release: cd backend && python manage.py migrate
web: cd backend && gunicorn exam_app.wsgi:application --bind 0.0.0.0:$PORT --timeout 120

