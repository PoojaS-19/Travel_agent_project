from app.database import engine
from sqlalchemy import text

print("--- Running Migration ---")
try:
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        conn.execute(text("ALTER TYPE collaboratorrole ADD VALUE 'FOLLOWER'"))
        print("ALTER TYPE executed successfully!")
except Exception as e:
    print("Error executing ALTER TYPE:", e)

print("--- Checking Current Enum Values ---")
with engine.connect() as conn:
    query = """
    SELECT n.nspname as schema_name, t.typname as type_name, e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE t.typname = 'collaboratorrole'
    """
    res = conn.execute(text(query))
    for row in res.fetchall():
        print(f"Schema: {row[0]}, Type: {row[1]}, Value: {row[2]}")
