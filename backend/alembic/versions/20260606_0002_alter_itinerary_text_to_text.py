"""alter itinerary_text to text

Revision ID: 20260606_0002
Revises: 20260520_0001
Create Date: 2026-06-06
"""

from alembic import op
import sqlalchemy as sa


revision = "20260606_0002"
down_revision = "20260520_0001"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "itineraries",
        "itinerary_text",
        existing_type=sa.String(length=1000),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade():
    op.alter_column(
        "itineraries",
        "itinerary_text",
        existing_type=sa.Text(),
        type_=sa.String(length=1000),
        existing_nullable=True,
    )
