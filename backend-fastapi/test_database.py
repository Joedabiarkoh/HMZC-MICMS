"""
Quick standalone connection check (not a pytest test).
Run with: python test_database.py
"""
from app.core.database import engine

try:
    connection = engine.connect()
    print("Database Connected Successfully")
    connection.close()
except Exception as e:
    print(e)
