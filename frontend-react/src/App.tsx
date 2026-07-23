import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import FinanceDashboard from "./features/finance/pages/FinanceDashboard";
import Quotations from "./features/finance/pages/Quotations";
import QuotationForm from "./features/finance/pages/QuotationForm";
import Invoices from "./features/finance/pages/Invoices";
import InvoiceForm from "./features/finance/pages/InvoiceForm";
import ItemCatalog from "./features/finance/pages/ItemCatalog";
import Payments from "./features/finance/pages/Payments";
import Expenses from "./features/finance/pages/Expenses";
import JobCosting from "./features/finance/pages/JobCosting";
import FinancialReports from "./features/finance/pages/FinancialReports";
import InspectionWorkspace from "./features/inspections/pages/InspectionWorkspace";
import CertificateLog from "./features/inspections/pages/CertificateLog";
import VesselSearch from "./features/inspections/pages/VesselSearch";
import VerifyCertificate from "./features/inspections/pages/VerifyCertificate";
import SignIn from "./features/auth/pages/SignIn";
import SignUp from "./features/auth/pages/SignUp";
import ChangePassword from "./features/auth/pages/ChangePassword";
import AdminUsers from "./features/auth/pages/AdminUsers";
import AuditLog from "./features/auth/pages/AuditLog";
import { AuthProvider } from "./context/AuthContext";
import RequireAuth from "./context/RequireAuth";
import RequirePermission from "./context/RequirePermission";
import AppShell from "./layout/AppShell";
import { PERM } from "./features/auth/types/auth.types";

// Only the Finance module (Module 18) had concrete page components in the
// source chat, so it was originally the only one wired into routing here.
// Certificates was named in the architecture diagram but never given a
// real component (see src/pages/README.md) — Inspections/Certificates is
// now built (ported from the previous standalone checklist tool) and
// wired in the same additive way, without touching the Finance routes.
//
// Module 2 (Users + Auth) is wired in: AuthProvider wraps everything so
// useAuth() works anywhere, and RequireAuth gates every module behind
// sign-in.
//
// Route tree switched to React Router's nested-layout-route pattern —
// one <Route element={<RequireAuth />}> (sign-in + must_change_password
// check, once) wrapping one <Route element={<AppShell />}> (the nav
// shell, rendering <Outlet />) wrapping every actual page as a child
// route. Was a `Shielded` component repeated on every single route,
// each independently re-wrapping in both RequireAuth and AppShell —
// functionally identical, but this is the idiom React Router v6+ was
// actually designed around, and it was the one genuinely low-risk,
// dependency-free piece of a larger proposed rewrite (shadcn/ui,
// TanStack Query, Refine) that didn't get adopted; see the root
// README for the full reasoning on each.
//
// Per-route role/permission checks moved to RequirePermission.tsx
// (lightweight — just the access check, no more re-checking auth or
// re-wrapping AppShell on every route). Admin Users and Audit Log stay
// role-gated (roles={["admin"]}) — those are genuinely admin-only, not
// something the permission-grant system extends to (see the note in
// api/routes/auth.py on why). Everything else uses permission strings
// (see core/permissions.py on the backend and auth.types.ts's
// PERM/hasPermission on the frontend) — a fixed role check can't
// express "a Sales account that's also been granted finance.view,"
// only a role-independent permission check can.
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/signin" replace />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          {/* Public — no sign-in required. This is what a certificate's
              printed QR code links to (see CertificateQR.tsx), reachable
              by anyone scanning a printed page, not just signed-in staff. */}
          <Route path="/verify/:certNo" element={<VerifyCertificate />} />

          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route path="/account/change-password" element={<ChangePassword />} />
              <Route path="/admin/users" element={<RequirePermission roles={["admin"]}><AdminUsers /></RequirePermission>} />
              <Route path="/admin/audit-log" element={<RequirePermission roles={["admin"]}><AuditLog /></RequirePermission>} />

              <Route path="/finance" element={<RequirePermission permission={PERM.FIN_VIEW}><FinanceDashboard /></RequirePermission>} />
              {/* Item Catalog gets its own, narrower permission — someone
                  with finance.view (can see quotations/invoices) doesn't
                  automatically get to edit the underlying price list; that
                  needs finance.catalog_manage specifically, matching
                  backend-fastapi's require_permission(FIN_CATALOG_MANAGE)
                  on the item write endpoints. */}
              <Route path="/finance/items" element={<RequirePermission permission={PERM.FIN_CATALOG_MANAGE}><ItemCatalog /></RequirePermission>} />
              <Route path="/finance/quotations" element={<RequirePermission permission={PERM.FIN_VIEW}><Quotations /></RequirePermission>} />
              <Route path="/finance/quotations/new" element={<RequirePermission permission={PERM.FIN_EDIT}><QuotationForm /></RequirePermission>} />
              <Route path="/finance/quotations/:quotationNo" element={<RequirePermission permission={PERM.FIN_VIEW}><QuotationForm /></RequirePermission>} />
              <Route path="/finance/invoices" element={<RequirePermission permission={PERM.FIN_VIEW}><Invoices /></RequirePermission>} />
              <Route path="/finance/invoices/new" element={<RequirePermission permission={PERM.FIN_EDIT}><InvoiceForm /></RequirePermission>} />
              <Route path="/finance/invoices/:invoiceNo" element={<RequirePermission permission={PERM.FIN_VIEW}><InvoiceForm /></RequirePermission>} />
              <Route path="/finance/payments" element={<RequirePermission permission={PERM.FIN_VIEW}><Payments /></RequirePermission>} />
              <Route path="/finance/expenses" element={<RequirePermission permission={PERM.FIN_VIEW}><Expenses /></RequirePermission>} />
              <Route path="/finance/job-costing" element={<RequirePermission permission={PERM.FIN_VIEW}><JobCosting /></RequirePermission>} />
              <Route path="/finance/reports" element={<RequirePermission permission={PERM.FIN_VIEW}><FinancialReports /></RequirePermission>} />

              {/* Certificates module (architecture diagram name) — inspection
                  checklists for lifeboats, rescue boats, free-fall lifeboats and
                  deck cranes, with Firefighting Equipment and Loose Gear &
                  Lifting Equipment as "coming soon" divisions.
                  certificates.view (broader — Sales/Administration/Service
                  Coordination/Technical/admin/any grant) reaches the
                  workspace so an "Open" from the Certificate Log works for
                  view-only accounts too; InspectionWorkspace.tsx itself hides
                  every editing control unless the signed-in user also has
                  certificates.edit — see the permission check near its top. */}
              <Route path="/vessels" element={<RequirePermission permission={PERM.CERT_VIEW}><VesselSearch /></RequirePermission>} />
              <Route path="/inspections" element={<RequirePermission permission={PERM.CERT_VIEW}><InspectionWorkspace /></RequirePermission>} />
              <Route path="/certificates" element={<RequirePermission permission={PERM.CERT_VIEW}><InspectionWorkspace /></RequirePermission>} />
              <Route path="/certificates/log" element={<RequirePermission permission={PERM.CERT_VIEW}><CertificateLog /></RequirePermission>} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/signin" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
