# Iteration 0 — Repo, Scaffolding, and Guardrails (1–2 hours)
**Status:** 🟩 Complete ([PR #1](https://github.com/acme/klar-parat/pull/1) – 2025-10-19)

- What changed: Bootstrapped the monorepo scaffolding across API, web, and shared packages with feature flags and fake integrations.
- How verified: `npm run lint`, `npm run typecheck`, `npm run test`, and `npm audit`.

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

**Status:** 🟩 Complete (AgentGPT – 2025-10-20)
  - PR TBD — Shipped Prisma schema, CRUD APIs, and adminless web shell; verified with `npm run lint`, `npm run typecheck`, `npm run test`.
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

**Status:** 🟩 Complete (gpt-5-codex – 2025-10-21)
  - PR TBD — Added session start API, kid mode flow, and schema updates; verified with `npm run lint`, `npm run typecheck`, `npm run test`.

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

**Status:** 🟩 Complete (gpt-5-codex – 2025-10-22)
  - PR TBD — Implemented completion/finish APIs, medal logic, and Kid Mode timer/medal UI; verified with `npm run lint`, `npm run typecheck`, and `npm run test`.

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

**Status:** 🟩 Complete (gpt-5-codex – 2025-10-23)
  - PR TBD — Added urgency telemetry endpoint, nudge scheduling, and Kid Mode dev banner; verified with `npm run lint`, `npm run typecheck`, and `npm run test`.

**Goal:** Compute urgency levels and schedule three mid-task encouragements per task; surface them in the UI (text labels for you to see), but still call **fake** LLM/TTS.

**Urgency Computation (server)**

* From PRD:

  * `total_window = planned_end - planned_start`
  * `elapsed = now - planned_start`
  * `time_remaining = planned_end - now`
  * `progress_ratio = completed_expected / expected_total`
  * `pace_delta = elapsed / total_window - progress_ratio`
* Map to levels 0–3 per thresholds; recompute on every event.
* Mid-task nudge cadence: schedule up to three “nudge events” per task at 33%, 66%, and 100% of `expected_minutes` elapsed (no duplicates once fired), even if the task is still within expected time.

**API**

* `GET /api/sessions/:id/telemetry` → `{ urgencyLevel, timeRemainingMinutes, paceDelta, nudges[] }`

**Web**

* Kid Mode “dev banner” showing `Urgency: L2, 9m left` for validation.
* Trigger mid-task nudges by letting a task run past the 33%, 66%, and 100% marks of its expected minutes (use dev controls to fast-forward if needed).

**Validation**

* Manually tweak `planned_end_at` to hit L2/L3; verify banner updates.
* Let a task run long enough to trigger all three nudge events and confirm each fires exactly once.

**Why now?** Prove urgency math before adding real speech—prevents prompting issues later.

---

# Iteration 5 — Real TTS Playback Pipeline With Fake LLM

**Status:** 🟩 Complete ([fix(I5): Prevent duplicate nudge TTS fetches](https://github.com/acme/klar-parat/pull/123) – 2025-10-24)

**Goal:** End-to-end audio playback on device using the fake LLM, ensuring autoplay permissions and buffering are handled.

**API**

* `POST /api/dev/fake-llm` returns a short sentence with placeholders filled.
* `POST /api/tts` accepts `{ text, language, voice }`

  * If `useFakeTTS=true`, returns cached code generated sine wave sound.
  * Else, calls real TTS provider (kept off this iteration).

**Web**

* On session start, require a single tap “Enable Voice” (for autoplay policies).
* After each completion and on nudges, call `/tts` and play returned audio.

**What changed:** Implemented `/api/tts` with fake audio when flagged, required a single Kid Mode voice enable gesture, and routed completion/nudge prompts through the fake LLM + TTS pipeline with duplicate fetch protection.

**How verified:** `npm run lint`, `npm run typecheck`, `npm run test`.

**Why now?** TTS streaming and browser policies are the most brittle UX. Solve this with a deterministic fake LLM before LLM variability enters.

---

# Iteration 6 — Real LLM (OpenAI) + Prompt Contract

**Status:** 🟩 Complete ([fix(I6): resolve lint errors in encouragement route](https://github.com/acme/klar-parat/pull/999) – 2025-10-26)
  - What changed: Delivered OpenAI-backed encouragement messaging with richer timing context, session kick-off announcements, and updated Kid Mode debug views to surface the new telemetry.
  - How verified: `npm run lint`, `npm run typecheck`, `npm run test`.

**Goal:** Replace fake LLM with OpenAI while keeping strict output guarantees.

**Server**

* System prompt defines: tone policy, age/urgency styles, and three event types (session start, mid-task nudge, completion) with upbeat/no-shame guardrails.
* JSON-only response contract: `{ "text": "..." }`. Validate without imposing an artificial character limit (model is instructed to stay brief).
* Inputs include: child first name, approximate age, language, session start/end times, elapsed/remaining session minutes, elapsed/remaining seconds for the current task, task hint/title, previous/next task preview, and nudge cadence history (three per-task checkpoints with fired count + upcoming threshold).
* New endpoint `POST /api/sessions/:id/message` returns `{ "text": "..." }` while handling retries, truncation, and deterministic fallback phrases when OpenAI fails.
* Retries with jitter (x2); on consecutive failure → return minimal hardcoded **server-side** sentence *then immediately reattempt on next event* (still spoken via TTS).
  *(No text fallback is displayed, honoring the “always TTS” rule.)*

**Web**

* Remove “dev banner” (keep behind a query flag `?debug=1`).

**Validation**

* Messages reflect urgency: at L3, sentences are shorter and action-first.
* Flip language setting EN/DA; messages switch.

**Why now?** We’ve de-risked TTS; introducing LLM last ensures the only moving piece now is content.

---

# Iteration 7 — Multi-Child Same-Screen Board

**Status:** 🟩 Complete (gpt-5-codex – 2025-10-27)
  - PR: feat(I7): auto-launch kid board with voice
  - What changed: Auto-launched the multi-child kid board with staged planning, shared voice kickoff, and an end-all-sessions reset.
  - How verified: `npm run lint`, `npm run typecheck`, `npm run test`.

**Goal:** Let siblings run their routines side-by-side on one device while keeping timers, urgency, and voice independent. Voice feedback arms itself when the parent taps Start, the kid board takes over the full screen, and the parent can end all running sessions to return to planning.

**Web**

* Replace Kid Mode with a board layout that shows one column per active child (current task, progress bar, big Complete/Skip buttons).
* The Today (Parent) view launches and resumes sessions into the shared board without navigation changes; allow quick focus highlighting per column.
* Provide a pre-launch planner so the parent can stage multiple child/template pairs before starting the board.
* Add an “End all sessions” control on the kid board that skips outstanding tasks, finishes every session, and drops back to the planner.
* Surface live medal and urgency status per child column so progress is visible at a glance.

**Server**

* Maintain independent session state keyed by `session_id` and expose `GET /api/sessions/active` to return all running sessions for the board.
* Ensure concurrency safety when multiple columns trigger `complete` events simultaneously; queue TTS requests per session to avoid overlapping audio.

**Validation**

* Start sessions for two children; confirm both columns advance correctly on the same screen and play their own TTS without crosstalk.
* The first message, when the session starts, introduces both kids to the session with the same TTS, and introduces their respective chores and their first task.

**Tests**

* Concurrency: two `complete` events for different sessions processed simultaneously without race conditions.
* Board layout: component tests covering focus switching and column rendering.

**Why now?** Delivers the sibling experience while the voice stack is still under control, so concurrency bugs surface before polish work.

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
* **I7 (multi-child):** Start two sessions; confirm both columns advance on the same board with independent speech & timing.
* **I8 (history):** Finish, then check recent sessions; open detail; confirm longest task.

---

## Risk Controls & Rollback Points

* **Autoplay/TTS blocked:** Require one-time “Enable Voice” on session start; store permit in state.
* **LLM latency spikes:** Set 900ms timeout → if exceeded, send short “fallback minimal string” to TTS *(still spoken, no text UI)* and continue; queue real message for next event. (Avoids silence without breaking your “always TTS” principle.)
* **Clock drift / wrong planned times:** Detect `now >> planned_start` on start; prompt to auto-shift both planned times to “now…+window”.
* **Concurrency:** One active session per child; server enforces with unique index `(child_id, actual_end_at IS NULL)`.
