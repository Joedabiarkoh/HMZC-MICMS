import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface Props {
  payload: string;
  size?: number;
}

/**
 * Renders a small QR code encoding the certificate's identifying details
 * (see buildCertQrPayload below). Generated client-side via the `qrcode`
 * npm package — no backend call needed, so it still works when printing
 * offline/without the API reachable, consistent with the rest of the
 * certificate preview.
 */
export default function CertificateQR({ payload, size = 64 }: Props) {
  const [dataUri, setDataUri] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(payload, { margin: 1, width: size * 3 })
      .then((uri) => {
        if (!cancelled) setDataUri(uri);
      })
      .catch(() => {
        if (!cancelled) setDataUri("");
      });
    return () => {
      cancelled = true;
    };
  }, [payload, size]);

  if (!dataUri) return null;
  return <img src={dataUri} alt="Certificate verification QR code" width={size} height={size} style={{ display: "block" }} />;
}

/**
 * Requested directly: the QR code should stop confirming a certificate
 * once it's deleted. Previously this just encoded plain descriptive
 * text (vessel/IMO/date) baked in at print time — scanning it showed
 * that text and nothing else, with no connection to whether the
 * certificate still actually existed. Now it's a real URL to a public
 * verification page (see VerifyCertificate.tsx) that checks the
 * certificate against the live database on every scan — delete the
 * certificate, and the next scan shows "Not a Valid Certificate."
 *
 * window.location.origin (not a hardcoded backend/frontend URL) is
 * deliberate — whatever origin is actually serving this printed page
 * right now (localhost during dev, a tunnel, the real deployed
 * frontend) is exactly the origin a scanning phone should also be able
 * to reach, without this needing separate configuration per environment.
 */
export function buildCertQrPayload(certNo: string): string {
  return `${window.location.origin}/verify/${encodeURIComponent(certNo)}`;
}
