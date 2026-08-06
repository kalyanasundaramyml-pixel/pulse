# Pulse — User Manual

Pulse is the tool for running feedback surveys and recurring 1:1
check-ins. This manual covers everything you can do in the app, organized by
role: **Member** (everyone), **Creator**, **Auditor**, and **Admin**. Each
role's section builds on the ones before it — a Creator sees everything a
Member sees, an Auditor sees everything a Creator sees (plus their own
oversight tools), and an Admin sees everything.

---

## Contents

- [Getting started](#getting-started)
- [The anonymity promise](#the-anonymity-promise)
- [For everyone (Member)](#for-everyone-member)
  - [Answering a survey](#answering-a-survey)
  - [Doing a 1:1 check-in](#doing-a-11-check-in)
  - [Viewing a survey as a Viewer](#viewing-a-survey-as-a-viewer)
- [For Creators](#for-creators)
  - [Creating a survey](#creating-a-survey)
  - [Editing and the publish lifecycle](#editing-and-the-publish-lifecycle)
  - [Recipients and Circles](#recipients-and-circles)
  - [Duplicating a survey](#duplicating-a-survey)
  - [Survey templates](#survey-templates)
  - [Viewing survey results](#viewing-survey-results)
  - [Running 1:1s](#running-11s)
  - [1:1 templates and trends](#11-templates-and-trends)
  - [Sharing templates with other creators](#sharing-templates-with-other-creators)
- [For Auditors](#for-auditors)
  - [What your oversight covers](#what-your-oversight-covers)
  - [Reviewing surveys](#reviewing-surveys)
  - [Reviewing One-on-Ones](#reviewing-one-on-ones)
  - [Granting and revoking Viewer access](#granting-and-revoking-viewer-access)
- [For Admins](#for-admins)
  - [Groups: org teams](#groups-org-teams)
  - [Adding people](#adding-people)
  - [Managing existing members](#managing-existing-members)
  - [Everything a Creator (and Auditor) can do](#everything-a-creator-and-auditor-can-do)

---

## Getting started

1. Go to the Pulse URL your organization gave you and sign in with the email
   and temporary password your Admin provided.
2. On first login you'll be forced to **set a new password** (at least 8
   characters) before you can do anything else. Your temporary password only
   works once.
3. If you ever forget your password, ask your Admin to reset it — there's no
   self-service "forgot password" flow (Pulse has no email relay), so a
   reset always goes through an Admin, who will hand you a new temporary
   password the same way.
4. Once signed in, the top navigation bar shows **Surveys** and
   **One-on-Ones** for everyone. Creators and Auditors additionally see
   **Templates** and **Circles**; Auditors also get an **Audit** tab within
   Surveys and One-on-Ones; Admins additionally see **Admin** and **Groups**.

## The anonymity promise

Every survey is marked either **Anonymous** or **Attributed** by the creator
who creates it, and you'll see a badge telling you which one you're looking
at before you answer anything:

- **Anonymous** — your answers are never linked to your identity anywhere in
  the system, including for Admins and Auditors. Pulse enforces this at the
  database level, not just in the interface. To keep small groups from being
  de-anonymized by elimination, a dashboard withholds per-question results
  until enough people have responded (your Admin configures this minimum; a
  few responses at least).
- **Attributed** — your name is visible next to your answers to the creator
  who created the survey (and to their Auditor, or anyone granted Viewer
  access).

Once a survey has been published even once, its anonymous/attributed setting
is **locked forever** — a creator can't quietly flip an anonymous survey to
attributed after the fact.

1:1 check-ins are always attributed (never anonymous) — they're a
conversation aid between you and your creator, not a feedback-collection
mechanism.

---

## For everyone (Member)

### Answering a survey

1. Go to **Surveys** → **Assigned to me**. This lists every survey you've
   been added as a recipient for, split into **Pending**, **Completed**, and
   **Closed** tabs.
2. Click a survey to open it. You'll see its title, description, and the
   anonymous/attributed badge before any questions.
3. Answer each question. Question types you may see:
   - **Rating** — pick a number on a scale (e.g. 1–5), with an optional
     comment box.
   - **Text** — free-form written answer.
   - **Choice** — pick from a list of options. Each choice question sets its
     own limit on how many you can select (shown next to the question; "pick
     one" is common, but a creator can allow more), with an optional comment
     box.
   - Questions marked with `*` are required.
4. Click **Submit response**. Once submitted, your response is locked — you
   can't edit or resubmit it, unless the survey's creator specifically
   reopens it for you (a one-time grant for exactly one more submission).
5. If a survey is closed, it moves to the **Closed** tab and can no longer
   accept new answers, but it's still visible for reference.

### Doing a 1:1 check-in

1. Go to **One-on-Ones** → **Assigned to me**. This lists every 1:1 "run"
   your creator has started with you, tagged **To do** or **Completed**.
2. Open a **To do** item, answer the questions (same question types as
   surveys), and click **Submit**.
3. Unlike a survey, a 1:1 run is **one-shot** — once you submit, it's locked
   and can't be edited. If your creator wants to check in again, they'll
   start a new run, which shows up as a fresh "To do" item; your history of
   past runs is what lets them see how things trend over time.
4. Your 1:1 answers are always visible to the creator who runs the template
   with you — there's no anonymous option here.

### Viewing a survey as a Viewer

An Auditor can grant you **Viewer** access to one specific survey — this
lets you see its dashboard and results even though you didn't create it and
aren't its Auditor. Any survey you've been given Viewer access to shows up
under **Surveys → Viewing**. Viewer access can be granted or revoked at any
time by that Auditor (or an Admin), and it only ever applies to surveys,
never to 1:1s.

---

## For Creators

Everything below is available if your account has the **Creator** role (or
**Auditor**, who has full Creator capabilities over their own content on top
of their oversight tools — see [For Auditors](#for-auditors) — or **Admin**,
which includes Creator permissions everywhere).

### Creating a survey

1. Click **New survey** in the nav bar, then **Create fresh**.
2. Fill in a **Title** and optional **Description**.
3. Choose **Anonymous** or **Attributed**. Think about this up front —
   once you publish, it's locked for that survey.
4. Optionally set an **End date** — the survey auto-closes on that date
   without you having to do anything (see [Editing and the publish
   lifecycle](#editing-and-the-publish-lifecycle)).
5. Add questions with the question editor: choose a type, write the prompt,
   mark it required or not, and (for Rating) set the scale, or (for Choice)
   list the options and set **Max choices** — how many a respondent can pick
   (1 for "choose exactly one", or higher to allow multiple).
6. Go to **Manage recipients** and add the people who should receive the
   survey (see [Recipients and Circles](#recipients-and-circles)).
7. Click **Publish**. Publishing requires at least one question and at
   least one recipient.

### Working in the builder

Nothing you do in the survey/1:1 builder — editing details, adding or
deleting a block or question, reordering, moving a question to a different
block — is saved until you click **Save**. **Discard changes** throws away
everything since your last save and reloads it.

- Each question's move controls (chevron icons) reorder it up/down within
  its own block; the arrow-between-boxes icon next to them opens a small
  menu to move that question into a different block entirely.
- Deleting a block or question asks you to confirm first, so an accidental
  click next to the intended button (e.g. hitting delete instead of edit)
  doesn't lose your work.
- If you try to leave the page — clicking another nav link, using the
  browser's Back button, or closing the tab — while you have unsaved
  changes, you'll get a "leave without saving?" prompt first.

### Editing and the publish lifecycle

A survey moves through three statuses:

- **DRAFT** — fully editable: change details, add/edit/delete questions,
  change recipients.
- **PUBLISHED** — live and visible to recipients. Question/recipient edits
  are locked while published.
- **CLOSED** — no longer accepting responses; recipients see it under their
  **Closed** tab.

Even after publishing, you're not stuck:

- **Unpublish to edit** — takes a `PUBLISHED` or `CLOSED` survey back to
  `DRAFT` so you can change questions, details, or recipients, then
  **Publish** again when ready. The one thing this can never change is the
  anonymous/attributed flag, once the survey has ever been published.
- A question that already has at least one answer can't have its type,
  options, or max choices changed, and can't be deleted — this protects the
  integrity of responses already collected. You can still edit its prompt,
  required flag, or rating scale, and you can always move it to a different
  block.
- **Close** — manually closes a `PUBLISHED` survey.
- **End date** — set on the survey; once that date passes, the survey
  auto-closes the next time anyone touches it, no action needed from you.
- **Reopen** — brings a `CLOSED` survey back to `PUBLISHED`, with the option
  to set (or clear) a new end date. This is the survey-level reopen; a
  separate, per-recipient **Reopen** grant on the survey's edit page lets one
  specific person resubmit once after they've already responded.

### Recipients and Circles

- On a survey's **Manage recipients** page, search the directory
  by name or email and add people one at a time, or pick a **Circle** from
  the dropdown to add everyone in it at once.
- Removing someone who has already responded is blocked — their response
  stays valid and they stay on the list.
- **Circles** (nav → **Circles**) are shared org-wide, ad-hoc recipient
  lists — any Creator, Auditor, or Admin can create one, and any of them can
  use any circle when picking recipients for their own survey or 1:1
  template. A circle can freely mix members from different Groups (see
  [Groups: org teams](#groups-org-teams) — Groups and Circles are unrelated
  concepts). Manage a circle's membership from its **Manage** page, using
  the same search-and-add picker. Adding a circle to a survey copies its
  current members in as individual recipients at that moment — it isn't a
  live link, so changing the circle later doesn't retroactively change who's
  already on a survey you sent.

### Duplicating a survey

From any survey's edit page, click **Duplicate** to create an independent
`DRAFT` copy — same title (prefixed "Copy of"), description, anonymity
setting, questions, and recipients — that you can then edit freely without
touching the original.

### Survey templates

A template is a survey that's never meant to be published directly — it's a
reusable starting point.

- Create one via **Templates → Survey templates → + New template**, or by
  checking that option from the **New survey** menu.
- A template can have questions and even pre-set recipients (handy if you
  run the same survey to the same audience periodically), but it has no
  publish/close/end-date controls — those don't apply to a template.
- Find your templates under **Templates → Survey templates**.
- Go to **Surveys → New survey → Use a template** and click a template to
  create an independent, live `DRAFT` survey with its questions and
  recipients pre-filled — edit anything you like, then publish it as
  normal. The template itself is untouched and can be reused again next
  time.

### Viewing survey results

From a survey's edit page, click **View dashboard** (available once
published):

- **Completion rate** — how many recipients have responded, out of the
  total.
- **Rating questions** show a distribution chart and average.
- **Choice questions** show a tally per option.
- **Text questions** show the list of responses.
- Any question with a comment box shows those comments alongside the main
  chart.
- For **Attributed** surveys, you also see a **Respondents** table with
  names and submission times.
- For **Anonymous** surveys, per-question results are automatically
  withheld until enough people have responded (to stop you from
  reverse-engineering who said what in a small group) — you'll see a note
  telling you how many more responses are needed.
- Your group's Auditor can also see this dashboard, for compliance
  oversight, and can grant a specific member or creator Viewer access to
  this one survey — you aren't asked and can't grant this yourself.

### Running 1:1s

1. Click **New One-on-One**, give it a title and description, and add
   questions the same way you would for a survey (these stay the same
   across every run, which is what makes trends comparable).
2. Go to **Manage recipients** and add the people you have 1:1s with. You
   can never add yourself as a recipient of your own template.
3. Click **Initiate one-on-one** once you have at least one question and one
   recipient.
4. From the template page, click **Start new 1:1** next to a recipient's
   name whenever you're ready to run a check-in with them — this creates a
   fresh "run" that shows up in their **Assigned to me** list. You can do
   this as often as you like, ad hoc, for the same person.
5. Once they've completed at least one run, a **View trend** link appears
   next to their name.

### 1:1 templates and trends

- Editing a question that already has answers is limited the same way as
  surveys (can't change its type, options, or max choices once it has
  responses), to keep historical trend data meaningful.
- **Archive** a template you're not actively using anymore (it stays around
  for history but is tucked out of the way); **Unarchive** to bring it
  back.
- The **trend** page for a specific person plots their **Rating** answers
  over time as a line chart, and lists their **Text**/**Choice** answers
  chronologically underneath, so you can see how someone's answers have
  moved across multiple check-ins.

### Sharing templates with other creators

Both survey templates and 1:1 templates support an optional **public**
flag, for sharing good templates across the team without giving up control
of your original:

- On a template you own, click **Make public**. Other Creators (and
  Auditors) will now see it under their own **Templates** tab, tagged
  **Public** with your name on it. **Make private** reverses this any time.
- Other Creators can view a public template read-only (they can't edit its
  questions, recipients, or the public flag) and take one of two actions:
  - **Initiate a one-on-one** / for surveys, **Use a template** — creates
    their own independent, live item from your template, with their own
    recipients.
  - **Copy to my templates** — creates a brand-new template owned by
    *them*, with your questions copied over, that they're free to edit
    however they like.
- **Your original template is never changed by anyone else.** Any
  customization by another Creator always creates their own separate copy —
  editing in place is only ever available to the owner (or an Admin).

---

## For Auditors

The Auditor role has two independent parts: full **Creator** capabilities
over your own surveys and 1:1s (everything in the [For
Creators](#for-creators) section above works the same for you), plus
read-only compliance oversight of everyone else's content within your own
**Group**.

### What your oversight covers

Your access is based on the **creator's** Group, never the recipients'. If
someone in your Group creates a survey and sends it to a circle spanning
several Groups, you can see it. A survey created by someone outside your
Group is invisible to you by default, no matter who it was sent to — unless
that specific person is separately given Viewer access (surveys only; see
below).

### Reviewing surveys

Under **Surveys → Audit**, you'll see every survey created within your
Group, at any status (draft, published, or closed). Open one to go straight
to its dashboard — the same results view its creator sees, including every
question's prompt and results. Anonymous surveys stay anonymous even to
you: the same withholding threshold and identity-stripping apply exactly as
they do for the creator.

### Reviewing One-on-Ones

Under **One-on-Ones → Audit**, you'll see every 1:1 template and live 1:1
created within your Group. Opening one shows a read-only version of its
questions and recipients — for anyone with two or more completed runs,
**View trend** shows how their answers changed over time, the same as the
creator sees it.

### Granting and revoking Viewer access

From a survey's dashboard, the **Manage viewers** panel lets you grant a
specific member or creator — inside or outside your Group — a narrow
exception to see that one survey's dashboard, even though they aren't its
Auditor. Search for them by name or email and click **Grant viewer**. They'll
then find it under their own **Surveys → Viewing** tab.

You can revoke it again at any time from the same panel. Viewer access can
be granted or revoked regardless of the survey's status, and it only ever
applies to surveys — there's no Viewer equivalent for 1:1s. The survey's own
creator can never grant or revoke this themselves; only an Auditor of that
survey's Group, or an Admin, can.

---

## For Admins

Admin accounts automatically have every Creator and Auditor capability
described above (org-wide, not just their own Group), plus member and Group
management under the **Admin** and **Groups** nav links.

### Groups: org teams

A **Group** represents a real team in your org — distinct from a Circle,
which is just an ad-hoc, shareable recipient list. Every member belongs to
exactly **one** Group at a time. Its only real purpose is scoping the
Auditor role: an Auditor's oversight covers everything created by members of
their own Group, and nothing else.

- Manage Groups under **Groups** — create, rename, or delete them.
- Every org starts with one default Group ("common"); it can't be deleted,
  and it's where new members land if you don't pick a Group explicitly.
- Any other Group can only be deleted once it has no members left in it —
  reassign them first.
- A member's Group is set (and changed later) from the Admin member list,
  the same place you set their role.

### Adding people

Two ways to get someone into Pulse:

- **One at a time**: **Admin → Add member**, fill in name, email, role, and
  Group, and submit. The temporary password is shown once in a banner right
  after creation — copy it and send it to the person through your normal
  internal channel (there's no email relay, so Pulse can't send it for you).
- **In bulk via CSV**: **Admin → Import CSV**. The import page shows the
  exact format expected — one header row, then one row per person as
  `name,email,role,group`. `role` is optional and defaults to `MEMBER` if
  omitted; accepted values are `ADMIN`, `CREATOR`, `AUDITOR`, or `MEMBER`
  (case-insensitive). `group` is also optional and defaults to the org's
  default Group; if given, it must match an existing Group's name
  (case-insensitive) or that row is rejected. There's a **Download sample
  CSV** link on that page if you want a template to fill in. After
  importing, download the generated temp-passwords CSV and distribute it —
  again, shown only once.

### Managing existing members

From **Admin** you can, per person:

- **Change role** via the dropdown (`ADMIN` / `CREATOR` / `AUDITOR` /
  `MEMBER`).
- **Change Group** via the dropdown — they leave their old Group instantly.
- **Activate / Deactivate** — deactivating blocks sign-in without deleting
  their account or history. There's no way to permanently delete a member
  account.
- **Reset password** — generates a new temporary password shown once,
  which forces them through the "set a new password" flow on next sign-in.
  Use this whenever someone's forgotten theirs, since there's no
  self-service reset.
- Search the list by name or email.

### Everything a Creator (and Auditor) can do

Because Admin includes Creator permissions everywhere, an Admin can also
create and manage surveys, circles, and 1:1 templates exactly as described
in the [For Creators](#for-creators) section above — and can open, edit, and
manage *anyone's* survey or template, not just their own. The one meaningful
difference from a Creator: an Admin can delete a survey in any status (Draft,
Published, or Closed), not just while it's still a Draft. 1:1 templates that
already have run history remain undeletable regardless of role; archive is
still the only option there.
