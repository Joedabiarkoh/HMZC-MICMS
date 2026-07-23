import re

# Requested directly: confirm an IMO number is at least well-formed
# before trusting it. This validates the official IMO check-digit
# algorithm — NOT a live registry lookup (see vessel_lookup.py for what
# this is combined with, and the root README for why a real MarineTraffic/
# Equasis integration isn't part of this).
#
# Algorithm (confirmed against multiple independent authoritative
# descriptions, and tested against real, independently-verified vessels
# before being used anywhere — see the root README): a 7-digit number
# where the first 6 digits are multiplied by descending weights 7..2,
# summed, and the units digit of that sum must equal the 7th digit.
# Verified against EVER GIVEN (IMO 9811000) and HMM Copenhagen
# (IMO 9863302), both independently confirmed by multiple vessel
# tracking sites and Wikipedia.
IMO_PATTERN = re.compile(r"^\d{7}$")


def is_valid_imo_checksum(imo: str) -> bool:
    """
    True if `imo` is exactly 7 digits and satisfies the official IMO
    check-digit formula. This only proves the number is *internally
    consistent* — it does not confirm a real ship with this IMO exists,
    nor that it matches any particular name. A made-up 7-digit number
    can still pass this by construction (roughly 1 in 10 random 7-digit
    numbers will).
    """
    if not IMO_PATTERN.match(imo):
        return False
    digits = [int(c) for c in imo]
    total = sum(digits[i] * (7 - i) for i in range(6))
    return total % 10 == digits[6]
