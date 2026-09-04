// Fixed field definitions for the Fast Rescue Craft (FRC) Service
// Report, built directly from HMZC's own
// HMZC_FRC_Service_Report_Template.docx (Installation/Replacement of
// the self-righting bag & CO2 activation bottle).
//
// Requested directly: an extra selectable report type available
// specifically when working a Rescue Boat (FRC) certificate — same
// "one equipment type, several distinct report shapes" pattern Loose
// Gear uses for its own sub-types (see LOOSE_GEAR_SUB_TYPES in
// inspectionHelpers.ts), except scoped to rescueboat specifically
// (see the "Report Type" toggle in InspectionWorkspace.tsx) rather
// than a brand-new top-level equipment type, since this report only
// ever applies to a Rescue Boat. See FRCServiceReportData's own
// comment in inspection.types.ts for how a certificate carries this.

import { FRCServiceType } from "../types/inspection.types";

// The template's own "Components Removed / Installed" table lists
// exactly these 5 rows by number — not a free-form register (contrast
// Loose Gear's Multiple Items/Spare Parts registers, which really are
// open-ended). Only the Old/New Serial, Qty and Expiry columns are
// ever filled in per job; the description is fixed.
export const FRC_COMPONENT_ROWS: { key: string; description: string }[] = [
  { key: "airbag", description: "Self-Righting Bag (Air Bag Assembly)" },
  { key: "co2bottle", description: "CO₂ Activation Bottle" },
  { key: "bracket", description: "Bottle Bracket / Mounting Hardware" },
  { key: "lanyard", description: "Activation Cable / Lanyard" },
  { key: "hru", description: "Hydrostatic Release Unit (if fitted)" },
];

// The template's own "Testing & Function Checks" table, in order.
export const FRC_FUNCTION_CHECKS: { key: string; label: string }[] = [
  { key: "co2WeightVerified", label: "CO₂ bottle weight/pressure verified against manufacturer specification" },
  { key: "co2Mounted", label: "CO₂ bottle securely mounted, pinned and safety-wired" },
  { key: "lanyardConnected", label: "Activation cable/lanyard correctly connected and free to operate" },
  { key: "bagStowed", label: "Self-righting bag correctly folded/stowed and secured" },
  { key: "inflationTest", label: "Bag inflation / activation test carried out" },
  { key: "noLeaksOrDamage", label: "No leaks, chafing or damage observed on inspection" },
  { key: "rightingTest", label: "FRC righting test carried out (if applicable)" },
  { key: "resetAndSeal", label: "System reset, safety pin and tamper seal fitted after test" },
  { key: "returnedToStowage", label: "FRC returned to davit / stowage in service-ready condition" },
];

export const FRC_SERVICE_TYPE_LABELS: Record<FRCServiceType, string> = {
  installation: "Installation",
  replacement: "Replacement",
  "": "—",
};

// The template's own closing statement, printed on both the print
// preview (CertificatePreview.tsx) and the Word export
// (certificateDocxExport.ts) — kept in one place so the two can't
// drift out of sync with each other.
export const FRC_SCOPE_OF_WORK =
  "Installation / replacement of the self-righting bag (air bag assembly) and CO₂ activation bottle on the above Fast Rescue Craft, carried out in accordance with the manufacturer's maintenance instructions, SOLAS Chapter III and the LSA Code requirements. Work included removal of the existing/expired components, fitting of new certified components, function testing of the self-righting activation system, and re-instatement of the FRC to service-ready condition.";

export const FRC_CERTIFICATION_STATEMENT =
  "This report certifies that the above work was carried out by qualified personnel in accordance with the equipment manufacturer's instructions and applicable SOLAS/LSA Code requirements. It does not replace statutory survey or classification society certification where required.";
