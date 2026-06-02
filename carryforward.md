# pAIRI — Project Carryforward

## Project Overview
AI Readiness Survey app. Users take a scenario-based survey, get a readiness score, and see recommended courses. Admins manage questions/settings, view analytics, and share company-specific dashboard links.

**GitHub repo:** `https://github.com/DSAC-DEMO/pAIRI.git`  
**Deployed on:** Cloudflare Pages (`p-airi.pages.dev`)  
**DB:** Cloudflare D1, binding `DB`, database name `p-airi`, ID `0e1d2eb8-380f-41b9-8db5-7827f111eb08`  
**Local dev:** `npm run start` (builds, seeds local D1, starts wrangler pages dev on :8788)  
**Cloudflare account:** demo@d3ts.net, account ID `2a02bfb09e4dfb60c241474c254a582e`

---

## Tech Stack
- React 18 + Vite + Tailwind CSS (frontend)
- react-router-dom v6
- Plotly.js (`plotly.js-dist-min`) — dynamically imported, used in dashboard AND admin analytics
- html2canvas + jsPDF — PDF export on dashboard and admin analytics
- Cloudflare Pages Functions (Workers) — all API routes under `functions/api/`
- Cloudflare D1 (SQLite) — single `p-airi` database

---

## Directory Structure
```
src/
  pages/
    SurveyPage.jsx       — quiz, company code entry, pillar-by-pillar flow
    ResultsPage.jsx      — post-submit results (score, radar, pillar breakdown, courses)
    DashboardPage.jsx    — company dashboard (login by code, analytics, PDF export)
    AdminPage.jsx        — admin panel (analytics, settings, questions, sessions)
  components/
    RadarChart.jsx       — SVG radar chart used in ResultsPage + AdminPage
    QuestionCard.jsx     — individual question display
    ProgressBar.jsx      — pillar progress indicator

functions/
  _lib/auth.js           — HMAC-SHA256 token, rate limiter, CORS helpers
  api/
    auth.js              — POST /api/auth (admin login, returns JWT-style token)
    questions.js         — GET /api/questions (public: questions+options+levels+courses)
    submit.js            — POST /api/submit (score calc, DB insert)
    dashboard.js         — POST /api/dashboard (company code login, returns session data)
    sessions.js          — GET/POST /api/sessions (admin: list/create/delete sessions)
    admin.js             — GET /api/admin (full analytics payload)
    admin/
      settings.js        — POST /api/admin/settings (update levels, courses, etc.)
      questions.js       — POST /api/admin/questions (add/edit/delete questions)
      session/           — (folder, sub-routes if any)
```

---

## Database Schema
```sql
questions       (id, category, question, dimension, q_id, order_num)
question_options(id, question_id, text, weight REAL)  -- FK CASCADE on question
settings        (key TEXT PK, value TEXT)
sessions        (id, name, sector, code_hash UNIQUE, code, company_uen, round_label, created_at)
responses       (id, answers_json, total_score, score_pct REAL, readiness_level,
                 recommended_courses TEXT DEFAULT '[]',
                 is_sp_staff, department, session_id REFERENCES sessions(id),
                 submitted_at)
```

`sessions.code` stores plain-text code alongside `code_hash` so admin can reveal it. `company_uen` groups sessions into multi-round companies. `round_label` is a custom label (e.g. "Pre-Programme").

`responses.recommended_courses` — JSON array of course name strings (e.g. `["AI Foundations","Prompt Engineering"]`) computed at submit time from the courses setting and stored for dashboard aggregation.

`questions.dimension` and `questions.q_id` — additional metadata fields editable via admin Questions tab.

**All columns are now in schema.sql** (no manual ALTER TABLE needed on fresh init).

**Live DB migration applied:** `ALTER TABLE responses ADD COLUMN recommended_courses TEXT NOT NULL DEFAULT '[]'`

**FK behaviour:** Deleting a session requires first nulling out linked responses:
```sql
UPDATE responses SET session_id = NULL WHERE session_id = ?;
DELETE FROM sessions WHERE id = ?;
```
This is handled in `functions/api/sessions.js`.

---

## Settings (stored in `settings` table)
| key | value |
|-----|-------|
| `option_levels` | `["Unaware","Aware","Ready","Competent","Catalyst"]` |
| `readiness_levels` | Array of 5 `{name, persona, description}` objects, index 0=highest |
| `courses` | Array of `{name, levels: number[], description, pillarConditions?: [{pillar, levels}]}` |

---

## Scoring Logic
- Questions have options with `weight` values: `0, 1.25, 2.50, 3.75, 5.00`
- `score_pct` stored in `responses` = **overallMean** (mean of all question weights, 0–5 scale) — despite the column name suggesting a percentage, it IS the 0-5 mean
- Readiness level thresholds (index 0=Expert … 4=Novice):
  - `>= 4` → 0 (Expert)
  - `>= 3` → 1 (Advanced)
  - `>= 2` → 2 (Moderate)
  - `>= 1` → 3 (Developing)
  - `< 1`  → 4 (Novice)
- Competency (per-pillar option level) thresholds: `>= 4.375` → Catalyst, `>= 3.125` → Competent, `>= 1.875` → Ready, `>= 0.625` → Aware, else Unaware

---

## Colour Palettes

### Dashboard & Admin — Blue monochromatic (index 0=Expert/darkest … 4=Novice/lightest)
```js
LEVEL_COLORS = ['#1e40af', '#2563eb', '#60a5fa', '#93c5fd', '#bfdbfe']
```

### Option levels (admin pills)
```
bg-slate-100 text-slate-600  // Unaware
bg-blue-100 text-blue-600    // Aware
bg-blue-200 text-blue-700    // Ready
bg-blue-300 text-blue-800    // Competent
bg-blue-500 text-white       // Catalyst
```

### ResultsPage — colour set by readiness level
`emerald > green > yellow > orange > red` (index 0–4, but note this is ResultsPage only)

---

## DashboardPage — Key Behaviour
- **Login:** POST `/api/dashboard` with `[company code] + "DSAC"` suffix (e.g. `ABC123DSAC`). API strips the last 4 characters, SHA-256 hashes the remainder, matches against `sessions.code_hash`. The DSAC suffix is admin-only knowledge — the placeholder just says "Enter your company code".
- **Multi-round mode:** If session has `company_uen`, API fetches all sibling sessions sorted by `created_at ASC` and returns `rounds[]`. Dashboard shows an "Overall" view + per-round tabs. Rounds are re-sorted and re-numbered client-side so Round 1 = earliest session.
- **Layout (3-col grid, 2 rows):**
  - **Left col (row-span-2):** KPI cards + survey description text + readiness level legend (name, persona, description, colour dot). Scrollable.
  - **Top-mid:** Competency Profile radar chart.
  - **Top-right:** Readiness Distribution bar chart (clickable to filter level).
  - **Bottom (col-span-2):** Most Recommended Programs horizontal bar chart.
- **Overall mode KPIs (left col):** Total responses across all rounds, avg score per round with trend arrows, Most Improved Pillar (R1 → latest, green/red delta).
- **Single-round KPIs (left col):** Total responses (filtered if level selected), avg score + level name, Top Pillar.
- **Filter:** Clicking a readiness distribution bar sets `selectedLevel` (0–4). Radar + KPIs + program chart filter to that level. Click again or click the badge in the header to clear. Filter disabled in Overall mode.
- **Most Recommended Programs chart:** Horizontal bar chart. Counts how many times each course name appears in `responses.recommended_courses` across `filteredResponses`. Updates when level filter changes. Shows "No programmes configured" if courses setting is empty.
- **Radar chart:** Shows avg pillar scores for filtered set. Numbers on each point in single-round mode; one trace per round in Overall mode.
- **Distribution chart:** Shows readiness level counts. Bars dim when a level is selected (single-round mode).
- **PDF Export:** html2canvas + jsPDF (static imports). Captures `dashboardRef`. Scale 2, `useCORS: true`.
- **PlotlyChart component:** Uses `useRef` for click callbacks. `removeAllListeners('plotly_click')` called before re-binding.

---

## AdminPage — Key Behaviour
- **Auth:** Password → POST `/api/auth` → HMAC-SHA256 token stored in `localStorage`. Token TTL 24h. Password stored as `ADMIN_PASSWORD` environment variable in Cloudflare Pages.
- **Layout:** Fixed full-height (`h-screen flex flex-col overflow-hidden`). Header bar + tab bar are `flex-shrink-0`. Analytics tab content is `flex-1 flex flex-col min-h-0`.
- **Tabs:** Analytics | Questions | Settings

### Analytics Tab
- **Filter strip** (top, `flex-shrink-0`): date range + **Compare dropdown** (searchable, multi-select) + sector pills + readiness level pills. "Clear all" button. "Export PDF" button.
- **Filter chain:** `responses` → `timeFilteredResponses` (date range) → `companyFilteredResponses` (company) → `sectorFilteredResponses` (sector) → `filteredResponses` (level)
- **Grid layout** (`flex col`, ref `analyticsRef`):
  - **Row 1** (`flex-shrink: 0`, auto height, 3-col grid): KPI cards | Readiness Distribution | Performance by Pillar
  - **Row 2** (`flex: 1`, fills remaining space, `1fr 2fr` grid): Submissions Over Time | Company Comparison
- **KPI cards:** Total Responses, Average Score, **Needs Attention** (% at Novice or Developing, colour-coded red/amber/green). Level names pulled from DB.
- **Submissions Over Time:** SVG line chart (daily count). Data labels shown directly on each dot (count > 0). Tooltip retained for date detail on hover. SVG padding: `top: 20, bottom: 20, left: 32, right: 16`.
- **Company Comparison:** Compare dropdown is in the filter strip (not the card). Card header has only title + Radar/Comparative Bar toggle. Select 1 company → SVG RadarChart. Select 2+ → `CompanyPlotlyChart` (Plotly grouped bar with delta annotations). `CompanyPlotlyChart` is a module-level component using `useRef` + `plotly.react()`.
- **Sector radar grid** (below the grid): Shows ALL 10 sectors. Populated sectors sort to top-left.

### Settings Tab (scrollable)
- Company Codes section with search + date range filter, duplicate detection, multi-round grouping
- Multi-Round Companies section (blue header) vs Standalone Sessions (gray header), each `max-h-72 overflow-y-auto`
- Readiness level names (5 rows, index shown as `4 - i`)
- Skills & Training courses (name, description, per-level checkboxes, optional pillar conditions)

### Questions Tab (scrollable)
- Questions grouped by category/pillar
- Add/Edit/Delete with inline `QuestionForm`

---

## Sectors (hardcoded in AdminPage)
```
Maritime, Technology, Healthcare, Education, Finance & Banking,
Manufacturing, Logistics, Government & Public Sector, Retail, Construction
```
Sector is set per session at creation time. The survey itself does not ask for sector — it's assigned by which company code the respondent uses.

---

## ResultsPage
- Score card: shows raw `overallMean.toFixed(2) / 5` + readiness level name + persona
- Radar chart (SVG, not Plotly)
- Score by Pillar table with competency badges
- Recommended courses: filtered by `levelIdx` (0–4), shows name + description. Pillar conditions use OR logic.
- Static AIAP/AIIP content below (links placeholder to `https://www.sp.edu.sg`)

---

## SurveyPage
- Fetches questions from `/api/questions`
- Groups by `category` (pillar), navigates pillar-by-pillar
- Company code field: verifies against `/api/questions` companies list, stores `sessionId`
- No pre-survey staff info screen (removed) — quiz starts immediately
- Submits to `/api/submit` with `{ answers, sessionCode, sessionId }`

---

## Deployment
- **Platform:** Cloudflare Pages, project name `p-airi`
- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler pages deploy dist --project-name=p-airi --branch=main`
- **`wrangler.toml`:** includes `pages_build_output_dir = "dist"` and D1 binding for `p-airi` DB
- **Environment variables (Cloudflare Pages → Settings):**
  - `ADMIN_PASSWORD` — admin login password
- **D1 binding (Cloudflare Pages → Settings → Bindings):**
  - Variable name: `DB`, database: `p-airi`
- **API token permissions needed:** Cloudflare Pages — Edit (Account level)

---

## Known DB State (as of 2026-05-28)
- New database `p-airi` (ID: `0e1d2eb8-380f-41b9-8db5-7827f111eb08`) — fresh, no data yet
- `schema.sql` does NOT include `code`, `company_uen`, `round_label` columns on sessions — run manual ALTER TABLE after `db:init`

---

## Pending / Watch Out For
- `schema.sql` now includes all columns (sessions extra cols + `recommended_courses` on responses). A fresh `db:init` followed by `db:init --remote` is clean with no extra ALTER TABLE needed.
- The `score_pct` column name is misleading — it stores the 0–5 mean, not a 0–100 percentage.
- Dashboard code entry requires `DSAC` suffix — the raw company code is never entered directly. Placeholder hides this from end users.
- Admin analytics PDF export captures the `analyticsRef` flex container — filters card is intentionally excluded.
- `recommended_courses` is computed at submit time from the `courses` settings key. Responses submitted before courses were configured will have `[]` and won't appear in the Programs chart.
- jsPDF and html2canvas are static imports (not dynamic) to avoid Cloudflare Pages chunk-fetch errors.

---

## Dashboard Colours for multiple rounds
Round 1: #2563eb  (blue)
  Round 2: #7c3aed  (purple)
  Round 3: #059669  (green)
  Round 4: #d97706  (amber)
  Round 5: #0891b2  (cyan)
  Round 6: #dc2626  (red)

## Commit Style
Single-line commit messages only. No bullet-point bodies. No Co-Authored-By lines.
