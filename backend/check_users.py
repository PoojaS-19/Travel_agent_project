import sqlite3

conn = sqlite3.connect("travel_planner.db")
cursor = conn.cursor()
cursor.execute("SELECT id, email, username FROM users")
rows = cursor.fetchall()
print("Registered Users:")
for row in rows:
    print(row)
conn.close()
