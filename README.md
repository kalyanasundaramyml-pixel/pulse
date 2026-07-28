# Pulse

Self-hosted web app for creating anonymous or attributed feedback
surveys and recurring 1:1 check-ins, targeting a hand-picked list of
recipients, and viewing results (including 1:1 trends over time) on a creator
dashboard. See [docs/PROJECT_SPEC.md](docs/PROJECT_SPEC.md) for the full
design rationale (anonymity model, schema, API surface, permission model), or
[docs/USER_MANUAL.md](docs/USER_MANUAL.md) for how to actually use the app
as a Member, Creator, Auditor, or Admin.

Every member belongs to exactly one org **Group** (managed by an Admin under
**Groups**), separate from a **Circle** (an ad-hoc, shareable recipient list
that can freely mix members from any Group). An **Auditor** gets full Creator
capabilities over their own surveys/1:1s, plus read-only oversight of every
survey/1:1 created within their own Group, and can grant a specific member or
creator narrow **Viewer** access to one survey's dashboard regardless of
Group. See the in-app **Help** page (role-specific guides + FAQ) for the full
rundown.

## Stack

- **Backend**: Node.js + TypeScript + Express, PostgreSQL via Prisma, server-side
  sessions (`express-session` + `connect-pg-simple`).
- **Frontend**: React + TypeScript (Vite), served in production by nginx which
  reverse-proxies `/api/*` to the backend.
- **Deployment**: Docker Compose (`db`, `api`, `web`) — no external internet
  dependency at runtime (no SMTP, no CDN, no third-party APIs).

## Anonymity model

Anonymous survey responses are stored in tables (`anonymous_responses`,
`anonymous_answers`, ...) that have **no column referencing a member at all**.
A separate backend-only table, `survey_response_access`, is the sole mechanism
used to enforce "one response per member" and to let a member find/edit their
own response — it is never read by any creator-facing or dashboard code path (this
is enforced by an ESLint rule, not just convention). Attributed survey
responses live in a parallel set of tables that do carry the respondent's
identity. See [backend/src/modules/responses/anonymousResponse.repository.ts](backend/src/modules/responses/anonymousResponse.repository.ts).

## Local development

Backend:

```sh
cd backend
cp .env.example .env      # edit DATABASE_URL etc. for your local Postgres
npm install
npm run prisma:migrate
npm run prisma:seed       # bootstraps the first Admin from ADMIN_BOOTSTRAP_* env vars
npm run dev                # http://localhost:4000
```

Tests (`npm test`) run against a **separate** database (`DATABASE_URL`, defaults
to `.../feedback_test`) because the suite truncates all tables between cases —
never point it at a database with real data. Create it once and run migrations
against it before the first run:

```sh
createdb feedback_test    # or: psql -U feedback -c 'CREATE DATABASE feedback_test'
DATABASE_URL=postgresql://feedback:feedback@localhost:5432/feedback_test npx prisma migrate deploy
npm test
```

Frontend:

```sh
cd frontend
npm install
npm run dev                # http://localhost:5173, proxies /api to :4000
```

## Running the full stack with Docker Compose

```sh
cp .env.example .env       # set POSTGRES_PASSWORD, SESSION_SECRET, ADMIN_BOOTSTRAP_*
docker compose up --build -d
```

The app is served at `http://<server>:${WEB_PORT:-80}/`. On first boot the
`api` container runs `prisma migrate deploy` then seeds the bootstrap Admin
account from `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_TEMP_PASSWORD`. Log in
with those credentials and you'll be forced to set a new password immediately.

From there, the Admin can bulk-import the rest of the org via **Admin → Import
CSV** (columns: `name,email,role,group` — `role` and `group` are both
optional, defaulting to `MEMBER` and the org's default Group respectively).
Since there's no SMTP relay, the import generates a random temp password per
member and returns them once as a downloadable CSV for the Admin to
distribute through your normal internal channel; each member is forced to
set their own password on first login.

## Building behind a TLS-inspecting corporate proxy

Some corporate networks intercept and re-sign HTTPS traffic with their own
root CA. This only matters at **build time** — once the images are built,
the running containers make zero outbound internet calls (no SMTP, no CDN,
no third-party APIs), so a TLS-inspecting proxy has nothing to intercept
while the app is actually running.

There are two independent things that need your org's root CA trusted if the
machine running `docker compose build` sits behind such a proxy:

1. **Docker Desktop pulling the base images** (`node:20-alpine`,
   `postgres:16-alpine`, `nginx:1.27-alpine`) from Docker Hub. This happens
   before any `Dockerfile` instruction runs, so it can't be fixed from inside
   this repo — it's a Docker Desktop / OS-level trust issue. If
   `docker compose build` fails immediately with a certificate error while
   pulling an image, get your org's root CA (IT can provide it, or export it
   yourself on Windows via `certmgr.msc` → *Trusted Root Certification
   Authorities* → find your proxy's CA → *Export* as Base-64 X.509 `.crt`)
   and import it into Docker Desktop's trust store — on Windows with the
   WSL2 backend that generally means adding the cert to the WSL distro
   Docker Desktop uses (`update-ca-certificates` inside it) or configuring
   it under Docker Desktop → *Settings* → *Docker Engine* / *Resources* →
   *Proxies*, per Docker's docs for corporate proxies. This step depends on
   your specific Docker Desktop version and IT setup, so if it doesn't pull
   cleanly, check with IT for the sanctioned way to trust it in Docker
   Desktop.

2. **`npm install` inside the build** (and any `apk` calls, including the very
   first one that installs `ca-certificates` itself). This one *is* handled by
   this repo: drop your org's root CA as a `.crt` file into `backend/certs/`
   **and** `frontend/certs/` (same file, both places) before building. Both
   Dockerfiles append anything in that directory into the base image's CA
   bundle *before* any network call runs — including the bootstrap `apk add`
   that installs `ca-certificates`/`update-ca-certificates` themselves — so it
   works even though that first call would otherwise fail under TLS
   inspection before those tools exist to fix it. It's a silent no-op if the
   directories are empty, so this is always safe to leave in place. These
   `certs/` folders are gitignored — don't rely on them for anything checked
   into version control.

Users' browsers reaching the app are generally unaffected by a
TLS-inspecting proxy either way: this app is served over plain HTTP inside
the network (see `COOKIE_SECURE` below), and proxy SSL inspection only
applies to HTTPS traffic. If you later put TLS in front of this app with
your own internal CA, that's a separate, unrelated certificate-trust step
for browsers — nothing to do with the build-time proxy.

## Backups

```sh
./scripts/backup.sh                              # nightly via cron, writes to ./backups/
./scripts/restore.sh backups/feedback_<stamp>.dump
```

Do a restore drill periodically (see plan's verification section): dump the
running DB, tear down the `pgdata` volume, restore, and confirm data
integrity before relying on this for production.

## Environment variables

See [`.env.example`](.env.example) (Compose) and
[`backend/.env.example`](backend/.env.example) (local dev) for the full list.
Notable ones:

- `MIN_ANONYMOUS_RESPONSES_FOR_BREAKDOWN` (default `3`): anonymous survey
  dashboards withhold per-question breakdowns until at least this many people
  have responded, to avoid re-identifying a respondent by elimination in a
  small group.
- `COOKIE_SECURE`: set to `true` only once you've terminated TLS in front of
  the app (otherwise browsers will refuse to send the session cookie).
