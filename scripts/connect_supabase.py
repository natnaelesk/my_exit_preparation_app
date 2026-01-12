#!/usr/bin/env python
"""
Connect to Supabase with proper URL encoding
"""
import os
import sys
from urllib.parse import quote_plus

# Your Supabase credentials
password = "#natnael0336"
host = "db.pdkjmoayrcakcdvrfpdj.supabase.co"
port = "5432"
database = "postgres"
user = "postgres"

# URL encode the password
encoded_password = quote_plus(password)

# Build connection string
connection_string = f"postgresql://{user}:{encoded_password}@{host}:{port}/{database}"

print("=" * 60)
print("Supabase Connection Test")
print("=" * 60)
print(f"\nConnection string: postgresql://{user}:***@{host}:{port}/{database}")
print(f"Encoded password: {encoded_password}")

# Set environment variable
os.environ['DATABASE_URL'] = connection_string

# Now test connection
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
sys.path.insert(0, backend_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'exam_app.settings')

import django
django.setup()

from django.db import connection

try:
    with connection.cursor() as cursor:
        cursor.execute("SELECT version();")
        version = cursor.fetchone()
        print(f"\n[OK] Connected to PostgreSQL!")
        print(f"Database version: {version[0][:50]}...")
        
        # Check tables
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """)
        tables = cursor.fetchall()
        print(f"\n[OK] Found {len(tables)} tables:")
        for table in tables[:10]:  # Show first 10
            print(f"  - {table[0]}")
        if len(tables) > 10:
            print(f"  ... and {len(tables) - 10} more")
        
        print("\n" + "=" * 60)
        print("[OK] Connection successful!")
        print("=" * 60)
        print("\nNext steps:")
        print("1. Run migrations: python backend/manage.py migrate")
        print("2. Your data will be migrated automatically")
        
except Exception as e:
    print(f"\n[ERROR] Connection failed: {e}")
    print("\nTroubleshooting:")
    print("1. Check if your Supabase project is active")
    print("2. Verify the password is correct")
    print("3. Check your internet connection")
    print("4. Try getting the connection string again from Supabase Dashboard")
    sys.exit(1)

