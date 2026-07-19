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

Pulse is an internal, firewall-hosted web app (~500 employees) for two
related but distinct things:

1. **Feedback surveys** — one-off or periodic campaigns sent to a
   hand-picked list of recipients, either **anonymous** (structurally
   unlinkable to the respondent, not just hidden in the UI) or
   **attributed** (respondent identity visible to the survey's creator).
2. **1:1 check-ins** — recurring, always-attributed conversation aids
   between a leader and a specific report, run ad hoc as many times as
   needed, with trend charts showing how that person's answers change over
   time.

No external dependencies at runtime: no SMTP relay, no CDN, no third-party
APIs. Accounts are local (email + password), created by an Admin — there is
no self-registration and no "forgot password" self-service flow. The app
must be buildable and runnable behind a corporate TLS-inspecting proxy
(Zscaler).

## 2. Roles & permission model

Exactly three roles, no team hierarchy, no per-object ACLs beyond
owner/role:

- **USER** — everyone. Can answer surveys they're a recipient of, and
  complete 1:1 runs assigned to them.
- **LEADER** — everything a USER can do, plus: create/manage Surveys and
  1:1 templates, create/manage Groups, view dashboards/trends for things
  they created.
- **ADMIN** — everything a LEADER can do, plus: manage all user accounts
  (create, CSV-import, role changes, activate/deactivate, password resets).

There is **no cross-leader visibility** into another leader's surveys or
1:1s by default — the one deliberate exception is opt-in **public
templates** (§5.6, §6.5).

## 3. Anonymity architecture (the one thing that must not be fudged)

This is the product's core trust promise and it must be enforced
**structurally**, not just hidden in the UI:

- Anonymous survey answers live in tables (`AnonymousResponse`,
  `AnonymousAnswer`, `AnonymousAnswerOption`) that have **zero columns
  referencing a user** — there is no foreign key from an anonymous answer
  back to who wrote it, anywhere.
- A separate, backend-only table (`SurveyResponseAccess`) is the **sole**
  mechanism for "has this person already responded" / "let them find and
  edit their own response." It links `(surveyId, userId) → responseId` but
  is never read by any leader-facing or dashboard code path. Enforce this
  with an ESLint `no-restricted-imports` rule that blocks the
  dashboard/leader module from importing the repository module that owns
  this table — a code-review-proof guarantee, not just a convention.
- Attributed responses live in a **parallel, separate set of tables**
  (`AttributedResponse`, `AttributedAnswer`, `AttributedAnswerOption`) that
  do carry `respondentUserId` as a first-class column. Anonymous and
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
  Show a "results withheld, X of N needed" message instead.
- 1:1 check-ins are **always attributed** — never anonymous. They're a
  conversation aid between a specific leader and a specific report, not a
  feedback-collection mechanism, so there's no anonymity mode to offer.

## 4. Tech stack

- **Backend**: Node.js + TypeScript + Express, PostgreSQL via Prisma,
  server-side sessions (`express-session` + `connect-pg-simple`, not JWT).
- **Frontend**: React + TypeScript (Vite), plain CSS with custom
  properties (no CSS framework, no component library) — see §8 for the
  design system.
- **Passwords**: bcrypt (`bcryptjs`), no plaintext ever stored or logged.
- **Deployment**: Docker Compose, 3 services — `db` (postgres:16-alpine),
  `api` (Node backend), `web` (nginx serving the built frontend and
  reverse-proxying `/api/*` to `api`). No other services.
- **File uploads**: `multer` (CSV import only — keep on the actively
  maintained 2.x line; 1.x has known CVEs).

## 5. Data model

Prisma schema, PostgreSQL. All tables use UUID primary keys
(`@default(uuid())`) and snake_case column names via `@map`. Key models:

**`User`** — `id, name, email (unique), passwordHash, role (enum:
ADMIN|LEADER|USER, default USER), mustChangePassword (bool, default true),
isActive (bool, default true), lastLoginAt, createdAt, updatedAt`.

**`Group`** / **`GroupMember`** — org-wide shared recipient lists.
`Group(id, name, createdById, createdAt, updatedAt)`. `GroupMember(id,
groupId, userId, createdAt)` with `@@unique([groupId, userId])`. Any
Leader/Admin can create a group and any Leader/Admin can use any group
(not owner-restricted) when picking recipients — groups are a shared
utility, not private to their creator.

**`Survey`** — `id, title, description?, isAnonymous (bool, immutable
after publish), status (enum: DRAFT|PUBLISHED|CLOSED, default DRAFT),
createdById, createdAt, updatedAt, publishedAt?, closedAt?, endDate?,
isTemplate (bool, default false), isPublic (bool, default false)`.

**`Question`** — belongs to a `Survey`. `id, surveyId, position,
questionType (enum: RATING|TEXT|SINGLE_CHOICE|MULTI_CHOICE), prompt,
isRequired (default true), ratingScaleMin?, ratingScaleMax?, createdAt,
updatedAt`. `@@unique([surveyId, position])`. Has `QuestionOption[]` for
choice types (`id, questionId, position, label`,
`@@unique([questionId, position])`).

**`SurveyRecipient`** — `id, surveyId, userId, createdAt`,
`@@unique([surveyId, userId])`.

**Anonymous response path** (no user reference anywhere):
`AnonymousResponse(id, surveyId, submittedAt, updatedAt)` →
`AnonymousAnswer(id, responseId, questionId, ratingValue?, textValue?,
commentText?)` `@@unique([responseId, questionId])` →
`AnonymousAnswerOption(id, answerId, optionId)` for multi/single choice
selections.

**`SurveyResponseAccess`** (backend-only, never leader/dashboard-visible)
— `id, surveyId, userId, responseId (unique, FK to AnonymousResponse),
createdAt`, `@@unique([surveyId, userId])`.

**Attributed response path** (identity is a first-class column):
`AttributedResponse(id, surveyId, respondentUserId, submittedAt,
updatedAt)` `@@unique([surveyId, respondentUserId])` →
`AttributedAnswer(...)` (same shape as AnonymousAnswer) →
`AttributedAnswerOption(...)`.

**Admin/ops support**: `UserImportBatch(id, importedById, filename?,
totalRows, successCount, errorCount, createdAt)` → `UserImportRowError(id,
batchId, rowNumber, rawRow (json), message)`. `AuditLog(id, actorId?,
action, targetType, targetId?, metadata (json)?, createdAt)` — write on
every meaningful state-changing action (publish, close, unpublish, reopen,
duplicate, user created, password reset, etc.).

**One-on-Ones** (deliberately separate model tree from Survey — no shared
tables, so trend history and Survey's one-response/anonymity guarantees
can never interact):

- `OneOnOneTemplate(id, title, description?, createdById, isArchived
  (default false), isPublic (default false), createdAt, updatedAt)`.
- `OneOnOneQuestion` / `OneOnOneQuestionOption` — same shape as
  Question/QuestionOption, scoped to a template instead of a survey.
- `OneOnOneRecipient(id, templateId, userId, createdAt)`,
  `@@unique([templateId, userId])`.
- `OneOnOneRun(id, templateId, respondentUserId, initiatedById, status
  (enum: PENDING|COMPLETED, default PENDING), createdAt, submittedAt?)`.
  **Deliberately no unique constraint on `(templateId,
  respondentUserId)`** — the entire point of this model is that a leader
  can start many runs with the same person over time, and each run is a
  fully independent, immutable, one-shot submission (no post-submit
  editing, unlike Survey responses which can be updated while the survey
  stays open).
- `OneOnOneAnswer` / `OneOnOneAnswerOption` — same shape as the survey
  answer tables, scoped to a run.

## 6. Feature spec

### 6.1 Auth

- Email + password login, server-side session cookie.
- No self-registration. Accounts are created by an Admin (one at a time,
  or via CSV import — see §6.6).
- Every newly created/reset account has `mustChangePassword = true` and a
  random temporary password; on next login the user is forced to a
  "set a new password" screen (min 8 chars) before reaching anything else.
- No "forgot password" self-service — there's no SMTP relay, so a reset
  always goes through an Admin (§6.6), who hands the person a new temp
  password through whatever internal channel they use.

### 6.2 Survey lifecycle

Three statuses: `DRAFT → PUBLISHED → CLOSED`, plus the ability to go back:

- **DRAFT**: fully editable — title/description/anonymity/end-date,
  questions (add/edit/delete/reorder), recipients.
- **Publish** requires ≥1 question and ≥1 recipient. Blocked entirely if
  `isTemplate` is true (see §6.5).
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
- **Reopen**: brings a `CLOSED` survey back to `PUBLISHED`, optionally
  setting a new end date (old one is cleared by default so it doesn't
  immediately auto-close again).
- **Duplicate**: creates an independent `DRAFT` copy (title prefixed
  "Copy of…") with the same anonymity flag, questions, and recipients.
  Always owned by the acting user.
- Recipients can be added individually (searchable directory) or in bulk
  via a Group (§6.4). Removing someone who has already responded is
  blocked — their response stays valid and they stay on the recipient
  list.
- Respondents see their assigned surveys split into **Active** /
  **Closed** tabs. While a survey is open they can submit once and then
  keep updating their answer; once closed, no more edits.

### 6.3 Survey results dashboard

Available to the creator once published. Shows:

- Completion rate (responded / total recipients).
- Per rating question: distribution + average, plus any comments attached.
- Per choice question: tally per option, plus comments.
- Per text question: list of responses.
- For **attributed** surveys only: a respondents table (name, submitted
  time).
- For **anonymous** surveys: per-question results withheld below the
  minimum-response threshold (§3).

### 6.4 Groups

Shared org-wide (not per-leader). Any Leader/Admin can create a group,
rename it, manage its membership (same search-and-add picker used for
survey/1:1 recipients), delete it. Any Leader/Admin can use any group when
picking recipients for their own survey or 1:1 template — this is a shared
utility, not scoped to its creator.

### 6.5 Templates & cross-leader sharing (Survey + 1:1)

Both Survey and 1:1 templates support the same model:

- **Creating a template**: one checkbox on the normal creation form
  ("Save as a reusable template instead of a live survey/starting a live
  1:1"), not a separate flow. A template has questions and (for surveys)
  optionally pre-set recipients, but no publish/close/end-date lifecycle —
  those controls are hidden/inapplicable on a template.
- **Using a template**: "Start a survey" (Survey) duplicates it into an
  independent, live `DRAFT` survey with the template's questions/
  recipients pre-filled, ready to edit and publish. The template itself is
  untouched and reusable again. For 1:1s there's no "start" step — a 1:1
  template *is* directly usable once it has recipients (§6.7); "starting"
  only applies to converting someone else's *public* template into your
  own copy first (next bullet).
- **Public sharing**: a template owner can toggle `isPublic`. Other
  Leaders/Admins then see it (read-only) under their own Templates view,
  tagged "Public" with the owner's name. A non-owner can:
  - View it read-only (title, description, questions — no edit controls,
    no recipients/lifecycle section).
  - **Copy to my templates**: creates a brand-new template **owned by the
    copier**, with the questions duplicated over, free to edit however
    they like from that point.
  - (Survey only) **Start a survey** directly from someone else's public
    template, same duplicate-to-independent-live-copy mechanism as above.
  - **The critical rule**: a non-owner can *never* mutate the original in
    place. Every action available to them creates a new, independent
    row owned by *them*. The owner (or an Admin) is the only one who can
    ever edit the original's questions/recipients/public flag. This is
    why "fork someone else's template" and "start my own template" can
    share the exact same `duplicate` code path — both always set
    `createdById = actingUser.id` on the copy and reset `isPublic = false`
    on it (a copy always starts private).
  - Permission check for this: one function (e.g.
    `assertCanViewOrUseTemplate`) = owner-or-Admin **OR** (`isPublic` AND
    role is Leader/Admin). Use it **only** for read (`GET :id`) and
    duplicate/copy actions. Every mutating endpoint (update, question
    CRUD, recipients, publish/close/archive/public-toggle) keeps the
    strict owner-or-Admin-only check, completely unaffected by the public
    flag — public only ever grants read + copy, never edit-in-place.

### 6.6 Admin: user management

- **Single-user creation**: name, email, role → creates the account,
  returns a one-time temp password shown once in the UI (banner), same
  visual treatment as the CSV batch result.
- **CSV bulk import**: columns `name,email,role` (header row required;
  `role` optional, defaults to `USER`; accepted values `ADMIN`/`LEADER`/
  `USER`, case-insensitive). Returns per-row success/error counts and a
  downloadable CSV of generated temp passwords (shown once — there's no
  email relay to send it automatically). The import UI should show this
  exact format inline (example row + accepted values + a sample-CSV
  download) so Admins don't have to guess.
- **Manage existing users**: change role, activate/deactivate (blocks
  login without deleting history), reset password (generates a new temp
  password, forces `mustChangePassword`), search by name/email.

### 6.7 One-on-Ones

- A **template** defines the question set (persists across every run —
  this is what makes trend comparison meaningful). Created once, reused
  indefinitely.
- **Recipients**: the people a leader runs this template with, added via
  the same search/group picker as surveys. **A leader can never add
  themselves as a recipient of their own template** — enforce server-side
  (reject in the set/add-recipients endpoints, not just hide the UI
  option) since only the owner/Admin can call those endpoints anyway.
- **Running it**: from the template page, "Start new 1:1" next to a
  specific recipient creates one `OneOnOneRun` for that person, ad hoc,
  as many times as wanted, whenever the leader wants. This shows up in the
  recipient's "Assigned to me" list as a to-do item.
- **Taking a run**: same question-type UI as surveys, but **one-shot** —
  once submitted, the run is locked and can never be edited. If the leader
  wants to check in again, they start a fresh run.
- **Trends**: once a specific recipient has ≥1 completed run, a "View
  trend" link shows their answers across every run — Rating questions as
  a connected line chart (SVG polyline, one point per run, x-axis =
  submission date, y-axis scaled to the question's min/max), Text/Choice
  questions as a chronological list. Build this as a self-contained inline
  SVG component, no chart library — keeps the app dependency-free and
  works fine for this data volume.
- **Archive**: hide a template you're not using without deleting its
  history; unarchive to bring it back.
- Public sharing: identical model to survey templates (§6.5); the fork
  action **never copies recipients** (a forked template belongs to a
  different leader's own reports, so it always starts empty).

## 7. Non-functional requirements

- **Enterprise/Zscaler build support**: any place the build process does
  `npm install` or `apk add` needs to trust the org's TLS-inspecting proxy
  root CA. Provide a gitignored `certs/` directory in both `backend/` and
  `frontend/`; both Dockerfiles should `apk add --no-cache ca-certificates
  openssl` (⚠️ `node:20-alpine` does **not** ship `ca-certificates` by
  default — this is a real, easy-to-hit build failure, not a
  hypothetical), then `update-ca-certificates` + set `NODE_EXTRA_CA_CERTS`
  if anything was dropped in `certs/`. Silent no-op if the directory is
  empty, so it's always safe to leave wired up. Once built, the running
  containers make zero outbound internet calls, so Zscaler only matters at
  build time, not runtime.
- **Security/dependency hygiene**: keep production dependencies free of
  known-vulnerable packages (verify with `npm audit --omit=dev`
  periodically) — this app runs inside a corporate network and any
  supply-chain issue is a real incident, not a lint warning. `multer` in
  particular must stay on the 2.x line (1.x has known CVEs).
- **Cookie security**: `COOKIE_SECURE` must genuinely gate on TLS being
  terminated in front of the app — a naive `z.coerce.boolean()` on an env
  var is a real bug (`Boolean("false") === true` in JS), so parse it as an
  explicit `'true'|'false'` enum and transform, not a coercion.
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
everything), role-gated per route (`requireRole('LEADER','ADMIN')` etc.):

- `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`,
  `POST /auth/change-password`.
- `GET/POST /admin/users`, `PATCH/POST /admin/users/:id[/reset-password]`,
  `POST /admin/users/import`.
- `GET /users/directory` (search, for recipient pickers).
- `GET/POST /groups`, `GET/PATCH/DELETE /groups/:id`.
- `POST /surveys`, `GET /surveys?scope=created|targeted|all|public`,
  `GET/PATCH/DELETE /surveys/:id`, `POST /surveys/:id/{publish,close,
  unpublish,reopen,duplicate}`, question CRUD + reorder under
  `/surveys/:id/questions`, recipient CRUD under `/surveys/:id/recipients`.
- `GET /surveys/:id/dashboard` (or equivalent) → anonymity-aware summary
  DTO as described in §6.3.
- `POST /responses/:surveyId` (submit), `PATCH` (edit while open),
  `GET /responses/:surveyId/take` (survey + question payload + "have I
  already responded" + my existing answers if editing).
- `POST /one-on-ones`, `GET /one-on-ones?scope=created|all|public`,
  `GET/PATCH/DELETE /one-on-ones/:id`, `POST /one-on-ones/:id/duplicate`,
  question CRUD under `/one-on-ones/:id/questions`, recipient CRUD under
  `/one-on-ones/:id/recipients` (with the self-recipient block, §6.7),
  `POST /one-on-ones/:id/runs` (start), `GET /one-on-ones/:id/runs`,
  `GET /one-on-ones/:id/trend/:userId`.
- `GET /one-on-ones/runs/mine`, `GET /one-on-ones/runs/:runId/take`,
  `POST /one-on-ones/runs/:runId/responses` (one-shot submit).

## 10. Explicitly out of scope

- No email/SMTP anything (invites, notifications, password resets) — by
  design, for firewall-only deployability.
- No dark mode.
- No team/manager hierarchy or per-object custom ACLs beyond the
  role/owner/public model in §2 and §6.5.
- No mobile app — responsive web only.
- No self-registration or SSO/OAuth.

---

*This spec was extracted from a working implementation. If details here
and an existing codebase ever disagree, prefer this document for
**intent** (what the system should do and why) but verify exact field
names/routes against the running code before relying on them — code drifts
faster than docs.*
