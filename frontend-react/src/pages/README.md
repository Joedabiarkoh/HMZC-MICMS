Placeholder folder. The architecture diagram lists pages for
Login, Dashboard, Customers, Vessels, Certificates, Reports, Users —
but the chat never wrote their component code.

Login, Certificates, and Users are now built — as
`src/features/auth/pages/{SignIn,SignUp,AdminUsers}.tsx` and
`src/features/inspections/pages/InspectionWorkspace.tsx`, following
Finance's per-feature folder convention rather than this shared
top-level pages/ folder. Customers, Vessels, Dashboard, and Reports are
still unbuilt — build them the same way once their backend routes
exist.
