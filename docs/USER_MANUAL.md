# Pulse — User Manual

Pulse is the internal tool for running feedback surveys and recurring 1:1
check-ins. This manual covers everything you can do in the app, organized by
role: **User** (everyone), **Leader**, and **Admin**. Leaders and Admins
should also read the User section first — they see everything a User sees,
plus the extra sections below.

---

## Contents

- [Getting started](#getting-started)
- [The anonymity promise](#the-anonymity-promise)
- [For everyone (User)](#for-everyone-user)
  - [Answering a survey](#answering-a-survey)
  - [Doing a 1:1 check-in](#doing-a-11-check-in)
- [For Leaders](#for-leaders)
  - [Creating a survey](#creating-a-survey)
  - [Editing and the publish lifecycle](#editing-and-the-publish-lifecycle)
  - [Recipients and Groups](#recipients-and-groups)
  - [Duplicating a survey](#duplicating-a-survey)
  - [Survey templates](#survey-templates)
  - [Viewing survey results](#viewing-survey-results)
  - [Running 1:1s](#running-11s)
  - [1:1 templates and trends](#11-templates-and-trends)
  - [Sharing templates with other leaders](#sharing-templates-with-other-leaders)
- [For Admins](#for-admins)
  - [Adding people](#adding-people)
  - [Managing existing users](#managing-existing-users)
  - [Everything a Leader can do](#everything-a-leader-can-do)

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
   **One-on-Ones** for everyone. Leaders and Admins additionally see
   **New Survey**, **Groups**, and (Admins only) **Admin**.

## The anonymity promise

Every survey is marked either **Anonymous** or **Attributed** by the leader
who creates it, and you'll see a badge telling you which one you're looking
at before you answer anything:

- **Anonymous** — your answers are never linked to your identity anywhere in
  the system, including for Admins. Pulse enforces this at the database
  level, not just in the interface. To keep small groups from being
  de-anonymized by elimination, a leader's dashboard withholds per-question
  results until enough people have responded (your Admin configures this
  minimum; a few responses at least).
- **Attributed** — your name is visible next to your answers to the leader
  who created the survey.

Once a survey has been published even once, its anonymous/attributed setting
is **locked forever** — a leader can't quietly flip an anonymous survey to
attributed after the fact.

1:1 check-ins are always attributed (never anonymous) — they're a
conversation aid between you and your leader, not a feedback-collection
mechanism.

---

## For everyone (User)

### Answering a survey

1. Go to **Surveys** → **Assigned to me**. This lists every survey you've
   been added as a recipient for, split into **Active** and **Closed** tabs.
2. Click a survey to open it. You'll see its title, description, and the
   anonymous/attributed badge before any questions.
3. Answer each question. Question types you may see:
   - **Rating** — pick a number on a scale (e.g. 1–5), with an optional
     comment box.
   - **Text** — free-form written answer.
   - **Single choice** / **Multi choice** — pick one or more options from a
     list, with an optional comment box.
   - Questions marked with `*` are required.
4. Click **Submit response**. You can come back and click **Update
   response** any time while the survey is still open (status
   `PUBLISHED`) — your latest answers replace the previous ones.
5. If a survey is closed, it moves to the **Closed** tab and can no longer
   accept new answers, but it's still visible for reference.

### Doing a 1:1 check-in

1. Go to **One-on-Ones** → **Assigned to me**. This lists every 1:1 "run"
   your leader has started with you, tagged **To do** or **Completed**.
2. Open a **To do** item, answer the questions (same question types as
   surveys), and click **Submit**.
3. Unlike a survey, a 1:1 run is **one-shot** — once you submit, it's locked
   and can't be edited. If your leader wants to check in again, they'll
   start a new run, which shows up as a fresh "To do" item; your history of
   past runs is what lets them see how things trend over time.
4. Your 1:1 answers are always visible to the leader who runs the template
   with you — there's no anonymous option here.

---

## For Leaders

Everything below is available if your account has the **Leader** role (or
**Admin**, which includes Leader permissions everywhere).

### Creating a survey

1. Click **New Survey** in the nav bar.
2. Fill in a **Title** and optional **Description**.
3. Choose **Anonymous** or **Attributed**. Think about this up front —
   once you publish, it's locked for that survey.
4. Optionally set an **End date** — the survey auto-closes on that date
   without you having to do anything (see [Editing and the publish
   lifecycle](#editing-and-the-publish-lifecycle)).
5. Optionally check **"Save as a reusable template instead of a live
   survey"** — see [Survey templates](#survey-templates).
6. Click **Create draft**. You're now on the survey's edit page as a
   `DRAFT` — nothing is visible to anyone else yet.
7. Add questions with the question editor: choose a type, write the prompt,
   mark it required or not, and (for Rating) set the scale, or (for
   Single/Multi choice) list the options.
8. Go to **Manage recipients** and add the people who should receive the
   survey (see [Recipients and Groups](#recipients-and-groups)).
9. Click **Publish**. Publishing requires at least one question and at
   least one recipient.

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
- A question that already has at least one answer can't have its type or
  options changed, and can't be deleted — this protects the integrity of
  responses already collected. You can still edit its prompt, required
  flag, or rating scale.
- **Close survey** — manually closes a `PUBLISHED` survey.
- **End date** — set on the survey; once that date passes, the survey
  auto-closes the next time anyone touches it, no action needed from you.
- **Reopen** — brings a `CLOSED` survey back to `PUBLISHED`, with the option
  to set (or clear) a new end date.

### Recipients and Groups

- On a survey's **Manage recipients** page, search the employee directory
  by name or email and add people one at a time, or pick a **Group** from
  the dropdown to add everyone in it at once.
- Removing someone who has already responded is blocked — their response
  stays valid and they stay on the list.
- **Groups** (nav → **Groups**) are shared org-wide: any leader can create
  one, and any leader can use any group when picking recipients for their
  own survey or 1:1 template. Manage a group's membership from its
  **Manage** page, using the same search-and-add picker.

### Duplicating a survey

From any survey's edit page, click **Duplicate** to create an independent
`DRAFT` copy — same title (prefixed "Copy of"), description, anonymity
setting, questions, and recipients — that you can then edit freely without
touching the original.

### Survey templates

A template is a survey that's never meant to be published directly — it's a
reusable starting point.

- Create one by checking **"Save as a reusable template"** on the New
  Survey form, or by using **Copy to my templates** on a template you don't
  own (see below).
- A template can have questions and even pre-set recipients (handy if you
  run the same survey to the same audience periodically), but it has no
  publish/close/end-date controls — those don't apply to a template.
- Find your templates under **Surveys → Templates**.
- Click **Start a survey** on a template to create an independent, live
  `DRAFT` survey with the template's questions and recipients pre-filled —
  edit anything you like, then publish it as normal. The template itself is
  untouched and can be reused again next time.

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

### Running 1:1s

1. Click **New template** under **One-on-Ones**, give it a title and
   description, and add questions the same way you would for a survey
   (these stay the same across every run, which is what makes trends
   comparable).
2. Go to **Manage recipients** and add the people you have 1:1s with. You
   can never add yourself as a recipient of your own template.
3. From the template page, click **Start new 1:1** next to a recipient's
   name whenever you're ready to run a check-in with them — this creates a
   fresh "run" that shows up in their **Assigned to me** list. You can do
   this as often as you like, ad hoc, for the same person.
4. Once they've completed at least one run, a **View trend** link appears
   next to their name.

### 1:1 templates and trends

- Editing a question that already has answers is limited the same way as
  surveys (can't change its type/options once it has responses), to keep
  historical trend data meaningful.
- **Archive** a template you're not actively using anymore (it stays around
  for history but is tucked out of the way); **Unarchive** to bring it
  back.
- The **trend** page for a specific person plots their **Rating** answers
  over time as a line chart, and lists their **Text**/**Choice** answers
  chronologically underneath, so you can see how someone's answers have
  moved across multiple check-ins.

### Sharing templates with other leaders

Both survey templates and 1:1 templates support an optional **public**
flag, for sharing good templates across the team without giving up control
of your original:

- On a template you own, click **Make public** (from either the survey
  edit page or the 1:1 template edit page). Other leaders will now see it
  under their own **Templates** tab, tagged **Public** with your name on
  it. **Make private** reverses this any time.
- Other leaders can view a public template read-only (they can't edit its
  questions, recipients, or the public flag) and take one of two actions:
  - **Start a survey** / for 1:1s, they copy it first and add their own
    recipients — creates their own independent, live item from your
    template.
  - **Copy to my templates** — creates a brand-new template owned by
    *them*, with your questions copied over, that they're free to edit
    however they like.
- **Your original template is never changed by anyone else.** Any
  customization by another leader always creates their own separate copy —
  editing in place is only ever available to the owner (or an Admin).

---

## For Admins

Admin accounts automatically have every Leader capability described above,
plus user management under the **Admin** nav link.

### Adding people

Two ways to get someone into Pulse:

- **One at a time**: **Admin → Users**, click **Add user**, fill in name,
  email, and role, and submit. The temporary password is shown once in a
  banner right after creation — copy it and send it to the person through
  your normal internal channel (there's no email relay, so Pulse can't send
  it for you).
- **In bulk via CSV**: **Admin → Users → Import CSV**. The import page
  shows the exact format expected — one header row, then one row per
  person as `name,email,role`. `role` is optional and defaults to `USER`
  if omitted; accepted values are `ADMIN`, `LEADER`, or `USER`
  (case-insensitive). There's a **Download sample CSV** link on that page
  if you want a template to fill in. After importing, download the
  generated temp-passwords CSV and distribute it — again, shown only once.

### Managing existing users

From **Admin → Users** you can, per person:

- **Change role** via the dropdown (`ADMIN` / `LEADER` / `USER`).
- **Activate / Deactivate** — deactivating blocks sign-in without deleting
  their account or history.
- **Reset password** — generates a new temporary password shown once,
  which forces them through the "set a new password" flow on next sign-in.
  Use this whenever someone's forgotten theirs, since there's no
  self-service reset.
- Search the list by name or email.

### Everything a Leader can do

Because Admin includes Leader permissions everywhere, an Admin can also
create and manage surveys, groups, and 1:1 templates exactly as described
in the [For Leaders](#for-leaders) section above. An Admin's **Surveys** and
**One-on-Ones** tabs show the same "Assigned to me / Created by me /
Templates" split as a Leader's — there's no separate "every survey in the
company" view, so oversight of another leader's surveys happens through
that leader directly or through your database backups/audit log, not the
UI.
