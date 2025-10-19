# Iteration 0 — Repo, Scaffolding, and Guardrails (1–2 hours)

**Goal:** A clean, reproducible baseline the agent can extend safely.

**Deliverables**

* Monorepo: `apps/web` (React+Vite+Tailwind), `apps/api` (Node/Express), `packages/shared` (types).
* SQLite via Prisma. Migrations enabled.
* `.env.example` with `DATABASE_URL`, `OPENAI_API_KEY`, `TTS_PROVIDER_*` (empty for now).
* CI: run lint, typecheck, unit tests.
* Local “fake cloud” stubs:

  * `/api/dev/fake-llm` returns a short canned string.
  * `/api/dev/fake-tts` returns a short code generated sine wave sound.
* Feature flags (env or JSON): `useFakeLLM`, `useFakeTTS`, `enableUrgency`, `enableMedals`.

**Validation**

* Start dev servers. Visit `/health` (API) and `/` (web) → both show “OK”.

**Why this order?** Ensures we can iterate quickly and flip real integrations later without touching UI or flows.

---

# Iteration 1 — Data Model + Adminless Local App Shell

**Goal:** Minimal DB models and a basic navigation shell—no auth, no users.

**Schema**

* `children(id, first_name, birthdate, active, created_at)`
* `templates(id, name, default_start_time, default_end_time, created_at, updated_at)`
* `template_tasks(id, template_id, order_index, title, emoji?, hint?, expected_minutes DEFAULT 1.0)`
* `sessions(id, child_id, template_snapshot JSON, planned_start_at, planned_end_at, actual_start_at, actual_end_at, expected_total_minutes, medal)`
* `session_tasks(id, session_id, title, expected_minutes, completed_at, skipped)`

**API**

* `GET/POST/PUT/DELETE /api/children`
* `GET/POST/PUT/DELETE /api/templates`
* `POST /api/templates/:id/clone-to-today` → returns the snapshot (used soon)

**Web**

* Sidebar: Children, Templates, Today, History (disabled links except Children/Templates).
* Forms with client validation.

**Validation**

* Add 2 children; add a template with default times and 4–6 tasks (with expected minutes); edit and reorder; data persists.

**Tests**

* Unit: data validators (times HH:MM), expected_minutes ≥ 0.
* API integration: CRUD happy paths + 400s.

**Why now?** Locks down the core entities (multi-child + rich templates) from the start.

---

# Iteration 2 — Session Creation (Single Child), No Timing Yet

**Goal:** Create a “Today Session” instance from a template for one child and render Kid Mode UI (no clocks, no LLM/TTS).

**API**

* `POST /api/sessions/start { child_id, template_id, planned_start_at?, planned_end_at?, allow_skip? }`

  * Snapshots template + calculated `expected_total_minutes`.
  * Sets `planned_*` from template defaults if not provided.
* `GET /api/sessions/:id` (returns full session with tasks)

**Web**

* **Today (Parent view):** choose child + template → Start Session → route to `Kid Mode`.
* **Kid Mode:** shows current task, big “Complete” button, progress bar, next-task preview.

**Validation**

* Start a session and complete nothing; reload → session persists in DB.
* UI shows correct order and counts.

**Why now?** Establishes the event loop and snapshotting before adding timing/voice.

---

# Iteration 3 — Timing & Medal Engine (No Urgency Yet)

**Goal:** Time tracking and deterministic medal calculation; still no LLM/TTS.

**Rules**

* `actual_start_at` set on *first* completion (or explicit Start).
* `actual_end_at` set on finishing last required task.
* `expected_total = Σ expected_minutes` (use template snapshot).
* Medal thresholds (settings, default): Gold ≤ 1.0×, Silver ≤ 1.3×, else Bronze.

**API**

* `POST /api/sessions/:id/task/:index/complete`
* `POST /api/sessions/:id/finish` → computes medal.

**Web**

* Kid Mode shows total elapsed time (mm:ss) since start.
* After final completion: medal badge + total vs expected.

**Validation**

* Finish session quickly → Gold. Delay with devtools wait → Silver/Bronze.

**Tests**

* Medal boundary tests (e.g., 1.0× and 1.3× exact).
* Idempotent completion (double-tap only counts once).

**Why now?** Medal logic is core motivation and must be correct before urgency.

---

# Iteration 4 — Urgency Model (LLM/TTS still fake)

**Goal:** Compute urgency levels and nudge frequency; surface them in the UI (text labels for you to see), but still call **fake** LLM/TTS.

**Urgency Computation (server)**

* From PRD:

  * `total_window = planned_end - planned_start`
  * `elapsed = now - planned_start`
  * `time_remaining = planned_end - now`
  * `progress_ratio = completed_expected / expected_total`
  * `pace_delta = elapsed / total_window - progress_ratio`
* Map to levels 0–3 per thresholds; recompute on every event.
* Mid-task nudge if task runtime > 1.5× expected (emit one “nudge event” per offending task).

**API**

* `GET /api/sessions/:id/telemetry` → `{ urgency_level, time_remaining_mm, pace_delta }`

**Web**

* Kid Mode “dev banner” showing `Urgency: L2, 9m left` for validation.
* Trigger mid-task nudge by waiting beyond 1.5× expected.

**Validation**

* Manually tweak `planned_end_at` to hit L2/L3; verify banner updates.

**Why now?** Prove urgency math before adding real speech—prevents prompting issues later.

---

# Iteration 5 — Real TTS Playback Pipeline With Fake LLM

**Goal:** End-to-end audio playback on device using the fake LLM, ensuring autoplay permissions and buffering are handled.

**API**

* `POST /api/dev/fake-llm` returns a short sentence with placeholders filled.
* `POST /api/tts` accepts `{ text, language, voice }`

  * If `useFakeTTS=true`, returns cached code generated sine wave sound.
  * Else, calls real TTS provider (kept off this iteration).

**Web**

* On session start, require a single tap “Enable Voice” (for autoplay policies).
* After each completion and on nudges, call `/tts` and play returned audio.

**Validation**

* Hear audio after each completion and on mid-task nudge with a single initial gesture.

**Why now?** TTS streaming and browser policies are the most brittle UX. Solve this with a deterministic fake LLM before LLM variability enters.

---

# Iteration 6 — Real LLM (OpenAI) + Prompt Contract

**Goal:** Replace fake LLM with OpenAI while keeping strict output guarantees.

**Server**

* System prompt defines: tone policy, age/urgency styles, max 120 chars, no shaming/comparisons.
* JSON-only response contract: `{ "text": "..." }`. Validate and truncate if needed.
* Inputs: `child_first_name`, `age_years`, `completed_task_title`, `next_task_title`, `urgency_level`, `time_remaining_mm`, `language`.
* Retries with jitter (x2); on consecutive failure → return minimal hardcoded **server-side** sentence *then immediately reattempt on next event* (still spoken via TTS).
  *(No text fallback is displayed, honoring the “always TTS” rule.)*

**Web**

* Remove “dev banner” (keep behind a query flag `?debug=1`).

**Validation**

* Messages reflect urgency: at L3, sentences are shorter and action-first.
* Flip language setting EN/DA; messages switch.

**Why now?** We’ve de-risked TTS; introducing LLM last ensures the only moving piece now is content.

---

# Iteration 7 — Multi-Child Parallel Sessions

**Goal:** Run separate sessions for different children without interference.

**Web**

* Today (Parent): grid of child cards with “Start”/“Resume” session.
* Each card opens its own Kid Mode route (`/today/:childId`).
* Visual indicators: Running, Paused, Completed.

**Server**

* Sessions keyed by `child_id`.
* Enforce one active session per child.

**Validation**

* Start two sessions with different templates/times; each plays its own TTS and computes urgency independently.

**Tests**

* Concurrency: two `complete` events for different sessions processed correctly.

**Why now?** You asked for multi-child as a must; we land it when the single-session loop is trustworthy.

---

# Iteration 8 — History & Insights (Lightweight)

**Goal:** Minimal review to inform tweaks.

**API**

* `GET /api/sessions/recent?child_id&limit=14`
* `GET /api/sessions/:id/detail` (task durations, medal)

**Web**

* History list per child; detail modal with task timings and any mid-task nudge occurrences.

**Validation**

* Sessions show with correct medals; detail reveals longest tasks.

**Why now?** Enables short feedback loops on expected minutes and template times.

---

# Iteration 9 — Settings & Fine-Tuning

**Goal:** Expose multipliers and defaults without breaking history.

**Settings**

* `language`, `gold_multiplier`, `silver_multiplier`, `default_task_minutes`, `allow_skip`, `tts_voice`.
* Multipliers affect **new** sessions only (history stays frozen).

**Validation**

* Change `gold_multiplier` to 0.9; new sessions tighten thresholds; old sessions unchanged.

---

# Iteration 10 — Polish & Guardrails

**Goal:** Make it kid-proof and morning-ready.

**Polish**

* Big touch targets (≥44px), high-contrast toggle.
* Undo last completion (parent drawer; 30s window).
* Transitions between tasks (quick, no jank).
* Empty states (no children/templates) with helpful CTAs.

**Observability**

* Server logs for: LLM latency, TTS latency, dropped audio, urgency transitions.
* Client event log (debug panel): last 10 speech events with durations.

**Validation**

* Cold start to medal in < 90 seconds of dev effort.
* All flows work on the iPad (Safari/Chrome).

---

## Cross-Iteration Assets for the AI Agent

**Repository Structure**

```
/apps
  /web     # React + Vite + Tailwind
  /api     # Express + Prisma
/packages
  /shared  # zod schemas, TypeScript types, constants (urgency thresholds)
/tests
  /api     # supertest integration suites
  /web     # vitest + RTL
```

**Shared Types (packages/shared)**

* `TimeHM = string` (`"HH:MM"`, 24h)
* `UrgencyLevel = 0 | 1 | 2 | 3`
* Zod schemas for create/update payloads.

**Fixtures**

* `fixtures/children.json`
* `fixtures/templates/school_morning.json` with tasks + expected minutes.
* `fixtures/sessions/happy_path.json` (for API tests).

**Prompt Template (server)**

* System: policy + style + output contract (JSON).
* User: compact with fields above.
* Function: validator rejects >120 chars; trims politely.

**TTS Abstraction**

* `synthesize(text, language, voice) → { audioUrl }`
* Provider strategy: Fake | WebSpeech | Cloud.
* Single point to switch providers by flag.

**Urgency Helpers**

* `computeUrgency(plannedStart, plannedEnd, completedExpected, expectedTotal, now)`
* Pure function with unit tests for boundary coverage.

---

## Manual Test Scripts You Can Run Each Iteration

* **I2 (session creation):** Start session, reload, check persistence and order.
* **I3 (medals):** Run fast → Gold; slow → Silver/Bronze; verify boundary equality.
* **I4 (urgency math):** Set window to 20 min; wait to cross 50%, 25%, 10%; see level changes in dev banner.
* **I5 (TTS):** Tap “Enable Voice”; complete a task; hear audio within ~1s.
* **I6 (LLM):** Switch to Danish; complete task near end time; hear concise “hurry” phrasing.
* **I7 (multi-child):** Start two sessions; ensure independent speech & timing.
* **I8 (history):** Finish, then check recent sessions; open detail; confirm longest task.

---

## Risk Controls & Rollback Points

* **Autoplay/TTS blocked:** Require one-time “Enable Voice” on session start; store permit in state.
* **LLM latency spikes:** Set 900ms timeout → if exceeded, send short “fallback minimal string” to TTS *(still spoken, no text UI)* and continue; queue real message for next event. (Avoids silence without breaking your “always TTS” principle.)
* **Clock drift / wrong planned times:** Detect `now >> planned_start` on start; prompt to auto-shift both planned times to “now…+window”.
* **Concurrency:** One active session per child; server enforces with unique index `(child_id, actual_end_at IS NULL)`.
