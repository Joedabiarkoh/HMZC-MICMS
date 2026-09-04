// Fixed field definitions for the Gangway / Accommodation Ladder Load
// Test certificate — requested directly, given the exact section
// layout (Gangway Details / Test Details / Inspection Result).

import { GangwayResult } from "../types/inspection.types";

export const GANGWAY_RESULT_LABELS: Record<GangwayResult, string> = {
  satisfactory: "Satisfactory",
  not_satisfactory: "Not Satisfactory",
  "": "—",
};

// Requested directly, verbatim — the certificate's own fixed
// inspection-result statement, printed on both the print preview
// (CertificatePreview.tsx) and the Word export
// (certificateDocxExport.ts) so the two can't drift out of sync.
export const GANGWAY_INSPECTION_STATEMENT =
  "The gangway was visually inspected and subjected to the specified load test. No abnormal deformation, cracking, structural failure, or movement was observed during or after the test. The gangway was found satisfactory for continued service.";
