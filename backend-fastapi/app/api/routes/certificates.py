from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_permission
from app.core.audit import record_audit
from app.core.database import get_database
from app.core.imo_validation import is_valid_imo_checksum
from app.core.permissions import CERT_DELETE, CERT_EDIT, CERT_VIEW, CERT_VIEW_ALL, get_user_permissions
from app.models.certificate import Certificate
from app.models.user import User
from app.schemas.certificate import CertificateCreate, CertificateResponse, VesselLookupResult, VesselSummary

# Answers the "who issued which certificate at what time" request
# directly: every save is tied to the authenticated user via
# issued_by_id (a real foreign key — see models/certificate.py), and
# created_at/updated_at are set by the database, not the client.
router = APIRouter(tags=["certificates"])


@router.post("", response_model=CertificateResponse, status_code=status.HTTP_200_OK)
def save_certificate(
    cert_in: CertificateCreate,
    request: Request,
    db: Session = Depends(get_database),
    current_user: User = Depends(require_permission(CERT_EDIT)),
):
    """
    Upsert by cert_no — matches the frontend's existing "Save Draft" /
    "Finalize & Save" flow, which reuses the same cert_no across edits
    of the same certificate (see useInspections.ts's saveCurrent).
    issued_by is set once, on first save, and never overwritten by a
    later edit — the record of who originally issued it shouldn't
    change just because someone (an admin) opens and re-saves it.
    """
    existing = db.query(Certificate).filter(Certificate.cert_no == cert_in.cert_no).first()

    if existing:
        # Optimistic concurrency: if the client says which version it
        # last read (anything other than None) and that no longer
        # matches, someone else has saved a newer edit in between —
        # reject rather than silently overwrite it. A client saving for
        # the first time after loading (version=None) skips the check,
        # same as a certificate that predates this field existing.
        if cert_in.version is not None and cert_in.version != existing.version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"This certificate was updated by someone else since you opened it "
                    f"(server has version {existing.version}, you have {cert_in.version}). "
                    f"Reload it and re-apply your changes."
                ),
            )
        existing.equipment_type = cert_in.equipment_type
        existing.vessel_name = cert_in.vessel_name
        existing.imo_no = cert_in.imo_no
        existing.status = cert_in.status
        existing.date_of_servicing = cert_in.date_of_servicing
        existing.payload = cert_in.payload
        existing.version += 1
        db.commit()
        db.refresh(existing)
        record_audit(db, request, "certificate.save", user_id=current_user.id, resource_type="certificate", resource_id=existing.cert_no, detail=f"status={existing.status}, version={existing.version}")
        return existing

    cert = Certificate(
        cert_no=cert_in.cert_no,
        equipment_type=cert_in.equipment_type,
        vessel_name=cert_in.vessel_name,
        imo_no=cert_in.imo_no,
        status=cert_in.status,
        date_of_servicing=cert_in.date_of_servicing,
        payload=cert_in.payload,
        issued_by_id=current_user.id,
    )
    db.add(cert)
    db.commit()
    db.refresh(cert)
    record_audit(db, request, "certificate.save", user_id=current_user.id, resource_type="certificate", resource_id=cert.cert_no, detail=f"created, status={cert.status}")
    return cert


@router.get("", response_model=List[CertificateResponse])
def list_certificates(
    db: Session = Depends(get_database),
    current_user: User = Depends(require_permission(CERT_VIEW)),
):
    # Requested directly: "each person only sees what certificate he has
    # issued, except the main admin who can see all." Technical staff
    # (who issue certificates) get certificates.view only by default —
    # filtered to their own issued_by_id below. Sales, Administration,
    # and Service Coordination additionally get certificates.view_all
    # (see core/permissions.py's ROLE_DEFAULT_PERMISSIONS) — their
    # reason for existing in this permission model is company-wide
    # visibility (downloading certificates for clients, tracking fleet
    # status), not their own issuance, since they don't issue any.
    # Admin has view_all via ALL_PERMISSIONS regardless of role.
    query = db.query(Certificate).options(joinedload(Certificate.issued_by))
    if CERT_VIEW_ALL not in get_user_permissions(current_user):
        query = query.filter(Certificate.issued_by_id == current_user.id)
    return query.order_by(Certificate.created_at.desc()).all()


# Not in the original request — added alongside the view filtering
# above out of necessity, not as a separate feature. Certificate numbers
# are generated client-side by counting how many certificates of that
# type already exist today (see generateCertNo in
# frontend/.../inspectionHelpers.ts); once list_certificates started
# filtering non-view_all accounts down to their own certificates, that
# client-side count would only reflect their own issuance for the day,
# not the company's — meaning two different technicians creating a
# certificate on the same day would both compute the same "next" number
# and collide. This returns just the bare cert_no strings (no vessel
# names, no photos, no other certificate content) for every certificate
# regardless of who issued it, specifically so numbering integrity
# doesn't depend on view permissions. Available to CERT_EDIT (only
# people who create certificates need it), not CERT_VIEW, so it doesn't
# become a second, unfiltered way to enumerate everyone's work.
@router.get("/numbers", response_model=List[str])
def list_certificate_numbers(
    db: Session = Depends(get_database),
    _user: User = Depends(require_permission(CERT_EDIT)),
):
    return [row[0] for row in db.query(Certificate.cert_no).all()]


# Requested directly: a vessel search — type a name or IMO, see matching
# vessels, then from there either start a new inspection for one or view
# everything already done for it. Different from vessel_lookup below,
# which needs an exact name/IMO already in hand (it's called from inside
# an in-progress certificate's Statement form); this is the entry point
# *before* that — one row per distinct vessel, grouped from this
# project's own certificate history since there's no separate Vessels
# table (see the root README: Vessels is named in the architecture
# diagram but was never modelled as its own entity — every certificate
# already carries its own vessel_name/imo_no, which is grouped here
# rather than duplicating that data into a new table). Respects the same
# "each person sees only what they've issued, admin/support roles see
# everything" scoping as list_certificates above.
@router.get("/vessels", response_model=List[VesselSummary])
def list_vessels(
    q: Optional[str] = None,
    db: Session = Depends(get_database),
    current_user: User = Depends(require_permission(CERT_VIEW)),
):
    query = db.query(Certificate).filter(
        or_(Certificate.vessel_name.isnot(None), Certificate.imo_no.isnot(None))
    )
    if CERT_VIEW_ALL not in get_user_permissions(current_user):
        query = query.filter(Certificate.issued_by_id == current_user.id)
    q = (q or "").strip()
    if q:
        like = f"%{q}%"
        query = query.filter(or_(Certificate.vessel_name.ilike(like), Certificate.imo_no.ilike(like)))

    groups: dict = {}
    for cert in query.all():
        key = ((cert.vessel_name or "").strip().lower(), (cert.imo_no or "").strip())
        groups.setdefault(key, []).append(cert)

    vessels = []
    for group in groups.values():
        group.sort(key=lambda c: c.created_at, reverse=True)
        latest = group[0]
        vessels.append(VesselSummary(
            vessel_name=latest.vessel_name,
            imo_no=latest.imo_no,
            certificate_count=len(group),
            last_date_of_servicing=latest.date_of_servicing,
            last_updated=latest.updated_at or latest.created_at,
            last_status=latest.status,
            last_equipment_type=latest.equipment_type,
        ))
    vessels.sort(key=lambda v: (v.vessel_name or "").lower())
    return vessels


# Requested directly: before starting an inspection, confirm the IMO and
# vessel name actually correspond, and see whether this vessel has been
# worked on before. Deliberately does NOT call MarineTraffic or Equasis —
# MarineTraffic's vessel API requires a paid subscription/API key this
# project doesn't have, and Equasis's own terms explicitly prohibit
# automated/API access ("No data can be harvested and reused in bulk
# without permission from Equasis. This includes webservices and
# API's."), so building a scraper against it would violate their terms
# rather than just being technically hard. What this endpoint actually
# does: validates the IMO's check-digit (core/imo_validation.py — proves
# the number is well-formed, not that a real ship holds it), and cross-
# checks OUR OWN certificate history — the one part of "confirm they
# correspond" this system can genuinely verify without an external
# service. History is returned unfiltered by certificates.view_all (like
# list_certificate_numbers above) — the operational question "has this
# vessel been inspected before, and by whom" needs a company-wide
# answer regardless of who's asking, but only summary fields (no photos,
# no full checklist payload) go out, so it can't be used to browse
# someone else's full certificate content.
@router.get("/vessel-lookup", response_model=VesselLookupResult)
def vessel_lookup(
    imo: Optional[str] = None,
    name: Optional[str] = None,
    db: Session = Depends(get_database),
    _user: User = Depends(require_permission(CERT_EDIT)),
):
    imo = (imo or "").strip()
    name = (name or "").strip()

    imo_checksum_valid = is_valid_imo_checksum(imo) if imo else None

    certs_by_imo = db.query(Certificate).filter(Certificate.imo_no == imo).all() if imo else []
    certs_by_name = (
        db.query(Certificate).filter(Certificate.vessel_name.ilike(name)).all() if name else []
    )

    history_by_id = {c.id: c for c in certs_by_imo}
    for c in certs_by_name:
        history_by_id[c.id] = c
    history = sorted(history_by_id.values(), key=lambda c: c.created_at, reverse=True)

    conflict = False
    conflict_detail = None
    if imo and name:
        other_names = {
            c.vessel_name for c in certs_by_imo
            if c.vessel_name and c.vessel_name.strip().lower() != name.lower()
        }
        other_imos = {
            c.imo_no for c in certs_by_name
            if c.imo_no and c.imo_no.strip() != imo
        }
        if other_names:
            conflict = True
            conflict_detail = f"IMO {imo} was previously recorded under a different name: {', '.join(sorted(other_names))}."
        elif other_imos:
            conflict = True
            conflict_detail = f"\"{name}\" was previously recorded under a different IMO: {', '.join(sorted(other_imos))}."

    return VesselLookupResult(
        imo_provided=imo or None,
        name_provided=name or None,
        imo_checksum_valid=imo_checksum_valid,
        name_imo_conflict=conflict,
        conflict_detail=conflict_detail,
        history=history,
    )


@router.delete("/{cert_no:path}", status_code=status.HTTP_204_NO_CONTENT)
def delete_certificate(
    cert_no: str,
    db: Session = Depends(get_database),
    _user: User = Depends(require_permission(CERT_DELETE)),
):
    # Was Depends(get_current_admin_user) — inconsistent with finance.py's
    # delete endpoints, which already checked FIN_DELETE rather than a
    # hardcoded admin role. certificates.delete is only granted to admin
    # by default (see core/permissions.py's ROLE_DEFAULT_PERMISSIONS), so
    # behavior for everyone is unchanged today — the difference is an
    # admin can now also grant CERT_DELETE to one specific trusted
    # person (e.g. a Technical lead) via extra_permissions, the same way
    # every other certificate/finance permission already works.
    cert = db.query(Certificate).filter(Certificate.cert_no == cert_no).first()
    if not cert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate not found")
    db.delete(cert)
    db.commit()
