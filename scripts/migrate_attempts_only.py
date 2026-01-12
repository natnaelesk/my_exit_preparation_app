#!/usr/bin/env python
"""
Simple script to migrate only attempts from Firebase to Django
"""
import os
import sys
import django
from datetime import datetime
import time

# Setup Django
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
sys.path.insert(0, backend_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'exam_app.settings')
django.setup()

import firebase_admin
from firebase_admin import credentials, firestore
from api.models import Attempt

def convert_timestamp(timestamp):
    """Convert Firestore Timestamp to Django datetime"""
    if hasattr(timestamp, 'timestamp'):
        return datetime.fromtimestamp(timestamp.timestamp())
    elif isinstance(timestamp, datetime):
        return timestamp
    return datetime.now()

def main():
    """Migrate only attempts"""
    print("=" * 50)
    print("Firebase to Django - Attempts Migration")
    print("=" * 50)
    
    # Get Firebase credentials path
    firebase_cred_path = os.environ.get('FIREBASE_CREDENTIALS_PATH')
    if not firebase_cred_path:
        print("ERROR: FIREBASE_CREDENTIALS_PATH environment variable not set")
        print("Please set it to the path of your Firebase service account JSON file")
        return
    
    if not os.path.exists(firebase_cred_path):
        print(f"ERROR: Firebase credentials file not found: {firebase_cred_path}")
        return
    
    try:
        cred = credentials.Certificate(firebase_cred_path)
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("[OK] Connected to Firebase")
    except Exception as e:
        print(f"ERROR: Failed to initialize Firebase: {e}")
        return
    
    print("\nMigrating attempts...")
    print("This may take a while if you have many attempts...\n")
    
    attempts_ref = db.collection('attempts')
    count = 0
    errors = 0
    
    try:
        # Get all attempts
        docs = attempts_ref.stream()
        
        for doc in docs:
            try:
                data = doc.to_dict()
                
                # Create or update attempt
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
                
                # Progress indicator every 50 records
                if count % 50 == 0:
                    print(f"  Migrated {count} attempts...")
                
                # Small delay to avoid rate limits
                if count % 100 == 0:
                    time.sleep(0.5)
                    
            except Exception as e:
                errors += 1
                print(f"Error migrating attempt {doc.id}: {e}")
                if errors > 10:
                    print("Too many errors. Stopping migration.")
                    break
        
        print("\n" + "=" * 50)
        print(f"Migration complete!")
        print(f"  Successfully migrated: {count} attempts")
        if errors > 0:
            print(f"  Errors: {errors}")
        print("=" * 50)
        
    except Exception as e:
        print(f"\nERROR during migration: {e}")
        print(f"Migrated {count} attempts before error")

if __name__ == '__main__':
    main()

