"""collaborative trip planning

Revision ID: 20260520_0001
Revises:
Create Date: 2026-05-20
"""

from alembic import op
import sqlalchemy as sa


revision = "20260520_0001"
down_revision = None
branch_labels = None
depends_on = None


role_enum = sa.Enum("OWNER", "EDITOR", "VIEWER", name="collaboratorrole")
invite_status_enum = sa.Enum("PENDING", "ACCEPTED", "REVOKED", "EXPIRED", name="invitationstatus")
suggestion_type_enum = sa.Enum("DESTINATION", "HOTEL", "RESTAURANT", "ACTIVITY", name="suggestiontype")
vote_value_enum = sa.Enum("UP", "DOWN", name="votevalue")
notification_type_enum = sa.Enum(
    "INVITE_ACCEPTED",
    "NEW_VOTE",
    "NEW_SUGGESTION",
    "COMMENT_REPLY",
    "TRIP_FINALIZED",
    name="notificationtype",
)


def upgrade():
    op.create_table(
        "trip_collaborators",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("trip_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", role_enum, nullable=False),
        sa.Column("invited_by_user_id", sa.Integer(), nullable=True),
        sa.Column("voting_locked", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("finalized_at", sa.DateTime(), nullable=True),
        sa.Column("joined_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["trip_id"], ["itineraries.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["invited_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("trip_id", "user_id", name="uq_trip_collaborator_user"),
    )
    op.create_index("ix_trip_collaborators_trip_role", "trip_collaborators", ["trip_id", "role"])

    op.create_table(
        "trip_invitations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("trip_id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("role", role_enum, nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False, unique=True),
        sa.Column("status", invite_status_enum, nullable=False),
        sa.Column("invited_by_user_id", sa.Integer(), nullable=True),
        sa.Column("accepted_by_user_id", sa.Integer(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("accepted_at", sa.DateTime(), nullable=True),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["trip_id"], ["itineraries.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["invited_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["accepted_by_user_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_trip_invitations_trip_email", "trip_invitations", ["trip_id", "email"])
    op.create_index("ix_trip_invitations_status_expires", "trip_invitations", ["status", "expires_at"])

    op.create_table(
        "trip_suggestions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("trip_id", sa.Integer(), nullable=False),
        sa.Column("suggestion_type", suggestion_type_enum, nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("image_url", sa.String(length=1000), nullable=True),
        sa.Column("estimated_cost", sa.DECIMAL(10, 2), nullable=True),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=True),
        sa.Column("external_ref", sa.JSON(), nullable=True),
        sa.Column("is_finalized", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["trip_id"], ["itineraries.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_trip_suggestions_trip_type_created", "trip_suggestions", ["trip_id", "suggestion_type", "created_at"])
    op.create_index("ix_trip_suggestions_trip_finalized", "trip_suggestions", ["trip_id", "is_finalized"])

    op.create_table(
        "suggestion_votes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("suggestion_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("vote_value", vote_value_enum, nullable=True),
        sa.Column("ranking", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["suggestion_id"], ["trip_suggestions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("suggestion_id", "user_id", name="uq_suggestion_vote_user"),
    )
    op.create_index("ix_suggestion_votes_value", "suggestion_votes", ["suggestion_id", "vote_value"])
    op.create_index("ix_suggestion_votes_ranking", "suggestion_votes", ["suggestion_id", "ranking"])

    op.create_table(
        "suggestion_reactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("suggestion_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("emoji", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["suggestion_id"], ["trip_suggestions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("suggestion_id", "user_id", "emoji", name="uq_suggestion_reaction_user_emoji"),
    )
    op.create_index("ix_suggestion_reactions_emoji", "suggestion_reactions", ["suggestion_id", "emoji"])

    op.create_table(
        "suggestion_comments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("suggestion_id", sa.Integer(), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["suggestion_id"], ["trip_suggestions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_id"], ["suggestion_comments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_suggestion_comments_suggestion_created", "suggestion_comments", ["suggestion_id", "created_at"])
    op.create_index("ix_suggestion_comments_parent", "suggestion_comments", ["parent_id"])

    op.create_table(
        "trip_notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("trip_id", sa.Integer(), nullable=False),
        sa.Column("recipient_user_id", sa.Integer(), nullable=False),
        sa.Column("actor_user_id", sa.Integer(), nullable=True),
        sa.Column("notification_type", notification_type_enum, nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("message", sa.String(length=1000), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("emailed_at", sa.DateTime(), nullable=True),
        sa.Column("read_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["trip_id"], ["itineraries.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recipient_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_trip_notifications_recipient_read", "trip_notifications", ["recipient_user_id", "read_at"])
    op.create_index("ix_trip_notifications_trip_created", "trip_notifications", ["trip_id", "created_at"])


def downgrade():
    op.drop_table("trip_notifications")
    op.drop_table("suggestion_comments")
    op.drop_table("suggestion_reactions")
    op.drop_table("suggestion_votes")
    op.drop_table("trip_suggestions")
    op.drop_table("trip_invitations")
    op.drop_table("trip_collaborators")
