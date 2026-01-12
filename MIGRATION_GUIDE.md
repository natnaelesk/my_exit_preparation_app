# Firebase to Django Migration Guide

This guide explains how to migrate from Firebase Firestore to Django REST API backend.

## Prerequisites

1. Python 3.8+ installed
2. Node.js and npm installed (for React frontend)
3. Firebase service account key JSON file (for data migration)

## Step 1: Set Up Django Backend

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run migrations to create database tables:
```bash
python manage.py makemigrations
python manage.py migrate
```

5. (Optional) Create a superuser for Django admin:
```bash
python manage.py createsuperuser
```

6. Start the Django development server:
```bash
python manage.py runserver
```

The API will be available at `http://localhost:8000/api/`

## Step 2: Migrate Data from Firebase

1. Export your Firebase service account key:
   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Save the JSON file

2. Set the environment variable:
```bash
export FIREBASE_CREDENTIALS_PATH=/path/to/your/service-account-key.json
# On Windows PowerShell:
$env:FIREBASE_CREDENTIALS_PATH="C:\path\to\your\service-account-key.json"
```

3. Run the migration script:
```bash
python scripts/migrate_firebase_to_django.py
```

This will migrate:
- Questions
- Exams
- Attempts
- Exam Sessions
- Daily Plans
- Theme Preferences

## Step 3: Update Frontend Configuration

1. Create or update `.env` file in the root directory:
```env
VITE_API_BASE_URL=http://localhost:8000/api
```

2. Remove or comment out Firebase configuration (no longer needed):
```env
# VITE_FIREBASE_API_KEY=...
# VITE_FIREBASE_AUTH_DOMAIN=...
# etc.
```

## Step 4: Test the Application

1. Start Django backend (if not already running):
```bash
cd backend
python manage.py runserver
```

2. Start React frontend:
```bash
npm run dev
```

3. Test all features:
   - Login/Authentication
   - View questions
   - Take exams
   - View analytics
   - Daily plans
   - Theme preferences

## Step 5: Clean Up (After Verification)

Once you've verified everything works:

1. Remove Firebase dependencies from `package.json`:
```bash
npm uninstall firebase
```

2. Remove Firebase service file:
```bash
rm src/services/firebase.js
```

3. Remove Firebase configuration from `.env`

## Troubleshooting

### CORS Errors
If you see CORS errors, ensure `django-cors-headers` is installed and configured in `backend/exam_app/settings.py`.

### API Connection Errors
- Verify Django server is running on port 8000
- Check `VITE_API_BASE_URL` in `.env` file
- Check browser console for specific error messages

### Data Migration Issues
- Verify Firebase service account key path is correct
- Check that Firebase project has read permissions
- Review migration script output for specific errors

### Database Issues
- If SQLite database is corrupted, delete `backend/db.sqlite3` and run migrations again
- Use Django admin (`http://localhost:8000/admin/`) to verify data

## API Endpoints

All endpoints are prefixed with `/api/`:

- `GET /api/questions/` - List all questions
- `GET /api/questions/{id}/` - Get question by ID
- `POST /api/questions/bulk/` - Bulk create/get questions
- `GET /api/exams/` - List all exams
- `POST /api/exams/` - Create exam
- `GET /api/attempts/` - List all attempts
- `POST /api/attempts/` - Create attempt
- `GET /api/sessions/` - List all sessions
- `POST /api/sessions/` - Create session
- `PATCH /api/sessions/{id}/progress/` - Update session progress
- `GET /api/plans/{dateKey}/` - Get daily plan
- `POST /api/plans/` - Create daily plan
- `GET /api/settings/theme/` - Get theme preferences
- `PUT /api/settings/theme/` - Update theme preferences
- `GET /api/analytics/subjects/` - Get subject statistics
- `GET /api/analytics/topics/?subject=X` - Get topic statistics
- `GET /api/analytics/trend/` - Get overall trend

## Next Steps

1. Set up production database (PostgreSQL recommended)
2. Configure production CORS settings
3. Set up deployment (Docker, cloud hosting)
4. Add API authentication if needed
5. Set up API documentation (Swagger/OpenAPI)

