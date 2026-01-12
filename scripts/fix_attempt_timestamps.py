#!/usr/bin/env python
"""
Script to fix attempt timestamps by re-migrating from Firebase with proper timestamp conversion
"""
import os
import sys
import django
from datetime import datetime

backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
sys.path.insert(0, backend_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'exam_app.settings')
django.setup()

import firebase_admin
from firebase_admin import credentials, firestore
from api.models import Attempt

def convert_timestamp(timestamp):
    """Convert Firestore Timestamp to Django datetime (timezone-aware)"""
    from django.utils import timezone
    
    if timestamp is None:
        return None
    
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
    
    # Handle Unix timestamp
    if isinstance(timestamp, (int, float)):
        try:
            if timestamp > 1e10:
                timestamp = timestamp / 1000
            dt = datetime.fromtimestamp(timestamp, tz=timezone.utc)
            return dt
        except:
            pass
    
    return None

def main():
    firebase_cred_path = os.environ.get('FIREBASE_CREDENTIALS_PATH')
    if not firebase_cred_path:
        default_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'exitexam-ea6a5-firebase-adminsdk-fbsvc-99975039b5.json'
        )
        if os.path.exists(default_path):
            firebase_cred_path = default_path
    
    if not firebase_cred_path or not os.path.exists(firebase_cred_path):
        print("ERROR: Firebase credentials not found")
        return
    
    try:
        cred = credentials.Certificate(firebase_cred_path)
        firebase_admin.initialize_app(cred)
        db = firestore.client()
    except ValueError:
        pass  # Already initialized
    
    db = firestore.client()
    
    print("Checking Firebase attempt timestamps...")
    attempts_ref = db.collection('attempts')
    docs = list(attempts_ref.limit(5).stream())
    
    print(f"\nSample Firebase attempts:")
    for doc in docs:
        data = doc.to_dict()
        timestamp = data.get('timestamp')
        print(f"  {doc.id}: timestamp type={type(timestamp)}, value={timestamp}")
        if timestamp:
            converted = convert_timestamp(timestamp)
            print(f"    -> Converted: {converted}")
    
    print("\nUpdating Django attempts with correct timestamps...")
    all_docs = attempts_ref.stream()
    count = 0
    updated = 0
    
    for doc in all_docs:
        data = doc.to_dict()
        timestamp = data.get('timestamp')
        
        if timestamp:
            converted_timestamp = convert_timestamp(timestamp)
            if converted_timestamp:
                try:
                    attempt = Attempt.objects.get(attempt_id=doc.id)
                    if attempt.timestamp != converted_timestamp:
                        attempt.timestamp = converted_timestamp
                        attempt.save()
                        updated += 1
                except Attempt.DoesNotExist:
                    pass
        
        count += 1
        if count % 50 == 0:
            print(f"  Processed {count} attempts, updated {updated}...")
    
    print(f"\n[OK] Updated {updated} out of {count} attempts with correct timestamps")

if __name__ == '__main__':
    main()

