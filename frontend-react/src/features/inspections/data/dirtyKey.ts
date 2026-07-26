import { InspectionCertificate } from "../types/inspection.types";

// Extracted from InspectionWorkspace.tsx purely to be independently
// testable — behavior is unchanged. Deliberately excludes
// version/issuedBy/issuedAt. Those three are set by the SERVER, not the
// user, and land on `current` asynchronously, after saveCurrent's
// promise resolves (see its .then() in useInspections.ts) — strictly
// later than the snapshot taken when a save was initiated. Comparing
// full JSON.stringify(current) against a snapshot taken before that
// async merge meant every single save — auto or manual — was
// immediately followed by an apparent "diff" on the very next tick,
// purely from the server's response arriving, with zero actual user
// edits. Since the interval hardcodes status: "draft", that phantom
// diff kept re-firing every 20 seconds forever, and would eventually
// stomp a certificate that had just been manually finalized back to
// draft — confirmed by watching the actual network requests: two
// consecutive auto-saves 20 seconds apart, both "draft", with only
// `version` differing between them and every user-facing field
// identical.
export function dirtyKey(cert: InspectionCertificate): string {
  const { version, issuedBy, issuedAt, ...rest } = cert;
  return JSON.stringify(rest);
}
