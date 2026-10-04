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

A private exam preparation app for Ethiopian Computer Science BSc students. Each person has their own account, question bank, study materials and progress.

**Key Highlights:**
- 🎯 Three Intelligent Exam Modes (Random, Topic-Focused, Weak-Area)
- 📄 Create exams from a PDF or photos of a past paper (AI reads the questions; you review before saving)
- 🤖 AI Study tutor that teaches plan topics in 4 chunks, using your own uploaded notes
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

### 📋 Curriculum from your exit exam blueprint

The app has no built-in subject list. Each user uploads their program's official Ministry of Education exit exam blueprint PDF under **Curriculum**. The server reads it with the AI, and the user reviews the program name, themes, courses, credit hours, exam item counts and per-course focus notes before applying. The applied blueprint becomes the subject list for the Plan, Plan Manager priorities, Question Bank, Analytics, exam imports and study materials. The Study tutor also gets the course's focus notes. Any program works; Computer Science is just the sample in `data/sample-blueprint.pdf`. Every applied blueprint stays in the history, and one is active at a time; switching rebuilds the subject priorities (completion is kept for courses with the same name).

### 🤖 AI Study tutor

Upload your notes under **Study**; the server gives each PDF a short AI description. From the daily plan, **Study these topics** opens a saved chat that teaches the day's topics in 4 chunks (Memory Lock, Exam Traps, Likely Questions) and waits for you to say "continue". The ✨ button on an exam question opens the same tutor for that question's topic. All AI calls run on the Django server; no keys are in the browser.

### 📊 Analytics & Performance

Track performance across your curriculum's courses with detailed breakdowns, topic-level analysis, performance trends, and visual status indicators.

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

**AI:** Cursor Python SDK (`cursor-sdk`) no-repo cloud agents with `CURSOR_API_KEY` (`crsr_…`), called from Django only — see `prompts/06-cursor-sdk-ai.md` (until that ships, the live code still uses an OpenAI-compatible `AI_*` client)

**Deployment:** Vercel (Frontend) • Render/Railway (Backend)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- Python 3.10+ (required by `cursor-sdk`)
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
```

**Backend**
```env
SECRET_KEY=your-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=postgresql://user:password@localhost:5432/exitexam

# AI (PDF exam import, study-doc descriptions, Study chat), server only.
# Runs on Cursor Python SDK (cursor-sdk) no-repo cloud agents; the Cursor account must allow no-repo agents.
CURSOR_API_KEY=crsr_your_key
# CURSOR_MODEL=            # optional fixed model id; empty = auto-smart tuned per job (see docs/DEPLOY.md)
# AI_TIMEOUT_SECONDS=600   # wall-clock limit per AI run; cloud agents take tens of seconds to minutes
```

`cursor-sdk` needs **Python 3.10+** and bundles its own Node.js bridge, so `pip install -r backend/requirements.txt` is all the setup it needs. A legacy `AI_API_KEY` is still honoured if it is a Cursor key (`crsr_…`); `AI_BASE_URL` / `AI_MAX_TOKENS` are no longer used.

> **Note:** AI keys live only on the backend; never put them in `VITE_` variables. Without `CURSOR_API_KEY`, the app still works and AI features show a "not configured" message. Full deploy checklist: [docs/DEPLOY.md](docs/DEPLOY.md).

---

## 📖 Usage

**Starting an Exam:** Choose mode from Dashboard → Answer questions → Use ✨ Study tutor for help → Submit to see results

**Analytics:** View subject/topic performance → Click "Improve This Area" to practice weak subjects

**Daily Plans:** Set study goals → System suggests questions → Track daily progress

---

## 🚢 Deployment

Backend on Render (`render.yaml`), database on Supabase Postgres, frontend on Vercel.

See **[docs/DEPLOY.md](docs/DEPLOY.md)** for the step-by-step deploy checklist (env vars, migrations, storage limits) and the smoke test to run before handing the app over.

---

## 📊 Subjects

Subjects are the courses of your active exit exam blueprint (see **Curriculum** above). A new account has none until it applies a blueprint; pages that need subjects show an "Upload your exit exam blueprint" button instead.

---

## 🐛 Troubleshooting

**Frontend won't start:** `rm -rf node_modules package-lock.json && npm install`

**Backend connection errors:** Check Django server on port 8000, verify `VITE_API_BASE_URL` in `.env`, check CORS settings

**AI features say "not configured":** set `CURSOR_API_KEY` on the backend (Render) and redeploy. Other AI errors: check the Cursor key, `CURSOR_MODEL`, that no-repo cloud agents are enabled, and `AI_TIMEOUT_SECONDS`.

**Database errors:** Run `python manage.py migrate`, check connection settings

---

## 📚 API Endpoints

All endpoints except `/api/` and signup/login require `Authorization: Token <key>` and only return the caller's data.

```
POST /api/auth/signup/ | /api/auth/login/ | /api/auth/logout/   GET /api/auth/me/
GET  /api/questions/          - List questions (paginated; ?page_size= up to 1000)
GET  /api/exams/              - List exams
POST /api/exams/              - Create exam
POST /api/blueprint-imports/  - Upload a blueprint PDF, then /extract/ (poll GET) and /apply/ with the reviewed draft
GET  /api/blueprint/          - Active curriculum (404 until a blueprint is applied)
GET  /api/blueprints/         - Applied blueprint history; POST /api/blueprints/<id>/activate/ switches the active one
GET  /api/subjects/           - Active course names ([] without a blueprint)
POST /api/exam-imports/       - Upload an exam PDF, then /extract/ and /publish/ (needs an active curriculum)
GET  /api/attempts/           - List attempts
GET  /api/analytics/subjects/ - Subject analytics
GET  /api/analytics/topics/   - Topic analytics
GET  /api/study-docs/         - Study materials (upload, /describe/, /file/)
POST /api/study-sessions/     - Open a Study chat for {planDateKey} or {subject, topic}; /messages/, /retry/
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

`subject` must be one of your active curriculum's courses (close spellings such as "Operating System" for "Operating Systems" are matched).

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
