import { useLayoutEffect } from "react";
import type { RefObject } from "react";

// Requested directly: "the FFE page when you create a page and it
// breaks and it half filled page should have the header and footer
// in the same position as the one which is full." A fixed min-height
// (the previous approach) only pads a section's content up to ONE
// page's worth — for a section whose content is naturally long enough
// to span several physical pages on its own (FFE's item table forces
// its own page breaks every 25 rows, so a certificate with 41 items
// spans two physical pages before the rest of the certificate's
// content even starts), only the TOTAL sum got padded, not each
// individual page within it — so the trailing, partially-filled page
// ended wherever its own leftover content happened to stop, not
// pushed down to match every full page's footer position.
//
// This measures the content's real (unpadded) height, then pads it up
// to the next whole multiple of "one page's worth of content" — so a
// section spanning 1.4 pages of real content gets stretched to fill
// exactly 2 full pages, and the footer on that second, mostly-empty
// page lands in the exact same spot the footer would land on a fully
// packed page. thead/tfoot heights are measured directly rather than
// hardcoded, so this self-adjusts if either ever changes size instead
// of needing a second hand-calculated constant kept in sync.
//
// SAFETY_MARGIN mirrors the same reasoning as the certificate/invoice
// page min-heights this replaces: real print/PDF rendering measured a
// few pixels taller than the identical layout looked on screen, so a
// large-ish margin (not a razor-thin one) is deliberate — pulled in
// closer to the true edge on request, but not shaved down to zero.
const PAGE_HEIGHT_PX = 1032; // @page A4 content area: (297mm - 24mm) at 96dpi
const SAFETY_MARGIN_PX = 55;

export function useFillToPageMultiple(
  fillRef: RefObject<HTMLElement>,
  theadRef: RefObject<HTMLElement>,
  tfootRef: RefObject<HTMLElement>,
) {
  useLayoutEffect(() => {
    const fill = fillRef.current;
    const thead = theadRef.current;
    const tfoot = tfootRef.current;
    if (!fill || !thead || !tfoot) return;

    // Reset before measuring — otherwise a min-height set by a
    // previous run would inflate the "natural" height being read here.
    fill.style.minHeight = "";
    const natural = fill.scrollHeight;

    const perPage = PAGE_HEIGHT_PX - thead.offsetHeight - tfoot.offsetHeight - SAFETY_MARGIN_PX;
    if (perPage <= 0) return; // header+footer alone would exceed a page — nothing sane to fill to

    const pages = Math.max(1, Math.ceil(natural / perPage));
    fill.style.minHeight = `${pages * perPage}px`;
  });
}
