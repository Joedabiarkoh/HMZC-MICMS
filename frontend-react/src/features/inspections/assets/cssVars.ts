import { HMZC_LOGO_DATA_URI } from "./logo";
import { HMZC_STAMP_DATA_URI } from "./stamp";
import { HMZC_WATERMARK_ICON_DATA_URI } from "./watermarkIcon";

// Requested directly, reviewing why a multi-section certificate's
// Paged.js pagination (PagedPreview.tsx) was blocking the browser tab
// for tens of seconds: the HMZC logo and stamp were each embedded as
// their own <img src="data:..."> (or inline watermark style) inside
// EVERY certificate section — CertPageFrame's Letterhead and
// SignatureGrid both render once per section, so a 4-section
// certificate carried 4 full copies of each in the HTML Paged.js had
// to lay out, well over half a megabyte of pure duplication before
// counting anything else.
//
// Set once, directly on the root element (equivalent to a CSS
// `:root { --x: ... }` rule, but doesn't need a stylesheet reload or
// re-parse to exist), rather than duplicated per section — every
// section now just references var(--insp-watermark-url)/
// var(--insp-stamp-url) via a background-image instead of carrying
// its own copy. Imported once, for this side effect only, from
// CertificatePreview.tsx and FinanceDocumentPreview.tsx (the only
// consumers of either variable) — safe to import from both, since a
// module's top-level code only ever runs once no matter how many
// places import it.
document.documentElement.style.setProperty("--insp-watermark-url", `url(${HMZC_LOGO_DATA_URI})`);
document.documentElement.style.setProperty("--insp-stamp-url", `url(${HMZC_STAMP_DATA_URI})`);
// Requested directly: "use this as the water mark" — a separate
// variable from --insp-watermark-url above (still used by the
// letterhead's own small logo) so swapping the big background
// watermark's image doesn't also change the letterhead.
document.documentElement.style.setProperty("--insp-watermark-icon-url", `url(${HMZC_WATERMARK_ICON_DATA_URI})`);
