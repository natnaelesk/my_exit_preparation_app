# Firebase to Django Data Migration - Quick Guide

## Step 1: Get Your Firebase Service Account Key

1. **Go to Firebase Console:**
   - Visit: https://console.firebase.google.com/
   - Sign in with your Google account

2. **Select Your Project:**
   - Choose the Firebase project that contains your exam data

3. **Navigate to Service Accounts:**
   - Click the ⚙️ **gear icon** (Settings) in the left sidebar
   - Select **Project Settings**
   - Click on the **"Service accounts"** tab

4. **Generate Private Key:**
   - Click the **"Generate new private key"** button
   - A warning dialog will appear - click **"Generate key"**
   - A JSON file will be downloaded automatically

5. **Save the Key:**
   - Save this JSON file to a secure location on your computer
   - Remember the full path (e.g., `C:\Users\YourName\Downloads\your-project-firebase-adminsdk.json`)

## Step 2: Run the Migration

### Option A: Using the PowerShell Helper Script (Windows)

1. Open PowerShell in the project directory
2. Run:
   ```powershell
   .\scripts\run_migration.ps1
   ```
3. If prompted, enter the full path to your service account JSON file

### Option B: Manual Migration

1. **Set Environment Variable:**
   ```powershell
   $env:FIREBASE_CREDENTIALS_PATH="C:\full\path\to\your-service-account-key.json"
   ```
   
   **Example:**
   ```powershell
   $env:FIREBASE_CREDENTIALS_PATH="C:\Users\natna\Downloads\my-exit-exam-app-firebase-adminsdk-abc123.json"
   ```

2. **Navigate to Backend:**
   ```powershell
   cd backend
   ```

3. **Activate Virtual Environment:**
   ```powershell
   venv\Scripts\Activate.ps1
   ```

4. **Run Migration Script:**
   ```powershell
   python ..\scripts\migrate_firebase_to_django.py
   ```

## Step 3: Verify Migration

After the migration completes, you should see output like:
```
Migrating questions...
Migrated 150 questions
Migrating exams...
Migrated 5 exams
Migrating attempts...
Migrated 1200 attempts
...
Migration complete! Total records migrated: 1455
```

## What Gets Migrated?

The migration script transfers:
- ✅ **Questions** - All your exam questions
- ✅ **Exams** - All exam metadata
- ✅ **Attempts** - All your answer attempts and history
- ✅ **Exam Sessions** - All exam session data
- ✅ **Daily Plans** - All daily study plans
- ✅ **Theme Preferences** - Your theme settings

## Troubleshooting

### Error: "FIREBASE_CREDENTIALS_PATH environment variable not set"
- Make sure you've set the environment variable before running the script
- On Windows PowerShell: `$env:FIREBASE_CREDENTIALS_PATH="C:\path\to\file.json"`

### Error: "Credentials file not found"
- Check that the path is correct and the file exists
- Use the full absolute path (not relative path)
- Make sure there are no typos in the filename

### Error: "Permission denied" or "Authentication failed"
- Make sure your Firebase service account has the correct permissions
- Regenerate the service account key if needed
- Ensure the key hasn't expired

### Error: "ModuleNotFoundError: No module named 'firebase_admin'"
- Make sure you've activated the virtual environment
- Install dependencies: `pip install -r requirements.txt`

## After Migration

1. **Verify Data in Django Admin:**
   - Start Django server: `python manage.py runserver`
   - Visit: http://localhost:8000/admin/
   - Log in with your superuser account
   - Check the API models to verify data was migrated

2. **Test the Application:**
   - Make sure both Django backend and React frontend are running
   - Test viewing questions, exams, and analytics
   - Verify your attempt history is preserved

3. **Backup (Recommended):**
   - The migration script uses `update_or_create`, so it's safe to run multiple times
   - However, consider backing up your Django database after successful migration

## Important Notes

- ⚠️ **The migration script preserves all IDs** - Your question IDs, exam IDs, etc. will remain the same
- ⚠️ **Existing Django data will be updated** - If records with the same IDs exist, they will be updated
- ⚠️ **This is a one-way migration** - Data is copied from Firebase to Django, not synced
- ✅ **Safe to run multiple times** - The script won't create duplicates








