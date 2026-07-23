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

/** One shared payload format so every page of a certificate encodes the same reference. */
export function buildCertQrPayload(certNo: string, vesselName: string, imoNo: string, dateOfServicing: string): string {
  return `HMZC CERTIFICATE\nNo: ${certNo}\nVessel: ${vesselName || "—"}\nIMO: ${imoNo || "—"}\nDate: ${dateOfServicing || "—"}`;
}
