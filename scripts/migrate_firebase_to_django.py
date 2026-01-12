#!/usr/bin/env python
"""
Migration script to transfer data from Firebase Firestore to Django SQLite database
Enhanced with collection discovery, mapping, and progress output
"""
import os
import sys
import django
import argparse
from datetime import datetime

# Setup Django
# Add backend directory to Python path
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
sys.path.insert(0, backend_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'exam_app.settings')
django.setup()

import firebase_admin
from firebase_admin import credentials, firestore
from api.models import Question, Exam, Attempt, ExamSession, DailyPlan, ThemePreferences, FirebaseCollection
import time

def convert_timestamp(timestamp):
    """Convert Firestore Timestamp to Django datetime (timezone-aware)"""
    from django.utils import timezone
    
    if timestamp is None:
        return timezone.now()
    
    # Handle Firestore DatetimeWithNanoseconds or similar objects
    if hasattr(timestamp, 'timestamp'):
        try:
            dt = datetime.fromtimestamp(timestamp.timestamp(), tz=timezone.utc)
            return dt
        except:
            pass
    
    # Handle datetime objects (make timezone-aware if needed)
    if isinstance(timestamp, datetime):
        if timezone.is_naive(timestamp):
            return timezone.make_aware(timestamp)
        return timestamp
    
    # Handle ISO format strings
    if isinstance(timestamp, str):
        try:
            dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            if timezone.is_naive(dt):
                dt = timezone.make_aware(dt)
            return dt
        except:
            try:
                from dateutil import parser
                dt = parser.parse(timestamp)
                if timezone.is_naive(dt):
                    dt = timezone.make_aware(dt)
                return dt
            except:
                pass
    
    # Handle Unix timestamp (seconds or milliseconds)
    if isinstance(timestamp, (int, float)):
        try:
            # If timestamp is in milliseconds, convert to seconds
            if timestamp > 1e10:
                timestamp = timestamp / 1000
            dt = datetime.fromtimestamp(timestamp, tz=timezone.utc)
            return dt
        except:
            pass
    
    # Last resort: return current time
    return timezone.now()

def migrate_with_retry(func, collection_name, max_retries=3):
    """Helper function to migrate with retry logic"""
    for attempt in range(max_retries):
        try:
            return func()
        except Exception as e:
            if "Quota exceeded" in str(e) or "429" in str(e):
                wait_time = (attempt + 1) * 5  # Exponential backoff: 5s, 10s, 15s
                print(f"\n[WARN] Rate limit hit. Waiting {wait_time} seconds before retry {attempt + 1}/{max_retries}...")
                time.sleep(wait_time)
                continue
            else:
                raise
    raise Exception(f"Failed to migrate {collection_name} after {max_retries} attempts")

def discover_collections(db):
    """Discover Firebase collections and count documents"""
    print("Discovering Firebase collections...")
    print("-" * 60)
    
    known_collections = [
        'questions', 'exams', 'attempts', 'examSessions', 
        'dailyPlans', 'settings'
    ]
    
    discovered = {}
    
    for collection_name in known_collections:
        try:
            collection_ref = db.collection(collection_name)
            # Try to get document IDs to count
            doc_ids = [doc.id for doc in collection_ref.select([]).stream()]
            count = len(doc_ids)
            if count > 0 or collection_name == 'settings':  # settings might be empty but exist
                discovered[collection_name] = count
                print(f"  [OK] Found '{collection_name}': {count:,} documents")
        except Exception as e:
            # Collection might not exist
            pass
    
    if discovered:
        total = sum(discovered.values())
        print(f"\nFound {len(discovered)} collections with {total:,} total documents")
    else:
        print("No collections found")
    
    print("-" * 60)
    return discovered

# Collection mapping dictionary
COLLECTION_MAPPING = {
    'questions': ('Question', 'migrate_questions'),
    'exams': ('Exam', 'migrate_exams'),
    'attempts': ('Attempt', 'migrate_attempts'),
    'examSessions': ('ExamSession', 'migrate_sessions'),
    'dailyPlans': ('DailyPlan', 'migrate_daily_plans'),
    'settings': ('ThemePreferences', 'migrate_theme_preferences'),
}

def migrate_questions(db, progress_interval=50, verbose=False):
    """Migrate questions from Firebase to Django"""
    print("-" * 60)
    print("Migrating: questions")
    print("-" * 60)
    
    def _migrate():
        questions_ref = db.collection('questions')
        docs = questions_ref.stream()
        
        count = 0
        for doc in docs:
            data = doc.to_dict()
            try:
                Question.objects.update_or_create(
                    question_id=doc.id,
                    defaults={
                        'question': data.get('question', ''),
                        'choices': data.get('choices', []),
                        'correct_answer': data.get('correctAnswer', ''),
                        'subject': data.get('subject', ''),
                        'topic': data.get('topic', ''),
                        'explanation': data.get('explanation', '')
                    }
                )
                count += 1
                
                if verbose or count % progress_interval == 0:
                    print(f"[OK] Saved question {doc.id}... ({count:,} total)")
                else:
                    sys.stdout.write(f"\rMigrating questions... {count:,} saved")
                    sys.stdout.flush()
                
                # Add small delay every 50 records to avoid rate limits
                if count % 50 == 0:
                    time.sleep(0.5)
                    
            except Exception as e:
                print(f"\n[ERROR] Error migrating question {doc.id}: {e}")
        
        if not verbose and count > progress_interval:
            print()  # New line after progress indicator
        return count
    
    try:
        count = migrate_with_retry(_migrate, "questions")
        print(f"[OK] Collection 'questions': {count:,} records migrated\n")
        return count
    except Exception as e:
        print(f"[ERROR] Failed to migrate questions: {e}\n")
        return 0

def migrate_exams(db, progress_interval=50, verbose=False):
    """Migrate exams from Firebase to Django"""
    print("-" * 60)
    print("Migrating: exams")
    print("-" * 60)
    
    exams_ref = db.collection('exams')
    docs = exams_ref.stream()
    
    count = 0
    for doc in docs:
        data = doc.to_dict()
        try:
            Exam.objects.update_or_create(
                exam_id=doc.id,
                defaults={
                    'title': data.get('title', ''),
                    'question_ids': data.get('questionIds', []),
                    'created_at': convert_timestamp(data.get('createdAt'))
                }
            )
            count += 1
            
            if verbose or count % progress_interval == 0:
                print(f"[OK] Saved exam {doc.id}... ({count:,} total)")
            else:
                sys.stdout.write(f"\rMigrating exams... {count:,} saved")
                sys.stdout.flush()
        except Exception as e:
            print(f"\n[ERROR] Error migrating exam {doc.id}: {e}")
    
    if not verbose and count > progress_interval:
        print()  # New line after progress indicator
    print(f"[OK] Collection 'exams': {count:,} records migrated\n")
    return count

def migrate_attempts(db, progress_interval=50, verbose=False):
    """Migrate attempts from Firebase to Django"""
    print("-" * 60)
    print("Migrating: attempts")
    print("-" * 60)
    
    def _migrate():
        attempts_ref = db.collection('attempts')
        docs = attempts_ref.stream()
        
        count = 0
        for doc in docs:
            data = doc.to_dict()
            try:
                Attempt.objects.update_or_create(
                    attempt_id=doc.id,
                    defaults={
                        'question_id': data.get('questionId', ''),
                        'selected_answer': data.get('selectedAnswer', ''),
                        'is_correct': data.get('isCorrect', False),
                        'time_spent': data.get('timeSpent', 0),
                        'subject': data.get('subject', ''),
                        'topic': data.get('topic', ''),
                        'exam_id': data.get('examId', ''),
                        'mode': data.get('mode', ''),
                        'plan_date_key': data.get('planDateKey', ''),
                        'timestamp': convert_timestamp(data.get('timestamp'))
                    }
                )
                count += 1
                
                if verbose or count % progress_interval == 0:
                    print(f"[OK] Saved attempt {doc.id}... ({count:,} total)")
                else:
                    sys.stdout.write(f"\rMigrating attempts... {count:,} saved")
                    sys.stdout.flush()
                
                # Add delay every 100 records
                if count % 100 == 0:
                    time.sleep(1)
                    
            except Exception as e:
                print(f"\n[ERROR] Error migrating attempt {doc.id}: {e}")
        
        if not verbose and count > progress_interval:
            print()  # New line after progress indicator
        return count
    
    try:
        count = migrate_with_retry(_migrate, "attempts")
        print(f"[OK] Collection 'attempts': {count:,} records migrated\n")
        return count
    except Exception as e:
        print(f"[ERROR] Failed to migrate attempts: {e}\n")
        return 0

def migrate_sessions(db, progress_interval=50, verbose=False):
    """Migrate exam sessions from Firebase to Django"""
    print("-" * 60)
    print("Migrating: examSessions")
    print("-" * 60)
    
    sessions_ref = db.collection('examSessions')
    docs = sessions_ref.stream()
    
    count = 0
    for doc in docs:
        data = doc.to_dict()
        try:
            ExamSession.objects.update_or_create(
                session_id=doc.id,
                defaults={
                    'exam_id': data.get('examId', ''),
                    'mode': data.get('mode', ''),
                    'config': data.get('config', {}),
                    'current_index': data.get('currentIndex', 0),
                    'question_ids': data.get('questionIds', []),
                    'answers': data.get('answers', {}),
                    'time_spent': data.get('timeSpent', {}),
                    'is_complete': data.get('isComplete', False),
                    'is_paused': data.get('isPaused', False),
                    'time_per_question': data.get('timePerQuestion'),
                    'plan_date_key': data.get('planDateKey', ''),
                    'started_at': convert_timestamp(data.get('startedAt')),
                    'last_updated': convert_timestamp(data.get('lastUpdated'))
                }
            )
            count += 1
            
            if verbose or count % progress_interval == 0:
                print(f"[OK] Saved session {doc.id}... ({count:,} total)")
            else:
                sys.stdout.write(f"\rMigrating examSessions... {count:,} saved")
                sys.stdout.flush()
        except Exception as e:
            print(f"\n[ERROR] Error migrating session {doc.id}: {e}")
    
    if not verbose and count > progress_interval:
        print()  # New line after progress indicator
    print(f"[OK] Collection 'examSessions': {count:,} records migrated\n")
    return count

def migrate_daily_plans(db, progress_interval=50, verbose=False):
    """Migrate daily plans from Firebase to Django"""
    print("-" * 60)
    print("Migrating: dailyPlans")
    print("-" * 60)
    
    plans_ref = db.collection('dailyPlans')
    docs = plans_ref.stream()
    
    count = 0
    for doc in docs:
        data = doc.to_dict()
        try:
            DailyPlan.objects.update_or_create(
                date_key=doc.id,
                defaults={
                    'focus_subject': data.get('focusSubject', ''),
                    'total_available_in_subject': data.get('totalAvailableInSubject', 0),
                    'max_planned_questions': data.get('maxPlannedQuestions', 35),
                    'question_ids': data.get('questionIds', []),
                    'answered_count': data.get('answeredCount', 0),
                    'correct_count': data.get('correctCount', 0),
                    'wrong_count': data.get('wrongCount', 0),
                    'accuracy': data.get('accuracy', 0.0),
                    'is_complete': data.get('isComplete', False),
                    'motivational_quote': data.get('motivationalQuote', ''),
                    'created_at': convert_timestamp(data.get('createdAt')),
                    'last_updated': convert_timestamp(data.get('lastUpdated'))
                }
            )
            count += 1
            
            if verbose or count % progress_interval == 0:
                print(f"[OK] Saved plan {doc.id}... ({count:,} total)")
            else:
                sys.stdout.write(f"\rMigrating dailyPlans... {count:,} saved")
                sys.stdout.flush()
        except Exception as e:
            print(f"\n[ERROR] Error migrating plan {doc.id}: {e}")
    
    if not verbose and count > progress_interval:
        print()  # New line after progress indicator
    print(f"[OK] Collection 'dailyPlans': {count:,} records migrated\n")
    return count

def migrate_theme_preferences(db, progress_interval=50, verbose=False):
    """Migrate theme preferences from Firebase to Django"""
    print("-" * 60)
    print("Migrating: settings (themePreferences)")
    print("-" * 60)
    
    try:
        settings_ref = db.collection('settings')
        doc_ref = settings_ref.document('themePreferences')
        doc = doc_ref.get()
        
        if doc.exists:
            data = doc.to_dict()
            ThemePreferences.objects.update_or_create(
                id='themePreferences',
                defaults={
                    'favorite_light_theme': data.get('favoriteLightTheme', 'light'),
                    'favorite_dark_theme': data.get('favoriteDarkTheme', 'dark'),
                    'auto_mode': data.get('autoMode', False)
                }
            )
            print("[OK] Saved themePreferences... (1 total)")
            print("[OK] Collection 'settings': 1 record migrated\n")
            return 1
        else:
            print("[INFO] No theme preferences found\n")
            return 0
    except Exception as e:
        print(f"[ERROR] Error migrating theme preferences: {e}\n")
        return 0

def migrate_generic_collection(db, collection_name, progress_interval=50, verbose=False):
    """Migrate unknown collections to generic FirebaseCollection model"""
    print("-" * 60)
    print(f"Migrating: {collection_name} (generic)")
    print("-" * 60)
    
    collection_ref = db.collection(collection_name)
    docs = collection_ref.stream()
    
    count = 0
    for doc in docs:
        try:
            FirebaseCollection.objects.update_or_create(
                collection_name=collection_name,
                document_id=doc.id,
                defaults={'data': doc.to_dict()}
            )
            count += 1
            
            if verbose or count % progress_interval == 0:
                print(f"[OK] Saved {collection_name}/{doc.id}... ({count:,} total)")
            else:
                sys.stdout.write(f"\rMigrating {collection_name}... {count:,} saved")
                sys.stdout.flush()
        except Exception as e:
            print(f"\n[ERROR] Error saving {collection_name}/{doc.id}: {e}")
    
    if not verbose and count > progress_interval:
        print()  # New line after progress indicator
    print(f"[OK] Collection '{collection_name}': {count:,} records migrated (generic)\n")
    return count

def main():
    """Main migration function"""
    parser = argparse.ArgumentParser(description='Migrate Firebase data to Django')
    parser.add_argument('--discover-only', action='store_true', 
                       help='Only discover collections, do not migrate')
    parser.add_argument('--collections', type=str, 
                       help='Comma-separated list of collections to migrate (e.g., questions,attempts)')
    parser.add_argument('--all', action='store_true', default=True,
                       help='Migrate all discovered collections (default)')
    parser.add_argument('--progress-interval', type=int, default=50,
                       help='Show progress every N records (default: 50)')
    parser.add_argument('--verbose', action='store_true',
                       help='Show "saved..." for every record')
    parser.add_argument('--auto-create', action='store_true', default=True,
                       help='Create generic tables for unknown collections (default: True)')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("Firebase to Django Migration Script")
    print("=" * 60)
    
    # Initialize Firebase Admin SDK
    firebase_cred_path = os.environ.get('FIREBASE_CREDENTIALS_PATH')
    
    # Try default location if not set
    if not firebase_cred_path:
        default_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'exitexam-ea6a5-firebase-adminsdk-fbsvc-99975039b5.json'
        )
        if os.path.exists(default_path):
            firebase_cred_path = default_path
        else:
            print("ERROR: FIREBASE_CREDENTIALS_PATH environment variable not set")
            print("Please set it to the path of your Firebase service account JSON file")
            return
    
    if not os.path.exists(firebase_cred_path):
        print(f"ERROR: Firebase credentials file not found: {firebase_cred_path}")
        return
    
    try:
        # Initialize Firebase (handle if already initialized)
        try:
            cred = credentials.Certificate(firebase_cred_path)
            firebase_admin.initialize_app(cred)
        except ValueError:
            # Already initialized, use existing app
            pass
        
        db = firestore.client()
        print("[OK] Connected to Firebase")
        print("[OK] Django database initialized\n")
    except Exception as e:
        print(f"ERROR: Failed to initialize Firebase: {e}")
        return
    
    # Discover collections
    discovered = discover_collections(db)
    
    if not discovered:
        print("No collections found. Exiting.")
        return
    
    if args.discover_only:
        print("\nDiscovery complete. Use --all or --collections to migrate.")
        return
    
    # Determine which collections to migrate
    collections_to_migrate = []
    if args.collections:
        collections_to_migrate = [c.strip() for c in args.collections.split(',')]
        # Validate collections exist
        invalid = [c for c in collections_to_migrate if c not in discovered]
        if invalid:
            print(f"[WARN] Warning: Collections not found: {', '.join(invalid)}")
            collections_to_migrate = [c for c in collections_to_migrate if c in discovered]
    else:
        # Migrate all discovered collections
        collections_to_migrate = list(discovered.keys())
    
    if not collections_to_migrate:
        print("No collections to migrate.")
        return
    
    print(f"\nStarting migration...")
    print(f"Collections to migrate: {', '.join(collections_to_migrate)}")
    print(f"Progress interval: {args.progress_interval} records")
    if args.verbose:
        print("Verbose mode: ON (showing every save)\n")
    else:
        print()
    
    # Migration function mapping
    migration_functions = {
        'questions': migrate_questions,
        'exams': migrate_exams,
        'attempts': migrate_attempts,
        'examSessions': migrate_sessions,
        'dailyPlans': migrate_daily_plans,
        'settings': migrate_theme_preferences,
    }
    
    results = {}
    total = 0
    
    # Migrate each collection
    for collection_name in collections_to_migrate:
        if collection_name in COLLECTION_MAPPING:
            # Use specific migration function
            func = migration_functions.get(collection_name)
            if func:
                count = func(db, args.progress_interval, args.verbose)
                results[collection_name] = count
                total += count
        else:
            # Use generic migration
            if args.auto_create:
                count = migrate_generic_collection(db, collection_name, args.progress_interval, args.verbose)
                results[collection_name] = (count, 'generic')
                total += count
            else:
                print(f"[WARN] Skipping unknown collection '{collection_name}' (use --auto-create to migrate)")
    
    # Print summary
    print("=" * 60)
    print("Migration Summary")
    print("=" * 60)
    print(f"Total collections migrated: {len(results)}")
    print(f"Total records migrated: {total:,}\n")
    
    for collection_name, result in results.items():
        if isinstance(result, tuple):
            count, collection_type = result
            print(f"  - {collection_name}: {count:,} ({collection_type})")
        else:
            print(f"  - {collection_name}: {result:,}")
    
    print("=" * 60)

if __name__ == '__main__':
    main()
