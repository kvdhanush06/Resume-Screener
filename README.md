# Resume Screener

An intelligent resume screening tool that parses candidate resumes, extracts structured data, and uses an LLM to semantically match candidates against job descriptions — producing ranked evaluations with justifications.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [LLM Prompts](#llm-prompts)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Get Your Groq API Key](#get-your-groq-api-key)
  - [Installation](#installation)
  - [Running in Development](#running-in-development)
  - [Running in Production](#running-in-production)
- [API Reference](#api-reference)
- [Environment Variables](#environment-variables)
- [How It Works](#how-it-works)

---

## Overview

Resume Screener automates the early-stage candidate evaluation process:

1. You paste a **job description** and upload one or more **PDF/TXT resumes**.
2. The backend extracts structured data from both using an LLM.
3. The LLM semantically scores the candidate against the job across five dimensions.
4. Results are ranked, filtered, and displayed with per-candidate justifications and score breakdowns.

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                        Browser (React)                      │
│                                                             │
│   ┌─────────────────┐          ┌──────────────────────┐    │
│   │  Screening Setup│          │  Ranked Results View │    │
│   │  - Job Desc.    │          │  - Score Breakdown   │    │
│   │  - Resume Upload│          │  - Matched/Missing   │    │
│   │  - Raw Text     │          │  - Strengths & Gaps  │    │
│   └────────┬────────┘          └──────────────────────┘    │
│            │  POST /api/screen                              │
└────────────┼───────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│              Express Server (Node.js / TypeScript)          │
│                                                             │
│  ┌─────────────┐  ┌───────────────┐  ┌──────────────────┐  │
│  │  PDF Parser │  │  Extractors   │  │     Matcher      │  │
│  │  (pdf-parse)│  │  (LLM Prompt) │  │  (LLM Prompt)    │  │
│  └──────┬──────┘  └──────┬────────┘  └────────┬─────────┘  │
│         │                │                     │            │
│         └────────────────┴─────────────────────┘            │
│                          │                                  │
│                  ┌───────▼───────┐                          │
│                  │  Groq Client  │ ──── HTTPS ────▶ Groq API│
│                  │  (native fetch│                          │
│                  └───────┬───────┘                          │
│                          │                                  │
│                  ┌───────▼───────┐                          │
│                  │   JSON Store  │                          │
│                  │  data/        │                          │
│                  │  candidates   │                          │
│                  │  .json        │                          │
│                  └───────────────┘                          │
└────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Resume File (PDF/TXT)
       │
       ▼
  PDF Parser ──► Raw Text
                   │
                   ▼
         ┌─── LLM Prompt 1 ───┐
         │  Extract Resume     │
         │  (name, skills,     │
         │  experience, edu)   │
         └──────────┬──────────┘
                    │ StructuredResume
                    ▼
         ┌─── LLM Prompt 3 ───────────────────────────┐
         │  Match Candidate vs Job                     │
         │  Score 5 dimensions (0–100)                 │
         │  Identify matched/missing skills            │
         │  Return strengths, gaps, justification      │
         └──────────┬──────────────────────────────────┘
                    │ EvaluationResult
                    ▼
              Weighted Score
         (40% skills + 25% exp +
          20% resp + 10% edu + 5% preferred)
                    │
                    ▼
         SHORTLIST (≥75) / REVIEW (≥50) / REJECT (<50)

Job Description Text
       │
       ▼
  ┌─── LLM Prompt 2 ───┐
  │  Extract Job        │
  │  (title, required   │
  │  skills, experience │
  │  responsibilities)  │
  └──────────┬──────────┘
             │ StructuredJob
             └──────────────────► Match (above)
```

---

## LLM Prompts

The system uses three LLM prompts, all sent to the Groq Chat Completions API with `temperature: 0.1` and `response_format: json_object` for deterministic, structured outputs.

---

### Prompt 1 — Job Description Extractor

**File:** `server/src/services/extractors.ts` → `JOB_PROMPT`

**Purpose:** Parse a raw job description into structured criteria.

```
You are an expert technical recruiter analyzing job descriptions.
Extract the structured role criteria from the job description text.
Return ONLY a valid JSON object matching this schema:
{
  "title": "Job Title",
  "requiredSkills": ["Required Skill 1", "Required Skill 2"],
  "preferredSkills": ["Preferred Skill 1", "Preferred Skill 2"],
  "experienceRequired": "e.g. 2-4 years / Entry Level / Senior",
  "keyResponsibilities": ["Responsibility 1", "Responsibility 2"],
  "educationRequirements": ["Education Requirement 1"]
}
Only extract items explicitly stated or strongly demanded in the text.
```

**User message:** `Job description text:\n\n{rawJobText}`

---

### Prompt 2 — Resume Extractor

**File:** `server/src/services/extractors.ts` → `RESUME_PROMPT`

**Purpose:** Parse raw resume text into a structured candidate profile.

```
You are a precise technical resume parsing engine.
Extract structured profile information from the supplied resume text.
Return ONLY a valid JSON object matching this schema exactly:
{
  "name": "Candidate Full Name",
  "email": "candidate@email.com",
  "phone": "+1234567890",
  "summary": "Brief 2-3 sentence overview of candidate profile",
  "skills": ["Skill1", "Skill2", "Skill3"],
  "experience": [
    {
      "company": "Company Name",
      "role": "Job Title",
      "duration": "Dates / Duration",
      "responsibilities": ["Key responsibility 1", "Key achievement 2"]
    }
  ],
  "education": [
    {
      "degree": "Degree and Major",
      "institution": "University / College",
      "year": "Year of graduation"
    }
  ],
  "certifications": ["Certification 1", "Certification 2"]
}
Do not invent or infer data that is not in the text. Return empty strings or arrays if not found.
```

**User message:** `Resume text to extract:\n\n{rawResumeText}`

---

### Prompt 3 — Candidate–Job Matcher (Semantic Scorer)

**File:** `server/src/services/matcher.ts` → `MATCHER_SYSTEM_PROMPT`

**Purpose:** Semantically evaluate a candidate's structured profile against the structured job description, scoring across five dimensions.

```
You are a strict, objective, and unbiased principal technical recruiter.
Evaluate the candidate's structured resume against the target structured job description.
Do not hallucinate skills or assume experience that is not supported by the candidate profile.

Score each dimension from 0 to 100 based on strict alignment:
1. requiredSkillsScore (0-100): Direct overlap with required skills and competencies.
2. experienceScore (0-100): Alignment of years of experience, relevant roles, and domain depth.
3. responsibilitiesScore (0-100): Alignment between past duties and target job responsibilities.
4. educationScore (0-100): Alignment with degree and academic criteria.
5. preferredSkillsScore (0-100): Presence of bonus / nice-to-have skills (default 50 if none specified).

Identify exact matched skills, missing required/preferred skills, key technical strengths,
areas of concern / gaps, and a concise recruiter justification.

Return ONLY a JSON object matching this schema:
{
  "dimensionScores": {
    "requiredSkillsScore": 85,
    "experienceScore": 80,
    "responsibilitiesScore": 80,
    "educationScore": 90,
    "preferredSkillsScore": 70
  },
  "matchedSkills": ["Python", "FastAPI", "PostgreSQL"],
  "missingSkills": ["Kubernetes", "AWS"],
  "strengths": ["Strong backend API development background"],
  "gaps": ["No demonstrated production Kubernetes orchestration"],
  "justification": "Candidate demonstrates high technical competency..."
}
```

**User message:** `Compare Candidate and Target Job:\n{structuredCandidate + structuredJob as JSON}`

---

### Scoring Formula

```
Overall Score = (requiredSkillsScore × 0.40)
              + (experienceScore      × 0.25)
              + (responsibilitiesScore× 0.20)
              + (educationScore       × 0.10)
              + (preferredSkillsScore × 0.05)

Recommendation:
  ≥ 75  →  SHORTLIST
  ≥ 50  →  REVIEW
  < 50  →  REJECT
```

---

## Tech Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Frontend   | React 18, TypeScript, Vite        |
| Backend    | Node.js, Express, TypeScript      |
| LLM        | Groq API (LLaMA / GPT-OSS models) |
| PDF Parse  | pdf-parse                         |
| File Upload| multer (memory storage)           |
| Database   | JSON flat file (data/candidates.json) |
| Runtime    | tsx (dev), compiled JS (prod)     |

---

## Project Structure

```
resume-screener/
├── client/                     # React frontend (Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── CandidateCard.tsx     # Ranked candidate summary card
│   │   │   ├── CandidateModal.tsx    # Full candidate detail view
│   │   │   ├── ResumeUpload.tsx      # File upload / text input
│   │   │   ├── ScoreBreakdown.tsx    # Dimension score progress bars
│   │   │   └── ScreeningResults.tsx  # Results list with filters
│   │   ├── services/
│   │   │   └── api.ts                # All API call functions
│   │   ├── types/
│   │   │   └── index.ts              # Shared TypeScript interfaces
│   │   ├── App.tsx                   # Root app component
│   │   ├── index.css                 # Global styles
│   │   └── main.tsx                  # Vite entry point
│   └── tsconfig.json
│
├── server/                     # Express backend
│   └── src/
│       ├── routes/
│       │   └── api.ts                # All API route handlers
│       ├── services/
│       │   ├── extractors.ts         # LLM prompts 1 & 2 (job + resume parsing)
│       │   ├── groqClient.ts         # Groq API HTTP client
│       │   ├── matcher.ts            # LLM prompt 3 (semantic scoring)
│       │   └── pdfParser.ts          # PDF text extraction
│       ├── config.ts                 # Environment configuration
│       ├── db.ts                     # JSON file-based data store
│       ├── server.ts                 # Express app entry point
│       └── types.ts                  # Shared TypeScript types
│   └── tsconfig.json
│
├── data/                       # Persistent JSON store (gitignored)
│   └── .gitkeep
├── public/                     # Static assets
├── .env.example                # Environment variable template
├── package.json                # Dependencies and scripts
├── vite.config.ts              # Vite build configuration
└── server.js                   # Production entry (runs compiled server)
```

---

## Getting Started

### Prerequisites

- **Node.js** v18 or higher — [nodejs.org](https://nodejs.org)
- **npm** v9 or higher (comes with Node.js)
- A **Groq API key** (free, instructions below)

---

### Get Your Groq API Key

1. Go to [console.groq.com](https://console.groq.com) and sign up for a free account.
2. Navigate to **API Keys** in the left sidebar.
3. Click **Create API Key**, give it a name, and copy the key.
4. The free tier is generous — no credit card required for getting started.

The default model used is `openai/gpt-oss-120b` (available on Groq). You can change this in `.env` to any model available on your Groq account, such as `llama3-70b-8192` or `llama-3.1-8b-instant`.

---

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/resume-screener.git
cd resume-screener

# 2. Install all dependencies (installs both frontend and backend deps)
npm install

# 3. Set up environment variables
cp .env.example .env
```

Open `.env` and fill in your values:

```env
PORT=3000
GROQ_API_KEY=gsk_your_actual_key_here
GROQ_MODEL=openai/gpt-oss-120b
```

---

### Running in Development

Development mode runs the backend and frontend separately with hot-reload.

**Terminal 1 — Backend API server:**
```bash
npm run dev
```
The API server starts on `http://localhost:3000`.

**Terminal 2 — Frontend dev server:**
```bash
npm run dev:client
```
The React app starts on `http://localhost:5173` with API requests proxied to the backend.

Open `http://localhost:5173` in your browser.

---

### Running in Production

Build both frontend and backend, then start the unified server:

```bash
# Build client (React → dist/client) and server (TS → dist/server)
npm run build

# Start the production server (serves both API and static frontend)
npm start
```

Open `http://localhost:3000` in your browser. The Express server serves both the API and the compiled React app from the same port.

---

## API Reference

| Method | Endpoint              | Description                                           |
|--------|-----------------------|-------------------------------------------------------|
| GET    | `/api/health`         | Health check — returns server status and model info   |
| GET    | `/api/candidates`     | Fetch all screened candidates + summary stats         |
| GET    | `/api/candidates/:id` | Fetch a single candidate record by ID                 |
| DELETE | `/api/candidates/:id` | Delete a single candidate record                      |
| DELETE | `/api/candidates`     | Clear all candidate records                           |
| POST   | `/api/screen`         | Screen resumes against a job description (multipart)  |
| POST   | `/api/parse-job`      | Parse a raw job description into structured format    |
| POST   | `/api/analyze-text`   | Screen a single resume provided as raw text           |

### POST `/api/screen` — Main Screening Endpoint

**Content-Type:** `multipart/form-data`

| Field             | Type        | Required | Description                           |
|-------------------|-------------|----------|---------------------------------------|
| `jobDescription`  | string      | Yes      | Raw job description text              |
| `resumes`         | File[]      | No*      | PDF or TXT resume files (up to 20)    |
| `resumeText`      | string      | No*      | Raw resume text (alternative to file) |
| `filename`        | string      | No       | Filename label for raw text input     |

*At least one of `resumes` or `resumeText` is required.

**Response:**
```json
{
  "candidates": [...],
  "summary": {
    "totalScreened": 3,
    "shortlistedCount": 1,
    "reviewCount": 1,
    "rejectedCount": 1,
    "averageScore": 68,
    "highestScore": 82
  },
  "job": { "title": "...", "requiredSkills": [...] }
}
```

---

## Environment Variables

| Variable       | Required | Default                | Description                              |
|----------------|----------|------------------------|------------------------------------------|
| `PORT`         | No       | `3000`                 | Port the Express server listens on       |
| `GROQ_API_KEY` | Yes      | —                      | Your Groq API key from console.groq.com  |
| `GROQ_MODEL`   | No       | `openai/gpt-oss-120b`  | Groq model to use for all LLM calls      |

Copy `.env.example` to `.env` and set your values. Never commit `.env` — it is gitignored.

---

## How It Works

1. **Upload** — User submits a job description and one or more resumes (PDF/TXT) via the React frontend.
2. **Parse** — The PDF parser extracts raw text from uploaded files. Text is normalized (whitespace, encoding).
3. **Structure** — Two LLM calls convert the raw job description and raw resume text into typed JSON objects.
4. **Match** — A third LLM call semantically compares the structured candidate profile against the structured job, scoring five dimensions and producing matched/missing skills, strengths, gaps, and a justification.
5. **Score** — The weighted overall score is computed from the five dimension scores.
6. **Recommend** — Candidates are classified as SHORTLIST, REVIEW, or REJECT based on their score.
7. **Store** — All records are saved to `data/candidates.json` and persist between sessions.
8. **Display** — The React frontend shows ranked candidates with filterable results, expandable detail modals, and a JSON export option.

If the Groq API is unavailable or the key is not set, all three steps fall back to fast heuristic extraction and keyword-based scoring — so the app remains functional offline.
