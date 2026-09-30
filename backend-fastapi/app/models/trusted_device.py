from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from app.models.base import BaseModel

# Requested directly: 2FA asking for a code on every single sign-in was
# "very difficult for some users" on the two roles it's enforced for
# (Admin/Finance) — see core/trusted_devices.py for the actual
# decision this exists to support: skip the 2FA challenge on a device
# this exact account already proved itself on recently, without
# weakening what 2FA protects against (a stolen/guessed password still
# isn't enough from anywhere ELSE). One row per trusted browser/device,
# not one column on User, since an account can reasonably trust more
# than one device (a work laptop and a phone, say) and each needs its
# own independent expiry and revocation.
class TrustedDevice(BaseModel):
    __tablename__ = "trusted_devices"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    user = relationship("User")

    # Only the SHA-256 hash is ever stored — same reasoning as
    # hashed_password, except a fast hash (not bcrypt) is deliberate
    # here: this token is a 256-bit cryptographically random value, not
    # a low-entropy human password, so there's no offline-brute-force
    # risk a slow hash would be defending against — only lookup speed
    # matters, and this runs on every login that presents one.
    token_hash = Column(String, nullable=False, unique=True, index=True)

    # Shown nowhere yet (no "manage trusted devices" page exists), but
    # captured now so that page doesn't need a second migration later —
    # genuinely useful the moment someone asks "wait, what device IS
    # this that's still trusted."
    user_agent = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_used_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    # Not indefinite — see TRUSTED_DEVICE_DAYS in core/trusted_devices.py.
    expires_at = Column(DateTime(timezone=True), nullable=False)
