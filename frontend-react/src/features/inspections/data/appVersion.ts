// Requested directly, reviewing a real CRALOG-issued certificate for
// comparison: their printed pages carry a software build stamp ("Issued
// 10-AUG-2026 18:44 UTC (v2026.08.04)") — useful for answering "was this
// PDF actually produced by our system, unedited" if a certificate's
// authenticity is ever questioned, and for support to know which build
// generated a given document. Bump APP_BUILD_VERSION by hand on a
// meaningful release the way CRALOG's own date-stamped version implies
// they do — there's no CI/build pipeline wiring a real version number
// into the frontend bundle here, so a hand-maintained constant is the
// honest, low-effort equivalent rather than inventing build tooling this
// project doesn't otherwise need.
export const APP_BUILD_VERSION = "2026.08.10";
