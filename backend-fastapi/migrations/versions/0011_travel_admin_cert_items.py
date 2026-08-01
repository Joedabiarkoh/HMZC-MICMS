"""seed Travel, Admin & Certification rate items

Revision ID: 0011_travel_admin_cert_items
Revises: 0010_terms_conditions
Create Date: 2026-08-01

Requested directly: two technician hourly-rate line items for
quotations, under a "Travel, Admin & Certification" category —
Standby/Waiting Time at $50/hour and Overtime Rate at $100/hour. No
schema change needed (finance_items.category is already a free-text
string, see app/models/finance_item.py).

Checked the running database first: this exact category, with these
exact two items (same name/unit/price), already existed — added
earlier through the Item Catalog admin UI (codes ADM-009/ADM-010), not
through a migration, so `alembic upgrade head` on a fresh database
wouldn't have created them. This migration only inserts a row when no
active item with the same (category, name) already exists, so it's a
no-op wherever ADM-009/ADM-010 (or equivalents) are already present,
and still seeds them on a database that genuinely doesn't have this
category yet.
"""
from alembic import op
import sqlalchemy as sa

revision = "0011_travel_admin_cert_items"
down_revision = "0010_terms_conditions"
branch_labels = None
depends_on = None

CATEGORY = "Travel, Admin & Certification"

ITEMS = [
    ("TAC-STANDBY", "Technician Hourly Rate — Standby/Waiting Time", 50.00),
    ("TAC-OVERTIME", "Overtime Rate", 100.00),
]


def upgrade() -> None:
    conn = op.get_bind()
    for code, name, price in ITEMS:
        exists = conn.execute(
            sa.text("SELECT 1 FROM finance_items WHERE category = :category AND name = :name LIMIT 1"),
            {"category": CATEGORY, "name": name},
        ).first()
        if exists:
            continue
        conn.execute(
            sa.text(
                """
                INSERT INTO finance_items (code, name, description, unit, unit_price, category, is_active)
                VALUES (:code, :name, NULL, 'per hour', :price, :category, TRUE)
                """
            ),
            {"code": code, "name": name, "price": price, "category": CATEGORY},
        )


def downgrade() -> None:
    # Only drops rows this migration itself could have created (matched
    # by the TAC- codes it uses) — never touches the pre-existing
    # ADM-009/ADM-010 rows, which this migration never owned.
    op.execute(
        sa.text("DELETE FROM finance_items WHERE code IN ('TAC-STANDBY', 'TAC-OVERTIME')")
    )
