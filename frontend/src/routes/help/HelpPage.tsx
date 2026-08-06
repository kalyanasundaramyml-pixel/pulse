import { ReactNode, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

type GuideTab = 'member' | 'creator' | 'auditor' | 'admin' | 'faq';

function Section({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details className="help-section" open={defaultOpen}>
      <summary>{title}</summary>
      <div className="help-body">{children}</div>
    </details>
  );
}

function MemberGuide() {
  return (
    <div className="help-guide">
      <p className="muted">
        As a respondent, you take surveys and 1:1 check-ins you've been assigned — you don't create anything
        yourself.
      </p>

      <Section title="Signing in for the first time" defaultOpen>
        <p>
          Your Admin creates your account and gives you a temporary password. The first time you sign in, you'll be
          required to set your own password (at least 8 characters) before you can do anything else.
        </p>
        <p>
          There's no self-service "forgot password" link — if you ever get locked out, ask your Admin to reset your
          password. They'll give you a new temporary one, and you'll be asked to change it again on your next
          sign-in.
        </p>
      </Section>

      <Section title="Taking a survey">
        <p>
          Under <strong>Surveys → Assigned to me</strong>, you'll see any survey you've been sent, split into{' '}
          <strong>In progress</strong> and <strong>Closed</strong>. Open one to answer its questions — a survey may
          have several named sections plus a welcome and closing message.
        </p>
        <p>
          You can come back and update your answers any time before the survey closes. Once a survey is closed, it
          moves to the Closed tab and can no longer be edited.
        </p>
      </Section>

      <Section title="Anonymous vs. Attributed surveys">
        <p>Every survey tells you up front which kind it is:</p>
        <ul>
          <li>
            <strong>Anonymous</strong> — your name is never linked to your answers, anywhere, for anyone, including
            Admins. The app doesn't just hide this in the interface — anonymous answers are stored in a completely
            separate place from your identity, so there's no record connecting the two.
          </li>
          <li>
            <strong>Attributed</strong> — your name is linked to your answers, and whoever created the survey can
            see who said what.
          </li>
        </ul>
        <p>A survey's anonymous/attributed setting is fixed once it's published and can never change afterward.</p>
      </Section>

      <Section title="Your One-on-Ones">
        <p>
          Under <strong>One-on-Ones → Assigned to me</strong>, you'll find any 1:1 check-ins your creator has started
          with you, split into <strong>To do</strong> and <strong>Completed</strong>. These are always attributed —
          they're tied to your name so your creator can follow up with you directly.
        </p>
        <p>
          Each 1:1 "run" is its own round of questions at a point in time. Your creator may start a new one with you
          periodically (e.g. monthly), and can see how your answers change over time.
        </p>
      </Section>

      <Section title="Viewing a survey's results as a Viewer">
        <p>
          An Auditor can grant you <strong>Viewer</strong> access to one specific survey — this lets you see its
          dashboard and results even though you didn't create it and aren't its Auditor. Any survey you've been given
          Viewer access to shows up under <strong>Surveys → Viewing</strong>. Viewer access can be granted or revoked
          at any time, and it only ever applies to surveys, never to 1:1s.
        </p>
      </Section>
    </div>
  );
}

function CreatorGuide() {
  return (
    <div className="help-guide">
      <p className="muted">
        As a Creator, you can create and manage your own surveys and 1:1 templates, and see results for the ones you
        own.
      </p>

      <Section title="Creating a survey" defaultOpen>
        <p>
          From <strong>Surveys</strong>, click <strong>New survey</strong> and choose <strong>Create fresh</strong>{' '}
          — this immediately creates an "Untitled survey" draft and takes you straight to its builder. There's no
          separate setup form: type a title and it saves automatically as you go.
        </p>
      </Section>

      <Section title="Anonymous vs. Attributed — and the lock">
        <p>
          While a survey is still a draft, you can toggle whether it's Anonymous or Attributed. Once you publish it
          for the first time, that setting locks permanently — even if you later unpublish it to make other edits,
          the anonymous/attributed choice can never be changed again. This is deliberate: respondents are told which
          kind of survey they're taking, and that promise has to hold for good.
        </p>
      </Section>

      <Section title="Building your survey: Welcome, Question blocks, End">
        <p>Every survey has the same three-part shape:</p>
        <ul>
          <li>
            <strong>Welcome</strong> — an optional intro heading/message shown before the first question. Always
            present, can't be removed.
          </li>
          <li>
            <strong>Question blocks</strong> — one or more named sections (e.g. "Culture", "Growth") that hold your
            actual questions. Add, rename, reorder, or delete these freely; reorder a question within its block,
            move it to a different block, or delete it. Supported question types: rating scale, free text, and
            choice — a choice question has a <strong>Max choices</strong> field for how many options a respondent
            can pick (1 for "pick exactly one", or more to allow multiple).
          </li>
          <li>
            <strong>End</strong> — an optional closing heading/message. Always present, can't be removed.
          </li>
        </ul>
        <p>
          The preview panel on the right always shows exactly what a respondent will see, live, as you edit — use it
          to check your wording before publishing.
        </p>
        <p>
          Nothing in the builder is saved automatically — click <strong>Save</strong> when you're happy with your
          changes, or <strong>Discard changes</strong> to throw them away. Deleting a block or question asks you to
          confirm first. If you try to leave the page (another nav link, the browser's Back button, or closing the
          tab) while you have unsaved changes, you'll be asked to confirm before they're lost.
        </p>
      </Section>

      <Section title="Choosing recipients">
        <p>
          Use <strong>Manage recipients</strong> to search the directory and add people individually, or add
          everyone from a saved <strong>Circle</strong> in one click. You can add or remove recipients at any time,
          even after publishing — the one exception is that someone who has already responded can never be removed.
        </p>
      </Section>

      <Section title="Publishing, closing, and reopening">
        <p>
          <strong>Publish</strong> requires at least one question and one recipient, and sends the survey live.{' '}
          <strong>Unpublish to edit</strong> takes it back to Draft without deleting any existing responses or
          recipients — though a question that's already been answered can't have its type, options, or removal
          changed, to protect those answers.
        </p>
        <p>
          <strong>Close</strong> stops new responses and moves the survey to your Closed list; <strong>Reopen</strong>{' '}
          brings it back to Published, optionally with a new end date. If you set an end date, the survey closes
          itself automatically once that date passes.
        </p>
      </Section>

      <Section title="Duplicating a survey">
        <p>
          <strong>Duplicate</strong> makes an independent copy — new questions, new (empty) recipient list, always
          starting as a fresh Draft — so you can reuse a good survey without disturbing the original's responses.
        </p>
      </Section>

      <Section title="The survey dashboard">
        <p>Open <strong>View dashboard</strong> on any of your surveys to see:</p>
        <ul>
          <li>A completion rate (always shown, regardless of anonymity).</li>
          <li>
            Per-question results: rating average and distribution, choice tallies, or a list of free-text answers,
            plus any comments left alongside rating/choice questions.
          </li>
          <li>
            For <strong>Attributed</strong> surveys only, a respondents table showing who has and hasn't answered.
          </li>
        </ul>
        <p>
          For <strong>Anonymous</strong> surveys, results for the whole survey are withheld until at least 3 people
          have responded — you'll see a "results withheld to protect anonymity" message instead of any chart until
          that threshold is met. This can't be overridden, including by an Admin.
        </p>
        <p>
          Your group's <strong>Auditor</strong> can also see this dashboard, for compliance oversight — that's based
          on your own group membership, not who you sent the survey to. They can additionally grant a specific
          member or creator <strong>Viewer</strong> access to this one survey; you aren't asked and can't grant this
          yourself. See <strong>Auditor Guide</strong> for details.
        </p>
      </Section>

      <Section title="Survey templates">
        <p>
          A template is a reusable question set that's never sent to anyone directly. Create one via{' '}
          <strong>Templates → Survey templates → + New template</strong>, or by checking that option from the New
          survey menu. Build it like a normal survey, but the action bar only offers <strong>Save</strong>,{' '}
          <strong>Discard changes</strong>, <strong>Make public</strong>, and <strong>Delete</strong> — there's no
          Publish, because a template itself is never live.
        </p>
        <p>
          To actually use one, go to <strong>Surveys → New survey → Use a template</strong> and click any template —
          this immediately creates your own live draft survey with its questions copied in, ready for you to add
          recipients and publish. Marking a template <strong>Public</strong> lets other Creators do the same with
          yours; they get their own independent copy and never affect your original.
        </p>
      </Section>

      <Section title="One-on-Ones: templates vs. live check-ins">
        <p>
          One-on-Ones work similarly to survey templates, but every 1:1 starts life as a template. Create one via{' '}
          <strong>One-on-Ones → New One-on-One</strong>, choosing <strong>Create fresh</strong> for an immediately
          live, editable 1:1, or <strong>Use a template</strong> to start from an existing one (yours or a public one
          someone else shared) — clicking a template there immediately creates your own live copy.
        </p>
        <p>
          A live 1:1 needs at least one question and one recipient before you can{' '}
          <strong>Initiate one-on-one</strong> (this is the equivalent of Publish — it makes the 1:1 ready to start
          real check-ins). You can never add yourself as a recipient of your own 1:1 — it wouldn't make sense to
          review yourself.
        </p>
      </Section>

      <Section title="Running a One-on-One over time">
        <p>
          Once initiated, use <strong>Start new 1:1</strong> next to a recipient to begin a fresh round — they'll see
          it appear under their own "Assigned to me" list. Each round (a "run") is independent, so you can start as
          many with the same person as you like (e.g. one per month).
        </p>
        <p>
          Once someone has two or more completed runs, <strong>View trend</strong> shows how their answers to each
          question have changed across every round, in order.
        </p>
      </Section>

      <Section title="Circles">
        <p>
          A Circle is just a saved, named list of people — a shortcut for recipient-picking, not a live link. Create
          and manage circles under <strong>Circles</strong>; any Creator or Admin can edit or delete any circle, since
          they're a shared, org-wide convenience rather than something you personally own. Adding a circle to a
          survey or 1:1's recipients copies its current members in as individual recipients — later changes to the
          circle don't retroactively affect a survey you've already sent.
        </p>
      </Section>

      <Section title="Deleting things">
        <p>
          You can delete a survey or 1:1 template while it's still a Draft. Once published, you can no longer delete
          it yourself (an Admin can, for any status) — unpublish it back to Draft first if you need to remove it. A
          1:1 template that already has run history can never be deleted at all, by anyone — archive it instead to
          hide it from future use while keeping its trend history intact.
        </p>
      </Section>
    </div>
  );
}

function AuditorGuide() {
  return (
    <div className="help-guide">
      <p className="muted">
        As an Auditor, you have read-only compliance oversight of every survey and 1:1 created by members of your
        own Group — you can't edit, publish, or delete anything, and you can't create surveys or 1:1s yourself.
      </p>

      <Section title="What your oversight actually covers" defaultOpen>
        <p>
          Your access is based on the <strong>creator's</strong> Group, never the recipients'. If someone in your
          Group creates a survey and sends it to a circle spanning several Groups, you can see it
        </p>
      </Section>

      <Section title="Reviewing surveys">
        <p>
          Under <strong>Surveys → Audit</strong>, you'll see every survey created within your Group, at any status
          (draft, published, or closed). Open one to go straight to its dashboard — the same results view its
          creator sees, including every question's prompt and results. Anonymous surveys stay anonymous even to
          you: the same 3-response withholding threshold and identity-stripping apply exactly as they do for the
          creator.
        </p>
      </Section>

      <Section title="Reviewing One-on-Ones">
        <p>
          Under <strong>One-on-Ones → Audit</strong>, you'll see every 1:1 template and live 1:1 created within
          your Group. Opening one shows a read-only version of its questions and recipients — for anyone with two
          or more completed runs, <strong>View trend</strong> shows how their answers changed over time, the same
          as the creator sees it.
        </p>
      </Section>

      <Section title="Granting and revoking Viewer access">
        <p>
          From a survey's dashboard, the <strong>Manage viewers</strong> panel lets you grant a specific member or
          creator — inside or outside your Group — a narrow exception to see that one survey's dashboard, even
          though they aren't its Auditor. Search for them by name or email and click <strong>Grant viewer</strong>.
          They'll then find it under their own <strong>Surveys → Viewing</strong> tab.
        </p>
        <p>
          You can revoke it again at any time from the same panel. Viewer access can be granted or revoked
          regardless of the survey's status (draft, published, or closed), and it only ever applies to
          surveys — there's no Viewer equivalent for 1:1s. The survey's own creator can never grant or revoke this
          themselves; only an Auditor of that survey's Group, or an Admin, can.
        </p>
      </Section>
    </div>
  );
}

function AdminGuide() {
  return (
    <div className="help-guide">
      <p className="muted">
        As an Admin, everything in the Creator Guide applies to you too — and you can act on{' '}
        <strong>anyone's</strong> surveys and templates, not just your own. The tools below are Admin-only.
      </p>

      <Section title="Groups: org teams" defaultOpen>
        <p>
          A <strong>Group</strong> represents a real team in your org — distinct from a Circle, which is just an
          ad-hoc, shareable recipient list. Every member belongs to exactly <strong>one</strong> Group at a time.
        </p>
        <p>
          Manage Groups under <strong>Groups</strong> — create, rename, or delete them. Every org starts with one
          default Group ("common"); it can't be deleted, and it's where new members land if you don't pick a
          Group explicitly. Any other Group can only be deleted once it has no members left in it — reassign them
          first. A member's Group is set (and changed later) from the Admin member list, the same place you set
          their role.
        </p>
      </Section>

      <Section title="Creating a single member account">
        <p>
          Under <strong>Admin</strong>, use the inline "create member" form (name, email, role, group) to add one
          person at a time. You'll see their generated temporary password once, right after creation — copy it
          down, because it isn't shown again. They'll be required to set their own password on first sign-in.
        </p>
      </Section>

      <Section title="Bulk-importing members via CSV">
        <p>
          For adding many people at once, use <strong>Admin → Import CSV</strong>. The file needs a header row with
          columns <code>name</code>, <code>email</code>, and optionally <code>role</code> and <code>group</code>.{' '}
          <code>role</code> defaults to <code>MEMBER</code> when omitted; accepted values are <code>ADMIN</code>,{' '}
          <code>CREATOR</code>, <code>AUDITOR</code>, or <code>MEMBER</code> (case-insensitive). <code>group</code>{' '}
          is also optional and defaults to the default Group; if given, it must match an existing Group's name
          (case-insensitive) or that row is rejected. A sample file is available to download from that page.
          Limits: 2,000 rows and 2MB per file.
        </p>
        <p>
          Import is best-effort per row — rows with a duplicate email (in the file or already in the system) or bad
          data are skipped and reported individually, while every valid row still gets created. There's no email
          relay configured, so after the import finishes you'll see (and can download) a CSV of every new account's
          temporary password — save it before navigating away, since it's never stored or shown again afterward.
        </p>
      </Section>

      <Section title="Managing members">
        <p>From the Admin member list you can, for any account:</p>
        <ul>
          <li>Change their role (Member / Creator / Auditor / Admin) directly from the table.</li>
          <li>Move them to a different Group directly from the table — they leave their old Group instantly.</li>
          <li>
            <strong>Deactivate</strong> or <strong>Activate</strong> them — a deactivated account can't sign in at
            all. There's no way to permanently delete a member account; deactivating is the way to disable someone who
            leaves.
          </li>
          <li>
            <strong>Reset their password</strong> — generates a new temporary password (shown once, inline) and
            forces them to set a new one on next sign-in.
          </li>
        </ul>
      </Section>

      <Section title="Managing everyone's surveys and templates">
        <p>
          Because you're treated as an owner of every survey and template, you can open, edit, and manage anyone's
          work the same way they would. The one meaningful difference from a Creator: you can delete a survey in any
          status (Draft, Published, or Closed), not just while it's still a Draft — useful for cleaning up something
          that should never have been sent. 1:1 templates that already have run history remain undeletable
          regardless of role; archive is still the only option there.
        </p>
      </Section>
    </div>
  );
}

function FaqItem({ q, defaultOpen, children }: { q: string; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details className="help-section faq-item" open={defaultOpen}>
      <summary>{q}</summary>
      <div className="help-body">{children}</div>
    </details>
  );
}

function Faq() {
  const { member } = useAuth();
  const isAdmin = member?.role === 'ADMIN';
  return (
    <div className="help-guide">
      <FaqItem q="Is an anonymous survey really anonymous, even from Admins?" defaultOpen>
        <p>
          Yes. Anonymous responses are stored in a completely separate place from any respondent's identity — there
          is no record anywhere linking the two, so it isn't just hidden in the interface. Not even an Admin can
          trace an anonymous answer back to a person.
        </p>
      </FaqItem>
      <FaqItem q="I am a Creator. Why can't I see any results for my anonymous survey yet?">
        <p>
          Results for an anonymous survey are withheld until at least 3 people have responded, so no answer can be
          singled out or guessed at from a very small sample. This threshold can't be lowered or bypassed by anyone.
          Attributed surveys don't have this limit.
        </p>
      </FaqItem>
      <FaqItem q="I forgot my password — what do I do?">
        <p>
          There's no self-service password reset. Ask your Admin to reset it for you — they'll give you a new
          temporary password, and you'll set your own the next time you sign in.
        </p>
      </FaqItem>
      <FaqItem q="Can I switch a survey from Anonymous to Attributed (or back) after publishing?">
        <p>
          No. That choice locks the first time a survey is published and can never change again, even if you
          unpublish it afterward — it's a promise made to respondents that has to hold permanently.
        </p>
      </FaqItem>
      <FaqItem q="Can I delete a survey once it's published?">
        <p>
          As a Creator, no — you can only delete a survey while it's a Draft. Unpublish it back to Draft first if you
          need to remove it. Admins can delete a survey in any status.
        </p>
      </FaqItem>
      <FaqItem q="Can I add myself as a recipient of my own 1:1 template?">
        <p>No — the app blocks this. A 1:1 is meant to be run with someone else, not yourself.</p>
      </FaqItem>
      <FaqItem q="What's the difference between a template and a regular survey or 1:1?">
        <p>
          A template is never sent to anyone — it's just a reusable question set. Using a template (via "Use a
          template") makes an independent live copy for you to send; editing your copy, or later editing the
          original template, never affects the other.
        </p>
      </FaqItem>
      <FaqItem q="If I make my template public, can other Creators edit my original?">
        <p>
          No. A public template can only be viewed and copied by others — copying always creates their own
          independent version. Only you (or an Admin) can edit the original.
        </p>
      </FaqItem>
      <FaqItem q="What is a Circle, and how is it different from a survey's recipient list?">
        <p>
          A Circle is just a saved, reusable list of people for quickly adding recipients — any Creator or Admin can
          create, edit, or delete any circle. Adding a circle to a survey copies its current members in as individual
          recipients at that moment; it isn't a live link, so changing the circle later doesn't change who's already
          on a survey you sent.
        </p>
      </FaqItem>
      {isAdmin && (
        <FaqItem q="What is a Group, and how is it different from a Circle?">
          <p>
            A Group is a real org team — every member belongs to exactly one, and it's set by an Admin. A Circle is
            just an ad-hoc, shareable recipient list that can freely mix people from any Group. Groups exist for one
            purpose: scoping the Auditor role. Circles exist to speed up picking recipients. They're unrelated.
          </p>
        </FaqItem>
      )}
      <FaqItem q="What does an Auditor do, and who can see what?">
        <p>
          An Auditor gets read-only access to every survey and 1:1 created by someone in their own Group — based on
          the <strong>creator's</strong> Group, not the recipients'. So a survey created by someone in Group A but
          sent to a circle spanning Groups A and B is visible to Group A's Auditor only, not Group B's — unless
          that specific person is separately given Viewer access (surveys only; see the next question). An Auditor
          can't create, edit, publish, or delete anything themselves.
        </p>
      </FaqItem>
      <FaqItem q="What is Viewer privilege, and who can grant it?">
        <p>
          Viewer is a narrow, per-person exception that lets one specific member or creator see one specific
          survey's dashboard, regardless of their Group. Only an Auditor (of that survey's own Group) or an Admin
          can grant or revoke it — never the survey's own creator. It can be set at any survey status, and it
          never applies to 1:1s.
        </p>
      </FaqItem>
      <FaqItem q="Can I edit a question after people have already answered it?">
        <p>
          You can edit its wording, and you can still move it to a different block, but you can't change its type,
          options, or max choices, and you can't delete it, once it has at least one response — this protects the
          answers already collected.
        </p>
      </FaqItem>
      <FaqItem q="What happens when a survey's end date passes?">
        <p>It closes automatically — respondents will find it under "Closed" and it stops accepting new answers.</p>
      </FaqItem>
      <FaqItem q="Can I remove someone from a survey's recipient list?">
        <p>
          Yes, at any time — unless they've already submitted a response, in which case they can't be removed (their
          response has to stay associated with a valid recipient).
        </p>
      </FaqItem>
      <FaqItem q="Why does starting a new 1:1 create another run instead of updating the last one?">
        <p>
          Each run is a snapshot in time on purpose — it's what makes the trend view meaningful. Every run keeps its
          own answers, so you can see how someone's responses evolve check-in over check-in.
        </p>
      </FaqItem>
      {isAdmin && (
        <FaqItem q="Can I permanently delete a member account?">
          <p>
            No — Admins can only deactivate an account (blocking sign-in) or change its role. There's no permanent
            delete, so historical data (past responses, runs, audit trail) stays intact.
          </p>
        </FaqItem>
      )}
      {isAdmin && (
        <FaqItem q="I imported a CSV of members — where did the temporary passwords go?">
          <p>
            They're shown once, right after the import finishes, with a button to download them all as a CSV. There's
            no email relay, so make sure to save that file before you navigate away — it can't be retrieved again
            afterward.
          </p>
        </FaqItem>
      )}
      <FaqItem q="Can a Creator see another Creator's private (non-public) surveys or templates?">
        <p>
          No — only the owner and Admins can see or manage a private survey or template. Marking something Public
          only ever grants other Creators read access and the ability to copy it, never edit access to the original.
        </p>
      </FaqItem>
      <FaqItem q="What does 'Discard changes' do in the builder?">
        <p>
          It reverts every unsaved edit on the page — title, description, and any block or question you added,
          edited, reordered, moved, or deleted — back to whatever was last saved. It doesn't delete the survey,
          template, or 1:1 itself; use Delete for that.
        </p>
      </FaqItem>
    </div>
  );
}

export function HelpPage() {
  const { member } = useAuth();
  const defaultTab: GuideTab =
    member?.role === 'ADMIN'
      ? 'admin'
      : member?.role === 'CREATOR'
        ? 'creator'
        : member?.role === 'AUDITOR'
          ? 'auditor'
          : 'member';
  const [tab, setTab] = useState<GuideTab>(defaultTab);

  return (
    <div className="page help-page">
      <div className="page-header">
        <h1>Help</h1>
      </div>
      <p className="muted">Guides for every role in Pulse, plus answers to common questions.</p>

      <div className="tabs">
        <button className={tab === 'member' ? 'active' : ''} onClick={() => setTab('member')}>
          Member Guide
        </button>
        {(member?.role === 'CREATOR' || member?.role === 'AUDITOR' || member?.role === 'ADMIN') && (
          <button className={tab === 'creator' ? 'active' : ''} onClick={() => setTab('creator')}>
            Creator Guide
          </button>
        )}
        {(member?.role === 'AUDITOR' || member?.role === 'ADMIN') && (
          <button className={tab === 'auditor' ? 'active' : ''} onClick={() => setTab('auditor')}>
            Auditor Guide
          </button>
        )}
        {member?.role === 'ADMIN' && (
          <button className={tab === 'admin' ? 'active' : ''} onClick={() => setTab('admin')}>
            Admin Guide
          </button>
        )}
        <button className={tab === 'faq' ? 'active' : ''} onClick={() => setTab('faq')}>
          FAQ
        </button>
      </div>

      {tab === 'member' && <MemberGuide />}
      {tab === 'creator' &&
        (member?.role === 'CREATOR' || member?.role === 'AUDITOR' || member?.role === 'ADMIN') && <CreatorGuide />}
      {tab === 'auditor' && (member?.role === 'AUDITOR' || member?.role === 'ADMIN') && <AuditorGuide />}
      {tab === 'admin' && member?.role === 'ADMIN' && <AdminGuide />}
      {tab === 'faq' && <Faq />}
    </div>
  );
}
