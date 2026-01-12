# Django Backend for Exit Exam App

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Run migrations:
```bash
python manage.py makemigrations
python manage.py migrate
```

4. Create a superuser (optional, for admin access):
```bash
python manage.py createsuperuser
```

5. Run the development server:
```bash
python manage.py runserver
```

The API will be available at `http://localhost:8000/api/`

## Data Migration from Firebase

To migrate existing Firebase data:

1. Export your Firebase service account key JSON file
2. Set the environment variable:
```bash
export FIREBASE_CREDENTIALS_PATH=/path/to/your/service-account-key.json
```

3. Run the migration script:
```bash
python scripts/migrate_firebase_to_django.py
```

## API Endpoints

- `/api/questions/` - Question management
- `/api/exams/` - Exam management
- `/api/attempts/` - Attempt tracking
- `/api/sessions/` - Exam session management
- `/api/plans/` - Daily plan management
- `/api/settings/theme/` - Theme preferences
- `/api/analytics/` - Analytics endpoints

## Admin Interface

Access Django admin at `http://localhost:8000/admin/` (after creating superuser)

