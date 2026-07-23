# HMZC-MICMS — Extracted & Organized Project

This is the buildable skeleton extracted from the ChatGPT "Certification
System Setup" conversation, organized into working backend/frontend
modules. Everything the chat gave concrete code for is implemented;
everything it only *described* (a folder name, a wireframe, a table
name) is stubbed with a comment pointing at what's missing.

## What's actually runnable right now

- **Backend**: FastAPI app with `/`, `/api/health`, a full
  **Module 2 (Users + Auth)** — `POST /api/auth/register`,
  `POST /api/auth/login` (JWT), `GET /api/auth/me`, and two additions
  beyond the source chat: `GET /api/auth/users` and
  `PATCH /api/auth/users/{id}/role`, both admin-only, so an admin can see
  everyone who's signed up and promote an account. Transcribed from a
  separately-run "Module 2" chat (pasted in as photos) and adapted to
  this project's existing `core/config.py`/`core/database.py`/
  `core/security.py` instead of duplicating them under different names.
  Plus a **Certificates table** (`app/models/certificate.py`) with a
  real foreign key to `users.id` via `issued_by_id` —
  `POST /api/certificates` (upsert by cert number, `issued_by` set once
  on first save and never overwritten), `GET /api/certificates`, and
  `DELETE /api/certificates/{cert_no}` (admin-only). Plus a **Finance
  module** — `app/models/finance_item.py` (the item/price catalog —
  code, name, unit price — admin-managed, never exposed as a public
  services list, only searched from when building an invoice or
  quotation) and `app/models/finance_document.py` (`Quotation`,
  `Invoice` — line items are snapshotted at issue time, so a later
  catalog price change never retroactively changes an already-issued
  document). Certificates, Quotations, and Invoices all carry a
  `version` column now — a save sends back the version it read, and the
  server returns 409 if someone else has saved a newer edit in between,
  instead of one edit silently overwriting another.
- **Frontend**: React + TypeScript app with a fully wired **Finance
  module** — dashboard (now backed by a real endpoint, computed from
  actual Invoice/Quotation rows — see the fix note below; expenses, job
  costing, and reports are still backend-pending), plus a fully rebuilt
  **Quotations and Invoices** flow that is not backend-pending: search
  the item catalog, add a line, quantity is typed in per line, price
  comes from the catalog automatically but can be overridden, a per-line
  discount
  can be applied, and the resulting document (`FinanceDocumentPreview`)
  uses the same letterhead, QR code, and watermark treatment as
  certificates. Editing is Finance-role-or-Administrator, and an
  Administrator can act on any invoice or quotation regardless of who
  issued it, not just their own; a **Item Catalog** admin page manages
  the underlying price list. A fully wired **Auth module** — sign-up,
  sign-in, and an admin-only Users page, calling the real Module 2
  backend above; and a fully wired **Inspections / Certificates
  module**, now gated behind sign-in — Statement + checklist forms for
  conventional lifeboats, rescue boats (FRC), free-fall lifeboats (dry
  cargo and tanker types) and deck cranes, with Firefighting Equipment
  and Loose Gear & Lifting Equipment present as "coming soon" divisions
  pending their check sheets. Ported from a standalone tool that
  predates this project, using the same color palette (now shared via
  `src/styles/theme.css` across every module, including Finance — see
  the "Finance had no CSS" finding in `docs/UX_AUDIT.md`), plus a
  per-page QR code and background watermark on every printed
  certificate page. Certificates sync to the real backend table above
  while still caching to browser localStorage — offline saves now use a
  real persisted retry queue (`src/offline/syncQueue.ts`), not a single
  best-effort attempt — see the entry below. A **Certificate Log** page
  (`/certificates/log`) lists every certificate with who issued it and
  when. A single **navigation shell** (`src/layout/AppShell.tsx`) now
  wraps every gated route — previously each module had its own
  disconnected header, and Admin Users had no navigation out at all
  (`docs/UX_AUDIT.md`, section 1). The app is also installable
  (`public/manifest.webmanifest` + `public/sw.js`, registered in
  `main.tsx`) and loads its shell offline. All other nav sections
  (Customers, Vessels, etc.) are named in the architecture but have no
  components yet.

## Quick start

```bash
docker compose up --build
```

- Frontend: http://localhost:3000 (or http://localhost via nginx)
- Backend: http://localhost:8000/docs
- DB: localhost:5432 (hmzc_user / password / hmzc_db)

Or run backend and frontend separately — see each folder's own README /
package.json scripts.

## Structure

```
HMZC-MICMS/
├── backend-fastapi/     FastAPI backend (see its README.md)
├── frontend-react/      React + TypeScript frontend
│   └── src/features/finance/       fully built Module 18
│   └── src/features/inspections/   fully built Certificates module (checklists)
│   └── src/features/auth/          fully built sign-up/sign-in/admin Users
├── database/            table/relationship reference (models not yet coded)
├── docker/nginx/        reverse proxy config
├── docker-compose.yml   runs backend + frontend + db + nginx together
└── docs/                (empty — for your own notes as you build)
```

## Inconsistencies found in the source chat and how they were resolved

1. **Two different DB credential sets.** The Docker walkthrough used
   `hmzc_user`/`password` against host `postgres`; the manual/no-Docker
   walkthrough used `postgres`/your-own-password against `localhost`.
   → Kept as two separate env files: `.env.example` (Docker) and
   `.env.local.example` (local Postgres install).
2. **`requirements.txt` listed twice** with different contents (second
   version added `reportlab`, `qrcode`, `pillow` for certificate
   generation). → Merged into one file.
3. **Frontend service import path mismatch.** `finance.api.ts` imports
   `"../../../api/axios"`, but the architecture diagram only shows
   `services/api.ts` at the top level, no `api/axios.ts`. → Created
   `src/api/axios.ts` to match what the actual code imports, and treated
   it as the shared client for all future feature modules.
4. **Roles list mismatch.** The security section lists 6 roles (ADMIN,
   TECHNICAL_MANAGER, INSPECTOR, ENGINEER, CUSTOMER, VIEW_ONLY); the
   Finance module later references "Finance Manager" and "Sales
   Coordinator", which aren't in that list. → Flagged in
   `database/README.md` to reconcile when Module 2 (auth) is built,
   rather than silently merging or dropping either set.
5. **Components/pages referenced but never coded**: `core/logging.py`,
   password hashing in `core/security.py`, `hooks/useFinance.ts`,
   `ProfitChart.tsx`, and most Finance API endpoints beyond the 3 the
   chat wrote. → Implemented with minimal, clearly-commented versions so
   the structure isn't pointing at empty files, each one noting it
   wasn't in the original spec.
6. **Nginx config and root-level orchestration** were named as folders
   (`docker/nginx/nginx.conf`) but never written. → Added a minimal
   reverse-proxy config.
7. **Certificates module** was named in the architecture diagram
   (`src/pages/README.md`) but never coded, same situation as
   Customers/Vessels/etc. → Built as `src/features/inspections/`,
   following Finance's own file layout (`types/`, `data/`, `services/`,
   `hooks/`, `components/`, `pages/`). Content (checklist sections,
   item wording, colour palette) was ported from a standalone tool
   that predates this project rather than invented, so it matches what
   HMZC's inspectors already use on paper. Firefighting Equipment and
   Loose Gear & Lifting Equipment are wired in as selectable divisions
   showing a "coming soon" placeholder, same pattern the standalone
   tool used, ready for their checklists once supplied. No backend
   route exists for it yet (same as Finance's own endpoints beyond the
   3 the chat wrote) — `inspection.storage.ts` persists to
   localStorage in the meantime; `inspection.api.ts` has the REST
   calls ready for whenever a backend module is built for it.
8. **Module 2 (Users + Auth)** was run as a separate chat and pasted in
   as photos of the output (`app/models/user.py`, `app/schemas/user.py`,
   `app/api/deps.py`, `app/api/v1/auth.py`, a second `app/core/security.py`,
   and a second `app/main.py`). Three real conflicts with what already
   existed here, resolved by keeping the existing version and adapting
   the pasted code to it (documented inline at each spot):
   - The pasted `core/security.py` duplicated the existing one under
     different function names (`get_password_hash` vs `hash_password`,
     `create_access_token(subject, expires_delta)` vs
     `create_access_token(data: dict)`) and read `SECRET_KEY`/`ALGORITHM`
     via `os.getenv` directly instead of the existing `settings` object.
     The existing `core/security.py` was kept; `deps.py`/`auth.py` were
     adapted to call it instead of adding a second, conflicting one.
   - The pasted `app/api/v1/auth.py` implied a new `v1/` package for one
     file. Moved to `app/api/routes/auth.py` instead, matching the
     existing `health.py` convention, mounted at `/api/auth` in `main.py`
     the same way `health.router` is mounted at `/api`.
   - The pasted `main.py` regenerated the whole file (different title,
     no health route). Merged in only what was actually new — CORS
     middleware, `Base.metadata.create_all` as an Alembic stand-in, and
     `auth.router` — rather than overwriting it.
   Two additions beyond the pasted code, both requested directly:
   `GET /api/auth/users` and `PATCH /api/auth/users/{id}/role`
   (admin-only), so an admin can see every account and promote one.
   The frontend's sign-up form deliberately does **not** offer
   "Administrator" as a selectable role — self-service admin signup is
   a privilege-escalation hole — promotion is admin-only, via the new
   Users page.
9. **QR codes and a watermark on printed certificates** were requested
   directly (not from the source chat). The watermark reuses the same
   logo asset added for the letterhead. The QR code is generated
   client-side via the `qrcode` npm package (added to `package.json`)
   rather than server-side via the `qrcode`/`pillow` Python packages
   already sitting in `requirements.txt` unused — printing shouldn't
   depend on the API being reachable at that moment, and neither
   package was actually wired to anything yet, so this was a choice
   between two unused dependencies rather than a correction of one.
10. **Certificates backend table**, resolving the gap #9 above and the
    previous "Next step" both flagged. `app/models/certificate.py` adds
    a `certificates` table with `issued_by_id -> users.id` as a real
    foreign key, plus the queryable columns (cert number, type, vessel,
    IMO, status) an admin needs to filter/sort on; the full nested
    certificate content (checklists, equipment list, photos, signatures
    — shape varies by equipment type) is stored as a JSON column rather
    than a dozen+ child tables, since it's never queried piece-by-piece
    server-side, only rendered whole by the frontend that already builds
    it. The frontend keeps its localStorage cache alongside this — see
    `useInspections.ts` — as a write-through fallback: saves succeed
    locally even if the API is briefly unreachable, and sync on the next
    successful save or page load rather than blocking the user. There's
    no background retry queue yet (see "Next step" below).
    `issued_by` is set once, at first save, and never overwritten by a
    later edit, so the record of who originally issued a certificate
    doesn't change if someone else (e.g. an admin) later re-saves it.
    A **Certificate Log** page was added alongside this (see above) —
    it didn't exist before, so there was previously no way to browse or
    reopen a saved certificate in the UI at all, only create new ones.
11. **Offline sync queue and PWA/installable-app support**, both
    requested directly. The certificate sync was previously
    best-effort — one attempt per save, then silence until the next
    save or reload. `src/offline/syncQueue.ts` replaces that with a
    real persisted queue: a save or delete made while offline is
    retried automatically on reconnect (the browser's `online` event)
    and on every app load, with a manual "Retry Now" available too, and
    nothing is lost by closing the tab. It's still last-write-wins, not
    conflict-resolved — if the same certificate is edited offline on
    two devices, whichever syncs second overwrites the first silently.
    That's a real limitation worth knowing, not just a rounding error.
    Separately, `frontend-react/public/manifest.webmanifest` +
    `public/sw.js` (registered in `main.tsx`) make the app installable
    (Add to Home Screen / desktop install) and let the app shell load
    without a connection. Both require a secure context — localhost
    counts as one, so this works in dev, not just once deployed behind
    HTTPS. The service worker deliberately never caches anything under
    `/api/` — offline writes are the sync queue's job, not the service
    worker's; caching API responses would risk silently serving stale
    or wrong data instead. At the time this was written, sync was still
    last-write-wins — entry #13 below replaces that.
12. **Item-catalog-driven Invoice and Quotation generation**, requested
    directly, with specific rules: quantity is typed per line (varies
    per vessel), price auto-fills from the catalog when an item is
    selected but the issuer can override it, and a per-line discount
    can be applied. `ItemPicker.tsx` searches the backend catalog (never
    a hardcoded list); `LineItemsEditor.tsx` is where quantity/price/
    discount get edited; `FinanceDocumentPreview.tsx` renders the result
    with the same letterhead/QR/watermark treatment as a certificate
    ("same characteristics as the certificate" was explicit). "Admin
    must have power to work on the invoice and quotation" is enforced
    server-side (`_can_edit` in `api/routes/finance.py`): a Finance-role
    user can edit their own documents, an Administrator can edit any of
    them. "Not to appear as service provided but database to help
    issuing invoice" — the catalog (`ItemCatalog.tsx`) is reachable only
    from the nav shell for Finance/Admin roles, never rendered anywhere
    as a public list.
13. **Optimistic concurrency (real conflict detection)**, extending the
    `version` column pattern to Certificates as well as the new Finance
    models. A save now sends back the version it last read; the server
    rejects with 409 if that's stale, and the frontend distinguishes a
    genuine conflict (surfaced immediately — retrying won't fix it) from
    a connectivity failure (queued for automatic retry) rather than
    treating both the same way. This directly replaces the
    last-write-wins behaviour entry #11 flagged as a known limitation.
14. **Navigation shell** (`src/layout/AppShell.tsx`), addressing
    `docs/UX_AUDIT.md` section 1 — the single biggest UX finding in that
    review. Every gated route is now wrapped in one persistent header
    with links to every module a signed-in user has access to, instead
    of each module having its own disconnected (or, for Admin Users,
    nonexistent) navigation.
15. **Finance styling**, addressing the audit's section 5. The
    suggestion to standardize on a component library (Material UI /
    Ant Design) was not taken — swapping the entire existing,
    HMZC-branded design system for a generic one would be a large,
    risky rewrite with no real benefit, especially impossible to
    validate in an environment with no `npm install` access (see below).
    Instead, `src/styles/theme.css` was extracted from `inspections.css`
    (previously the only place the HMZC color tokens existed) and
    `finance.css` was written using those same tokens, matching what
    Inspections and Auth already looked like rather than inventing a
    third visual language.
16. **Photo-upload enforcement**, addressing a real gap: the UI
    previously said "(required before finalizing)" without checking
    anything. Each equipment type now has a `minPhotos` config (see
    `inspectionChecklists.ts`) enforced in `handleSave` — Finalize is
    disabled and a save is blocked with a specific list of what's
    missing until every section's minimum is met. The specific counts
    (6 for a lifeboat hull/canopy, 4 for davit, etc.) are a reasonable
    starting point, **not confirmed HMZC policy** — flagged in the code
    itself as needing HMZC's real minimums per equipment type.

## What from a later pasted advisory (Phase 1/2 integration + offline sync notes) was done, adapted, or deliberately skipped

A second round of advisory material (three more documents, covering
API/CORS integration and an offline-sync design) came in after the
above. Most of "Phase 1" turned out to already exist — health check,
auth endpoints, a ProtectedRoute equivalent (`RequireAuth`, which
already does more: role gating, loading state), and login/logout
storing the token — so this pass focused on the genuine gaps:

- **CORS was actually broken**, independent of anything in the pasted
  material: `allow_origins=["*"]` combined with `allow_credentials=True`
  is invalid per the CORS spec — browsers silently reject that
  combination rather than erroring loudly, which is a worse failure
  mode. Fixed via a configurable `CORS_ORIGINS` setting
  (`core/config.py`) rather than hardcoding a guessed deployment URL.
- **Token-expiry handling was a real gap.** `api/axios.ts` had a request
  interceptor (attaching the token) but no response interceptor — a
  401 just failed silently on whatever page it happened on. Added one
  that clears the stale token and redirects to sign-in, skipped for
  the login/register calls themselves (where a 401 is an expected
  "wrong password," not a session problem).
- **`withCredentials: true` was suggested but not added.** That flag is
  for cookie-based auth; this project authenticates via a Bearer token
  in the Authorization header, so there's no cookie to send — turning
  it on would do nothing and would additionally require CORS to echo
  back an exact origin with credentials for every request, for no
  benefit.
- **`.env.development`/`.env.production` (frontend) and a documented
  `CORS_ORIGINS` entry in `.env.example` (backend)** were added.
  `.env.production`'s API URL is a placeholder, not a guessed Railway
  URL — fill in wherever this actually gets deployed.
- **A root `.gitignore` didn't exist at all** — worth having now that
  files are going to GitHub via direct upload (see the Quick start
  section) rather than always through a git client that some setups
  configure separately.
- **The offline queue was migrated from localStorage to IndexedDB**
  (via the `idb` package) — the piece explicitly deferred earlier in
  this README as "worth doing as its own focused piece of work." Same
  external behavior (queueSave/queueDelete/flushQueue), now backed by
  IndexedDB instead of a ~5-10MB-ceiling localStorage key, with a
  one-time migration for anything already queued under the old key.
  Added alongside it: **exponential backoff** (5s/15s/30s/60s/120s,
  giving up after 10 attempts rather than retrying forever), a
  **30-second periodic retry** while online (not just the `online`
  event, which only fires on an actual state transition), and a global
  **offline banner + sync-status badge** in the nav shell
  (`src/offline/OfflineBanner.tsx`, `SyncStatusBadge.tsx`) — previously
  sync status only showed up as a per-page banner inside Inspections.
- **A generic `/api/sync/push` batch endpoint was deliberately not
  built.** The pasted design queues arbitrary `{method, endpoint,
  payload}` operations and replays them through one dispatcher
  endpoint. This project already has typed, conflict-aware upsert
  endpoints per resource (`POST /api/certificates`, `/api/finance/
  invoices`, `/api/finance/quotations`), each already idempotent (an
  upsert-by-number, not a create-only call) and already returning 409
  on a real conflict. Building a second, generic pathway alongside
  those would mean maintaining the same conflict/validation logic
  twice, in two different shapes, for no behavior the per-resource
  endpoints don't already provide. The frontend queue calls the
  existing typed endpoints directly instead.
- **A scoped audit log was added** — not logging every action (that
  buries what matters in noise), just the events where "who did this,
  when, from where" actually matters for a certification platform:
  login, certificate saves, and role changes
  (`app/models/audit_log.py`, `app/core/audit.py`). Readable via
  admin-only `GET /api/auth/audit-log`; no frontend page for it yet
  (see Next step) — same underlying event only being partially
  addressed.

Still deliberately not done, same reasoning as before — see the
original three-item list retained below:

- **Switching to Material UI or Ant Design.**
- **A full WCAG accessibility pass.** A visible focus ring and
  `aria-label`s on the line-item editor exist; genuine screen-reader
  testing and complete label coverage across every form is real,
  standalone work.
- **Duplicate/idempotency protection as a separate mechanism** wasn't
  added on top of the per-resource endpoints, because upsert-by-number
  already provides it structurally: retrying the same save twice
  updates the same record rather than creating a second one. A
  dedicated client-generated idempotency key would only add value for
  operations that aren't naturally upserts, which none of these are.

## Account approval and password recovery

Two things requested directly, both now real:

- **New accounts require admin approval before they can sign in.**
  `is_active` already existed on every user and was already checked at
  login — it just defaulted to `True`. Now it defaults to `False`, and
  an admin approves (or later deactivates) an account from the Users
  page. This creates a bootstrap problem — with no admin yet, no one
  could approve the first account — solved by auto-activating and
  auto-promoting to admin whichever account is created first on a fresh
  database (`is_first_user` check in `register_user`), and only that
  one. Every account after it goes through normal approval.
- **There is no "recover the password" feature, and there never will
  be** — passwords are one-way hashed (`hash_password` in
  `core/security.py`), which means nobody, including an admin, can ever
  read one back. What exists instead: an admin can trigger
  `POST /auth/users/{id}/reset-password`, which generates a random
  temporary password, returns it exactly once in the response (never
  stored in plaintext, never logged — the audit entry records that a
  reset happened and who did it, not the credential), and sets
  `must_change_password` so the person is forced to set their own real
  password — which only they know — the moment they sign in with it.
  `RequireAuth` enforces this redirect on every route except the change-
  password page itself.

One real bug caught while wiring this in: `AuthContext.tsx`'s
`register()` used to call `login()` immediately after registering. The
moment new accounts stopped defaulting to active, that auto-login would
fail on every single sign-up with a confusing "pending approval" error
appearing to come from the registration step itself. Fixed by only
auto-logging-in when the returned account is already active (the
bootstrap admin case) and showing a clear "waiting for approval"
message otherwise.

## A real bug found during a project review, not a feature request

Comparing the project end-to-end surfaced something concrete: the
**Finance Dashboard** — the first page a Finance-role user sees — was
erroring on every load. `useFinance.ts` called `GET /finance/dashboard`,
which never existed as a backend route; only `/finance/items`,
`/quotations`, and `/invoices` had been built. Fixed by actually
building it (`get_dashboard` in `api/routes/finance.py`), computed from
real `Invoice`/`Quotation` rows rather than sample data:

- **Revenue** = sum of paid invoices' totals; **outstanding** = sum of
  issued-but-unpaid invoices; **pending quotations** = count of
  draft/sent quotations. All real numbers once invoices/quotations
  exist in the database.
- **Profit margin is `null`, not `0%`.** There's no Expense/cost-tracking
  table wired up yet (`Expenses.tsx`/`JobCosting.tsx` are still
  backend-pending stubs — see below), so a real margin can't be
  computed. Returning `0%` would silently claim every dollar of revenue
  is pure profit, which is a worse answer than "not tracked yet" — the
  frontend now shows that phrase explicitly rather than a fabricated
  number.
- The monthly revenue chart and recent-transactions list are both real,
  built from actual invoice records (last 6 months, last 5 invoices).

Caught a second bug while building the fix: the endpoint's first draft
referenced `MonthlyRevenuePoint` and `RecentTransaction` without
importing them — a real `NameError` waiting to happen at runtime, the
kind of bug neither `py_compile` nor a cross-file import checker catches
(it's a same-file undefined-name issue, not a resolution-across-files
one). Caught it by writing an actual scope-aware AST checker rather than
trusting the weaker checks that had been used up to this point — worth
knowing that distinction exists, since it means earlier "verified clean"
claims in this README were true for what they checked, but weren't
checking for this specific bug class.

## The same advisory material, sent twice

The exact same three documents above were pasted again in a later
message. Rather than assume the prior round's work was still intact,
every item was re-verified against the actual files (not re-explained
from memory) before concluding what was already covered. Two real gaps
turned out to still be open and were closed then:

- **No real backend-reachability check existed.** `OfflineBanner.tsx`
  only reflects the browser's own online/offline detection: a device
  can show as "online" (connected to WiFi) while the API itself is
  unreachable — wrong `VITE_API_BASE_URL`, the backend down, CORS
  rejecting the request — and nothing said so. `BackendStatusDot.tsx`
  is the literal "frontend startup check" from the integration notes,
  made persistent (checked every 30s, not just once) and shown in the
  nav shell rather than a `console.log` only a developer watching dev
  tools would ever see.
- **Photos weren't compressed.** They rode along fine inside a
  certificate's JSON payload (so "offline photo uploads" already
  worked end-to-end, just not efficiently) but at whatever resolution
  the phone's camera captured — often several MB each, multiplied by
  the 4-6 photos a lifeboat/davit inspection requires.
  `utils/compressImage.ts` resizes to a 1600px max dimension and
  re-encodes as JPEG at 75% quality before a photo is ever added to a
  certificate, which is where it matters — by the time something
  reaches the sync queue, it's already the smaller version.

## Both items from the last "Next step" are now done

- **Alembic migrations exist** (`migrations/`, previously empty) — a
  hand-written baseline plus the `must_change_password` column as its
  own follow-up migration, specifically so an existing deployment (which
  already has every table, just not that one new column) can pick up
  only what's actually missing. **Not run against a real database** —
  see `migrations/README.md` for exactly which commands to run for a
  fresh database versus an existing one, and test against a disposable
  Postgres instance before trusting this anywhere real. This is true of
  migrations generally more than most code: a wrong migration can be
  worse than no migration, and there was no live database available to
  verify these against beyond static analysis (syntax + import +
  undefined-name checks — see the "real bug found" section above for
  what those do and don't catch).
- **The audit log now has a frontend page** (`AuditLog.tsx`, under
  Users in the nav, admin-only) — searchable and filterable by action.

## Certificates/Finance permission separation — a lot already existed, some real gaps closed

A substantial permission system already existed from earlier in this
project's build-out (permission strings, role defaults, per-user
`extra_permissions` an admin can grant on top — see
`backend-fastapi/app/core/permissions.py`): Technical issues
certificates, Sales/Administration/Service Coordination can view and
download but not edit, Finance stays its own separate domain, and a
Limited Admin role starts with almost nothing and is built up
per-person. That backend design is sound and was reviewed, not rebuilt.

What was actually missing, found by checking the frontend against it
rather than assuming it matched:

- **The frontend still used the old fixed-role-array gating everywhere**
  (`RequireAuth`'s `roles` prop, `App.tsx`'s `FINANCE_ROLES` array,
  `AppShell`'s `adminOnly`/`financeOnly` booleans) — none of it checked
  the actual computed permission list the backend already exposes on
  every `User` (`user.permissions`). A Limited Admin granted
  `finance.view` would pass every backend check and still get blocked
  by the frontend. `RequireAuth` now supports a `permission` prop
  alongside the existing `roles` one (kept for the genuinely
  role-fixed pages — Admin Users, Audit Log), and every Finance/
  Certificates route and nav item was switched to it.
- **Certificate deletion was inconsistent** — hardcoded to
  `get_current_admin_user` while Finance's delete endpoints correctly
  checked a `FIN_DELETE` permission. Switched to `require_permission
  (CERT_DELETE)` for the same reason Finance already worked that way:
  it lets an admin grant delete access to one specific trusted person
  without also making them a full Administrator, matching the
  "some actions... based on role assigned by the main administrator"
  request directly.
- **No UI existed to actually grant a permission** — the backend
  endpoint (`PATCH /auth/users/{id}/permissions`) was there, nothing
  called it. Built a "Manage Access" panel into Admin Users: checkboxes
  for every permission string, showing what an account can currently
  do and letting an admin add to it. Deliberately additive-only in the
  UI too, matching the backend — unchecking something the account's
  role already grants by default doesn't remove it (the panel says so
  directly rather than implying an uncheck works when it wouldn't).
- **The four new roles (Sales, Administration, Service Coordination,
  Limited Admin) had no CSS at all** — would have rendered as
  colorless, unstyled pills the first time any of them showed up
  anywhere in the Users list.
- **View-only certificate access wasn't built on the frontend.**
  Someone with `certificates.view` but not `certificates.edit` now
  gets a genuinely different `InspectionWorkspace` view when they open
  a certificate from the Certificate Log: the read-only certificate
  itself (still fully printable/downloadable) instead of the editable
  form, save/finalize buttons, and equipment-type switcher (which
  would otherwise silently discard whatever they'd opened — it calls
  `startNew()`, and a view-only account has no way to get that back).
- **Sign-up's role dropdown still only offered the three original
  roles.** Extended to every self-service-appropriate role, using the
  same `ROLE_LABELS` the rest of the app already displays departments
  with instead of raw stored values like `"inspector"`.

One real bug caught while making these changes, worth naming plainly:
a stray `#` where a `//` comment was meant (a Python comment character
left in a TypeScript file) — would have been a straightforward syntax
error the moment anything tried to build this. Caught by re-running the
TypeScript check immediately after the edit, not by careful writing —
worth noting because it's a reminder that the verification step is
doing real work here, not a formality.

## Response to a proposed "Milestone 1: Synchronization Engine" plan

A separate assistant's plan (`sync_engine.py`, `routes/sync.py`,
`conflict_service.py`, `idempotency_service.py`, a generic
`POST /api/sync/push` batch endpoint, etc.) was reviewed against what's
actually in this codebase rather than implemented from scratch as
proposed. None of those specific files were created — not because the
plan was wrong to want offline sync, conflict detection, and
idempotency, but because working, verified versions of all three
already existed by the time this was reviewed, built in a different
shape than the plan assumed:

- **Conflict detection**: a `version` column + 409 response, already on
  Certificates, Invoices, and Quotations (see `_check_version` in
  `api/routes/certificates.py` and `finance.py`), not a separate
  `conflict_service.py`.
- **Idempotency**: upsert-by-business-key (`cert_no`, `invoice_no`,
  `quotation_no`) already makes retrying the same save safe — it
  updates the same record instead of creating a duplicate — rather
  than a separate `idempotency_service.py` tracking client-generated
  IDs.
- **Audit logging**: already wired into login, certificate/invoice/
  quotation saves, and account/role/permission changes (`core/audit.py`),
  not something Milestone 1 would have added new.
- **The offline queue itself**: already IndexedDB-backed with real
  exponential backoff, automatic retry (reconnect, 30s poll, app load,
  manual), and conflict-vs-connectivity-failure handling — see
  `frontend/src/offline/syncQueue.ts` and `indexedDb.ts`.
- **A generic batch `/api/sync/push` endpoint was deliberately still not
  built**, same reasoning as before: this project already has typed,
  conflict-aware upsert endpoints per resource. A generic dispatcher
  replaying arbitrary `{method, endpoint, payload}` operations would
  mean maintaining the same validation and conflict logic twice, in two
  shapes, for no behavior the per-resource endpoints don't already
  provide. If round-trip latency in poor-connectivity ports turns out
  to be a real, *measured* problem once this is actually tested on real
  hardware, batching many queued operations into one request is the
  right trigger to revisit that decision — not before.

**What actually was a genuine, confirmed gap**: the offline queue only
ever covered Certificates. Invoice and Quotation saves had *no* offline
handling at all — a failed save (offline, server briefly down) just
showed a generic error and the typed-in work was gone. Fixed by
generalizing the existing queue (not building a second, parallel one)
to also cover Invoice/Quotation saves, with the same conflict-vs-
connectivity distinction Certificates already had
(`DocumentConflictError` in `finance.api.ts`, mirroring
`CertificateConflictError`).

One real limitation surfaced while fixing this, worth being upfront
about rather than glossing over: Certificates have a local-first cache
(`inspection.storage.ts` + the `certificates` state in
`useInspections.ts`) that can show a not-yet-synced record immediately;
Finance has no equivalent, since `Invoices.tsx`/`Quotations.tsx` always
fetch from the server. A queued-but-unsynced invoice or quotation is
genuinely saved (in IndexedDB) and will sync automatically, but it
won't appear in the Invoices/Quotations list until it does — the save
form says this explicitly rather than implying otherwise. Building a
local cache for Finance to match Certificates' behavior is real,
scoped follow-up work, not something folded into this fix.

## Response to the readiness/percentage assessment — what got fixed

A prior review gave rough completeness percentages across categories
(feature completeness, security, tests, etc.) and a prioritized list of
what needed to happen before going live. The list was tackled in the
order given, everything that's actually fixable without a live server:

1. **`SECRET_KEY` placeholder** — the app now refuses to start at all
   if `SECRET_KEY` is still `change_this_secret_key` or under 32
   characters (`core/config.py`), instead of silently running with a
   guessable JWT-signing secret. A loud startup failure instead of a
   silent vulnerability.
2. **The migration's one flagged uncertainty** — the enum-type-naming
   assumption in `migrations/versions/0001_baseline.py` was resolved at
   the source: `models/user.py`'s role column now explicitly names the
   Postgres enum `"userrole"` instead of relying on SQLAlchemy's
   implicit default naming. Both places say the same thing because it's
   declared, not inferred — nothing left to double-check there.
3. **Zero rate limiting on login/register** — confirmed directly (grepped
   for it, found nothing) before fixing. `core/rate_limit.py` is a
   deliberately simple, dependency-free in-memory limiter — 10 attempts
   per minute per IP. Its real limitation is stated in its own comment:
   this is per-process state, fine for the single backend instance
   `docker-compose.yml` runs today, not correct if this is ever scaled
   to multiple replicas (that needs a Redis-backed limiter instead).
4. **Four Finance pages that looked finished but silently did nothing**
   (Payments, Expenses, Job Costing, Reports — confirmed each was wired
   to a backend endpoint that doesn't exist, and none even imported the
   stylesheet) — replaced with an honest "Coming Soon" state, the same
   pattern already used for Firefighting Equipment and Loose Gear.
   Unstyled and silently broken is worse than admitting the truth.
5. **Zero automated tests** — confirmed directly (`tests/` contained one
   empty `__init__.py`) before adding real ones. `tests/test_auth.py`
   and `tests/test_certificates.py` cover registration, the bootstrap-
   first-admin problem, login, the admin-only-actions-are-actually-
   rejected-for-non-admins check, the forced-password-change flow, and
   — specifically because it was called out as needing real-database
   testing — the conflict-detection scenario (two saves against the
   same certificate, the second with a stale version, expecting 409).
   A real structural bug was caught and fixed while writing these:
   `main.py` connects to the *real* configured database at import time,
   which would have broken test isolation (or touched a real database)
   the moment `app.main` was imported for testing — fixed by setting
   safe environment variables before any `app` import happens, documented
   in `tests/conftest.py`. Also caught: the rate limiter's state is a
   module-level dict shared across every test in the same pytest run,
   which would have made tests pass or fail depending on what ran
   before them — fixed with an autouse fixture that resets it.

**Still explicitly not done, because it can't be from here:**
database backups (an infrastructure/hosting decision, not something
this codebase can configure for you), and actually running any of
this. Every fix above was verified by static analysis — syntax,
cross-file imports, and a closure-aware undefined-name check — the
same tools used throughout this project, with the same honest
limitation: they prove internal consistency, not that the code
actually runs correctly. That first real run is still ahead of you.

## Testing the offline sync, once there's a laptop to test on

Nothing below has been run — this is what to actually try, not a
report of results. In rough order:

1. **Basic round trip.** Sign in, create/save a certificate (or an
   invoice, on a Finance account), reload the page, confirm it's still
   there and shows a real `issuedBy`/timestamp (not just a local one).
2. **Real offline behavior.** In the browser's dev tools, use Network
   throttling → Offline (more reliable than actually disconnecting
   Wi-Fi, which some browsers don't detect consistently). Save a
   certificate or invoice while "offline." Confirm: the save still
   appears to succeed locally, the sync status badge in the header
   shows a pending count, and the work is still there after a page
   reload (proves it's actually in IndexedDB, not just React state).
3. **Reconnect.** Turn throttling back to Online. Within ~30 seconds
   (the periodic retry) or immediately if the browser fires its
   `online` event, the pending count should drop to 0 and the record
   should show up in the Certificate Log / Invoices list with a real
   server timestamp.
4. **Conflict detection.** Open the same certificate or invoice in two
   browser tabs (or two accounts). Save from tab A. Then save from tab
   B without reloading first — this should get a 409 and a clear
   message, not silently overwrite tab A's save. This is the one that
   most needs real-database testing, since the version-check logic
   depends on Postgres row state that no amount of static analysis in
   this build-out could verify.
5. **Backoff.** Point `VITE_API_BASE_URL` at a port nothing's
   listening on, save something, and watch the Network tab — retries
   should be spaced out (5s, 15s, 30s...), not hammering immediately
   and repeatedly.
6. **Permanent failure.** Harder to test deliberately, but worth
   knowing: after 10 failed attempts an item stops retrying and shows
   up as "gave up syncing" rather than queuing forever silently.

## Response to the readiness assessment — what was already fixed, what was genuinely still missing

A prior readiness review estimated this project at roughly 55-65% of
the way to safe production use, and named specific gaps. Auditing the
codebase against that list (rather than assuming anything) found most
of it had already been addressed since:

- **`SECRET_KEY`** — `core/config.py` now refuses to start at all if
  it's still the `.env.example` placeholder, or shorter than 32
  characters, instead of silently accepting a public, guessable value.
- **Rate limiting** — `core/rate_limit.py`, a deliberately simple
  in-memory fixed-window limiter (10 attempts/minute per IP) on
  `/auth/login` and `/auth/register`. Documented honestly as
  single-process only (won't share state across multiple backend
  replicas) rather than presented as a complete solution.
- **Automated tests** — `tests/conftest.py`, `test_auth.py`,
  `test_certificates.py` now exist, using SQLite for speed rather than
  requiring a real Postgres instance per test run. `conftest.py` is
  explicit about the real tradeoff that comes with that (no native
  ENUM type, looser type enforcement than Postgres) — these tests can
  confirm application logic, not stand in for testing the migrations
  themselves against real Postgres.
- **The four dead Finance pages** (Payments, Expenses, Job Costing,
  Reports) — each called a backend endpoint that never existed.
  Replaced with the same honest "coming soon" pattern already used for
  Firefighting Equipment and Loose Gear in Inspections
  (`FinanceComingSoon.tsx`), rather than left silently broken.

**What was genuinely still missing, found by auditing rather than
assuming the above list was complete**: the migrations were already out
of date relative to the model they were meant to describe. The
Certificates/Finance permission-separation work added
`User.extra_permissions` and four new role values (sales,
administration, service_coordination, limited_admin) — but no migration
existed for either. Anyone running `alembic upgrade head` would have
gotten a `users` table missing that column entirely, and inserting a
user with one of the new roles would have failed outright (the Postgres
enum type wouldn't have accepted a value it doesn't know about).
Added `migrations/versions/0003_permissions_and_roles.py` for this —
worth reading its own docstring, since it uses `ALTER TYPE ... ADD
VALUE`, which has a genuine Postgres restriction (can't run in the same
transaction as something that *uses* the new value) that this migration
should satisfy but, like every other migration here, has not been
proven against a real database.

Two of my own cross-file verification scripts (used throughout this
project's build-out to check things statically, since no real Python/
Node install has ever been available) had blind spots, found and fixed
while running them again this round: neither recognized a variable
defined with a type annotation (`x: Dict[str, int] = {}`) as a real
definition, only plain assignment (`x = {}`) — a false positive on
`core/rate_limit.py`'s `_attempts`, not an actual bug. Worth naming
because it's a reminder that the verification tooling itself has been
built incrementally and imperfectly, the same as the application code
it's checking.

## Response to an 8-phase "enterprise roadmap" proposal

A separate assistant's plan proposed an extensive roadmap — unified
navigation with notifications/search, richer offline conflict UI, a
KPI dashboard, a notification center, a customer portal, 2FA, device
management, vessel/equipment history timelines, spare parts and
procurement, upgraded certificate security (digital signatures, hash,
tamper detection, a public verification portal), AI-assisted inspection
features (OCR, defect prediction, auto-fill), and a mobile-native-style
experience (voice notes, offline maps, dark mode).

Most of that was **not built**. Not because it's a bad roadmap — a lot
of it would be genuinely valuable — but because each of those (the
customer portal, 2FA, procurement/inventory, AI features especially)
is real, separate work deserving its own focused milestone, the same
reasoning already applied earlier in this project to a proposed generic
sync-engine rewrite. Attempting fragments of eight different phases in
one pass would spread effort too thin and risk shipping several
half-features instead of a few complete ones.

What **was** built — the bounded, technician-facing, safety-relevant
items from Phase 1 and Phase 8 that were genuinely missing, confirmed
by checking the code rather than assuming:

- **Smart validation before finalizing a certificate.** Previously only
  photo minimums were enforced — a certificate could be finalized with
  no vessel name, no IMO number, no engineer name, and no signature.
  `getFinalizeBlockers()` in `InspectionWorkspace.tsx` now checks all of
  it, and the blockers are shown as a visible notice, not just a
  disabled button's hover tooltip.
- **A section-progress indicator on the checklist subtabs** — checkmarks
  for sections that have actually been opened. Deliberately *not* a
  "have you reviewed every individual item" tracker: checklist items
  default to "Good" (matching the paper forms they replaced), so
  there's no way to tell a genuinely-reviewed-and-fine item apart from
  one nobody looked at without changing what an item's data even
  records — a bigger change than this pass, so the honest, achievable
  version was built instead of a misleading one.
- **Auto-save every 20 seconds, plus a native "leave page?" warning**
  when there are unsaved changes — the single most direct fix for
  "technicians in poor connectivity losing work." Two real bugs were
  caught and fixed while building this, before either shipped: the
  interval would have torn itself down and rebuilt on every keystroke
  (meaning it might never fire during continuous typing), and
  separately, `saveCurrent` itself closes over its own snapshot of the
  data from `useInspections.ts` — fixing the first bug alone wouldn't
  have stopped a stale save. Both fixed with a ref-based pattern that
  keeps the timer on a true fixed schedule while always reading live
  data.
- **A real in-app confirmation dialog** (`components/ConfirmDialog.tsx`),
  replacing every `window.confirm()` in the app (deactivating a user,
  resetting a password, deleting a certificate/invoice/quotation) —
  five call sites, all fixed. While in those files: found and fixed two
  more stale hardcoded `role === "admin"` checks gating the Invoice and
  Quotation delete buttons, which should have checked the `FIN_DELETE`
  permission the backend actually enforces — the same class of
  frontend/backend mismatch caught earlier in this project's
  permission-model work.
- **Session-expiry now explains itself.** Was a silent redirect to
  sign-in with zero context — genuinely confusing on its own, and worse
  paired with the auto-save work above, since the redirect is a full
  page reload that would previously have discarded any unsaved edits
  along with the explanation for why.

## "Each person only sees what they've issued" — a real change, and a bug I found before it shipped

Requested directly: certificate issuers should only see their own
issued certificates; the main admin sees everything. This meant
reconciling it with something already built for a different reason —
Sales, Administration, and Service Coordination were specifically
designed to see *every* certificate (to download for clients, track
fleet status), since they don't issue any themselves. Read literally,
"each person only sees what they issued" would show those roles
nothing at all, breaking the job they were built for.

**The interpretation used**: the restriction applies to certificate
*issuers* (Technical/Inspector). The support roles keep company-wide
visibility, because that's the entire reason they have certificate
access in the first place. If that's not what was meant, it's a one-line
change in `core/permissions.py`'s `ROLE_DEFAULT_PERMISSIONS` — a new
`certificates.view_all` permission now exists specifically so this is
adjustable per-role (or per-person, via `extra_permissions`) without
touching the filtering logic itself.

**The bug this would have caused if shipped naively**: certificate
numbers (`CERT/HMZCS/LB/20260722-001`) are generated by counting how
many certificates of that type already exist today — client-side, by
counting whatever's in the locally-cached certificate list. The moment
`list_certificates` started filtering non-`view_all` accounts to their
own certificates, that count would only reflect one technician's own
issuance for the day, not the company's. Two different technicians
creating a certificate on the same day would both compute the same
"next" number and collide — not a rare edge case, a guaranteed one the
very first time it happened. Fixed with a separate, narrower endpoint
(`GET /certificates/numbers`, `certificates.edit`-gated) that returns
just the bare cert_no strings for every certificate regardless of
issuer — enough to keep numbering correct without exposing anyone's
actual certificate content to people who shouldn't see it. The
database's `unique` constraint on `cert_no` remains the hard backstop
either way: even in the narrow window before that endpoint's result
loads, a genuine collision is rejected as a save error, not silently
persisted as two certificates sharing one number.

**What wasn't built, because the request was ambiguous rather than
clearly specified**: "queries if they need help." Admin already has
full visibility into sign-ups (`AdminUsers.tsx`), all certificate
activity regardless of issuer, and a full audit trail
(`AuditLog.tsx`) — but there's no actual support-request or
help-ticket mechanism for a staff member to flag "I need help with
this" and have it show up somewhere for the admin. Worth clarifying
before building, rather than guessing at a whole new feature (an
in-app messaging system, a comment thread on a certificate, an email
notification) that might not be what was actually meant.

## Admin-only account creation, with real email delivery

Requested directly: only an admin creates accounts; if someone loses
their login, an admin resets it and they choose their own password the
moment they sign in with the generated one; and the login details
should be emailed to them, not just relayed by hand.

- **Self-service sign-up is now blocked** for everyone except the very
  first account on a completely empty database — there's no admin yet
  to create one otherwise, so that one case still has to bootstrap
  itself (`register_user` in `api/routes/auth.py`). Every account after
  that gets a clear 403 pointing to "contact your administrator," and
  `SignUp.tsx` was rewritten to reflect that honestly rather than still
  looking like a general-purpose sign-up form.
- **A new admin-only `POST /auth/users`** creates an account active
  immediately (no approval queue needed — the admin creating it *is*
  the approval), with a random temporary password and
  `must_change_password` set, same mechanism the existing admin-reset
  flow already used. A "Create User" form was added to the Users page
  for this.
- **Real email**, not a placeholder. `core/email.py` uses `smtplib`
  (Python's standard library) so it works with any real SMTP provider —
  Gmail with an app password, SendGrid, Postmark, AWS SES's SMTP
  interface — via a handful of `.env` settings, all optional (unlike
  `SECRET_KEY`, missing SMTP settings don't stop the app from starting;
  `send_email()` just logs a warning and returns `False`, and the
  temporary password is still shown on-screen to the admin as a
  fallback either way).

**This is the first thing in this entire project that was actually run,
not just statically checked.** `smtplib`/`email` are Python's standard
library — no `pip install` needed — so a minimal fake SMTP server was
hand-written (raw sockets, ~80 lines, no third-party test library
available in this environment) specifically to verify `send_email()`
for real: opening a connection, authenticating, and transmitting a
correctly-formed multipart message, confirmed by decoding the
base64-encoded body the fake server actually received and reading back
the real content. The "SMTP not configured" fallback path was verified
separately too — confirmed it returns `False` and logs a warning rather
than raising an exception that would break account creation.

**What this does *not* prove**, and can't from this environment: an
actual SMTP provider's credentials, real deliverability, spam
filtering, or a message landing in a real inbox. That needs a real
email account configured — Gmail app password, SendGrid API key, or
similar — which only happens once this is deployed somewhere. Fill in
`SMTP_HOST`/`SMTP_USERNAME`/`SMTP_PASSWORD`/`SMTP_FROM_EMAIL` in the
real `.env` (see `.env.example`) and send one real test email before
relying on this for anyone's actual account.

## Vessel lookup — researched before building, not assumed

Requested directly: confirm IMO and vessel name correspond, verify the
vessel against a real registry (MarineTraffic, Equasis, or similar),
check if it's been inspected before in our system, and offer to view
history or start a new inspection.

**What was actually checked before writing any code**, using web search
(this project's bash sandbox has no network access at all, so nothing
below could have been assumed):

- **MarineTraffic's vessel API requires a paid subscription and an
  issued API key** — confirmed directly from their own documentation.
  Not something this project can wire up without that subscription,
  which is a real external cost only you can decide to take on.
- **Equasis's own terms explicitly prohibit this**: "No data can be
  harvested and reused in bulk without permission from Equasis. This
  includes webservices and API's." Building an automated integration
  against Equasis — even a modest one — would mean violating their
  terms of service, not just working around a technical limitation.
  That's a hard no, not a "not yet."

So neither is integrated, and building a fake version of either (a
stub that pretends to check a registry but doesn't) would have been
worse than being upfront about the gap. What's built instead is
everything that's actually achievable without a paid subscription or a
ToS violation:

- **A real, tested IMO check-digit validator**
  (`core/imo_validation.py`). Confirmed correct three ways: matched
  against the official algorithm description from multiple independent
  sources, and directly verified against two vessels whose real IMO
  numbers are independently confirmed by several vessel-tracking sites
  and Wikipedia (EVER GIVEN, IMO 9811000; HMM Copenhagen, IMO 9863302—
  both checksum-valid, as they should be). This proves a number is
  *well-formed* — it cannot prove a real ship holds it, which is stated
  plainly in the UI rather than implied.
- **A cross-check against this system's own certificate history**
  (`GET /certificates/vessel-lookup`) — the one part of "IMO and name
  must correspond" this system can genuinely verify: if an IMO has been
  recorded before under a different name, or a name under a different
  IMO, in *our own* records, it's flagged directly.
- **Prior inspection history for the vessel**, with a one-click way to
  open an old certificate (including one of a different equipment type
  — that path forces a real page navigation rather than a same-page
  route change, since the existing certificate-open handoff depends on
  data that a same-page navigation wouldn't refresh).

A real bug caught before it shipped: the vessel fields (Name of Ship,
IMO No.) turned out to live inside `StatementForm`, a separate
component from `InspectionWorkspace` with its own prop list — the
lookup panel's first draft referenced `openCertificate` assuming it was
in scope from the outer component, which TypeScript correctly flagged
as undefined. Fixed by passing it through as an explicit prop instead
of assuming a closure that didn't exist.

If a real external registry check is worth the cost later, the
backend endpoint (`vessel_lookup` in `api/routes/certificates.py`) is
the one place to add it — the response shape already has room for it,
and a MarineTraffic subscription is the realistic path (Equasis is not,
for the reason above).

## AppShell architecture — what was adopted, what wasn't, and why

A proposal suggested React Router nested layouts + shadcn/ui (Sidebar
components) + TanStack Query, with Refine as an alternative. Each piece
was evaluated on its own merits rather than accepted or rejected as one
bundle:

- **Nested layout routing with `<Outlet />` — adopted.** This is a
  legitimate React Router v6+ idiom (confirmed this project already
  runs `react-router-dom@^6.22.0`, which fully supports it), requires
  zero new dependencies, and is exactly as verifiable as everything
  else in this project via the same TypeScript check. The route tree in
  `App.tsx` now nests every gated page under one
  `<Route element={<RequireAuth />}>` wrapping one
  `<Route element={<AppShell />}>`, instead of a `Shielded` wrapper
  component repeated on every individual route. `RequireAuth.tsx` is
  now a pure layout-route auth gate (sign-in + the forced
  must_change_password redirect, checked once); the per-route role/
  permission check that used to live inside it moved to a new,
  lightweight `RequirePermission.tsx`.
- **shadcn/ui — not adopted.** It requires Tailwind CSS, which doesn't
  exist anywhere in this project — every page uses hand-written CSS
  built around HMZC's specific brand palette
  (`--insp-navy`/`--insp-green`/etc. in `styles/theme.css`), consistent
  across Inspections, Auth, and Finance. Adopting shadcn would mean
  either running two parallel styling systems or rewriting every
  existing page to Tailwind, for a component library that's generic by
  design and would need heavy re-theming to match this branding
  regardless. There's also no way to install or compile Tailwind/
  PostCSS/shadcn's CLI in the sandbox this project has been built in to
  verify any of it actually works — adopting it here would mean
  shipping untested build infrastructure on top of an app whose styling
  has been manually verified (visually, by construction) throughout.
- **TanStack Query — not adopted, for now.** A reasonable library in
  the abstract, but adopting it means touching every data-fetching hook
  in the app (`useInspections`, `useFinance`, both auth flows), none of
  which could be verified against a real cache/refetch cycle without a
  live environment — the same limitation that applies to everything
  else here. The current axios + `useState`/`useEffect` pattern works
  and has been verified consistently; worth revisiting once this is
  running somewhere real and staleness/caching becomes an observed
  problem rather than a theoretical one.
- **Refine — not appropriate.** A full admin-framework replacement, not
  a routing change; adopting it would discard a large amount of
  already-built, working code for no clear gain at this stage.

One real bug, same class as before: the rewritten `App.tsx` had a
stray `#` where a `//` comment was meant — caught and fixed by
specifically checking for that pattern before running the TypeScript
check, not by the check catching it after the fact (a `#` inside a
`//`-commented line doesn't break anything on its own; it was in a
position that would have). Also worth naming: the TypeScript check
itself initially flagged `Outlet` as missing from `react-router-dom` —
that was a gap in this project's own hand-written type stub (used
because the real package can't be installed in this sandbox), not a
real error; the actual `react-router-dom@^6.22.0` has exported
`Outlet` since v6.0.

## Next step

See `docs/UX_AUDIT.md` for a full review of the product as it stands —
strengths, gaps, and a prioritized list of what to build next, not just
what to fix. Nothing in this codebase has been run live — every
verification in this README has been static analysis (does it compile,
do the types line up, do the imports resolve) because no runtime
environment has been available at any point in this project's build-out.
The single most valuable next step, before any more features, is
probably just that: get it running somewhere real, click through it,
and see what breaks that static analysis couldn't have caught.
