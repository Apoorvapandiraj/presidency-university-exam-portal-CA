# Presidency University – Online Exam Portal

React (Vite) + Express + SQLite (better-sqlite3). One folder, one deploy.

## Run locally (VS Code)
```bash
npm install          # installs root + server deps
npm install --prefix client
cp server/.env.example server/.env   # already created; edit secrets
npm run dev          # client http://localhost:5173  |  API http://localhost:5001
```
Teacher login: username `Apoorva`, password `PpuExam@2026!` (change in `server/.env`: `TEACHER_USER`, `TEACHER_PASS`).

## Questions
`server/seed/questions.json` is built from the two PPTs (CSA1500 – Problem Solving Techniques Using C, Module 1 & 2):
a pool of 37 MCQs + 3 coding questions (2 easy, 1 hard). Each student gets **20 random MCQs from the pool** (random order, shuffled
options) + the 3 coding questions = 40 marks. Change `EXAM_MCQ_COUNT` in `.env` to draw more/fewer.
To edit questions: change the JSON, delete `server/data/exam.db`, restart (do this BEFORE the exam starts).

## Logo
Replace `client/public/logo.svg` with the official Presidency University logo (or edit `src/Logo.jsx` to use a PNG).

## Settings (`server/.env`)
`EXAM_DURATION_MIN` (default 60), `EXAM_MCQ_COUNT` (default 20), `JWT_SECRET`, `TEACHER_USER`, `TEACHER_PASS`, `DATA_DIR` (where `exam.db` lives).

## Push to GitHub
```bash
git init && git add . && git commit -m "Exam portal"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

## Deploy (Render – free)
1. render.com → New → Web Service → connect the repo.
2. Build command: `npm install && npm run build`
3. Start command: `npm start`
4. Environment: `JWT_SECRET` (random), `TEACHER_USER`, `TEACHER_PASS`, `EXAM_DURATION_MIN`.

**SQLite warning:** Render's free tier has no persistent disk, so `exam.db` is wiped on every redeploy/restart.
Use **Export CSV** on the teacher dashboard right after the exam, or deploy to Railway / Fly.io with a volume and set
`DATA_DIR` to the volume path (e.g. `/data`).

## How it works
- Student logs in with name + Outlook ID + roll no. Re-login resumes the same attempt; one attempt per roll number.
- Same question pattern for all; MCQ order and option order are shuffled per student, coding questions come last.
- One question at a time, countdown timer, auto-submit on time-out, answers auto-saved.
- Copy / cut / paste / right-click disabled. Tab switch or window blur → red banner + warning counter in the nav bar, logged with time.
- Result screen shows score / total only. MCQs auto-graded; teacher grades coding answers in the dashboard.

## Hardening included
helmet security headers, rate-limited logins (teacher: 10 tries / 15 min), constant-time password check, signed 6h student sessions,
server-side timer (client clock can't extend the exam), answers accepted only for the student's own questions, one attempt per roll number.
Set a strong `JWT_SECRET` and change the teacher password before going live.
