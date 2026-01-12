#!/usr/bin/env python
"""
Complete Supabase database setup script
Run this once your Supabase project is active
"""
import os
import sys
import django

backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
sys.path.insert(0, backend_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'exam_app.settings')

# Set your connection string here (replace with actual from Supabase)
# Format: postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
# Note: Replace # in password with %23 for URL encoding
CONNECTION_STRING = os.environ.get('DATABASE_URL', '')

if not CONNECTION_STRING:
    print("=" * 60)
    print("Supabase Database Setup")
    print("=" * 60)
    print("\n[ERROR] DATABASE_URL not set!")
    print("\nPlease set it using:")
    print('  $env:DATABASE_URL="postgresql://postgres:[PASSWORD]@db.pdkjmoayrcakcdvrfpdj.supabase.co:5432/postgres"')
    print("\nOr edit this script and set CONNECTION_STRING directly")
    print("\nGet connection string from:")
    print("  Supabase Dashboard > Settings > Database > Connection string > URI")
    sys.exit(1)

os.environ['DATABASE_URL'] = CONNECTION_STRING

django.setup()

from django.core.management import execute_from_command_line
from django.db import connection

print("=" * 60)
print("Setting up Supabase Database")
print("=" * 60)

# Test connection
try:
    with connection.cursor() as cursor:
        cursor.execute("SELECT version();")
        version = cursor.fetchone()
        print(f"\n[OK] Connected to PostgreSQL!")
        print(f"Database: {version[0][:60]}...")
except Exception as e:
    print(f"\n[ERROR] Connection failed: {e}")
    print("\nPlease check:")
    print("1. Supabase project is active")
    print("2. Connection string is correct")
    print("3. Password is URL-encoded (# becomes %23)")
    sys.exit(1)

# Run migrations
print("\n[1/2] Running migrations...")
try:
    execute_from_command_line(['manage.py', 'migrate', '--noinput'])
    print("[OK] Migrations completed!")
except Exception as e:
    print(f"[ERROR] Migrations failed: {e}")
    sys.exit(1)

# Check data
print("\n[2/2] Checking database...")
from api.models import Question, Exam, Attempt, ExamSession, DailyPlan

print(f"  Questions: {Question.objects.count()}")
print(f"  Exams: {Exam.objects.count()}")
print(f"  Attempts: {Attempt.objects.count()}")
print(f"  Sessions: {ExamSession.objects.count()}")
print(f"  Daily Plans: {DailyPlan.objects.count()}")

print("\n" + "=" * 60)
print("[SUCCESS] Database setup complete!")
print("=" * 60)
print("\nNext: Your data from SQLite needs to be migrated.")
print("Run: python scripts/migrate_data_to_postgresql.py")

