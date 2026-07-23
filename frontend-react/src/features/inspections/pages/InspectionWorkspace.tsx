import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "../inspections.css";
import { INSPECTION_TYPES } from "../data/inspectionChecklists";
import { useInspections } from "../hooks/useInspections";
import { EquipmentTypeKey, ChecklistSection, EquipResult } from "../types/inspection.types";
import ChecklistGroup from "../components/ChecklistGroup";
import ComingSoon from "./ComingSoon";
import CertificatePreview from "../components/CertificatePreview";
import SignatureCanvas from "../components/SignatureCanvas";
import PhotoUpload from "../components/PhotoUpload";
import VesselLookupPanel from "../components/VesselLookupPanel";
import { useAuth } from "../../../context/AuthContext";
import { hasPermission, PERM } from "../../auth/types/auth.types";

const TYPE_GROUPS: { label: string; keys: EquipmentTypeKey[] }[] = [
  { label: "Lifesaving Appliances", keys: ["lifeboat", "rescueboat", "freefall_dry", "freefall_tanker"] },
  { label: "Lifting Appliances", keys: ["crane", "loosegear"] },
  { label: "Fire Safety", keys: ["firefighting"] },
];

type SubTab = "statement" | "boat" | "davit" | "equip" | "checklist" | "loadtest";

// Certificates now sync to a real backend table (issued_by_id -> users.id,
// see backend-fastapi/app/models/certificate.py) instead of living only in
// localStorage — `savedBy`/`savedAt` below are this device's local record
// of a save; `issuedBy`/`issuedAt` on the certificate (once synced) are the
// backend-authoritative version tied to a real user id, shown in the
// Certificate Log and to admins.

export default function InspectionWorkspace() {
  const [searchParams] = useSearchParams();
  const [type, setType] = useState<EquipmentTypeKey>((searchParams.get("type") as EquipmentTypeKey) || "lifeboat");
  const [sub, setSub] = useState<SubTab>("statement");
  // Tracks which subtabs have actually been opened this session — used
  // for the "have I looked at every section" indicator on the subtab
  // bar. Deliberately not trying to track "has every individual
  // checklist item been reviewed": items default to "Good" (matching
  // the paper checklists this replaced, which come pre-ticked the same
  // way), so there's no way to tell a genuinely-reviewed-and-fine item
  // apart from one nobody looked at — that would need a real change to
  // the checklist item's own data shape, not just this page. "Opened
  // this tab at least once" is the honest, achievable version of a
  // progress indicator without that larger change.
  const [visitedTabs, setVisitedTabs] = useState<Set<SubTab>>(new Set(["statement"]));
  const { current, setCurrent, saveCurrent, startNew, openCertificate, certificates, syncError, pendingSyncCount, retrySync } = useInspections(type);
  const { user } = useAuth();

  const cfg = INSPECTION_TYPES[type];

  // Auto-save + "you have unsaved changes" warning. Placed here (before
  // the placeholder/view-only early returns below) because hooks can't
  // be called conditionally — the effect itself checks canEdit/cfg.kind
  // internally instead of being skipped via an early return.
  //
  // Tracks "dirty" by comparing the current in-memory certificate
  // against a snapshot taken at the moment of the last successful save.
  // currentRef holds the latest value without being a dependency of the
  // interval/beforeunload effect below — depending on `current` directly
  // there would tear down and recreate the interval on every single
  // keystroke (current changes on every field edit), meaning auto-save
  // might never actually fire during continuous typing since the timer
  // would keep resetting before reaching 20 seconds. The ref lets the
  // interval keep running on a true fixed schedule while still reading
  // the latest content when it fires.
  const currentRef = useRef(current);
  currentRef.current = current;
  // saveCurrent is itself a useCallback that closes over useInspections'
  // own `current` at the moment it was created (see saveCurrent in
  // useInspections.ts) — a stale reference to it would silently save
  // outdated content even with currentRef above in place, since the
  // ref only helps the dirty-check logic here, not what saveCurrent
  // itself captured internally. Refreshed every render so the interval
  // below always calls the version that's actually in sync with the
  // latest `current`.
  const saveCurrentRef = useRef(saveCurrent);
  saveCurrentRef.current = saveCurrent;
  const lastSavedSnapshot = useRef<string>(JSON.stringify(current));
  useEffect(() => {
    lastSavedSnapshot.current = JSON.stringify(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.certNo]); // reset the baseline whenever a *different* certificate is loaded

  useEffect(() => {
    const canAutoSave = cfg.kind !== "placeholder" && hasPermission(user, PERM.CERT_EDIT);
    if (!canAutoSave) return;

    const interval = window.setInterval(() => {
      const snapshot = JSON.stringify(currentRef.current);
      if (snapshot === lastSavedSnapshot.current) return; // nothing changed since the last save
      const hasAnyIdentity = currentRef.current.vesselName.trim() || currentRef.current.imoNo.trim();
      if (!hasAnyIdentity) return; // don't auto-save a still-completely-blank new draft
      const savedByName = user ? (user.full_name || user.email) : currentRef.current.savedBy;
      saveCurrentRef.current("draft", savedByName);
      lastSavedSnapshot.current = snapshot;
    }, 20_000);

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (JSON.stringify(currentRef.current) === lastSavedSnapshot.current) return;
      e.preventDefault();
      e.returnValue = ""; // required for Chrome to show the native confirmation
    }
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.kind, user]);

  // Handoff from the Certificate Log page (a separate hook instance, so
  // state isn't shared directly — see the comment in CertificateLog.tsx):
  // it navigates here with ?open=<certNo> instead of calling
  // openCertificate() on its own instance.
  useEffect(() => {
    const openCertNo = searchParams.get("open");
    if (openCertNo && certificates[openCertNo]) {
      openCertificate(openCertNo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certificates]);

  // Handoff from the Vessels page (VesselSearch.tsx): "+ Start New
  // Inspection" for a selected vessel navigates here with
  // ?vesselName=&imoNo=&type= instead of leaving the vessel fields blank
  // for someone to retype what they just searched for. Guarded by a ref
  // so it only ever applies once, on the navigation that carried these
  // params — without that guard this would keep clobbering vesselName/
  // imoNo back to the searched vessel every time `current` changes
  // (which is on every keystroke), since setting state re-renders and
  // re-runs effects.
  const appliedVesselHandoff = useRef(false);
  useEffect(() => {
    if (appliedVesselHandoff.current) return;
    const vesselName = searchParams.get("vesselName");
    const imoNo = searchParams.get("imoNo");
    if (vesselName || imoNo) {
      appliedVesselHandoff.current = true;
      startNew(type, vesselName || "", imoNo || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTypeChange(next: EquipmentTypeKey) {
    setType(next);
    setSub("statement");
    startNew(next);
  }

  function updateField<K extends keyof typeof current>(key: K, value: (typeof current)[K]) {
    setCurrent((prev) => ({ ...prev, [key]: value }));
  }

  function updateNested(group: "boat" | "release" | "davit" | "winch" | "crane" | "wireRope" | "loadTest", field: string, value: string) {
    setCurrent((prev) => ({ ...prev, [group]: { ...(prev as any)[group], [field]: value } }));
  }

  function updateChecklistItem(
    key: "boatChecklist" | "davitChecklist" | "checklist",
    sectionIndex: number,
    itemIndex: number,
    isSpecial: boolean,
    field: "status" | "remark",
    value: string
  ) {
    setCurrent((prev) => {
      const sections = [...(prev[key] || [])] as ChecklistSection[];
      const section = { ...sections[sectionIndex] };
      if (isSpecial) {
        const special = [...section.special];
        special[itemIndex] = { ...special[itemIndex], [field]: value };
        section.special = special;
      } else {
        const items = [...section.items];
        items[itemIndex] = { ...items[itemIndex], [field]: value } as any;
        section.items = items;
      }
      sections[sectionIndex] = section;
      return { ...prev, [key]: sections };
    });
  }

  function updateEquip(index: number, field: "result" | "remark", value: string) {
    setCurrent((prev) => {
      const equip = [...(prev.equip || [])];
      equip[index] = { ...equip[index], [field]: field === "result" ? (value as EquipResult) : value } as any;
      return { ...prev, equip };
    });
  }

  function updateOutstanding(key: string, value: string) {
    setCurrent((prev) => ({ ...prev, outstanding: { ...prev.outstanding, [key]: value } }));
  }

  function addPhotos(key: string, dataUris: string[]) {
    setCurrent((prev) => ({
      ...prev,
      photos: { ...prev.photos, [key]: [...(prev.photos[key] || []), ...dataUris] },
    }));
  }

  function removePhoto(key: string, index: number) {
    setCurrent((prev) => {
      const list = [...(prev.photos[key] || [])];
      list.splice(index, 1);
      return { ...prev, photos: { ...prev.photos, [key]: list } };
    });
  }

  function updateSignature(field: "captainSig" | "engineerSig", value: string) {
    setCurrent((prev) => ({ ...prev, [field]: value }));
  }

  function toggleAutoRemarks(auto: boolean) {
    setCurrent((prev) => ({
      ...prev,
      remarksAuto: auto,
      remarks: auto && cfg.remarksTemplate ? cfg.remarksTemplate(prev.location) : prev.remarks,
    }));
  }

  // Was photo-requirements-only (missingPhotoRequirements). Extended
  // into a real "Smart Validation Engine" per a readiness review: a
  // certificate could previously be finalized with no vessel name, no
  // IMO number, no engineer name, and no signature at all — nothing
  // stopped it, since only the photo minimums were ever checked. For a
  // document meant to represent a real safety inspection, that's a
  // bigger gap than it sounds. Kept as one function (not several
  // separately-named ones) so there's one single source of truth for
  // "can this be finalized," used both to disable the button and to
  // explain why when someone tries anyway.
  function getFinalizeBlockers(): string[] {
    const problems: string[] = [];

    if (!current.vesselName.trim() && !current.imoNo.trim()) {
      problems.push("Vessel name or IMO number is required");
    }
    if (!current.engineerName.trim()) {
      problems.push("Service Engineer name is required");
    }
    if (!current.engineerSig) {
      problems.push("Service Engineer signature is required");
    }

    const min = cfg.minPhotos || {};
    for (const [key, required] of Object.entries(min)) {
      if (required <= 0) continue;
      const have = (current.photos[key] || []).length;
      if (have < required) {
        const sectionLabel = key === "boatChecklist" ? cfg.boatTitle : key === "davitChecklist" ? cfg.davitTitle : cfg.checklistTitle;
        problems.push(`${sectionLabel}: ${have}/${required} photos uploaded`);
      }
    }
    return problems;
  }

  function handleSave(status: "draft" | "final") {
    if (status === "final") {
      const missing = getFinalizeBlockers();
      if (missing.length > 0) {
        window.alert(`Cannot finalize — this certificate isn't complete yet:\n\n${missing.join("\n")}\n\nFix the above, or save as Draft instead.`);
        return;
      }
    }
    const savedByName = user ? (user.full_name || user.email) : current.savedBy;
    const saved = saveCurrent(status, savedByName);
    window.alert(`Certificate ${saved.certNo} saved as ${status.toUpperCase()}.`);
  }

  if (cfg.kind === "placeholder") {
    return (
      <div className="inspections-page" data-type={type}>
        <TopBar type={type} onTypeChange={handleTypeChange} />
        <ComingSoon config={cfg} />
      </div>
    );
  }

  // Sales, Administration, and Service Coordination (by default — see
  // core/permissions.py's ROLE_DEFAULT_PERMISSIONS) reach this page with
  // certificates.view but not certificates.edit, via "Open" on the
  // Certificate Log. They get the read-only certificate itself (still
  // fully printable/downloadable) instead of the editable form and
  // action buttons below, which is what "can see certificate issued and
  // download but cannot make changes" actually means in this UI.
  const canEdit = hasPermission(user, PERM.CERT_EDIT);
  if (!canEdit) {
    const isViewingRealCert = !!certificates[current.certNo];
    return (
      <div className="inspections-page" data-type={type}>
        <TopBar type={type} onTypeChange={handleTypeChange} viewOnly />
        <div style={{ padding: "10px 20px 0" }}>
          <div style={{ background: "#E7ECF1", border: "1px solid #455A73", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#243040" }}>
            View-only access — you can see and print/download certificates, but only Technical staff
            or an administrator can create or edit them.
          </div>
        </div>
        {isViewingRealCert ? (
          <>
            <div className="insp-cert-scroll">
              <CertificatePreview cert={current} config={cfg} />
            </div>
            <div className="insp-btn-row">
              <button className="insp-btn insp-btn-primary" onClick={() => window.print()}>Print / Download</button>
            </div>
          </>
        ) : (
          <div style={{ padding: 40, textAlign: "center", color: "var(--insp-muted)" }}>
            Open a certificate from the <a href="/certificates/log">Certificate Log</a> to view it here.
          </div>
        )}
      </div>
    );
  }

  const isBoat = cfg.kind === "boat";
  const subtabs: { key: SubTab; label: string }[] = isBoat
    ? [
        { key: "statement", label: "Statement" },
        { key: "boat", label: cfg.boatTitle || "Boat Checklist" },
        { key: "davit", label: cfg.davitTitle || "Davit Checklist" },
        { key: "equip", label: "Equipment List" },
      ]
    : [
        { key: "statement", label: "Statement" },
        { key: "checklist", label: cfg.checklistTitle || "Inspection Checklist" },
        { key: "loadtest", label: "Load Test Record" },
      ];

  return (
    <div className="inspections-page" data-type={type}>
      <TopBar type={type} onTypeChange={handleTypeChange} />
      {syncError && (
        <div style={{ margin: "10px 20px 0", background: "#FBF0E2", border: "1px solid #B4690E", color: "#7A4A08", borderRadius: 6, padding: "8px 12px", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span>{syncError}</span>
          {pendingSyncCount > 0 && (
            <button className="insp-btn insp-btn-outline" style={{ padding: "3px 10px", fontSize: 11 }} onClick={retrySync}>Retry Now</button>
          )}
        </div>
      )}

      <div className="insp-subtabs">
        {subtabs.map((s) => (
          <button
            key={s.key}
            className={`insp-subtab ${sub === s.key ? "active" : ""}`}
            onClick={() => {
              setSub(s.key);
              setVisitedTabs((prev) => new Set(prev).add(s.key));
            }}
          >
            {visitedTabs.has(s.key) && <span style={{ color: "var(--insp-green)", marginRight: 4 }}>✓</span>}
            {s.label}
          </button>
        ))}
      </div>

      <div className="insp-layout">
        <div className="insp-panel">
          <div className="insp-panel-header">{subtabs.find((s) => s.key === sub)?.label}</div>
          <div className="insp-panel-body">
            {sub === "statement" && (
              <StatementForm
                type={type}
                current={current}
                updateField={updateField}
                updateNested={updateNested}
                toggleAutoRemarks={toggleAutoRemarks}
                updateSignature={updateSignature}
                openCertificate={openCertificate}
              />
            )}

            {sub === "boat" && isBoat && (
              <>
                {(current.boatChecklist || []).map((section, i) => (
                  <ChecklistGroup
                    key={section.code}
                    section={section}
                    onItemChange={(idx, field, val) => updateChecklistItem("boatChecklist", i, idx, false, field, val)}
                    onSpecialChange={(idx, field, val) => updateChecklistItem("boatChecklist", i, idx, true, field, val)}
                  />
                ))}
                <OutstandingAndPhotos
                  checklistKey="boatChecklist"
                  outstanding={current.outstanding.boatChecklist || ""}
                  photos={current.photos.boatChecklist || []}
                  minRequired={cfg.minPhotos?.boatChecklist || 0}
                  onOutstandingChange={updateOutstanding}
                  onAddPhotos={addPhotos}
                  onRemovePhoto={removePhoto}
                />
              </>
            )}

            {sub === "davit" && isBoat && (
              <>
                {(current.davitChecklist || []).map((section, i) => (
                  <ChecklistGroup
                    key={section.code}
                    section={section}
                    disabled={section.hydraulicGate && type === "rescueboat" && !current.hydraulicFitted}
                    disabledReason="not fitted (enable in Statement tab)"
                    onItemChange={(idx, field, val) => updateChecklistItem("davitChecklist", i, idx, false, field, val)}
                    onSpecialChange={(idx, field, val) => updateChecklistItem("davitChecklist", i, idx, true, field, val)}
                  />
                ))}
                <OutstandingAndPhotos
                  checklistKey="davitChecklist"
                  outstanding={current.outstanding.davitChecklist || ""}
                  photos={current.photos.davitChecklist || []}
                  minRequired={cfg.minPhotos?.davitChecklist || 0}
                  onOutstandingChange={updateOutstanding}
                  onAddPhotos={addPhotos}
                  onRemovePhoto={removePhoto}
                />
              </>
            )}

            {sub === "checklist" && !isBoat && (
              <>
                {(current.checklist || []).map((section, i) => (
                  <ChecklistGroup
                    key={section.code}
                    section={section}
                    onItemChange={(idx, field, val) => updateChecklistItem("checklist", i, idx, false, field, val)}
                    onSpecialChange={(idx, field, val) => updateChecklistItem("checklist", i, idx, true, field, val)}
                  />
                ))}
                <OutstandingAndPhotos
                  checklistKey="checklist"
                  outstanding={current.outstanding.checklist || ""}
                  photos={current.photos.checklist || []}
                  minRequired={cfg.minPhotos?.checklist || 0}
                  onOutstandingChange={updateOutstanding}
                  onAddPhotos={addPhotos}
                  onRemovePhoto={removePhoto}
                />
              </>
            )}

            {sub === "equip" && isBoat && (
              <EquipmentForm equip={current.equip || []} onChange={updateEquip} />
            )}

            {sub === "loadtest" && !isBoat && (
              <LoadTestForm current={current} updateNested={updateNested} />
            )}
          </div>
        </div>

        <div className="insp-panel">
          <div className="insp-panel-header">Certificate Preview</div>
          <div className="insp-cert-scroll">
            <CertificatePreview cert={current} config={cfg} />
          </div>
        </div>
      </div>

      {getFinalizeBlockers().length > 0 && (
        <div style={{ margin: "0 20px 10px", background: "#FBF0E2", border: "1px solid #B4690E", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#7A4A08" }}>
          <strong>Not ready to finalize yet:</strong> {getFinalizeBlockers().join(" · ")}
        </div>
      )}
      <div className="insp-btn-row">
        <button className="insp-btn insp-btn-outline" onClick={() => handleSave("draft")}>Save Draft</button>
        <button
          className="insp-btn insp-btn-primary"
          onClick={() => handleSave("final")}
          disabled={getFinalizeBlockers().length > 0}
          title={getFinalizeBlockers().length > 0 ? `Not ready to finalize: ${getFinalizeBlockers().join("; ")}` : undefined}
        >
          Finalize &amp; Save
        </button>
        <button className="insp-btn insp-btn-outline" onClick={() => window.print()}>Print</button>
        <button className="insp-btn insp-btn-outline" onClick={() => startNew(type)}>New Certificate</button>
      </div>
    </div>
  );
}

function TopBar({ type, onTypeChange, viewOnly }: { type: EquipmentTypeKey; onTypeChange: (t: EquipmentTypeKey) => void; viewOnly?: boolean }) {
  return (
    <div className="insp-topbar">
      <div>
        <h1>Inspection Checklists &amp; Certificates</h1>
        <p>HMZC LTD — Marine Engineering Services</p>
      </div>
      {/* Switching type calls startNew(), which discards whatever's
          currently loaded and starts a blank draft — fine for an editor,
          but it would silently throw away the certificate a view-only
          user just opened, with no way for them to get it back (they
          can't save). Hidden rather than disabled so it's not a dead
          control sitting in the header. */}
      {!viewOnly && (
        <select className="insp-type-select" value={type} onChange={(e) => onTypeChange(e.target.value as EquipmentTypeKey)}>
          {TYPE_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.keys.map((k) => (
                <option key={k} value={k}>{INSPECTION_TYPES[k].typeName}</option>
              ))}
            </optgroup>
          ))}
        </select>
      )}
    </div>
  );
}

function StatementForm({ type, current, updateField, updateNested, toggleAutoRemarks, updateSignature, openCertificate }: any) {
  const cfg = INSPECTION_TYPES[type as EquipmentTypeKey];
  const isBoat = cfg.kind === "boat";

  return (
    <>
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Certificate</legend>
        <div className="insp-row2">
          <div className="insp-field"><label>Certificate No.</label><input value={current.certNo} readOnly /></div>
          <div className="insp-field"><label>Date of Servicing</label><input type="date" value={current.dateOfServicing} onChange={(e) => updateField("dateOfServicing", e.target.value)} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field">
            <label>Kind of Servicing</label>
            <select value={current.kindOfServicing} onChange={(e) => updateField("kindOfServicing", e.target.value)}>
              <option>Annual</option>
              <option>5-Yearly</option>
              <option>Post-Repair</option>
            </select>
          </div>
          <div className="insp-field"><label>Last Date of Servicing</label><input type="date" value={current.lastServicing} onChange={(e) => updateField("lastServicing", e.target.value)} /></div>
        </div>
        <div className="insp-field"><label>Port of Servicing</label><input value={current.portServicing} onChange={(e) => updateField("portServicing", e.target.value)} placeholder="e.g. Cabinda, Angola" /></div>
      </fieldset>

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Vessel</legend>
        <div className="insp-field"><label>Name of Ship</label><input value={current.vesselName} onChange={(e) => updateField("vesselName", e.target.value)} /></div>
        <div className="insp-row2">
          <div className="insp-field"><label>IMO No.</label><input value={current.imoNo} onChange={(e) => updateField("imoNo", e.target.value)} /></div>
          <div className="insp-field">
            <label>{isBoat ? "Location on Board" : "Crane Location"}</label>
            <input list="sideOpts" value={current.location} onChange={(e) => updateField("location", e.target.value)} />
            <datalist id="sideOpts">{(cfg.sideOptions || []).map((o: string) => <option key={o} value={o} />)}</datalist>
          </div>
        </div>
      </fieldset>

      <VesselLookupPanel
        vesselName={current.vesselName}
        imoNo={current.imoNo}
        onOpenCertificate={(certNo, equipmentType) => {
          if (equipmentType === type) {
            // Same equipment type as the current tab — the hook already
            // manages this type's state, so the tested, direct path works.
            openCertificate(certNo);
          } else {
            // Different equipment type: a same-page React Router
            // navigation wouldn't reliably re-trigger the certificate-
            // open handoff below (it depends on `certificates`, not
            // `searchParams`, and switching type via this route doesn't
            // remount the component). A real navigation does — it's
            // the exact same mechanism CertificateLog.tsx already uses
            // successfully to open a certificate from a different page.
            window.location.href = `/inspections?type=${equipmentType}&open=${encodeURIComponent(certNo)}`;
          }
        }}
      />

      {isBoat ? (
        <>
          <IdBlock title={cfg.label} prefix="boat" obj={current.boat} capacity={current.capacity} onChange={updateNested} onCapacity={(v: string) => updateField("capacity", v)} isBoat />
          <IdBlock title="Release Mechanism" prefix="release" obj={current.release} onChange={updateNested} />
          <IdBlock title={cfg.davitTitle?.includes("Launching") ? "Launching Appliance" : "Davit"} prefix="davit" obj={current.davit} onChange={updateNested}>
            {type === "rescueboat" && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <input type="checkbox" checked={!!current.hydraulicFitted} onChange={(e) => updateField("hydraulicFitted", e.target.checked)} />
                Hydraulic davit system fitted (enables Davit Checklist D-4)
              </label>
            )}
          </IdBlock>
          <IdBlock title="Winch" prefix="winch" obj={current.winch} onChange={updateNested} />
        </>
      ) : (
        <>
          <fieldset className="insp-fieldset">
            <legend className="insp-legend">Crane</legend>
            <div className="insp-row2">
              <div className="insp-field"><label>Type</label><input value={current.crane?.typeName || ""} onChange={(e) => updateNested("crane", "typeName", e.target.value)} /></div>
              <div className="insp-field"><label>Serial No.</label><input value={current.crane?.serial || ""} onChange={(e) => updateNested("crane", "serial", e.target.value)} /></div>
            </div>
            <div className="insp-row2">
              <div className="insp-field"><label>SWL</label><input value={current.crane?.swl || ""} onChange={(e) => updateNested("crane", "swl", e.target.value)} placeholder="e.g. 2.T" /></div>
              <div className="insp-field"><label>Date of Manufacture</label><input value={current.crane?.mfgDate || ""} onChange={(e) => updateNested("crane", "mfgDate", e.target.value)} placeholder="MM/YYYY" /></div>
            </div>
            <div className="insp-field"><label>Manufacturer</label><input value={current.crane?.manufacturer || ""} onChange={(e) => updateNested("crane", "manufacturer", e.target.value)} /></div>
          </fieldset>
          <fieldset className="insp-fieldset">
            <legend className="insp-legend">Wire Rope</legend>
            <div className="insp-row2">
              <div className="insp-field"><label>Type</label><input value={current.wireRope?.typeName || ""} onChange={(e) => updateNested("wireRope", "typeName", e.target.value)} /></div>
              <div className="insp-field"><label>Diameter</label><input value={current.wireRope?.diameter || ""} onChange={(e) => updateNested("wireRope", "diameter", e.target.value)} /></div>
            </div>
            <div className="insp-row2">
              <div className="insp-field"><label>Length</label><input value={current.wireRope?.length || ""} onChange={(e) => updateNested("wireRope", "length", e.target.value)} /></div>
              <div className="insp-field"><label>Certificate No.</label><input value={current.wireRope?.certNo || ""} onChange={(e) => updateNested("wireRope", "certNo", e.target.value)} /></div>
            </div>
          </fieldset>
        </>
      )}

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Remarks</legend>
        <textarea rows={4} value={current.remarks} onChange={(e) => updateField("remarks", e.target.value)} />
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginTop: 6 }}>
          <input type="checkbox" checked={current.remarksAuto} onChange={(e) => toggleAutoRemarks(e.target.checked)} />
          Auto-fill from location
        </label>
      </fieldset>

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Signatures</legend>
        <div className="insp-row2">
          <div className="insp-field"><label>Captain Name (optional)</label><input value={current.captainName} onChange={(e) => updateField("captainName", e.target.value)} /></div>
          <div className="insp-field"><label>Service Engineer Name</label><input value={current.engineerName} onChange={(e) => updateField("engineerName", e.target.value)} /></div>
        </div>
        <div className="insp-row2">
          <SignatureCanvas label="Captain Signature" value={current.captainSig} onChange={(v: string) => updateSignature("captainSig", v)} />
          <SignatureCanvas label="Service Engineer Signature" value={current.engineerSig} onChange={(v: string) => updateSignature("engineerSig", v)} />
        </div>
      </fieldset>
    </>
  );
}

function IdBlock({ title, prefix, obj, capacity, onChange, onCapacity, isBoat, children }: any) {
  return (
    <fieldset className="insp-fieldset">
      <legend className="insp-legend">{title}</legend>
      <div className="insp-row2">
        <div className="insp-field"><label>Type</label><input value={obj?.typeName || ""} onChange={(e) => onChange(prefix, "typeName", e.target.value)} /></div>
        <div className="insp-field"><label>Serial No.</label><input value={obj?.serial || ""} onChange={(e) => onChange(prefix, "serial", e.target.value)} /></div>
      </div>
      <div className="insp-row2">
        <div className="insp-field"><label>Date of Manufacture</label><input value={obj?.mfgDate || ""} onChange={(e) => onChange(prefix, "mfgDate", e.target.value)} placeholder="MM/YYYY" /></div>
        <div className="insp-field">
          <label>{isBoat ? "Capacity" : "Manufacturer"}</label>
          {isBoat
            ? <input value={capacity || ""} onChange={(e) => onCapacity(e.target.value)} placeholder="e.g. 88 Person" />
            : <input value={obj?.manufacturer || ""} onChange={(e) => onChange(prefix, "manufacturer", e.target.value)} />}
        </div>
      </div>
      {isBoat && <div className="insp-field"><label>Manufacturer</label><input value={obj?.manufacturer || ""} onChange={(e) => onChange(prefix, "manufacturer", e.target.value)} /></div>}
      {children}
    </fieldset>
  );
}

function OutstandingAndPhotos({
  checklistKey, outstanding, photos, minRequired, onOutstandingChange, onAddPhotos, onRemovePhoto,
}: {
  checklistKey: string;
  outstanding: string;
  photos: string[];
  minRequired?: number;
  onOutstandingChange: (key: string, value: string) => void;
  onAddPhotos: (key: string, dataUris: string[]) => void;
  onRemovePhoto: (key: string, index: number) => void;
}) {
  return (
    <>
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Outstanding Issues / Defects Raised</legend>
        <textarea
          rows={3}
          placeholder="List any defects, spares required, or follow-up items raised during this inspection. Leave blank if none."
          value={outstanding}
          onChange={(e) => onOutstandingChange(checklistKey, e.target.value)}
        />
      </fieldset>
      <PhotoUpload
        photos={photos}
        minRequired={minRequired}
        onAdd={(uris) => onAddPhotos(checklistKey, uris)}
        onRemove={(i) => onRemovePhoto(checklistKey, i)}
      />
    </>
  );
}

function EquipmentForm({ equip, onChange }: { equip: any[]; onChange: (i: number, f: "result" | "remark", v: string) => void }) {
  return (
    <>
      {equip.map((e, i) => (
        <div className="insp-chk-row" key={e.n}>
          <div className="insp-chk-name">{e.n} <span style={{ color: "var(--insp-muted)" }}>({e.qty} {e.unit})</span></div>
          <select value={e.result} onChange={(ev) => onChange(i, "result", ev.target.value)}>
            <option value="ok">OK</option>
            <option value="expired">Expired</option>
            <option value="missing">Missing</option>
            <option value="damaged">Damaged</option>
          </select>
          <input className="insp-chk-remark" value={e.remark} onChange={(ev) => onChange(i, "remark", ev.target.value)} placeholder={e.exp ? "EXP date..." : "Remarks"} />
        </div>
      ))}
    </>
  );
}

function LoadTestForm({ current, updateNested }: any) {
  const lt = current.loadTest || {};
  return (
    <fieldset className="insp-fieldset">
      <legend className="insp-legend">Load Test</legend>
      <div className="insp-row2">
        <div className="insp-field"><label>Test Load Applied</label><input value={lt.testLoad || ""} onChange={(e) => updateNested("loadTest", "testLoad", e.target.value)} /></div>
        <div className="insp-field"><label>% of SWL</label><input value={lt.swlPercent || ""} onChange={(e) => updateNested("loadTest", "swlPercent", e.target.value)} /></div>
      </div>
      <div className="insp-row2">
        <div className="insp-field"><label>Result</label>
          <select value={lt.result || "pass"} onChange={(e) => updateNested("loadTest", "result", e.target.value)}>
            <option value="pass">Pass</option>
            <option value="fail">Fail</option>
          </select>
        </div>
        <div className="insp-field"><label>Test Certificate No.</label><input value={lt.testCertNo || ""} onChange={(e) => updateNested("loadTest", "testCertNo", e.target.value)} /></div>
      </div>
      <div className="insp-field"><label>Remarks</label><textarea rows={3} value={lt.remark || ""} onChange={(e) => updateNested("loadTest", "remark", e.target.value)} /></div>
    </fieldset>
  );
}
