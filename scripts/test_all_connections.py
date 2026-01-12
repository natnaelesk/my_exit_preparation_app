#!/usr/bin/env python
"""
Test different Supabase connection string formats
"""
import os
import sys
from urllib.parse import quote_plus

password = "#natnael0336"
project_ref = "pdkjmoayrcakcdvrfpdj"
encoded_password = quote_plus(password)

# Different connection string formats to try
connection_strings = [
    # Direct connection
    f"postgresql://postgres:{encoded_password}@db.{project_ref}.supabase.co:5432/postgres",
    
    # Pooler (Session mode) - common format
    f"postgresql://postgres.{project_ref}:{encoded_password}@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
    
    # Pooler (Transaction mode)
    f"postgresql://postgres.{project_ref}:{encoded_password}@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
]

print("=" * 60)
print("Testing Supabase Connection Strings")
print("=" * 60)

backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
sys.path.insert(0, backend_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'exam_app.settings')

import django
django.setup()

from django.db import connection

for i, conn_str in enumerate(connection_strings, 1):
    print(f"\n[{i}] Testing: {conn_str.split('@')[1] if '@' in conn_str else conn_str[:50]}...")
    os.environ['DATABASE_URL'] = conn_str
    
    try:
        # Force Django to reload database config
        from django.conf import settings
        settings.DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.postgresql',
                'NAME': 'postgres',
                'USER': 'postgres',
                'PASSWORD': password,
                'HOST': conn_str.split('@')[1].split(':')[0] if '@' in conn_str else '',
                'PORT': conn_str.split(':')[-1].split('/')[0] if ':' in conn_str else '5432',
            }
        }
        
        with connection.cursor() as cursor:
            cursor.execute("SELECT version();")
            version = cursor.fetchone()
            print(f"[OK] Connected successfully!")
            print(f"     Database: {version[0][:50]}...")
            print(f"\n[SUCCESS] Use this connection string:")
            print(f"  {conn_str}")
            break
    except Exception as e:
        print(f"[FAILED] {str(e)[:100]}")
else:
    print("\n" + "=" * 60)
    print("[ERROR] None of the connection strings worked.")
    print("=" * 60)
    print("\nPlease:")
    print("1. Go to Supabase Dashboard > Settings > Database")
    print("2. Copy the EXACT connection string (with password filled in)")
    print("3. Share it so we can test it")

