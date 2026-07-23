from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel

from app.schemas.user import UserResponse


class CertificateCreate(BaseModel):
    cert_no: str
    equipment_type: str
    vessel_name: Optional[str] = None
    imo_no: Optional[str] = None
    status: str = "draft"
    date_of_servicing: Optional[str] = None
    payload: Dict[str, Any]
    # If set, must match the record's current version or the save is
    # rejected with 409 Conflict instead of silently overwriting someone
    # else's more recent edit. Omit (None) for a brand-new certificate.
    version: Optional[int] = None


class CertificateResponse(BaseModel):
    id: int
    cert_no: str
    equipment_type: str
    vessel_name: Optional[str] = None
    imo_no: Optional[str] = None
    status: str
    date_of_servicing: Optional[str] = None
    payload: Dict[str, Any]
    issued_by: Optional[UserResponse] = None
    version: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Lighter shape for the admin certificate list — the full `payload` (which
# includes base64 photos and signatures) is unnecessary weight for a table
# view that just needs to answer "who issued what, when".
class CertificateSummary(BaseModel):
    id: int
    cert_no: str
    equipment_type: str
    vessel_name: Optional[str] = None
    imo_no: Optional[str] = None
    status: str
    date_of_servicing: Optional[str] = None
    issued_by: Optional[UserResponse] = None
    version: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Requested directly: confirm IMO and Name correspond, check the vessel
# has actually been worked on before, and surface its history. See
# core/imo_validation.py and api/routes/certificates.py's vessel_lookup
# for what each field means and why there's no live external-registry
# check (MarineTraffic needs a paid API key; Equasis's own terms
# explicitly prohibit automated/API access — see the root README).
class VesselLookupResult(BaseModel):
    imo_provided: Optional[str] = None
    name_provided: Optional[str] = None
    imo_checksum_valid: Optional[bool] = None  # None if no IMO was given to check
    # True if this IMO has been used before under a materially different
    # name, or this name under a different IMO, in OUR OWN certificate
    # history — the one part of "IMO and Name must correspond" this
    # system can actually verify, since it doesn't have a live external
    # registry connected.
    name_imo_conflict: bool = False
    conflict_detail: Optional[str] = None
    history: List[CertificateSummary] = []


# One row per distinct vessel (grouped by name+IMO across this vessel's
# certificates), not one row per certificate — the "search a vessel,
# then decide what to do with it" flow needs a vessel-level list first
# (see list_vessels in api/routes/certificates.py), separate from
# vessel_lookup above, which needs an exact name/IMO already in hand.
class VesselSummary(BaseModel):
    vessel_name: Optional[str] = None
    imo_no: Optional[str] = None
    certificate_count: int
    last_date_of_servicing: Optional[str] = None
    last_updated: datetime
    last_status: str
    last_equipment_type: str
