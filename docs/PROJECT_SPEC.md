# Pulse — Project Specification

A complete build spec for recreating **Pulse** from scratch. This is the
single file to hand to a fresh agent/session (Fable, Claude Cowork, or any
other builder) — it captures the product requirements, data model, business
rules, and the non-obvious design decisions that were made along the way, so
a rebuild doesn't have to re-derive them.

If the target environment can also see the live repo, point it there too —
but this file is the one that explains **why**, which the code alone won't.

---

## 1. Product summary

Pulse is a self-hosted web app for two related but distinct things:

1. **Feedback surveys** — one-off or periodic campaigns sent to a
   hand-picked list of recipients, either **anonymous** (structurally
   unlinkable to the respondent, not just hidden in the UI) or
   **attributed** (respondent identity visible to the survey's creator).
2. **1:1 check-ins** — recurring, always-attributed conversation aids
   between a creator and a specific report, run ad hoc as many times as
   needed, with trend charts showing how that person's answers change over
   time.

No external dependencies at runtime: no SMTP relay, no CDN, no third-party
APIs. Accounts are local (email + password), created by an Admin — there is
no self-registration and no "forgot password" self-service flow. The app
must be buildable and runnable behind a corporate TLS-inspecting proxy.

## 2. Roles & permission model

Four roles, no team hierarchy, no per-object ACLs beyond owner/role — plus
one narrow, explicit, per-survey exception (Viewer, see below):

- **MEMBER** — everyone. Can answer surveys they're a recipient of, and
  complete 1:1 runs assigned to them.
- **CREATOR** — everything a MEMBER can do, plus: create/manage Surveys and
  1:1 templates, create/manage Circles, view dashboards/trends for things
  they created.
- **AUDITOR** — everything a CREATOR can do for their own content
  (identical capability, just a different role value — ownership checks are
  role-agnostic besides ADMIN), plus **read-only** compliance oversight of
  every survey/1:1 created by any member of their own **Group** (§5), based
  on the *creator's* Group, never the recipients'. Can also grant/revoke a
  narrow, per-survey **Viewer** exception (see below) to any member/creator,
  inside or outside their own Group.
- **ADMIN** — everything an AUDITOR can do, org-wide (not scoped to a single
  Group), plus: manage all member accounts (create, CSV-import, role/Group
  changes, activate/deactivate, password resets) and manage Groups
  themselves.

There is **no cross-creator visibility** into another creator's surveys or
1:1s by default, with two deliberate, narrow exceptions:

- opt-in **public templates** (§6.7);
- an **Auditor**'s Group-scoped oversight (§6.6), plus their ability to
  grant one specific person a **Viewer** exception on one specific survey
  (never 1:1s), regardless of Group.

## 3. Anonymity architecture (the one thing that must not be fudged)

This is the product's core trust promise and it must be enforced
**structurally**, not just hidden in the UI:

- Anonymous survey answers live in tables (`AnonymousResponse`,
  `AnonymousAnswer`, `AnonymousAnswerOption`) that have **zero columns
  referencing a member** — there is no foreign key from an anonymous answer
  back to who wrote it, anywhere.
- A separate, backend-only table (`SurveyResponseAccess`) is the **sole**
  mechanism for "has this person already responded" / "let them find their
  own response." It links `(surveyId, memberId) → responseId` but is never
  read by any creator-facing or dashboard code path. Enforce this with an
  ESLint `no-restricted-imports` rule that blocks the dashboard/creator
  module from importing the repository module that owns this table — a
  code-review-proof guarantee, not just a convention.
- Attributed responses live in a **parallel, separate set of tables**
  (`AttributedResponse`, `AttributedAnswer`, `AttributedAnswerOption`) that
  do carry `respondentMemberId` as a first-class column. Anonymous and
  attributed responses are never unioned or joined together.
- Once a survey has been published even once (`publishedAt != null`), its
  anonymous/attributed flag is **locked forever**, regardless of current
  status (draft/published/closed) — respondents relied on that promise the
  first time it went out.
- Dashboards for anonymous surveys **withhold per-question results**
  (distribution, tallies, comments) until at least `N` responses have come
  in (`MIN_ANONYMOUS_RESPONSES_FOR_BREAKDOWN`, default 3, env-configurable)
  — otherwise a small group's results could re-identify a respondent by
  elimination (e.g. "only one person could have picked that combination").
  Show a "results withheld, X of N needed" message instead. This applies
  identically no matter who's viewing — creator, Auditor, Viewer, or Admin
  all go through the exact same aggregation function, so there is no role
  that bypasses the threshold or the identity-stripping.
- 1:1 check-ins are **always attributed** — never anonymous. They're a
  conversation aid between a specific creator and a specific report, not a
  feedback-collection mechanism, so there's no anonymity mode to offer.

## 4. Tech stack

- **Backend**: Node.js + TypeScript + Express, PostgreSQL via Prisma,
  server-side sessions (`express-session` + `connect-pg-simple`, not JWT).
- **Frontend**: React + TypeScript (Vite), plain CSS with custom
  properties (no CSS framework, no component library) — see §8 for the
  design system.
- **Passwords**: bcrypt (`bcryptjs`), no plaintext ever stored or logged.
- **Deployment**: Docker Compose, 3 services — `db` (postgres:16-alpine),
  `api` (Node backend, served through nginx via `express.set('trust proxy',
  1)` so `express-rate-limit` correctly reads nginx's `X-Forwarded-For`),
  `web` (nginx serving the built frontend and reverse-proxying `/api/*` to
  `api`). No other services.
- **File uploads**: `multer` (CSV import only — keep on the actively
  maintained 2.x line; 1.x has known CVEs).

## 5. Data model

Prisma schema, PostgreSQL. All tables use UUID primary keys
(`@default(uuid())`) and snake_case column names via `@map`. Key models:

**`Member`** — `id, name, email (unique), passwordHash, role (enum:
ADMIN|CREATOR|AUDITOR|MEMBER, default MEMBER), groupId (FK to Group),
mustChangePassword (bool, default true), isActive (bool, default true),
lastLoginAt, createdAt, updatedAt`.

**`Group`** — org teams, distinct from Circle below. `id, name (unique),
isDefault (bool, default false), createdAt, updatedAt`. Every Member has
exactly one `groupId` — a scalar FK, not a join table, so "one Group at a
time" is structural rather than application-enforced. Seed exactly one
Group with `isDefault = true` (e.g. "common") as the fallback for member
creation when no Group is specified; it can never be deleted, and any other
Group can only be deleted once it has zero members (reassign them first). A
Group's only purpose is scoping the Auditor role (§2) — it is otherwise
invisible to Creators/Members and has nothing to do with Circles.

**`Circle`** / **`CircleMember`** — org-wide, ad-hoc, shareable recipient
lists (a Circle can freely mix members from any Group — this is
deliberate). `Circle(id, name, createdById, createdAt, updatedAt)`.
`CircleMember(id, circleId, memberId, createdAt)` with
`@@unique([circleId, memberId])`. Any Creator/Auditor/Admin can create a
circle and any of them can use any circle (not owner-restricted) when
picking recipients — circles are a shared utility, not private to their
creator. A member can belong to any number of circles simultaneously.

**`Survey`** — `id, title, description?, isAnonymous (bool, immutable
after publish), status (enum: DRAFT|PUBLISHED|CLOSED, default DRAFT),
createdById, createdAt, updatedAt, publishedAt?, closedAt?, endDate?,
isTemplate (bool, default false), isPublic (bool, default false)`.
`@@unique([createdById, title])` — a creator can never have two
surveys/templates sharing a title.

**`SurveyBlock`** — a survey is `WELCOME` → N named `QUESTIONS` blocks →
`END`. Welcome/End are created once and always present, never added or
removed; only `QUESTIONS` blocks are freely added/renamed/reordered/
deleted. `id, surveyId, position, blockType (enum: WELCOME|QUESTIONS|END),
name?, title?, body?, createdAt, updatedAt`, `@@unique([surveyId, position])`.

**`Question`** — belongs to a `SurveyBlock`. `id, surveyId, blockId,
position, questionType (enum: RATING|TEXT|SINGLE_CHOICE|MULTI_CHOICE),
prompt, isRequired (default true), ratingScaleMin?, ratingScaleMax?,
maxChoices (int, default 1), createdAt, updatedAt`. `@@unique([blockId,
position])`. Has `QuestionOption[]` for choice types (`id, questionId,
position, label`, `@@unique([questionId, position])`). `SINGLE_CHOICE` is
legacy-only — the builder only ever writes `MULTI_CHOICE` going forward, and
single-vs-multi selection behavior is driven entirely by `maxChoices`
(1 = pick exactly one) rather than the type string; kept in the enum rather
than dropped since Postgres can't cheaply remove an enum value.

**`SurveyRecipient`** — `id, surveyId, memberId, resubmitAllowed (bool,
default false), createdAt`, `@@unique([surveyId, memberId])`.
`resubmitAllowed` is a one-time grant set by the creator to let one
recipient who already responded submit exactly once more (a respondent
otherwise can never edit or resubmit once they've responded); it resets to
`false` the moment they use it.

**Anonymous response path** (no member reference anywhere):
`AnonymousResponse(id, surveyId, submittedAt, updatedAt)` →
`AnonymousAnswer(id, responseId, questionId, ratingValue?, textValue?,
commentText?)` `@@unique([responseId, questionId])` →
`AnonymousAnswerOption(id, answerId, optionId)` for multi/single choice
selections.

**`SurveyResponseAccess`** (backend-only, never creator/dashboard-visible)
— `id, surveyId, memberId, responseId (unique, FK to AnonymousResponse),
createdAt`, `@@unique([surveyId, memberId])`.

**Attributed response path** (identity is a first-class column):
`AttributedResponse(id, surveyId, respondentMemberId, submittedAt,
updatedAt)` `@@unique([surveyId, respondentMemberId])` →
`AttributedAnswer(...)` (same shape as AnonymousAnswer) →
`AttributedAnswerOption(...)`.

**`SurveyViewer`** — the narrow, per-survey exception an Auditor (of that
survey's own Group) or an Admin can grant. `id, surveyId, memberId,
grantedById, createdAt`, `@@unique([surveyId, memberId])`. Applies at any
survey status. Surveys only — deliberately no 1:1 equivalent.

**Admin/ops support**: `MemberImportBatch(id, importedById, filename?,
totalRows, successCount, errorCount, createdAt)` → `MemberImportRowError(id,
batchId, rowNumber, rawRow (json), message)`. `AuditLog(id, actorId?,
action, targetType, targetId?, metadata (json)?, createdAt)` — write on
every meaningful state-changing action (publish, close, unpublish, reopen,
duplicate, member created, role/Group changed, password reset, Group
created/renamed/deleted, survey Viewer granted/revoked, etc.).

**One-on-Ones** (deliberately separate model tree from Survey — no shared
tables, so trend history and Survey's one-response/anonymity guarantees can
never interact):

- `OneOnOneTemplate(id, title, description?, createdById, isArchived
  (default false), isPublic (default false), isTemplate (default true),
  status (enum: DRAFT|PUBLISHED), createdAt, updatedAt)`.
  `@@unique([createdById, title])`.
- `OneOnOneBlock` / `OneOnOneQuestion` / `OneOnOneQuestionOption` — same
  Welcome/Questions/End block shape as Survey, scoped to a template
  instead.
- `OneOnOneRecipient(id, templateId, memberId, createdAt)`,
  `@@unique([templateId, memberId])`.
- `OneOnOneRun(id, templateId, respondentMemberId, initiatedById, status
  (enum: PENDING|COMPLETED, default PENDING), createdAt, submittedAt?)`.
  **Deliberately no unique constraint on `(templateId,
  respondentMemberId)`** — the entire point of this model is that a
  creator can start many runs with the same person over time, and each run
  is a fully independent, immutable, one-shot submission (no post-submit
  editing at all, unlike Survey responses which can be resubmitted once via
  the `resubmitAllowed` grant above).
- `OneOnOneAnswer` / `OneOnOneAnswerOption` — same shape as the survey
  answer tables, scoped to a run.

## 6. Feature spec

### 6.1 Auth

- Email + password login, server-side session cookie.
- No self-registration. Accounts are created by an Admin (one at a time,
  or via CSV import — see §6.8).
- Every newly created/reset account has `mustChangePassword = true` and a
  random temporary password; on next login the member is forced to a
  "set a new password" screen (min 8 chars) before reaching anything else.
- No "forgot password" self-service — there's no SMTP relay, so a reset
  always goes through an Admin (§6.8), who hands the person a new temp
  password through whatever internal channel they use.

### 6.2 Survey lifecycle

Three statuses: `DRAFT → PUBLISHED → CLOSED`, plus the ability to go back:

- **DRAFT**: fully editable — title/description/anonymity/end-date,
  questions (add/edit/delete/reorder, grouped into blocks), recipients.
- **Publish** requires ≥1 question and ≥1 recipient. Blocked entirely if
  `isTemplate` is true (see §6.7).
- **PUBLISHED**: visible to recipients, accepting responses. Structural
  edits (questions, recipients) are locked.
- **Unpublish to edit**: takes a `PUBLISHED` or `CLOSED` survey back to
  `DRAFT` so it can be edited, then republished. This is the *only* path
  to editing a live survey — there's no separate "patch a published
  survey" capability. The anonymity flag stays locked regardless (keyed
  off `publishedAt != null`, not current status).
- **Answer-existence guards**: once a question has ≥1 answer, its
  `questionType` and `options` can never change and it can't be deleted
  (prompt/required/rating-scale-bounds can still be edited). This applies
  identically to Survey questions and 1:1 questions, and protects both
  in-flight response integrity and historical trend data.
- **Close**: manually closes a `PUBLISHED` survey.
- **End date** (optional): when set, the survey auto-closes the next time
  anything touches it past that date — implement as a single choke-point
  function (e.g. `ensureNotPastEndDate`) called from the survey-loading
  path used by every route, so every code path gets the lazy check for
  free without scattering date checks everywhere.
- **Reopen** (survey-level): brings a `CLOSED` survey back to `PUBLISHED`,
  optionally setting a new end date (old one is cleared by default so it
  doesn't immediately auto-close again).
- **Reopen for one recipient**: separate from the above — a respondent can
  never edit or resubmit once they've responded, except that the creator
  can grant one specific recipient a single further submission
  (`SurveyRecipient.resubmitAllowed`), consumed the moment they use it.
  Anonymous surveys can't use this (there's no way to single out one
  respondent without undercutting the anonymity guarantee).
- **Duplicate**: creates an independent `DRAFT` copy (title prefixed
  "Copy of…") with the same anonymity flag, questions, and recipients.
  Always owned by the acting member.
- Recipients can be added individually (searchable directory) or in bulk
  via a Circle (§6.4). Removing someone who has already responded is
  blocked — their response stays valid and they stay on the recipient
  list.
- Respondents see their assigned surveys split into **Pending** /
  **Completed** / **Closed** tabs. Once submitted, a response is locked —
  no more editing unless the creator grants the one-time reopen above.

### 6.3 Survey results dashboard

Available at `GET /surveys/:id/dashboard` to: the creator once published;
an Auditor whose own Group matches the creator's Group, at any status; a
member holding an explicit `SurveyViewer` grant; or an Admin, always. Shows:

- Completion rate (responded / total recipients).
- Per rating question: distribution + average, plus any comments attached.
- Per choice question: tally per option, plus comments.
- Per text question: list of responses.
- For **attributed** surveys only: a respondents table (name, submitted
  time).
- For **anonymous** surveys: per-question results withheld below the
  minimum-response threshold (§3), identically for every viewer role.
- An Auditor or Admin additionally gets a **Manage viewers** panel on this
  page to grant/revoke the `SurveyViewer` exception (§6.6).

### 6.4 Circles

Shared org-wide (not per-creator), ad-hoc recipient lists — distinct from
Group (§6.5). Any Creator/Auditor/Admin can create a circle, rename it,
manage its membership (same search-and-add picker used for survey/1:1
recipients), delete it. Any Creator/Auditor/Admin can use any circle when
picking recipients for their own survey or 1:1 template — this is a shared
utility, not scoped to its creator. A circle can freely mix members from
different Groups, and a member can belong to many circles at once. Adding a
circle to a survey/1:1's recipients copies its current members in as
individual recipients at that moment — it's a one-time copy, not a live
link, so a later change to the circle never retroactively affects a survey
already sent.

### 6.5 Groups (org teams)

Not to be confused with Circles above — a Group is a real org team, and
every member belongs to exactly one. Its sole purpose is scoping the
Auditor role (§6.6). Admin-only CRUD (list with member counts, create,
rename, delete); a Group can't be deleted while it has members, and the
seeded default Group can never be deleted. A member's Group is assigned and
changed from the same Admin member-management screen used for their role
(§6.8) — there's no separate "Group membership" concept beyond that one
scalar field.

### 6.6 Auditor role & Viewer grants

An Auditor has two independent capabilities:

1. **Full Creator capability over their own content.** Creating, editing,
   publishing, deleting, and managing recipients on a survey/1:1 they
   personally created works identically to a Creator — this is an
   ownership check (`createdById === actingMember.id`), not a role check,
   so it naturally applies to an Auditor exactly like a Creator once the
   route-level role gate admits them.
2. **Read-only, Group-scoped oversight of everyone else's content.** An
   Auditor can view (never edit) every survey's dashboard and every 1:1
   template/run/trend created by any member of their own Group — based on
   the **creator's** Group, never the recipients'. Exposed via an
   **Audit** scope/tab on the Surveys and One-on-Ones list pages. This
   check requires one extra join (member → their Group) beyond the usual
   owner-or-Admin check, expressed as its own assertion function
   (`assertCanViewSurveyDashboard` / `assertCanViewTemplateDetail` /
   `assertCanAuditTemplate` in the reference implementation) — kept
   deliberately separate from the owner/Admin-only functions used by every
   mutating endpoint, so widening read access can never accidentally widen
   write access.

An Auditor (of a survey's own Group) or an Admin can additionally grant a
**Viewer** exception: one specific member/creator, inside or outside the
Auditor's Group, gets access to one specific survey's dashboard only —
never edit access, never 1:1 access. Grant/revoke works at any survey
status and is fully independent of Group membership on either side (the
granter must be authorized via their own Group or Admin status; the grantee
can be anyone). The survey's own creator can never grant or revoke this
themselves.

### 6.7 Templates & cross-creator sharing (Survey + 1:1)

Both Survey and 1:1 templates support the same model:

- **Creating a template**: one checkbox on the normal creation form
  ("Save as a reusable template instead of a live survey/starting a live
  1:1"), not a separate flow. A template has questions and (for surveys)
  optionally pre-set recipients, but no publish/close/end-date lifecycle —
  those controls are hidden/inapplicable on a template.
- **Using a template**: "Use a template" (Survey) duplicates it into an
  independent, live `DRAFT` survey with the template's questions/
  recipients pre-filled, ready to edit and publish. The template itself is
  untouched and reusable again. For 1:1s there's no separate "start" step
  for your own template — a 1:1 template *is* directly usable once it has
  recipients (§6.9); "starting" only applies to converting someone else's
  *public* template into your own copy first (next bullet).
- **Public sharing**: a template owner can toggle `isPublic`. Other
  Creators/Auditors/Admins then see it (read-only) under their own
  Templates view, tagged "Public" with the owner's name. A non-owner can:
  - View it read-only (title, description, questions — no edit controls,
    no recipients/lifecycle section).
  - **Copy to my templates**: creates a brand-new template **owned by the
    copier**, with the questions duplicated over, free to edit however
    they like from that point.
  - (Survey only) **Use a template** directly from someone else's public
    template, same duplicate-to-independent-live-copy mechanism as above.
  - **The critical rule**: a non-owner can *never* mutate the original in
    place. Every action available to them creates a new, independent
    row owned by *them*. The owner (or an Admin) is the only one who can
    ever edit the original's questions/recipients/public flag. This is
    why "fork someone else's template" and "start my own template" can
    share the exact same `duplicate` code path — both always set
    `createdById = actingMember.id` on the copy and reset `isPublic =
    false` on it (a copy always starts private).
  - Permission check for this: one function (e.g.
    `assertCanViewOrUseTemplate`) = owner-or-Admin **OR** (`isPublic` AND
    role is Creator/Auditor/Admin). Use it **only** for read (`GET :id`)
    and duplicate/copy actions. Every mutating endpoint (update, question
    CRUD, recipients, publish/close/archive/public-toggle) keeps the
    strict owner-or-Admin-only check, completely unaffected by the public
    flag — public only ever grants read + copy, never edit-in-place. This
    is a deliberately **separate** function from the Auditor's group-scoped
    read access (§6.6) — an Auditor gets an *additional* branch for their
    own Group, layered on top of this one, never merged into it (merging
    them would let an Auditor duplicate/fork a survey they only have audit
    access to, which is out of scope).

### 6.8 Admin: member & Group management

- **Single-member creation**: name, email, role, Group (optional, defaults
  to the org's default Group) → creates the account, returns a one-time
  temp password shown once in the UI (banner), same visual treatment as
  the CSV batch result.
- **CSV bulk import**: columns `name,email,role,group` (header row
  required; `role` optional, defaults to `MEMBER`; accepted values
  `ADMIN`/`CREATOR`/`AUDITOR`/`MEMBER`, case-insensitive; `group` optional,
  defaults to the org's default Group, must match an existing Group's name
  case-insensitively or that row is rejected). Returns per-row
  success/error counts and a downloadable CSV of generated temp passwords
  (shown once — there's no email relay to send it automatically). The
  import UI should show this exact format inline (example row + accepted
  values + a sample-CSV download) so Admins don't have to guess.
- **Manage existing members**: change role, change Group (reassignment is
  instant — a member leaves their old Group the moment it's changed),
  activate/deactivate (blocks login without deleting history), reset
  password (generates a new temp password, forces
  `mustChangePassword`), search by name/email.
- **Groups CRUD**: separate admin screen (§6.5) — list with member counts,
  create, rename, delete (blocked while it has members, and for the
  default Group unconditionally).

### 6.9 One-on-Ones

- A **template** defines the question set (persists across every run —
  this is what makes trend comparison meaningful). Created once, reused
  indefinitely.
- **Recipients**: the people a creator runs this template with, added via
  the same search/circle picker as surveys. **A creator can never add
  themselves as a recipient of their own template** — enforce server-side
  (reject in the set/add-recipients endpoints, not just hide the UI
  option) since only the owner/Admin can call those endpoints anyway.
- **Running it**: from the template page, "Start new 1:1" next to a
  specific recipient creates one `OneOnOneRun` for that person, ad hoc, as
  many times as wanted, whenever the creator wants. This shows up in the
  recipient's "Assigned to me" list as a to-do item.
- **Taking a run**: same question-type UI as surveys, but **one-shot** —
  once submitted, the run is locked and can never be edited. If the
  creator wants to check in again, they start a fresh run.
- **Trends**: once a specific recipient has ≥1 completed run, a "View
  trend" link shows their answers across every run — Rating questions as
  a connected line chart (SVG polyline, one point per run, x-axis =
  submission date, y-axis scaled to the question's min/max), Text/Choice
  questions as a chronological list. Build this as a self-contained inline
  SVG component, no chart library — keeps the app dependency-free and
  works fine for this data volume. A recipient may also view their own
  trend without owning the template, but only once they have run history
  with it (can't be used to browse an arbitrary template's question list).
- **Archive**: hide a template you're not using without deleting its
  history; unarchive to bring it back.
- **Auditor oversight**: an Auditor sees a read-only version of every
  template/run/trend created within their own Group (§6.6) — no Viewer
  equivalent here, unlike surveys.
- Public sharing: identical model to survey templates (§6.7); the fork
  action **never copies recipients** (a forked template belongs to a
  different creator's own reports, so it always starts empty).

## 7. Non-functional requirements

- **Enterprise/TLS-inspecting-proxy build support**: any place the build
  process does `npm install` or `apk add` needs to trust the org's
  TLS-inspecting proxy root CA. Provide a gitignored `certs/` directory in
  both `backend/` and `frontend/`. Both Dockerfiles append anything
  dropped in `certs/` **directly into the base image's pre-installed CA
  bundle before the first `apk add` call** (not after) — `node:*-alpine`
  images already ship a working `/etc/ssl/certs/ca-certificates.crt`, but
  the very first `apk add ca-certificates openssl` still needs network
  access to Alpine's package CDN, so under TLS inspection it fails before
  `ca-certificates`/`update-ca-certificates` are even installed to fix it.
  Append-then-`apk add`-then-`update-ca-certificates`-properly is the
  correct order; doing `apk add` first is a real, easy-to-hit build
  failure behind a TLS-inspecting proxy, not a hypothetical. Silent no-op
  if `certs/` is empty, so it's always safe to leave wired up either way.
  Once built, the running containers make zero outbound internet calls, so
  the proxy only matters at build time, not runtime. Separately, pulling
  the base images themselves (`node:20-alpine`, `postgres:16-alpine`,
  `nginx:1.27-alpine`) from Docker Hub happens before any Dockerfile
  instruction runs at all, so that step needs the org's proxy trusted at
  the Docker daemon/OS level instead — on native Linux (Docker Engine) via
  a systemd drop-in (`/etc/systemd/system/docker.service.d/*.conf` with
  `HTTP_PROXY`/`HTTPS_PROXY`, then `daemon-reload` + restart), on
  Windows/Docker Desktop via its own proxy/WSL2 trust-store settings; this
  part can't be fixed from inside the repo.
- **Security/dependency hygiene**: keep production dependencies free of
  known-vulnerable packages (verify with `npm audit --omit=dev`
  periodically) — this app runs inside a corporate network and any
  supply-chain issue is a real incident, not a lint warning. `multer` in
  particular must stay on the 2.x line (1.x has known CVEs).
- **Cookie security**: `COOKIE_SECURE` must genuinely gate on TLS being
  terminated in front of the app — a naive `z.coerce.boolean()` on an env
  var is a real bug (`Boolean("false") === true` in JS), so parse it as an
  explicit `'true'|'false'` enum and transform, not a coercion.
- **Reverse-proxy awareness**: with nginx in front of the API (docker
  compose's `web` service proxies `/api/*` to `api`), Express must call
  `app.set('trust proxy', 1)` (exactly one hop) so `express-rate-limit`
  correctly reads the `X-Forwarded-For` header nginx sets, instead of
  erroring/misbehaving on every request — including login, which is easy
  to miss in local dev (where nginx usually isn't in the request path) and
  only surfaces once the full docker-compose stack is actually exercised.
- **Backups**: nightly `pg_dump` via cron to a local `./backups/` volume,
  plus a restore script. Do a restore drill (dump → tear down volume →
  restore → verify) before relying on it.

## 8. Design system

- **Palette**: "Clay & Stone" — warm terracotta/orange brand color
  (`--brand: #c2603f`, `--brand-strong: #a34d30`), off-white/stone
  neutrals for background and surface, no dark mode (light theme only,
  deliberately — this was an explicit product decision, not an oversight).
- Fixed semantic colors for anonymity badges, independent of the brand
  palette so they stay meaningful regardless of future re-theming:
  `--anon` / `--attributed` (distinct hues, each with a `-soft` background
  tint variant for badges).
- Plain CSS custom properties in one global stylesheet, no CSS framework,
  no component library — small enough app that this stays maintainable.
- **Logo**: a heartbeat/pulse waveform icon (circle + jagged line), used
  as `currentColor` so it inherits the brand-orange gradient badge
  treatment wherever it appears (nav bar, login page). Favicon is a static
  standalone version of the same mark, recolored to the brand gradient
  (favicons render with no page CSS context, so they can't use
  `currentColor`).
- **Login page**: split layout — a hero panel (logo mark, large "Pulse"
  wordmark, one-line tagline, 3 short feature bullets) beside the sign-in
  card. Hero panel collapses/hides below ~860px viewport width, sign-in
  card stays centered.
- Every button/link group in a shared row should live in **one** flex
  container (`display:flex; flex-wrap:wrap; gap`) rather than being split
  across adjacent `<section>`s that happen to render stacked — a purely
  cosmetic trap that's easy to fall into by organizing markup around
  "what the buttons do" instead of "how they should lay out."

## 9. Key API surface (for reference, not exhaustive)

REST-ish JSON API under `/api`, session-cookie auth
(`requireAuth` + `requirePasswordChanged` middleware on nearly
everything), role-gated per route (`requireRole('CREATOR','AUDITOR','ADMIN')`
etc. — Auditor is added to every Creator-capability gate, never to
Admin-only gates):

- `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`,
  `POST /auth/change-password`. Login/me responses key the account as
  `{ member: ... }`, not `{ user: ... }`.
- `GET/POST /admin/members`, `PATCH/POST /admin/members/:id[/reset-password]`,
  `POST /admin/members/import` — all Admin-only.
- `GET /members/directory` (search, for recipient pickers) — Creator/
  Auditor/Admin.
- `GET/POST /admin/groups`, `PATCH/DELETE /admin/groups/:id` — Admin-only.
- `GET/POST /circles`, `GET/PATCH/DELETE /circles/:id` — Creator/Auditor/
  Admin.
- `POST /surveys`, `GET /surveys?scope=created|targeted|all|public|audit|
  viewing` (`all` is Admin-only, `audit` is Auditor-only, `viewing` is
  anyone), `GET/PATCH/DELETE /surveys/:id`, `POST /surveys/:id/{publish,
  close,unpublish,reopen,duplicate}`, `PUT /surveys/:id/draft` (the builder's
  one Save action — title/description/anonymity/end date plus the entire
  block+question tree in a single transactional call; a block/question with
  no `id` is created, one present in the survey but missing from the payload
  is deleted, everything else is updated in place, and a question's `blockId`
  is simply whichever block it's nested under in the payload, which is what
  makes moving a question between blocks free — no separate move endpoint.
  Structural changes — type, options, or `maxChoices` — to a question that
  already has responses are rejected with `409 QUESTION_HAS_RESPONSES` before
  anything is written, leaving the whole draft untouched), recipient CRUD
  under `/surveys/:id/recipients`,
  `POST /surveys/:id/recipients/:memberId/reopen`.
- `GET/POST /surveys/:id/viewers`, `DELETE /surveys/:id/viewers/:memberId`
  — Auditor (of that survey's Group) or Admin only; enforced in the
  service layer, since a static route-level role allow-list can't express
  the "Auditor of *this* survey's Group" scoping.
- `GET /surveys/:id/dashboard` — no route-level role gate at all; access
  (owner, Admin, Auditor-of-Group, or explicit Viewer grant) is entirely a
  service-layer check, since the allowed set can't be expressed as a
  static role list either.
- `POST /surveys/:id/responses` (submit — locked after that, no PATCH; see
  the per-recipient reopen grant in §6.2 for the only way back in),
  `GET /surveys/:id/take` (survey + question payload + "have I already
  responded" + my existing answers if I have any).
- `POST /one-on-ones`, `GET /one-on-ones?scope=created|all|public|audit`,
  `GET/PATCH/DELETE /one-on-ones/:id`, `POST /one-on-ones/:id/duplicate`,
  `PUT /one-on-ones/:id/draft` (same one-Save-transaction shape as the
  survey draft endpoint above, minus anonymity/end date), recipient CRUD
  under `/one-on-ones/:id/recipients` (with the
  self-recipient block, §6.9), `POST /one-on-ones/:id/runs` (start),
  `GET /one-on-ones/:id/runs`, `GET /one-on-ones/:id/trend/:memberId` (no
  route-level role gate — a recipient may view their own trend; the
  service enforces that a non-owner/non-Auditor can only ever request
  their own `memberId`).
- `GET /one-on-ones/runs/mine`, `GET /one-on-ones/runs/:runId/take`,
  `POST /one-on-ones/runs/:runId/responses` (one-shot submit).

## 10. Explicitly out of scope

- No email/SMTP anything (invites, notifications, password resets) — by
  design, for firewall-only deployability.
- No dark mode.
- No cross-Group visibility beyond the Auditor role and explicit Viewer
  grants (§2, §6.6) — no broader team/manager hierarchy or per-object
  custom ACLs.
- No mobile app — responsive web only.
- No self-registration or SSO/OAuth.

---

*This spec was extracted from a working implementation. If details here
and an existing codebase ever disagree, prefer this document for
**intent** (what the system should do and why) but verify exact field
names/routes against the running code before relying on them — code drifts
faster than docs.*
