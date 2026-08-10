import { InspectionCertificate, PhotoEvidence } from "../types/inspection.types";
import VesselLookupPanel from "./VesselLookupPanel";
import PhotoUpload from "./PhotoUpload";
import SignatureCanvas from "./SignatureCanvas";
import FitForPurposeField from "./FitForPurposeField";

interface Props {
  current: InspectionCertificate;
  updateField: <K extends keyof InspectionCertificate>(key: K, value: InspectionCertificate[K]) => void;
  openCertificate: (certNo: string) => void;
}

// Requested directly: "photo report for FFE and Calibration should be
// all together for the vessel but not for each inspection, make a
// section for photo report that the technician can select and make a
// photo report for the inspection done for the vessel." FFE and
// Calibration inspections are split across many narrow sub-type
// certificates per vessel visit (see FFEForm.tsx/CalibrationForm.tsx)
// — tying photo evidence to just one of those certificates would
// fragment it across however many sub-types happened to be issued
// that visit. This is its own certificate type instead (kind:
// "photoreport", see inspectionChecklists.ts's photo_report entry):
// no checklist, no item register, just vessel identity, one combined
// set of photos with captions, and a sign-off — reusing the same
// finalize/print/Save-as-Word/permissions pipeline every other
// certificate type already has, rather than a bespoke new subsystem.
const PHOTO_KEY = "general";

export default function PhotoReportForm({ current, updateField, openCertificate }: Props) {
  function addPhotos(newPhotos: PhotoEvidence[]) {
    updateField("photos", { ...current.photos, [PHOTO_KEY]: [...(current.photos[PHOTO_KEY] || []), ...newPhotos] });
  }
  function removePhoto(index: number) {
    const list = [...(current.photos[PHOTO_KEY] || [])];
    list.splice(index, 1);
    updateField("photos", { ...current.photos, [PHOTO_KEY]: list });
  }
  function updateCaption(index: number, caption: string) {
    const list = [...(current.photos[PHOTO_KEY] || [])];
    if (!list[index]) return;
    list[index] = { ...list[index], caption };
    updateField("photos", { ...current.photos, [PHOTO_KEY]: list });
  }

  return (
    <>
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Certificate</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="pr-vessel">Vessel</label><input id="pr-vessel" value={current.vesselName} onChange={(e) => updateField("vesselName", e.target.value)} /></div>
          <div className="insp-field"><label htmlFor="pr-cert-no">Certificate No</label><input id="pr-cert-no" value={current.certNo} readOnly /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="pr-imo">IMO No</label><input id="pr-imo" value={current.imoNo} onChange={(e) => updateField("imoNo", e.target.value)} /></div>
          <div className="insp-field"><label htmlFor="pr-date">Date</label><input id="pr-date" type="date" value={current.dateOfServicing} onChange={(e) => updateField("dateOfServicing", e.target.value)} /></div>
        </div>
      </fieldset>

      <VesselLookupPanel
        vesselName={current.vesselName}
        imoNo={current.imoNo}
        onOpenCertificate={(certNo, equipmentType) => {
          if (equipmentType === current.type) {
            openCertificate(certNo);
          } else {
            window.location.href = `/inspections?type=${equipmentType}&open=${encodeURIComponent(certNo)}`;
          }
        }}
      />

      <PhotoUpload
        photos={current.photos[PHOTO_KEY] || []}
        onAdd={addPhotos}
        onRemove={removePhoto}
        onCaptionChange={updateCaption}
      />

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Comments</legend>
        <textarea rows={3} value={current.remarks} onChange={(e) => updateField("remarks", e.target.value)} />
      </fieldset>

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Signatures</legend>
        <FitForPurposeField value={current.fitForPurpose || ""} onChange={(v) => updateField("fitForPurpose", v)} />
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="pr-master-name">Master Name (optional)</label><input id="pr-master-name" value={current.captainName} onChange={(e) => updateField("captainName", e.target.value)} /></div>
          <div className="insp-field"><label htmlFor="pr-technician-name">Technician Name</label><input id="pr-technician-name" value={current.engineerName} onChange={(e) => updateField("engineerName", e.target.value)} /></div>
        </div>
        <div className="insp-row2">
          <SignatureCanvas label="Master Signature" value={current.captainSig} onChange={(v) => updateField("captainSig", v)} />
          <SignatureCanvas label="Technician Signature" value={current.engineerSig} onChange={(v) => updateField("engineerSig", v)} allowSavedDefault />
        </div>
      </fieldset>
    </>
  );
}
