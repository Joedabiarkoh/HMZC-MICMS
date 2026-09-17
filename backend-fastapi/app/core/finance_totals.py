from typing import List, Tuple

from fastapi import HTTPException, status

from app.schemas.finance import LineItem

# Found during a security review: InvoiceCreate/QuotationCreate accepted
# subtotal/discount_total/total as plain client-submitted floats with
# nothing recomputing them from the actual line items — any account
# with finance.edit (every Finance-role user, not just admins) could
# save an invoice whose stored total simply doesn't match its own line
# items, silently corrupting revenue reporting on the Finance Dashboard
# or under-billing a customer. This closes that gap for invoices (the
# document that actually gets paid and counted as revenue).
#
# One cent — allows for floating-point rounding differences between the
# browser's float64 arithmetic and Python's over a JSON round-trip,
# without being loose enough to let a real discrepancy through.
TOLERANCE = 0.01


def _line_discount(item: LineItem) -> float:
    gross = item.quantity * item.unit_price
    return item.discount_amount if item.discount_type == "amount" else gross * (item.discount_percent / 100)


def compute_document_totals(
    line_items: List[LineItem],
    overall_discount_type: str,
    overall_discount_percent: float,
    overall_discount_amount: float,
) -> Tuple[float, float, float]:
    """
    Mirrors computeDocumentTotals in frontend-react's own
    LineItemsEditor.tsx exactly — same per-line discount rule (percent
    of that line's own gross, or a flat amount), same document-level
    discount stacked on top of what's left after line discounts, same
    clamp against a negative total. The two must never drift apart,
    since verify_document_totals below checks the client's submitted
    numbers against this.
    """
    subtotal = sum(item.quantity * item.unit_price for item in line_items)
    line_discount_total = sum(_line_discount(item) for item in line_items)
    after_line_discounts = max(0.0, subtotal - line_discount_total)
    raw_overall_discount = (
        overall_discount_amount
        if overall_discount_type == "amount"
        else after_line_discounts * (overall_discount_percent / 100)
    )
    overall_discount = min(max(0.0, raw_overall_discount), after_line_discounts)
    discount_total = line_discount_total + overall_discount
    total = subtotal - discount_total
    return subtotal, discount_total, total


def verify_document_totals(
    line_items: List[LineItem],
    overall_discount_type: str,
    overall_discount_percent: float,
    overall_discount_amount: float,
    claimed_subtotal: float,
    claimed_discount_total: float,
    claimed_total: float,
) -> None:
    """Raises 400 if the claimed subtotal/discount_total/total don't
    match what the line items + overall discount actually compute to.
    Call before persisting — rejects rather than silently rewriting the
    client's numbers, the same "reload and try again" pattern this app
    already uses for a stale-version conflict, so a real mismatch (a
    frontend bug, not just tampering) surfaces immediately instead of
    quietly storing something the person on screen never actually saw."""
    subtotal, discount_total, total = compute_document_totals(
        line_items, overall_discount_type, overall_discount_percent, overall_discount_amount
    )
    mismatches = []
    if abs(subtotal - claimed_subtotal) > TOLERANCE:
        mismatches.append(f"subtotal (expected {subtotal:.2f}, got {claimed_subtotal:.2f})")
    if abs(discount_total - claimed_discount_total) > TOLERANCE:
        mismatches.append(f"discount total (expected {discount_total:.2f}, got {claimed_discount_total:.2f})")
    if abs(total - claimed_total) > TOLERANCE:
        mismatches.append(f"total (expected {total:.2f}, got {claimed_total:.2f})")
    if mismatches:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "The submitted totals don't match the line items: " + "; ".join(mismatches) +
                ". Reload the page and try again."
            ),
        )
