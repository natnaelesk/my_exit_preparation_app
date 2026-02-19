#!/usr/bin/env python
"""
Test Supabase PostgreSQL connection and migrate data
"""
import os
import sys
import django

backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
sys.path.insert(0, backend_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'exam_app.settings')
django.setup()

from django.db import connection
from api.models import Question, Exam, Attempt, ExamSession, DailyPlan, ThemePreferences

def test_connection():
    """Test database connection"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT version();")
            version = cursor.fetchone()
            print(f"[OK] Connected to PostgreSQL!")
            print(f"Database version: {version[0]}")
            return True
    except Exception as e:
        print(f"[ERROR] Connection failed: {e}")
        return False

def check_tables():
    """Check if tables exist"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name;
            """)
            tables = cursor.fetchall()
            print(f"\n[OK] Found {len(tables)} tables:")
            for table in tables:
                print(f"  - {table[0]}")
            return True
    except Exception as e:
        print(f"[ERROR] Failed to check tables: {e}")
        return False

def check_data():
    """Check data counts"""
    try:
        print("\n[OK] Data counts:")
        print(f"  Questions: {Question.objects.count()}")
        print(f"  Exams: {Exam.objects.count()}")
        print(f"  Attempts: {Attempt.objects.count()}")
        print(f"  Sessions: {ExamSession.objects.count()}")
        print(f"  Daily Plans: {DailyPlan.objects.count()}")
        print(f"  Theme Preferences: {ThemePreferences.objects.count()}")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to check data: {e}")
        return False

if __name__ == '__main__':
    print("=" * 60)
    print("Testing Supabase Connection")
    print("=" * 60)
    
    # Check if DATABASE_URL is set
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        print("\n[ERROR] DATABASE_URL environment variable not set!")
        print("\nPlease set it using:")
        print('  $env:DATABASE_URL="postgresql://postgres:[PASSWORD]@db.pdkjmoayrcakcdvrfpdj.supabase.co:5432/postgres"')
        print("\nOr get the connection string from Supabase Dashboard:")
        print("  Settings → Database → Connection string → URI")
        sys.exit(1)
    
    print(f"\nUsing database: {db_url.split('@')[1] if '@' in db_url else 'Unknown'}")
    
    if test_connection():
        check_tables()
        check_data()
        print("\n" + "=" * 60)
        print("[OK] Database connection successful!")
        print("=" * 60)
    else:
        print("\n[ERROR] Please check your DATABASE_URL connection string")
        sys.exit(1)







