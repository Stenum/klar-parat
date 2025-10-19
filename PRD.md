# Klar Parat — Product Requirements Document (PRD)

**Owner:** You (personal project)
**Document version:** v1.0 (MVP)
**Platform:** Web app (tablet-first; works on desktop/mobile)
**Primary users:** Parents (configure), Children (use in the morning)
**Goal:** Increase kids’ motivation and smoothness of morning routines via checklists, playful feedback, and light gamification (time medals + encouraging voice).

---

## 1) Problem Statement & Objectives

### Problem

Mornings are chaotic. Kids struggle to stay on task, and parents spend energy nudging. Existing checklist tools are either too plain for kids or too heavy for parents to maintain.

### Objectives (MVP)

* Make it **fun and obvious** for kids to see “what’s next” and mark tasks done.
* Provide **immediate, positive feedback** (voice + on-screen).
* Add **gentle time pressure** via auto timers and medal thresholds (Gold/Silver/Bronze).
* Keep **parent setup friction low**: fast creation of daily/recurring checklists and messages.
* Run as a **simple web app** on the family iPad.

**Success signals (qualitative, MVP):**

* Kids complete routines with fewer verbal reminders.
* Morning completion time becomes more predictable over 1–2 weeks.
* Kids ask to start the checklist without being prompted.

---

## 2) Users & Use Cases

### 2.1 Parent

* Create/edit routine templates (weekday vs. weekend).
* Add tasks, optional per-task timers, and friendly messages.
* Choose **voice feedback** style and intensity.
* Start/reset today’s routine.
* Review yesterday’s completion time and medal results at a glance.

### 2.2 Child

* See **today’s checklist** on the tablet.
* Tap big friendly buttons to **start task**, **complete task**, or **skip** (if allowed).
* Hear **encouraging voice** after each completion and at milestones.
* See **progress bar** and **medal state** for today.

---

## 3) Scope (MVP)

### In

* Parent login (single household account; email + password).
* 1 household, multiple children profiles (optional, MVP can be single child if you prefer).
* Routine templates with tasks (title, optional emoji, optional hint).
* Per-task **expected duration** to compute medals (not a hard countdown by default).
* **Auto-run session timer** for the whole routine (start/stop by parent or auto-start when first task checked).
* Medal thresholds (Gold/Silver/Bronze) based on **total duration** vs. **sum of expected durations** (configurable multipliers).
* Positive **voice feedback** using TTS after each completed task and at session end.
* **OpenAI-generated encouragement** text that is fed into TTS (with parent-approved tone).
* Today view for kids: large touch targets, minimal text, progress bar, next-up highlight.
* Simple **session summary** for parent (total time, medal, tasks that took longest).
* Basic offline tolerance (PWA—optional stretch: cache app shell and today’s routine).

### Out (MVP)

* Complex analytics dashboards.
* Social sharing, external reward stores.
* Multi-language *UI* beyond English/Danish (we’ll support content in both; see Localization).
* Push notifications.
* Any external hardware integrations.

---

## 4) Key Features & Requirements

### 4.1 Routine & Tasks

**User Stories**

* As a parent, I can create a routine template with tasks so my child knows what to do each morning.
* As a parent, I can set an expected duration per task to enable fair medal thresholds.
* As a parent, I can reorder tasks by drag-and-drop.

**Functional Requirements**

* Create/Edit/Delete routine templates.
* Fields: `template_name`, `days_active (Mon–Sun)`, `tasks[]`.
* `task` fields: `title` (required), `emoji` (optional), `hint` (optional), `expected_minutes` (optional numeric).
* “Publish” a template to “Today” (manual or scheduled by weekday).

**Acceptance Criteria**

* Can add, remove, reorder tasks without page reload.
* Saving a template persists it and it appears in the templates list.
* “Use today” creates a **Today Session** instance.

---

### 4.2 Today Session (Kid Mode)

**User Stories**

* As a child, I see a simple list with only one primary action per task.
* As a child, I hear a friendly message after I finish each task.
* As a child, I see progress and how close I am to finishing.

**Functional Requirements**

* **Start session** (auto when first task is completed or via parent “Start”).
* **Mark task complete**: one tap; app records completion timestamp.
* **Skip task** (configurable per session by parent; default off).
* **Progress UI**: completed count / total; progress bar; next task highlighted.
* **Encouragement message**: after each completion, with TTS playback.
* **End session**: when all required tasks completed → compute medal.

**Acceptance Criteria**

* All interactive elements must be tappable with a thumb (min 44px touch target).
* TTS plays within 500 ms of task completion (subject to device/browser).
* If TTS fails, show on-screen message and continue.

---

### 4.3 Timing & Medals

**User Stories**

* As a parent, I want medals to reflect efficiency but remain positive.
* As a child, I want Gold to feel achievable with focus.

**Functional Requirements**

* Session **start time**: when first task completes (default) or when parent presses “Start”.
* Session **end time**: when final required task completes.
* **Expected total** = sum of `expected_minutes` per task (tasks without value default to 1 minute, configurable global default).
* Medal thresholds (editable global settings):

  * Gold ≤ **1.0 × expected total**
  * Silver ≤ **1.3 × expected total**
  * Bronze > Silver threshold
* Optional **per-task soft timers**: if a task takes > 2× its expected minutes, show a gentle nudge message next time that task appears (learning hint).

**Acceptance Criteria**

* Medal is computed deterministically from timestamps and settings.
* Changing global thresholds affects **future** sessions, not historical.

---

### 4.4 Feedback (OpenAI + TTS)

**User Stories**

* As a child, I hear encouraging, age-appropriate messages.
* As a parent, I can choose tone (e.g., “Playful”, “Coach”, “Calm”) and review the style.

**Functional Requirements**

* For each completion event, app creates a **short encouragement** string.
* Message sources (configurable order of precedence):

  1. **Template snippets** (parent-authored per task, optional).
  2. **Generated text** via OpenAI based on a style prompt + child name + task context.
* TTS playback of the final text (Web Speech API or client-side TTS where available; fallback: display text balloon).
* Safety filter: no personal data sent in prompts beyond first name (configurable).

**Acceptance Criteria**

* If OpenAI call fails or is blocked, fallback to parent-authored generic phrases.
* TTS voice is consistent with chosen voice (best-effort per browser).
* Messages are ≤ 120 characters (truncate gracefully if longer).

---

### 4.5 Parent View & Session Summary

**User Stories**

* As a parent, I want to quickly see how the morning went.
* As a parent, I want to know which tasks typically drag.

**Functional Requirements**

* “Yesterday & Today” card: medal, total time vs expected, which task took longest.
* History list (last 14 sessions): date, total time, medal.
* Export JSON (download) of last 30 days (optional).

**Acceptance Criteria**

* Summary page loads < 1s on typical home Wi-Fi.
* History entries open to show per-task durations.

---

### 4.6 Settings

* Household name, child’s first name(s).
* Tone presets for encouragement.
* Medal thresholds (multipliers).
* Default expected minutes for tasks without explicit values.
* Skipping tasks: allowed or not.
* Language of UI: **English** or **Danish** (toggle).
* Data reset (clear history/templates) with confirmation.

---

## 5) Non-Functional Requirements (pragmatic for personal project)

* **Performance:** Tablet-first; kid mode routes render < 1s on a midrange iPad. TTS latency best-effort.
* **Availability:** Single-node hosting is fine (e.g., Vercel/Netlify for frontend; small backend on Render/Fly/railway).
* **Security (basic):**

  * HTTPS only.
  * Email+password auth with a well-tested library; hashed passwords (bcrypt/argon2).
  * Minimal PII: store only first names; no birthdates.
  * Environment variables for API keys; never exposed to client.
* **Privacy:**

  * Do not store OpenAI responses containing PII; log minimal technical telemetry.
  * Provide a plain-language “Data Use” note in Settings.
* **Accessibility:**

  * Large tap targets, high contrast theme option.
  * Screen reader labels for controls.
  * Avoid flashing animations.
* **Localization:**

  * UI copy in EN/DA via JSON resource files.
  * Encouragement messages can be generated in EN or DA (setting).

---

## 6) System Design (simple, MVP-friendly)

### 6.1 Architecture

* **Frontend:** React (or Svelte/Vue), tablet-first responsive UI, optional PWA.
* **Backend:** Tiny Node/Express (or Python FastAPI) for auth, templates, sessions, and OpenAI proxying.
* **Database:** SQLite (file) or lightweight Postgres; 3 core tables (see Data Model).
* **TTS:** Prefer **client-side** (Web Speech API) to avoid infra costs. If unavailable, fallback to on-screen text.
* **OpenAI:** Server-side endpoint to generate short messages from prompt templates.

### 6.2 Data Model (iteration 1 baseline)

_No auth yet; everything is stored locally for a single household._

**children**

* `id (pk, cuid)`
* `first_name`
* `birthdate` (date, ISO string)
* `active` (bool, default `true`)
* `created_at`

**templates**

* `id (pk, cuid)`
* `name`
* `default_start_time` (`"HH:MM"`, 24h)
* `default_end_time` (`"HH:MM"`, 24h)
* `created_at`
* `updated_at`

**template_tasks**

* `id (pk, cuid)`
* `template_id (fk templates)`
* `order_index` (0-based, maintains display order)
* `title`
* `emoji` (nullable)
* `hint` (nullable)
* `expected_minutes` (float, ≥ 0, default `1.0`)

**sessions**

* `id (pk, cuid)`
* `child_id (fk children)`
* `template_snapshot` (JSON string of the template at start; stored as TEXT in SQLite for now)
* `planned_start_at`, `planned_end_at`
* `allow_skip` (bool, default `false`)
* `actual_start_at`, `actual_end_at`
* `expected_total_minutes`
* `medal` (nullable until completion)
* `created_at`

**session_tasks**

* `id (pk, cuid)`
* `session_id (fk sessions)`
* `order_index` (0-based, keeps kid-mode order)
* `title`
* `expected_minutes`
* `completed_at` (nullable)
* `skipped` (bool, default `false`)

---

## 7) API (iteration 1 shell)

> Local-only for now; no auth yet. Successful responses use explicit keys (`{ children }`, `{ template }`, `{ snapshot }`); error
s follow `{ "error": { "code", "message" } }`.

**Children**

* `GET /api/children` → list children (ordered by `created_at`).
* `POST /api/children { firstName, birthdate, active? }` → create child.
* `PUT /api/children/:id { firstName?, birthdate?, active? }` → update fields.
* `DELETE /api/children/:id` → remove child.

**Templates**

* `GET /api/templates` → list templates with ordered tasks.
* `POST /api/templates { name, defaultStartTime, defaultEndTime, tasks[] }` → create template.
* `PUT /api/templates/:id` → replace template metadata + task list (tasks re-ordered by array index).
* `DELETE /api/templates/:id` → remove template + tasks.
* `POST /api/templates/:id/clone-to-today` → returns `{ snapshot }` with `expectedTotalMinutes` for session bootstrapping.

**Sessions**

* `POST /api/sessions/start { childId, templateId, plannedStartAt?, plannedEndAt?, allowSkip? }` → create snapshot + tasks.
* `GET /api/sessions/:id` → fetch session with ordered tasks and template snapshot.

Validation errors return HTTP 400, missing resources 404, and unexpected failures 500.

---

## 8) UX Flows (concise)

### 8.1 Parent creates template

1. Parent → Templates → “New Template”.
2. Name, pick days (Mon–Fri), add tasks with optional expected minutes.
3. Save → appears in list with “Use Today”.

**Edge cases:** empty task name blocks save; expected minutes must be ≥ 0 (allow 0 to mean “ignore in timing”).

### 8.2 Kid runs Today Session

1. Open app → “Start Today” (or auto when first task completed).
2. Big card for current task with emoji + hint; “Mark Done” button.
   * Optional “Skip” button shows only if the parent allowed skips when starting the session.
3. On tap: message is generated → TTS plays → next task slides in.
4. Final task: “You finished!” + medal animation + total time vs. expected.

**Edge cases:**

* If the browser blocks autoplay TTS, show a “Tap to hear” button.
* If a task is accidentally marked done, parent can undo from a parent-only drawer (pin-protected).

### 8.3 Parent reviews summary

1. Parent → Summary → Yesterday & Today panel: medal, total time, longest task.
2. Optional: open session detail to see per-task timing.

---

## 9) Content & Tone

* **Tone presets** (examples):

  * *Playful:* “Nice! PJs on—next up: socks power-up!”
  * *Coach:* “Great job finishing ‘Get dressed’. Keep your pace for the next one.”
  * *Calm:* “Well done. When you’re ready, the next step is breakfast.”

* **Safety nudges:** never shame or compare siblings; avoid time anxiety.

* **Length limits:** keep messages short; insert child’s first name sparingly.

---

## 10) Settings Defaults (recommended)

* Gold = 1.0× expected total; Silver = 1.3×; Bronze otherwise.
* Default task minutes = 1.
* Tone = Playful.
* TTS language = Danish on devices set to Danish; else English.
* Skipping tasks = Off (MVP).

---

## 11) Error Handling (examples)

* **OpenAI failure:** fall back to stored phrase list per task (“Great work on {{task}}! Next up: {{next}}.”).
* **TTS unavailable:** show text bubble; add “Play” button if TTS becomes available.
* **Offline mode:** allow running the already-loaded “Today Session”; queue completions and sync later.
* **Accidental tap:** parent undo for last action (within 30 seconds).

---

## 12) Analytics (lightweight, local-first)

* Local aggregates (stored per user): average total time last 7 days; most delayed task ID.
* No third-party analytics by default for privacy; optional toggle in Settings if you later add one.

---

## 13) Testing & Acceptance

**Critical acceptance tests (MVP):**

1. Create a template with 5 tasks; publish to Today; run a full session and receive a medal.
2. OpenAI disabled → app still speaks using fallback phrases.
3. TTS blocked → user sees messages and can tap “Play” to hear them.
4. Changing medal multipliers affects next session but not prior session’s medal.
5. Localization switch toggles UI labels (EN/DA), and generated messages follow chosen language.

---

## 14) Roadmap (post-MVP ideas)

* Per-task live timers (visible countdown rings).
* Sticker/badge collection and streaks.
* Multiple children running **simultaneous** sessions with quick swap.
* Parent push reminders (web push).
* Deeper insights: “Top 3 slow tasks this month.”
* Guided breaks or breathing prompts if a task stalls.

---

## 15) Implementation Notes (quick start)

* **Frontend:** React + Vite; state via Zustand or Redux Toolkit; i18n via i18next.
* **Styling:** Tailwind; large components for kid mode.
* **Backend:** Node/Express; Prisma ORM to SQLite for speed.
* **Auth:** next-auth (if Next.js) or Passport/express-session for a minimal stack.
* **OpenAI:** server route wraps `chat.completions` (or `responses`) with a short, safe prompt template.
* **TTS:** `window.speechSynthesis` with voice selection by locale; preload utterances where possible.

---

### Final Notes

* Keep it **forgiving** and **celebratory**: never punish slowness; always frame nudges as help.
* Build the **kid mode** first and test on the real device; polish the parent setup after the core loop (complete → praise → next) feels snappy.
* Avoid scope creep—this MVP already gives you a strong, testable morning routine loop.
