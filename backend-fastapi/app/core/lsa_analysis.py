"""Maker / model analysis of the lifesaving appliances HMZC has inspected.

Built from finalized certificates of the Lifesaving Appliances section only
(lifeboat, rescue boat, free-fall lifeboats, FRC service reports and release
hook re-installations). Each certificate names the boat, davit, winch and
release hook it covered, with their maker and model; this groups them so
HMZC (and a class society or flag state that asks) can see, per maker and
model: how many units were inspected, on how many vessels, and how often
the checklist found something to repair.

A "defect" is any checklist item marked Repair; "attention" is any marked
Part (partially satisfactory). Both come straight from the certificate's own
checklist, so this reports what the technician recorded and nothing else.
"""
import re
from collections import defaultdict
from typing import Any, Iterable, Optional

LSA_TYPES = ("lifeboat", "rescueboat", "freefall_dry", "freefall_tanker", "frc_service", "hook_reinstall")

BOAT_LABEL = {
    "lifeboat": "Lifeboat",
    "rescueboat": "Rescue boat",
    "freefall_dry": "Free-fall lifeboat",
    "freefall_tanker": "Free-fall lifeboat",
}
# Report order and titles.
CATEGORIES = ("Lifeboat", "Rescue boat", "Free-fall lifeboat", "Davit", "Winch", "Release hook")

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}")


def _s(v: Any) -> str:
    return " ".join(str(v).split()) if isinstance(v, (str, int, float)) else ""


def _key(v: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", v.lower()).strip()


def _sections(payload: dict, field: str) -> list[dict]:
    secs = payload.get(field)
    return [s for s in secs if isinstance(s, dict)] if isinstance(secs, list) else []


def _count_items(sections: Iterable[dict]) -> tuple[int, int]:
    """(repair items, part items) across the given checklist sections."""
    repair = part = 0
    for sec in sections:
        for item in list(sec.get("items") or []) + list(sec.get("special") or []):
            status = item.get("status") if isinstance(item, dict) else None
            if status == "repair":
                repair += 1
            elif status == "part":
                part += 1
    return repair, part


def _sections_matching(payload: dict, field: str, include: str, exclude: Optional[str] = None) -> list[dict]:
    out = []
    for sec in _sections(payload, field):
        name = _s(sec.get("name"))
        if re.search(include, name, re.I) and not (exclude and re.search(exclude, name, re.I)):
            out.append(sec)
    return out


def _component(d: Any) -> tuple[str, str, str]:
    """(maker, model, serial) from an IdentifiedComponent."""
    if not isinstance(d, dict):
        return "", "", ""
    return _s(d.get("manufacturer")), _s(d.get("typeName")), _s(d.get("serial"))


def extract_components(cert) -> list[dict]:
    """Every identified boat/davit/winch/hook on one certificate."""
    p = cert.payload if isinstance(cert.payload, dict) else {}
    rows: list[dict] = []

    def add(category, maker, model, serial, repair, part):
        if not maker and not model:
            return
        rows.append({"category": category, "maker": maker, "model": model, "serial": serial, "repair": repair, "part": part})

    if cert.equipment_type in BOAT_LABEL:
        maker, model, serial = _component(p.get("boat"))
        boat_secs = [s for s in _sections(p, "boatChecklist") if not re.search(r"release", _s(s.get("name")), re.I)]
        add(BOAT_LABEL[cert.equipment_type], maker, model, serial, *_count_items(boat_secs))

        maker, model, serial = _component(p.get("davit"))
        add("Davit", maker, model, serial, *_count_items(_sections_matching(p, "davitChecklist", r"davit|launching", r"winch")))

        maker, model, serial = _component(p.get("winch"))
        add("Winch", maker, model, serial, *_count_items(_sections_matching(p, "davitChecklist", r"winch")))

        maker, model, serial = _component(p.get("release"))
        add("Release hook", maker, model, serial, *_count_items(_sections_matching(p, "boatChecklist", r"release")))

    elif cert.equipment_type == "frc_service":
        frc = p.get("frcServiceReport") if isinstance(p.get("frcServiceReport"), dict) else {}
        add("Rescue boat", _s(frc.get("manufacturer")), _s(frc.get("frcMakeModel")), _s(frc.get("hullSerialNo")), 0, 0)
        add("Davit", "", _s(frc.get("davitLaunchingAppliance")), "", 0, 0)

    elif cert.equipment_type == "hook_reinstall":
        hr = p.get("hookReinstall") if isinstance(p.get("hookReinstall"), dict) else {}
        # The certificate's own overall outcome is the only unambiguous result
        # here (individual yes/no checks mix "defect found?" with "item ok?").
        add("Release hook", "", _s(hr.get("hookMakeModel")), "", 1 if hr.get("outcome") == "not_satisfactory" else 0, 0)
        add("Davit", "", _s(hr.get("davitLaunchingAppliance")), "", 0, 0)

    return rows


def _class_text(cert) -> str:
    p = cert.payload if isinstance(cert.payload, dict) else {}
    parts = [_s(p.get("classSociety"))]
    for key, field in (("frcServiceReport", "classFlag"), ("hookReinstall", "classFlag")):
        d = p.get(key)
        if isinstance(d, dict):
            parts.append(_s(d.get(field)))
    return " ".join(x for x in parts if x)


def _flag_text(cert) -> str:
    p = cert.payload if isinstance(cert.payload, dict) else {}
    parts = [_s(p.get("flag"))]
    for key in ("frcServiceReport", "hookReinstall"):
        d = p.get(key)
        if isinstance(d, dict):
            parts.append(_s(d.get("classFlag")))
    return " ".join(x for x in parts if x)


def _cert_date(cert) -> str:
    d = _s(cert.date_of_servicing)
    if _DATE_RE.match(d):
        return d[:10]
    return cert.created_at.date().isoformat() if getattr(cert, "created_at", None) else ""


def build_analysis(
    certs: Iterable,
    class_filter: str = "",
    flag_filter: str = "",
    date_from: str = "",
    date_to: str = "",
) -> dict:
    cf, ff = _key(class_filter), _key(flag_filter)
    groups: dict[tuple, dict] = {}
    cert_count = 0
    vessels_all: set[str] = set()
    classes: set[str] = set()
    flags: set[str] = set()

    for cert in certs:
        if cert.status != "final" or cert.equipment_type not in LSA_TYPES:
            continue
        if cf and cf not in _key(_class_text(cert)):
            continue
        if ff and ff not in _key(_flag_text(cert)):
            continue
        d = _cert_date(cert)
        if date_from and d and d < date_from:
            continue
        if date_to and d and d > date_to:
            continue
        comps = extract_components(cert)
        if not comps:
            continue
        cert_count += 1
        vessel = _s(cert.vessel_name)
        if vessel:
            vessels_all.add(vessel)
        p = cert.payload if isinstance(cert.payload, dict) else {}
        if _s(p.get("classSociety")):
            classes.add(_s(p.get("classSociety")))
        if _s(p.get("flag")):
            flags.add(_s(p.get("flag")))

        for c in comps:
            k = (c["category"], _key(c["maker"]), _key(c["model"]))
            g = groups.get(k)
            if g is None:
                g = groups[k] = {
                    "category": c["category"],
                    "maker": c["maker"] or "—",
                    "model": c["model"] or "—",
                    "certs": set(), "units": set(), "vessels": set(),
                    "defect_certs": set(), "attention_certs": set(),
                    "repair_items": 0,
                }
            g["certs"].add(cert.cert_no)
            g["units"].add(_key(c["serial"]) or f"cert:{cert.cert_no}")
            if vessel:
                g["vessels"].add(vessel)
            if c["repair"]:
                g["defect_certs"].add(cert.cert_no)
                g["repair_items"] += c["repair"]
            if c["part"]:
                g["attention_certs"].add(cert.cert_no)

    rows = []
    for g in groups.values():
        n = len(g["certs"])
        rows.append({
            "category": g["category"],
            "maker": g["maker"],
            "model": g["model"],
            "units": len(g["units"]),
            "vessels": len(g["vessels"]),
            "certificates": n,
            "with_defects": len(g["defect_certs"]),
            "with_attention": len(g["attention_certs"]),
            "repair_items": g["repair_items"],
            "defect_rate": round(100.0 * len(g["defect_certs"]) / n, 1) if n else 0.0,
        })
    order = {c: i for i, c in enumerate(CATEGORIES)}
    rows.sort(key=lambda r: (order.get(r["category"], 99), -r["certificates"], r["maker"].lower(), r["model"].lower()))

    return {
        "filters": {"class": class_filter, "flag": flag_filter, "date_from": date_from, "date_to": date_to},
        "certificates_analysed": cert_count,
        "vessels": len(vessels_all),
        "rows": rows,
        "known_classes": sorted(classes),
        "known_flags": sorted(flags),
    }
