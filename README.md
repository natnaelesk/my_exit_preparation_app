# Exit Exam Preparation Platform

A single-user personal exam preparation and analysis platform for the Ethiopian Computer Science BSc Exit Exam.

## Features

- **Three Exam Modes:**
  - Random Mode: Practice with randomly selected questions
  - Topic-Focused Mode: Focus on specific subjects and topics
  - Weak-Area Mode: Automatically targets your weak areas

- **AI Assistant (Grok Integration):**
  - Click the ✨ button on any question during exam mode
  - Get instant AI explanations of questions, answers, and topics
  - Chat with AI to ask follow-up questions
  - Questions are marked as incorrect when using AI (for learning purposes)
  - No chat data is saved - all interactions are temporary

- **Comprehensive Analytics:**
  - Subject-level performance analysis
  - Topic-level drill-down
  - Performance trends over time
  - Strong/Medium/Weak status indicators

- **Smart Practice:**
  - "Improve This Area" buttons on subject/topic views
  - Automatic weak-area identification
  - Cross-exam aggregation of attempts

- **Exam Features:**
  - One question at a time
  - Auto-save on every interaction
  - Pause and resume functionality
  - Time tracking per question
  - Detailed wrong answer review after completion

## Tech Stack

- React (JavaScript) - Frontend
- Django REST Framework - Backend API
- SQLite - Database
- Vite - Build tool
- Recharts (for analytics visualization)

## Setup

### Frontend Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
   - Create a `.env` file in the root directory (copy from `.env.example` if it exists)
   - Add Django API URL:
   ```
   VITE_API_BASE_URL=http://localhost:8000/api
   ```

3. Configure AI Assistant (Optional - for AI assistant feature):
   - **Recommended: Use OpenAI** (works immediately, free tier available)
     - Get API key from [OpenAI](https://platform.openai.com/api-keys)
     - Add to `.env` file:
     ```
     VITE_GROK_API_KEY=sk-your-openai-api-key
     VITE_GROK_API_URL=https://api.openai.com/v1/chat/completions
     VITE_GROK_MODEL=gpt-3.5-turbo
     ```
   - **Alternative: Use Grok/xAI** (if API is available)
     - Get API key from [xAI](https://x.ai)
     - Add to `.env` file:
     ```
     VITE_GROK_API_KEY=your-grok-api-key
     VITE_GROK_API_URL=https://api.x.ai/v1/chat/completions
     VITE_GROK_MODEL=grok-beta
     ```
   - **Note**: The AI assistant feature is optional. If you don't add the API key, the AI button will show an error message when clicked.
   - **Troubleshooting**: If you get a 400 error, check the browser console (F12) for detailed error messages. The service supports OpenAI-compatible APIs.

### Backend Setup

4. Set up Django backend:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   python manage.py makemigrations
   python manage.py migrate
   python manage.py runserver
   ```
   
   The API will be available at `http://localhost:8000/api/`

5. Run the React development server (in a new terminal):
```bash
npm run dev
```

## Features

### AI Assistant (Grok Integration)
During exam mode, you can click the Grok AI button (✨) on any question to:
- Get instant explanations of the question and answer
- Understand why the correct answer is correct
- Learn about the topic in detail
- Chat with AI to ask follow-up questions
- **Note**: Using Grok marks the question as incorrect for learning purposes (this is intentional for study mode)
- **Privacy**: No chat data is saved - all AI interactions are temporary and not stored

### Migrating Data from Firebase (Optional)

If you have existing Firebase data and want to migrate it to Django:

1. Export your Firebase service account key:
   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Save the JSON file

2. Set environment variable:
   ```bash
   export FIREBASE_CREDENTIALS_PATH=/path/to/service-account-key.json
   # On Windows PowerShell:
   $env:FIREBASE_CREDENTIALS_PATH="C:\path\to\service-account-key.json"
   ```

3. Run migration script:
   ```bash
   python scripts/migrate_firebase_to_django.py
   ```

See `MIGRATION_GUIDE.md` for detailed migration instructions.

## Database Schema

The app uses the following Django models:
- `Question` - Stores all question data
- `Exam` - Stores exam metadata
- `Attempt` - Stores user answer attempts
- `ExamSession` - Stores exam session state
- `DailyPlan` - Stores daily study plans
- `ThemePreferences` - Stores theme settings

## Question Data Structure

Each question in the database should have:
```javascript
{
  question: string,
  choices: string[],
  correctAnswer: string,
  explanation: string,
  subject: string, // One of the 15 official subjects
  topic: string,   // Free-form topic name
  createdAt: timestamp
}
```

## Official Subjects

The system uses these 15 fixed subjects:
1. Computer Programming
2. Object Oriented Programming
3. Data Structures and Algorithms
4. Design and Analysis of Algorithms
5. Database Systems
6. Software Engineering
7. Web Programming
8. Operating System
9. Computer Organization and Architecture
10. Data Communication and Computer Networking
11. Computer Security
12. Network and System Administration
13. Introduction to Artificial Intelligence
14. Automata and Complexity Theory
15. Compiler Design

## Deployment

### Frontend Deployment (Vercel)

1. Push your code to GitHub
2. Import project to Vercel
3. Add environment variable: `VITE_API_BASE_URL` pointing to your Django API
4. Deploy

### Backend Deployment

The Django backend can be deployed to:
- **Heroku** - See Django deployment guides
- **Railway** - Easy Django deployment
- **DigitalOcean App Platform** - Managed Django hosting
- **AWS/GCP/Azure** - Enterprise solutions

For production:
- Use PostgreSQL instead of SQLite
- Set `DEBUG=False` in Django settings
- Configure CORS for your frontend domain
- Set up proper secret key and environment variables

See `MIGRATION_GUIDE.md` for more deployment details.

## License

MIT

