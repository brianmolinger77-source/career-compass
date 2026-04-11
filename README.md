# Career Compass

A career pathing tool for military veterans transitioning to civilian careers. Mentees document their career history with AI-powered coaching feedback. Mentors review and annotate their mentees' documents from a private dashboard.

---

## Getting Started

### Step 1 — Navigate to the project folder

```bash
cd ~/Desktop/career-compass
```

### Step 2 — Install root dependencies (server + dev tools)

```bash
npm install
```

### Step 3 — Install client dependencies

```bash
cd client && npm install && cd ..
```

### Step 4 — Set up your environment file

```bash
cp .env.example .env
```

### Step 5 — Add your Anthropic API key

Open `.env` in any text editor and replace `your_key_here` with your actual key:

```
ANTHROPIC_API_KEY=sk-ant-api...
MENTOR_PASSWORD=acp2025
PORT=3001
```

Get your API key at [console.anthropic.com](https://console.anthropic.com) under **API Keys**.

### Step 6 — Start the application

```bash
npm run dev
```

This starts both the Express server (port 3001) and the Vite dev server (port 3000) concurrently.

### Step 7 — Open the app

Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

---

## Using the App

### Mentor Dashboard

Go to [http://localhost:3000/mentor](http://localhost:3000/mentor)

Default password: **acp2025** (change this in your `.env` file using the `MENTOR_PASSWORD` variable)

### Creating a Mentee

1. Click **Add New Mentee** on the dashboard
2. Enter the mentee's name and email
3. Copy the unique URL generated (e.g. `http://localhost:3000/mentee/matt-moore`)
4. Share that URL with your mentee — no login required on their end

### Mentee Experience

Mentees visit their unique URL and fill in:
- **Career History** — roles with What I Did, How I Did It, and The Impact
- **AI Analysis** — each role can be analyzed for military jargon, missing context, and impact
- **Passions, Strengths & Aspirations** — guided self-reflection with prompts
- **Table Stakes** — non-negotiable conditions for their best work
- **Generate My Story** — AI-powered first-person career narrative (requires 2+ roles)

### Mentor View

Mentors access each mentee's document at `/mentor/mentee/:id` and can:
- Add, edit, and delete private coaching notes on any section
- See the "Competitive Differentiators" themes panel at the top
- View a summary of all notes at the bottom of the page
- Edit and annotate any field directly

---

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **Storage**: Local JSON files in `/server/data/`
- **AI**: Anthropic Claude (`claude-sonnet-4-20250514`) via `@anthropic-ai/sdk`
- **Auth**: Express sessions (cookie-based, mentor only)

---

## Project Structure

```
career-compass/
├── server/
│   ├── index.js          # Express server entry point
│   ├── routes/
│   │   ├── mentee.js     # Mentee CRUD routes
│   │   ├── mentor.js     # Mentor auth + management routes
│   │   └── ai.js         # AI analysis + narrative generation
│   └── data/             # JSON files, one per mentee
├── client/
│   ├── src/
│   │   ├── pages/        # MenteeView, MentorDashboard, MentorMenteeView, MentorLogin
│   │   ├── components/   # RoleCard, AIFeedbackPanel, NarrativeCard, etc.
│   │   └── utils/        # api.js, autosave.js
│   └── ...
├── .env                  # Your secrets (not committed)
└── .env.example          # Template
```

---

## Notes

- Mentee data is stored as plain JSON files in `server/data/`. Back this directory up regularly.
- The mentor password is set in `.env` — change `acp2025` to something stronger before sharing.
- All autosave triggers 1.5 seconds after the last keystroke.
- Print-friendly — use "Print / Save PDF" to generate a clean document with navigation and buttons hidden.
