# Render Deployment Guide

## Step 1: Create Render Account

1. Go to https://render.com
2. Sign up with GitHub (recommended for easy deployment)
3. Verify your email

## Step 2: Deploy Backend

### Option A: Deploy from GitHub (Recommended)

1. **Push your code to GitHub** (if not already)
   ```bash
   git add .
   git commit -m "Prepare for Render deployment"
   git push
   ```

2. **In Render Dashboard:**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select your repository

3. **Configure the service:**
   - **Name:** `exit-exam-backend` (or your choice)
   - **Region:** Choose closest to you (e.g., Frankfurt, Oregon)
   - **Branch:** `main` (or your default branch)
   - **Root Directory:** Leave empty (or `backend` if you want)
   - **Environment:** `Python 3`
   - **Build Command:** `pip install -r backend/requirements.txt`
   - **Start Command:** `cd backend && gunicorn exam_app.wsgi:application --bind 0.0.0.0:$PORT`

4. **Set Environment Variables:**
   Click "Advanced" → "Add Environment Variable"
   
   Add these variables:
   - **DATABASE_URL**
     ```
     postgresql://postgres.pdkjmoayrcakcdvrfpdj:%23natnael0336@aws-1-eu-north-1.pooler.supabase.com:5432/postgres
     ```
   
   - **SECRET_KEY**
     ```
     754a(u+0&6dfcm87oib5xt4((zkn&_dmh2@z5aqu_+mnmvsz+@
     ```
   
   - **DEBUG**
     ```
     False
     ```
   
   - **ALLOWED_HOSTS**
     ```
     exit-exam-backend.onrender.com
     ```
     (Render will give you a different domain - update this after first deploy)
   
   - **FRONTEND_URL** (set this after frontend is deployed)
     ```
     https://your-frontend.vercel.app
     ```

5. **Click "Create Web Service"**
   - Render will start building and deploying
   - First deployment takes 5-10 minutes

6. **After deployment:**
   - Get your Render URL (e.g., `https://exit-exam-backend.onrender.com`)
   - Update `ALLOWED_HOSTS` with your actual Render domain
   - Run migrations:
     - Go to Render Dashboard → Your Service → "Shell"
     - Run: `cd backend && python manage.py migrate`
     - Or use Render CLI: `render run python backend/manage.py migrate`

### Option B: Use render.yaml (Alternative)

If you prefer, you can use the `render.yaml` file:
1. In Render Dashboard → "New +" → "Blueprint"
2. Connect your GitHub repo
3. Render will read `render.yaml` and create the service
4. You'll still need to set environment variables manually

## Step 3: Update Frontend

After backend is deployed:

1. **Get your Render backend URL:**
   - From Render Dashboard → Your Service
   - Copy the URL (e.g., `https://exit-exam-backend.onrender.com`)

2. **Update Vercel:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add/Update: `VITE_API_BASE_URL` = `https://exit-exam-backend.onrender.com/api`
   - Redeploy frontend

3. **Update Render CORS:**
   - Go back to Render → Your Service → Environment
   - Update `FRONTEND_URL` = your Vercel URL
   - Redeploy backend

## Important Notes

### Render Free Tier Limitations:
- **Sleeps after 15 minutes** of inactivity
- **Takes 30-60 seconds to wake up** on first request after sleep
- **750 hours/month** free (enough for always-on if you keep it active)

### To Keep Service Awake (Optional):
- Use a cron job service like cron-job.org
- Set it to ping your Render URL every 10 minutes
- Or use UptimeRobot (free tier)

### Database:
- Your Supabase database is already set up and working
- All 828 records are migrated
- Connection string is saved in environment variables

## Troubleshooting

### Service won't start:
- Check build logs in Render Dashboard
- Verify all environment variables are set
- Check that `requirements.txt` has all dependencies

### Database connection errors:
- Verify `DATABASE_URL` is correct
- Check password is URL-encoded (`#` → `%23`)
- Ensure Supabase project is active

### CORS errors:
- Make sure `FRONTEND_URL` is set in Render
- Check `CORS_ALLOWED_ORIGINS` in settings.py includes your frontend URL

## Your Connection Details

**Supabase Database:**
```
postgresql://postgres.pdkjmoayrcakcdvrfpdj:%23natnael0336@aws-1-eu-north-1.pooler.supabase.com:5432/postgres
```

**Secret Key:**
```
754a(u+0&6dfcm87oib5xt4((zkn&_dmh2@z5aqu_+mnmvsz+@
```

Save these for reference!







