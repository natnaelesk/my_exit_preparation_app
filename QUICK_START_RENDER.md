# Quick Start: Deploy to Render

## Your Supabase Connection String
```
postgresql://postgres.pdkjmoayrcakcdvrfpdj:%23natnael0336@aws-1-eu-north-1.pooler.supabase.com:5432/postgres
```

## Your Secret Key
```
754a(u+0&6dfcm87oib5xt4((zkn&_dmh2@z5aqu_+mnmvsz+@
```

## Steps to Deploy

### 1. Push to GitHub
```bash
git add .
git commit -m "Ready for Render deployment"
git push
```

### 2. Go to Render.com
1. Sign up/Login with GitHub
2. Click "New +" → "Web Service"
3. Connect your GitHub repo
4. Select your repository

### 3. Configure Service
- **Name:** `exit-exam-backend`
- **Region:** Choose closest (Frankfurt, Oregon, etc.)
- **Branch:** `main`
- **Root Directory:** (leave empty)
- **Environment:** `Python 3`
- **Build Command:** `pip install -r backend/requirements.txt`
- **Start Command:** `cd backend && gunicorn exam_app.wsgi:application --bind 0.0.0.0:$PORT`

### 4. Set Environment Variables
Click "Advanced" → Add these:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | `postgresql://postgres.pdkjmoayrcakcdvrfpdj:%23natnael0336@aws-1-eu-north-1.pooler.supabase.com:5432/postgres` |
| `SECRET_KEY` | `754a(u+0&6dfcm87oib5xt4((zkn&_dmh2@z5aqu_+mnmvsz+@` |
| `DEBUG` | `False` |
| `ALLOWED_HOSTS` | `exit-exam-backend.onrender.com` (update after deploy) |
| `FRONTEND_URL` | (set after frontend deployed) |

### 5. Deploy
- Click "Create Web Service"
- Wait 5-10 minutes for first deployment
- Copy your Render URL (e.g., `https://exit-exam-backend.onrender.com`)

### 6. Run Migrations
After deployment:
- Render Dashboard → Your Service → "Shell"
- Run: `cd backend && python manage.py migrate`

### 7. Update Frontend
- Vercel → Settings → Environment Variables
- Set `VITE_API_BASE_URL` = your Render URL + `/api`
- Redeploy frontend

### 8. Update CORS
- Render → Environment → Update `FRONTEND_URL` = your Vercel URL
- Redeploy backend

Done! 🎉







