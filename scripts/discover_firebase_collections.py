#!/usr/bin/env python
"""
Script to discover all Firebase Firestore collections and count documents
"""
import os
import sys
import json
from datetime import datetime

# Setup Django (needed for potential future use)
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
sys.path.insert(0, backend_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'exam_app.settings')

try:
    import django
    django.setup()
except:
    pass  # Django not required for discovery

import firebase_admin
from firebase_admin import credentials, firestore

def discover_collections():
    """Discover all Firebase collections and their document counts"""
    print("=" * 60)
    print("Firebase Collection Discovery")
    print("=" * 60)
    
    # Get Firebase credentials path
    firebase_cred_path = os.environ.get('FIREBASE_CREDENTIALS_PATH')
    
    # Try default location if not set
    if not firebase_cred_path:
        default_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'exitexam-ea6a5-firebase-adminsdk-fbsvc-99975039b5.json'
        )
        if os.path.exists(default_path):
            firebase_cred_path = default_path
            print(f"Using default credentials file: {firebase_cred_path}")
        else:
            print("ERROR: FIREBASE_CREDENTIALS_PATH environment variable not set")
            print("Please set it to the path of your Firebase service account JSON file")
            print("\nOr place the credentials file in the project root with name:")
            print("  exitexam-ea6a5-firebase-adminsdk-fbsvc-99975039b5.json")
            return None
    
    if not os.path.exists(firebase_cred_path):
        print(f"ERROR: Firebase credentials file not found: {firebase_cred_path}")
        return None
    
    try:
        # Initialize Firebase (handle if already initialized)
        try:
            cred = credentials.Certificate(firebase_cred_path)
            firebase_admin.initialize_app(cred)
        except ValueError:
            # Already initialized, use existing app
            pass
        
        db = firestore.client()
        print("[OK] Connected to Firebase\n")
    except Exception as e:
        print(f"ERROR: Failed to initialize Firebase: {e}")
        return None
    
    print("Discovering Firebase collections...")
    print("-" * 60)
    
    # Note: Firestore doesn't have a direct API to list all collections
    # We need to try known collections or use a workaround
    # For now, we'll check common collections and try to get document counts
    
    known_collections = [
        'questions', 'exams', 'attempts', 'examSessions', 
        'dailyPlans', 'settings', 'dailyPlans'
    ]
    
    discovered = {}
    all_collections = []
    
    # Try to get collections by attempting to read from them
    # This is a limitation - Firestore doesn't expose collection listing directly
    print("Checking known collections...")
    
    for collection_name in known_collections:
        try:
            collection_ref = db.collection(collection_name)
            # Count documents by getting all document IDs
            try:
                doc_ids = [doc.id for doc in collection_ref.select([]).stream()]
                count = len(doc_ids)
                if count > 0 or collection_name == 'settings':  # settings might exist even if empty
                    discovered[collection_name] = count
                    all_collections.append(collection_name)
                    print(f"  [OK] Found '{collection_name}': {count:,} documents")
            except Exception as e:
                # If counting fails, collection might not exist
                pass
        except Exception as e:
            # Collection doesn't exist or error accessing it
            pass
    
    # Try to discover other collections by checking for common patterns
    # This is a workaround since Firestore doesn't provide collection listing
    print("\nNote: Firestore doesn't provide direct collection listing.")
    print("Only collections that have been accessed are shown above.")
    print("To discover all collections, you may need to check Firebase Console.")
    
    print("\n" + "-" * 60)
    print("Discovery Summary:")
    print("-" * 60)
    
    if discovered:
        total_docs = sum(discovered.values())
        print(f"\nFound {len(discovered)} collections:")
        for name, count in sorted(discovered.items()):
            print(f"  - {name}: {count:,} documents")
        print(f"\nTotal documents: {total_docs:,}")
        
        # Save to JSON file
        output_file = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            'firebase_collections_discovered.json'
        )
        output_data = {
            'discovered_at': datetime.now().isoformat(),
            'collections': discovered,
            'total_collections': len(discovered),
            'total_documents': total_docs
        }
        
        with open(output_file, 'w') as f:
            json.dump(output_data, f, indent=2)
        
        print(f"\nDiscovery results saved to: {output_file}")
    else:
        print("\nNo collections found or unable to access collections.")
        print("Please verify:")
        print("  1. Firebase credentials are correct")
        print("  2. Firebase project has the expected collections")
        print("  3. Service account has read permissions")
    
    print("-" * 60)
    
    return discovered

if __name__ == '__main__':
    discover_collections()

