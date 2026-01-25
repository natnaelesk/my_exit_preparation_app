<div align="center">

![Dashboard](readme-images/dashboard.png)

# 🎓 Exit Exam Preparation Platform

### A Comprehensive, AI-Powered Study Platform for Ethiopian Computer Science BSc Exit Exam

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![React](https://img.shields.io/badge/React-18.2.0-61DAFB?logo=react)
![Django](https://img.shields.io/badge/Django-4.2.7-092E20?logo=django)
![License](https://img.shields.io/badge/license-MIT-green.svg)

[Features](#-features) • [Quick Start](#-quick-start) • [Screenshots](#-screenshots) • [Deployment](#-deployment)

---

</div>

## 🎯 Overview

A sophisticated exam preparation platform for Ethiopian Computer Science BSc students. Features intelligent exam modes, AI-powered assistance, comprehensive analytics, and smart practice features.

**Key Highlights:**
- 🎯 Three Intelligent Exam Modes (Random, Topic-Focused, Weak-Area)
- 🤖 AI-Powered Learning Assistant (OpenAI/Grok integration)
- 📊 Comprehensive Analytics & Performance Tracking
- 📅 Smart Daily Plans & Auto-Save
- 🎨 Modern UI/UX with Dark Mode

---

## ✨ Features

### 🎮 Exam Modes

**Random Mode** - Practice with randomly selected questions to simulate real exam conditions.

**Topic-Focused Mode** - Focus on specific subjects and topics to strengthen targeted areas.

**Weak-Area Mode** - Automatically identifies and targets your weak areas based on performance history.

![Question Bank](readme-images/questions.png)

### 🤖 AI Assistant

Click the ✨ button during exams to get instant explanations, understand answers, and chat with AI. All interactions are temporary and private.

### 📊 Analytics & Performance

Track performance across 15 subjects with detailed breakdowns, topic-level analysis, performance trends, and visual status indicators.

![Analytics Dashboard](readme-images/analysis.png)

### 📝 Exam Features

- One question at a time interface
- Auto-save on every interaction
- Pause & resume functionality
- Time tracking per question
- Detailed wrong answer review

![Exam Interface](readme-images/exam-interface.png)

### 📅 Daily Plans

Create and manage personalized daily study plans to track your progress.

![Daily Plans](readme-images/plan.png)

---

## 📸 Screenshots

<div align="center">

![Dashboard](readme-images/dashboard.png)
*Main Dashboard*

![Exam Session](readme-images/exam.png)
*Active Exam Session*

![Exam Interface](readme-images/exam-interface.png)
*Exam Interface*

![Analytics](readme-images/analysis.png)
*Analytics Dashboard*

![Question Bank](readme-images/questions.png)
*Question Bank*

![Daily Plans](readme-images/plan.png)
*Daily Plans*

</div>

---

## 🛠️ Tech Stack

**Frontend:** React 18.2.0 • Vite • Tailwind CSS • Recharts • Framer Motion

**Backend:** Django 4.2.7 • Django REST Framework • PostgreSQL/SQLite

**AI:** OpenAI API / Grok/xAI API

**Deployment:** Vercel (Frontend) • Render/Railway (Backend)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- Python 3.8+
- PostgreSQL (optional, SQLite for development)

### Installation

**1. Clone Repository**
```bash
git clone https://github.com/yourusername/exit-exam-app.git
cd exit-exam-app
```

**2. Frontend Setup**
```bash
npm install
# Create .env file with: VITE_API_BASE_URL=http://localhost:8000/api
```

**3. Backend Setup**
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

**4. Start Frontend**
```bash
npm run dev
```

**Access:** Frontend → http://localhost:5173 | Backend API → http://localhost:8000/api

---

## ⚙️ Configuration

### Environment Variables

**Frontend (.env)**
```env
VITE_API_BASE_URL=http://localhost:8000/api

# AI Assistant (Optional - OpenAI recommended)
VITE_GROK_API_KEY=sk-your-openai-api-key
VITE_GROK_API_URL=https://api.openai.com/v1/chat/completions
VITE_GROK_MODEL=gpt-3.5-turbo
```

**Backend**
```env
SECRET_KEY=your-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=postgresql://user:password@localhost:5432/exitexam
```

> **Note:** AI assistant is optional. Without API key, the AI button will show an error when clicked.

---

## 📖 Usage

**Starting an Exam:** Choose mode from Dashboard → Answer questions → Use ✨ AI Assistant for help → Submit to see results

**Analytics:** View subject/topic performance → Click "Improve This Area" to practice weak subjects

**Daily Plans:** Set study goals → System suggests questions → Track daily progress

---

## 🚢 Deployment

### Frontend (Vercel)
1. Push to GitHub
2. Import to Vercel
3. Add `VITE_API_BASE_URL` environment variable
4. Deploy!

### Backend (Render/Railway)
1. Connect GitHub repository
2. Set build: `cd backend && pip install -r requirements.txt`
3. Set start: `cd backend && gunicorn exam_app.wsgi:application`
4. Add environment variables
5. Deploy!

**Production Checklist:** Set `DEBUG=False`, configure `ALLOWED_HOSTS`, use PostgreSQL, set up CORS, configure SSL/HTTPS.

See `RENDER_DEPLOYMENT.md` for detailed instructions.

---

## 📊 Official Subjects

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

---

## 🔄 Migration

**Migrating from Firebase:**
1. Export Firebase service account key
2. Set `FIREBASE_CREDENTIALS_PATH` environment variable
3. Run: `python scripts/migrate_firebase_to_django.py`

See `MIGRATION_GUIDE.md` for details.

---

## 🐛 Troubleshooting

**Frontend won't start:** `rm -rf node_modules package-lock.json && npm install`

**Backend connection errors:** Check Django server on port 8000, verify `VITE_API_BASE_URL` in `.env`, check CORS settings

**AI Assistant not working:** Verify API key, check browser console, ensure API credits/quota

**Database errors:** Run `python manage.py migrate`, check connection settings

---

## 📚 API Endpoints

```
GET  /api/questions/          - List questions
GET  /api/exams/              - List exams
POST /api/exams/              - Create exam
GET  /api/attempts/           - List attempts
GET  /api/analytics/subjects/ - Subject analytics
GET  /api/analytics/topics/   - Topic analytics
```

---

## 📝 Question Data Structure

```json
{
  "question": "Question text...",
  "choices": ["A", "B", "C", "D"],
  "correctAnswer": "B",
  "explanation": "Explanation text...",
  "subject": "Computer Programming",
  "topic": "Operators and Expressions"
}
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add feature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📄 License

MIT License - see LICENSE file for details.

---

<div align="center">

**Made with ❤️ for My-Self Computer Science ExitExam**

⭐ Star this repo if you find it helpful!

[Report Bug](https://github.com/yourusername/exit-exam-app/issues) • [Request Feature](https://github.com/yourusername/exit-exam-app/issues) • [Documentation](#)

</div>
