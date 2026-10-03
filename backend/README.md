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

## API Endpoints

- `/api/questions/` - Question management
- `/api/exams/` - Exam management
- `/api/attempts/` - Attempt tracking
- `/api/sessions/` - Exam session management
- `/api/plans/` - Daily plan management
- `/api/settings/theme/` - Theme preferences
- `/api/analytics/` - Analytics endpoints
- `/api/auth/` - Signup, login, logout, current user (token auth)
- `/api/exam-imports/` - PDF exam import
- `/api/study-docs/`, `/api/study-sessions/` - Study materials and Study chat

Run the tests with `python manage.py test api`. Deployment: see `../docs/DEPLOY.md`.

## Admin Interface

Access Django admin at `http://localhost:8000/admin/` (after creating superuser)

