# Deployment Guide

## Supabase Database Connection

Your Supabase PostgreSQL connection string:
```
postgresql://postgres.pdkjmoayrcakcdvrfpdj:#natnael0336@aws-1-eu-north-1.pooler.supabase.com:5432/postgres
```

**Note:** When setting as environment variable, URL-encode the password:
- `#` becomes `%23`
- Full connection string: `postgresql://postgres.pdkjmoayrcakcdvrfpdj:%23natnael0336@aws-1-eu-north-1.pooler.supabase.com:5432/postgres`

## Railway Deployment

### Environment Variables to Set:

1. **DATABASE_URL** (Required)
   ```
   postgresql://postgres.pdkjmoayrcakcdvrfpdj:%23natnael0336@aws-1-eu-north-1.pooler.supabase.com:5432/postgres
   ```

2. **SECRET_KEY** (Required)
   - Generate a new secret key for production
   - Run: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`

3. **DEBUG** (Required)
   ```
   False
   ```

4. **ALLOWED_HOSTS** (Required)
   - Your Railway domain (e.g., `yourapp.up.railway.app`)
   - Can add multiple: `domain1.com,domain2.com`

5. **FRONTEND_URL** (Optional - for CORS)
   - Your Vercel frontend URL (e.g., `https://your-app.vercel.app`)

### Deployment Steps:

1. Push code to GitHub
2. Connect Railway to your repository
3. Railway will auto-detect Django
4. Set all environment variables above
5. Deploy
6. After deployment, run migrations:
   - Railway Dashboard → Your Service → "Deployments" → "View Logs"
   - Or use Railway CLI: `railway run python backend/manage.py migrate`

## Local Testing with PostgreSQL

To test locally with Supabase:

```powershell
$env:DATABASE_URL="postgresql://postgres.pdkjmoayrcakcdvrfpdj:%23natnael0336@aws-1-eu-north-1.pooler.supabase.com:5432/postgres"
cd backend
.\venv\Scripts\python.exe manage.py runserver
```

## Data Migration

All 828 records have been migrated to Supabase:
- Questions: 506
- Exams: 5
- Attempts: 300
- Sessions: 13
- Daily Plans: 3
- Theme Preferences: 1

