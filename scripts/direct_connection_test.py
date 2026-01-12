#!/usr/bin/env python
"""Direct PostgreSQL connection test"""
import psycopg2
from urllib.parse import quote_plus

# Connection parameters
password = "#natnael0336"
host = "db.pdkjmoayrcakcdvrfpdj.supabase.co"
port = 5432
database = "postgres"
user = "postgres"

print("=" * 60)
print("Direct PostgreSQL Connection Test")
print("=" * 60)
print(f"Host: {host}")
print(f"Port: {port}")
print(f"Database: {database}")
print(f"User: {user}")
print(f"Password: {'*' * len(password)}")
print()

try:
    # Try direct connection
    print("Attempting connection...")
    conn = psycopg2.connect(
        host=host,
        port=port,
        database=database,
        user=user,
        password=password
    )
    
    print("[OK] Connected successfully!")
    
    # Test query
    cur = conn.cursor()
    cur.execute("SELECT version();")
    version = cur.fetchone()
    print(f"PostgreSQL version: {version[0][:60]}...")
    
    # Check tables
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
    """)
    tables = cur.fetchall()
    print(f"\nFound {len(tables)} tables in database")
    
    cur.close()
    conn.close()
    
    print("\n" + "=" * 60)
    print("[SUCCESS] Connection works!")
    print("=" * 60)
    
except psycopg2.OperationalError as e:
    print(f"[ERROR] Connection failed: {e}")
    print("\nPossible issues:")
    print("1. Network/DNS resolution problem")
    print("2. Firewall blocking port 5432")
    print("3. Supabase project might be paused")
    print("4. Incorrect hostname")
except Exception as e:
    print(f"[ERROR] Unexpected error: {e}")

