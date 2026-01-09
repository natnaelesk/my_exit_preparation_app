# Exit Exam Preparation Platform

A single-user personal exam preparation and analysis platform for the Ethiopian Computer Science BSc Exit Exam.

## Features

- **Three Exam Modes:**
  - Random Mode: Practice with randomly selected questions
  - Topic-Focused Mode: Focus on specific subjects and topics
  - Weak-Area Mode: Automatically targets your weak areas

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

- React (JavaScript)
- Firebase Firestore
- Vite
- Recharts (for analytics visualization)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure Firebase:
   - Create a `.env` file in the root directory (copy from `.env.example` if it exists)
   - Add your Firebase configuration:
   ```
   VITE_FIREBASE_API_KEY=your-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   ```
   
   **To get your Firebase config:**
   1. Go to [Firebase Console](https://console.firebase.google.com/)
   2. Create a new project or select an existing one
   3. Go to Project Settings (gear icon)
   4. Scroll down to "Your apps" section
   5. Click on the web app icon (</>) or add a web app
   6. Copy the config values from the `firebaseConfig` object

3. Set up Firestore:
   - Create the following collections:
     - `questions` - Store question data
     - `exams` - Store exam metadata
     - `attempts` - Store user attempts
     - `examSessions` - Store exam session state

4. Run the development server:
```bash
npm run dev
```

## Firestore Security Rules

Since this is a single-user application with no authentication, you need to configure Firestore security rules to allow read/write access.

### Setting Up Firestore Security Rules

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click on **Firestore Database** in the left sidebar
4. Click on the **Rules** tab
5. Replace the default rules with the following:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to all collections for single-user app
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

6. Click **Publish** to save the rules

**Important Notes:**
- These rules allow full read/write access to anyone. This is acceptable for a single-user personal app.
- If you plan to deploy this publicly, consider adding additional security measures.
- The rules will take effect immediately after publishing.

### Creating Firestore Collections

The app uses these collections (they will be created automatically when you upload questions):
- `questions` - Stores all question data
- `exams` - Stores exam metadata
- `attempts` - Stores user answer attempts
- `examSessions` - Stores exam session state

## Question Data Structure

Each question in Firestore should have:
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

## Deployment to Vercel

This app is configured for easy deployment to Vercel.

### Prerequisites

1. A Vercel account (sign up at [vercel.com](https://vercel.com))
2. A Firebase project with Firestore enabled
3. Your Firebase configuration credentials

### Deployment Steps

1. **Push your code to GitHub** (already done if you're reading this)

2. **Import your project to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository: `natnaelesk/my_exit_preparation_app`
   - Vercel will auto-detect Vite configuration

3. **Add Environment Variables:**
   - In Vercel project settings, go to "Environment Variables"
   - Add the following variables (use the same names as in `.env.example`):
     - `VITE_FIREBASE_API_KEY`
     - `VITE_FIREBASE_AUTH_DOMAIN`
     - `VITE_FIREBASE_PROJECT_ID`
     - `VITE_FIREBASE_STORAGE_BUCKET`
     - `VITE_FIREBASE_MESSAGING_SENDER_ID`
     - `VITE_FIREBASE_APP_ID`
   - Make sure to add them for all environments (Production, Preview, Development)

4. **Deploy:**
   - Click "Deploy"
   - Vercel will build and deploy your app automatically
   - Your app will be live at `https://your-project-name.vercel.app`

### Build Configuration

The app uses the following build settings (configured in `vercel.json`):
- **Framework:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

### Important Notes

- Environment variables must be prefixed with `VITE_` to be accessible in the browser
- The app uses client-side routing, so Vercel is configured to redirect all routes to `index.html`
- Make sure your Firestore security rules are set up correctly (see Firestore Security Rules section above)

## License

MIT

