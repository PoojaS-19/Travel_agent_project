import os
import mysql.connector
from dotenv import load_dotenv

load_dotenv()

try:
    conn = mysql.connector.connect(
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        database=os.getenv("DB_NAME")
    )
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, username FROM users")
    rows = cursor.fetchall()
    print("MySQL Registered Users:")
    for row in rows:
        print(row)
    conn.close()
except Exception as e:
    print("Failed to connect to MySQL:", e)
