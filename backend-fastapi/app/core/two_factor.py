import base64
import io
from secrets import choice
from string import ascii_uppercase, digits
from typing import List, Optional, Tuple

import pyotp
import qrcode
from PIL import Image as PILImage

from app.core.security import hash_password, verify_password

# Requested directly: "2FA for Admin and Finance roles specifically" —
# a follow-up from a security review's additional-layers list. TOTP
# (Google Authenticator/Authy/1Password-compatible), not SMS — no new
# external account/provider to set up, matching this project's existing
# "no new external dependency to configure" bias (see rate_limit.py's
# own comment on the same tradeoff for a Redis-backed limiter).
#
# Enrollment is two steps, both self-service (see api/routes/auth.py):
#   1. POST /auth/2fa/setup — generates and stores a secret (inert until
#      confirmed), returns it plus a QR code the person scans.
#   2. POST /auth/2fa/confirm — proves they actually scanned it right
#      (submits the current 6-digit code); only then does
#      two_factor_enabled flip to True, and only then are recovery
#      codes generated and shown (once, like PasswordResetResult's
#      temporary_password — see that schema's own comment for why this
#      pattern already exists in this codebase).
#
# Enforcement for Admin/Finance is "soft," the same way must_change_password
# already is: the account can still log in, but User.requires_2fa_setup
# (see models/user.py) tells the frontend to block everything else until
# 2FA is actually set up — see RequireAuth.tsx's existing
# must_change_password redirect, which this mirrors.

ISSUER_NAME = "HMZC Certification Platform"
RECOVERY_CODE_COUNT = 8


def generate_secret() -> str:
    return pyotp.random_base32()


def provisioning_qr_data_uri(secret: str, email: str) -> str:
    uri = pyotp.totp.TOTP(secret).provisioning_uri(name=email, issuer_name=ISSUER_NAME)
    # Same qrcode + Pillow round-trip already used for invoice QR codes
    # (core/invoice_pdf.py's _qr_image) — reused here instead of adding
    # a second QR-rendering approach (e.g. a frontend QR library) just
    # for this one setup screen.
    qr = qrcode.QRCode(border=1, box_size=6)
    qr.add_data(uri)
    qr.make(fit=True)
    img: PILImage.Image = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def verify_totp_code(secret: str, code: str) -> bool:
    # valid_window=1 accepts the previous/next 30s step too — real
    # devices' clocks drift a little; without this, a code typed just as
    # the 30-second window rolls over would be wrongly rejected.
    return pyotp.TOTP(secret).verify(code.strip(), valid_window=1)


def generate_recovery_codes() -> Tuple[List[str], List[str]]:
    """Returns (plaintext_codes, hashed_codes) — plaintext is shown to the
    person exactly once and never stored; only the hashes are kept."""
    alphabet = (ascii_uppercase + digits).translate(str.maketrans("", "", "0O1I"))
    plaintext = ["".join(choice(alphabet) for _ in range(5)) + "-" + "".join(choice(alphabet) for _ in range(5)) for _ in range(RECOVERY_CODE_COUNT)]
    hashed = [hash_password(code) for code in plaintext]
    return plaintext, hashed


def consume_recovery_code(stored_hashes: List[str], submitted_code: str) -> Optional[List[str]]:
    """Returns the remaining hash list with the matched one removed, or
    None if submitted_code doesn't match any stored code (single-use —
    each code works exactly once, same reasoning as an admin-issued
    temporary password)."""
    submitted = submitted_code.strip().upper()
    for i, stored_hash in enumerate(stored_hashes):
        if verify_password(submitted, stored_hash):
            return stored_hashes[:i] + stored_hashes[i + 1:]
    return None


def looks_like_totp_code(code: str) -> bool:
    return code.strip().isdigit()
