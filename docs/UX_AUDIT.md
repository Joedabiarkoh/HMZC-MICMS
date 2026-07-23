# HMZC-MICMS — UX Audit

Reviewed as a working product, not a spec. Every finding below points at
a real file or a real screen you can open — this isn't a generic
checklist, it's what's actually there.

**Context that shapes every recommendation below:** the people using the
Inspections module are marine engineers standing on a deck or in an
engine room, often on older Android phones (the reference screenshots
sent earlier in this project showed a visibly cracked screen), sometimes
with gloves on, sometimes with poor signal. Design decisions here should
be judged against that reality first, and against a typical office
SaaS-dashboard standard second.

---

## 1. The single biggest structural gap: there is no app

Right now this is four unconnected pages that happen to share a design
language (three of them, anyway):

- `/inspections` — has its own top bar, with links to Certificate Log
  and (if admin) Users.
- `/certificates/log` — has its own top bar, no link back to
  Inspections' type picker, no link to Finance.
- `/admin/users` — **no navigation at all.** An admin who lands here
  has to hit the browser back button to leave.
- `/finance` and its sub-pages — completely unstyled (no CSS file
  exists for Finance at all — see `finance-dashboard__cards` in
  `FinanceDashboard.tsx`, which references classes nothing defines),
  and has no link to anything outside Finance.

There's no shell: no persistent sidebar or header that's the same
across every screen, no breadcrumb, no "you are here." Each module was
built as if it were the only thing in the app. That was a reasonable
shortcut while proving each piece out individually — it stops being
reasonable the moment a real person needs to move between "check the
crane" and "see who's signed up" and "look at this quarter's revenue"
in the same session, which is exactly what an admin will do daily.

**This is the first thing to fix, before any visual polish.** A single
`AppShell` component — logo, the four module entry points, current
user, sign out — wrapping every gated route, would cost less than a day
and would make the product feel like one thing instead of four demos.

---

## 2. Inspections module — where the real design effort went, and it shows

This is the strongest part of the product. Specific things done right:

- **Color-coding by equipment type** (`data-type` attribute driving CSS
  custom properties in `inspections.css`) gives a fast visual "which
  mode am I in" signal — genuinely useful when someone's flicking
  between a lifeboat cert and a crane cert.
- **The checklist status buttons** (Good / Part-Ex / Repair / N/A as
  four always-visible small buttons, not a dropdown) are the right call
  for a thumb on a small screen — no menu to open, no mis-tap risk from
  a dropdown that opens over the wrong row.
- **Signature capture and photo upload live inline in the form**, not
  behind a separate flow — reduces the number of screens between
  "inspecting" and "done."

### What's genuinely short here

- **The checklist form is one long scroll with no progress indication.**
  A lifeboat inspection has D-2 through D-6 (and D-7/D-8 conditionally)
  — that's 60+ individual toggle rows in `formChecklistHTML`-equivalent
  rendering with no "you've done 40 of 63 items" anywhere. On a phone,
  that's a lot of scrolling with no sense of how much is left. A sticky
  section-progress indicator (even just "D-4 of D-6") would meaningfully
  reduce the "did I finish this?" anxiety that drives people to
  double-check by scrolling back up.
- **No inline validation before Finalize.** A technician can hit
  "Finalize & Save" with every single checklist item still on its
  default "Good" and no photos attached, and it'll succeed. The photo
  upload component says "(required before finalizing)" in text, but
  nothing actually enforces it — see `PhotoUpload.tsx`, the label is
  informational only. Either enforce it or stop implying it's enforced;
  right now it's a promise the UI makes and doesn't keep.
- **Switching equipment type silently discards the in-progress form**
  (`setType` in `InspectionWorkspace.tsx` calls `startNew` with no
  confirmation beyond a native `confirm()` dialog). Native `confirm()`
  dialogs are easy to reflexively dismiss without reading — losing 20
  minutes of checklist entries to a misclick is a real risk, not a
  theoretical one, on a cracked touchscreen.
- **The "Print Blank Checklist" and "Print [Section] Only" buttons are
  seven buttons in a row** (`insp-btn-row` in `InspectionWorkspace.tsx`)
  with no visual grouping. Save actions, print actions, and "start
  over" are all the same visual weight. Group them (Save/Finalize as
  primary actions; Print as a secondary cluster, maybe a single "Print"
  button that opens a small menu of what to print) rather than a flat
  row of look-alike buttons.

---

## 3. Auth — functional, minimal, missing the connective tissue

`SignIn.tsx`/`SignUp.tsx` are clean, single-purpose, on-brand. Fine as
far as they go. Gaps:

- **No password reset flow.** For a field team that will absolutely
  forget passwords, this isn't optional polish, it's a support-ticket
  generator waiting to happen.
- **No "remember me" / persistent-session messaging.** The token lives
  in localStorage under `hmzc_token` with no expiry handling visible in
  `AuthContext.tsx` — if a JWT expires while someone's mid-checklist,
  what happens? Right now: the next API call 401s, and nothing in the
  UI explains why or routes them back to sign-in gracefully. That's a
  "lost my work and don't know why" moment.
- **Role selection at sign-up ("Inspector / Service Engineer", "Finance",
  "Client") asks a brand-new user to self-classify** with no
  explanation of what each role can see or do. Someone signing up in a
  hurry will guess. Either let an admin assign the real role after
  reviewing (the sign-up copy already says admin promotion is required
  for Administrator — extend that same reviewed-assignment pattern to
  all roles, or at minimum add one line of explanation per option).

---

## 4. Admin visibility (Users + Certificate Log) — does the job, feels like a spreadsheet

This directly answers what was asked for (who's signed up, who issued
what, when) and the backend behind it is solid — real foreign keys, not
string matching. But as a screen:

- **No date-range or role filtering** on either table — fine at 20
  users, becomes a scroll-and-squint exercise at 200.
- **"Promote to Admin" has no confirmation step.** Granting admin is a
  meaningfully consequential action and currently one tap does it
  (`AdminUsers.tsx`'s `promote` function fires immediately on click).
- **No audit trail of role changes.** You can see the *current* role,
  not who changed it or when. For a certification platform where "who
  had admin access on the date this certificate was issued" could
  plausibly matter, that's a real gap, not a nice-to-have.

---

## 5. Finance module — the part of the product that looks unfinished, because it is

This is worth stating plainly rather than softening: **Finance has no
visual design.** `FinanceDashboard.tsx` renders semantic HTML with BEM
class names that reference a stylesheet that doesn't exist anywhere in
the repo. Anyone who navigates from a polished Inspections screen into
Finance will reasonably assume something broke.

This isn't a criticism of the Finance *logic* — the hook, the API
layer, the component structure are all sound, same quality bar as
everything else. It's specifically that no one has done the CSS pass
yet. Given how much visual language already exists (the whole
`--insp-*` custom property system, the HMZC palette, the card/table/
badge patterns used in Inspections and Auth), extending that same
system to Finance is a mechanical afternoon of work, not a design
project — the hard design decisions are already made and sitting in
`inspections.css`.

---

## 6. Accessibility — currently not addressed, worth naming directly

- No `aria-label`s on icon-only or ambiguous controls (the SAT/N-SAT/
  Repair/N/A status buttons are single-letter text, which is at least
  readable by a screen reader, but nothing marks the currently-selected
  state for assistive tech — it's conveyed by background color alone).
- Color is the *only* signal for checklist status (green/amber/red
  pills). Someone with red-green color blindness — not a rare
  condition — is looking at a safety-critical inspection form where
  "Good" and "Repair" are distinguished only by hue. Add a shape or
  icon differentiator, not just color.
- No visible focus states beyond browser defaults were customized
  anywhere (`inspections.css`/`auth.css` don't define `:focus-visible`
  styles), which matters for anyone navigating by keyboard.
- Form inputs generally lack explicit `<label htmlFor>` association
  (labels are visually adjacent divs, not programmatically linked) —
  functional for sighted mouse users, a real barrier for screen reader
  users.

None of this is unusual for a project at this stage — it's unusual for
it to stay unaddressed once the product is actually being used daily by
a real team, especially for anything touching certification (some
jurisdictions treat inspection/certification tooling as needing to meet
accessibility standards regardless of team size).

---

## 7. What's genuinely strong — say this part plainly too

- **The color/typography system is coherent and intentional**, not
  default-Bootstrap-blue. The navy/green HMZC palette is applied
  consistently everywhere it's been applied at all.
- **The offline-first data model** (localStorage cache + sync queue,
  see `syncQueue.ts`) is the right architecture for field use, and
  it's now genuinely resilient, not just best-effort — that's a real
  technical strength most tools this size skip entirely.
- **The checklist content itself is authentic**, transcribed from
  HMZC's actual paper forms rather than generic placeholder text — the
  product speaks the inspector's language, not a generic SaaS
  template's language. That's worth more to adoption than most visual
  polish would be.
- **The QR code + watermark + issuer/timestamp on every printed page**
  gives the physical output real integrity signals — worth highlighting
  to HMZC's own clients as a differentiator, not just an internal nicety.

---

## 8. Prioritized recommendations

**Do first (structural, affects everything downstream):**
1. Build a shared `AppShell` — one header/nav present on every gated
   route. This single change would do more for the product feeling
   finished than any individual screen's polish.
2. Style Finance using the existing `insp-*`/`auth-*` design tokens —
   mechanical work, high visible payoff.
3. Enforce (not just imply) photo-required-before-finalize.

**Do next (trust and safety, given this is a certification tool):**
4. Confirmation step before granting admin.
5. Session-expiry handling that explains itself instead of silently
   401-ing.
6. Color-blind-safe status indicators on checklist items.

**Do when there's room (quality-of-life, still real):**
7. Progress indicator on long checklist forms.
8. Password reset flow.
9. Filtering/search on the Users and Certificate Log tables as they
   grow past a screenful.
10. Replace native `confirm()` dialogs (type-switch, delete actions)
    with an in-app confirmation component that's harder to
    reflexively dismiss.

None of this contradicts the technical foundation that's been built —
the backend, the offline sync, the data model are all solid enough to
support a genuinely good product on top of them. What's missing is the
layer that makes four well-built modules feel like one considered
product, and that's a normal, expected gap at this stage — not a sign
anything was done wrong.
