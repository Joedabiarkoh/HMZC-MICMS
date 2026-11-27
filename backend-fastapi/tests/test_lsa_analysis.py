"""Maker/model analysis of lifesaving appliances (core/lsa_analysis.py)."""
import io

from pypdf import PdfReader


def _h(token):
    return {"Authorization": f"Bearer {token}"}


def _boat_cert(cert_no, vessel, flag, cls, boat_model, davit_model, defect=False, serial="S1", etype="lifeboat"):
    status = "repair" if defect else "good"
    return {
        "cert_no": cert_no, "equipment_type": etype, "vessel_name": vessel, "status": "final",
        "date_of_servicing": "2026-07-21",
        "payload": {
            "certNo": cert_no, "type": etype, "vesselName": vessel, "flag": flag, "classSociety": cls,
            "boat": {"typeName": boat_model, "manufacturer": "Hatecke", "serial": serial, "mfgDate": ""},
            "davit": {"typeName": davit_model, "manufacturer": "Welin", "serial": "D" + serial, "mfgDate": ""},
            "winch": {"typeName": "W-1", "manufacturer": "Welin", "serial": "W" + serial, "mfgDate": ""},
            "release": {"typeName": "RH-9", "manufacturer": "Schat", "serial": "R" + serial, "mfgDate": ""},
            "boatChecklist": [
                {"code": "D-2", "name": "Lifeboat General", "items": [{"label": "Hull", "status": status, "remark": ""}], "special": []},
                {"code": "D-5", "name": "Release Gear", "items": [{"label": "Hook", "status": "good", "remark": ""}], "special": []},
            ],
            "davitChecklist": [
                {"code": "D-2", "name": "Lifeboat Davit System", "items": [{"label": "Arm", "status": "good", "remark": ""}], "special": []},
                {"code": "D-3", "name": "Electric Lifeboat Winch System", "items": [{"label": "Brake", "status": "repair" if defect else "good", "remark": ""}], "special": []},
            ],
        },
    }


def _seed(client, token):
    h = _h(token)
    for c in (
        _boat_cert("LSA-1", "MV One", "Panama", "DNV", "TEL-26", "GL-1", defect=True, serial="A"),
        _boat_cert("LSA-2", "MV Two", "Panama", "DNV", "TEL-26", "GL-1", serial="B"),
        _boat_cert("LSA-3", "MV Three", "Cyprus", "BV", "TEL-30", "GL-2", serial="C"),
    ):
        r = client.post("/api/certificates", json=c, headers=h)
        assert r.status_code == 200, r.text


def _rows(body, category):
    return [r for r in body["rows"] if r["category"] == category]


def test_groups_by_maker_and_model_with_defect_rates(client, admin_token):
    _seed(client, admin_token)
    body = client.get("/api/reports/lifesaving-analysis", headers=_h(admin_token)).json()
    assert body["certificates_analysed"] == 3
    tel26 = [r for r in _rows(body, "Lifeboat") if r["model"] == "TEL-26"][0]
    assert (tel26["units"], tel26["vessels"], tel26["certificates"], tel26["with_defects"]) == (2, 2, 2, 1)
    assert tel26["vessel_names"] == ["MV One", "MV Two"]
    assert tel26["defect_rate"] == 50.0
    # the winch defect is attributed to the winch, not the davit
    assert _rows(body, "Winch")[0]["with_defects"] == 1
    assert [r for r in _rows(body, "Davit") if r["model"] == "GL-1"][0]["with_defects"] == 0


def test_class_and_flag_filters(client, admin_token):
    _seed(client, admin_token)
    h = _h(admin_token)
    dnv = client.get("/api/reports/lifesaving-analysis", params={"class_society": "dnv"}, headers=h).json()
    assert dnv["certificates_analysed"] == 2
    cy = client.get("/api/reports/lifesaving-analysis", params={"flag": "Cyprus"}, headers=h).json()
    assert cy["certificates_analysed"] == 1 and {r["model"] for r in _rows(cy, "Lifeboat")} == {"TEL-30"}
    both = client.get("/api/reports/lifesaving-analysis", params={"class_society": "BV", "flag": "Panama"}, headers=h).json()
    assert both["certificates_analysed"] == 0


def test_drafts_and_other_equipment_are_excluded(client, admin_token):
    h = _h(admin_token)
    draft = _boat_cert("LSA-D", "MV Draft", "Panama", "DNV", "TEL-26", "GL-1")
    draft["status"] = "draft"
    client.post("/api/certificates", json=draft, headers=h)
    crane = _boat_cert("CRN-1", "MV Crane", "Panama", "DNV", "TEL-26", "GL-1", etype="crane")
    client.post("/api/certificates", json=crane, headers=h)
    assert client.get("/api/reports/lifesaving-analysis", headers=h).json()["certificates_analysed"] == 0


def test_pdf_download_and_permission(client, admin_token):
    _seed(client, admin_token)
    r = client.get("/api/reports/lifesaving-analysis/pdf", params={"class_society": "DNV"}, headers=_h(admin_token))
    assert r.status_code == 200 and r.content.startswith(b"%PDF")
    text = " ".join(" ".join(p.extract_text().split()) for p in PdfReader(io.BytesIO(r.content)).pages)
    assert "Maker & Model" in text and "TEL-26" in text and "Class: DNV" in text and "5001114387" in text
    assert "TEL-30" not in text
    assert "MV One, MV Two" in text
    assert client.get("/api/reports/lifesaving-analysis/pdf").status_code == 401
