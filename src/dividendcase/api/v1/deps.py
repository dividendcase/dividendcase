"""Request dependencies shared by the API routes."""
from uuid import UUID

# The local app has exactly one user: whoever runs it. Every row that belongs to a
# user carries this id, so the multi-user schema works unchanged.
LOCAL_USER_ID = UUID("00000000-0000-0000-0000-000000000001")


def _get_user_id() -> UUID:
    return LOCAL_USER_ID
