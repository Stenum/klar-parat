# AGENTS.md

Guidelines for the coding agent (and human reviewer) building **Morning Momentum** in **small, testable iterations**.
This document evolves with the project—**prefer adding sections over hardcoding assumptions.**

---

## 0) Principles

* **Vertical slices first.** Each iteration must be user-demoable on tablet (Kid Mode loop where possible).
* **Safety by contracts.** Share types and schemas across web/API; validate all inputs & outputs.
* **Keep it reversible.** Small PRs, minimal blast radius, clear rollback plan.
* **Determinism over cleverness.** Timing, medals, and urgency computations must be reproducible in unit tests.
* **Online-only.** Assume connectivity for LLM/TTS; no offline caches or text fallbacks.
* **No auth.** No accounts/logins for MVP. Local distribution.
* **Multi-child is core.** Design data & routes to isolate state per child.
* **Kid-first UX.** Big targets, minimal text, fast feedback, age-appropriate.

---

## 1) Working Agreement

* **Branching:** `main` (protected), feature branches `feat/<iteration>-<slug>`, fixes `fix/<slug>`.
* **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`). One logical change per commit.
* **PRs:** ≤ 400 LOC diff when feasible. Include:

  * Purpose and iteration linkage
  * Screenshots/GIF (web) or cURL (API)
  * Test plan & results
  * Rollback strategy
* **Definition of Done (per iteration slice):**

  * Code + tests pass locally and CI
  * Acceptance criteria met (see iteration plan)
  * UX verified on iPad/Safari (or iOS simulator)
  * Docs updated (README sections and this file if relevant)
* **Feature flags:** Prefer env/JSON toggles. Examples:

  * `USE_FAKE_LLM`, `USE_FAKE_TTS`, `ENABLE_URGENCY`, `ENABLE_MEDALS`, `DEBUG_UI`

---

## 2) Repository (expected baseline; refine as we go)

```
/apps
  /web       # React + Vite + Tailwind
  /api       # Express + Prisma (SQLite)
/packages
  /shared    # Types, zod schemas, constants (urgency thresholds)
/tests
  /api       # Integration tests (supertest)
/.github
  /workflows # CI: lint, typecheck, test
```

> If layout diverges, update this doc and the project README in the same PR.

---

## 3) Coding Standards

### 3.1 Language & Tooling

* **TypeScript everywhere.** `strict: true`.
* **ESLint + Prettier.** No disabling rules without justification.
* **Paths & imports:** Prefer absolute import aliases (`@shared/*`) via TS path mapping.

### 3.2 API

* **REST, JSON only.**
* **Validation:** All request bodies & query params validated with **zod** in the API.
* **Responses:** Typed DTOs shared via `/packages/shared`.
* **Errors:** Consistent shape:

  ```json
  { "error": { "code": "BAD_REQUEST", "message": "..." } }
  ```
* **Idempotency:** Task completion endpoints must be idempotent.

### 3.3 Web (React)

* **State:** Local component state for UI; global app state via Zustand or Redux Toolkit (keep slices small).
* **Side effects:** Use React Query (or RTK Query) for API calls; retries with backoff where appropriate.
* **Accessibility:** Tap targets ≥ 44px, focus outlines, ARIA labels for key buttons.
* **Performance:** Avoid heavy renders; memoize lists; no needless reflows.

### 3.4 Styling

* **TailwindCSS.** Semantic utility groupings; avoid long class chains—extract components.
* **Design tokens:** Keep spacing/size constants where reused (e.g., `BTN_LG`).

### 3.5 Time & Math

* Use a single library (`dayjs` or `luxon`) for time math.
* All **urgency** and **medal** computations are **pure functions** with unit tests (no Date.now inside—inject `now`).

---

## 4) Testing Conventions

### 4.1 Pyramid

* **Unit tests** (fast, many): pure utils (urgency, medals, validators).
* **API integration tests** (supertest): CRUD flows, session lifecycle, idempotency.
* **Web tests** (Vitest + React Testing Library): critical flows (start session → complete tasks → medal).
* **Manual scripts** for iPad validation (documented per iteration).

### 4.2 Naming & Structure

* Mirror source structure; `*.spec.ts`.
* Deterministic seeds for DB tests; reset DB per suite.

### 4.3 External Services

* **LLM/TTS are mocked** by default in tests. Real integrations covered by isolated “can-run-locally” suites behind env flags.
* Never make network calls in unit tests.

---

## 5) Data & Contracts (minimal; expand iteratively)

* **Children**

  * `first_name: string (1..40)`, `birthdate: ISO date`, `active: boolean`
* **Templates**

  * `id: uuid`, `name: string (1..60)`, `default_start_time: "HH:MM"`, `default_end_time: "HH:MM"`
* **Template Tasks**

  * `title: string (1..60)`, `emoji?: string`, `hint?: string`, `expected_minutes: number >= 0 (default from settings, e.g., 1.0)`
* **Sessions**

  * Snapshot of template + tasks; `planned_start_at`, `planned_end_at`, `actual_*`, `medal`
* **Session Tasks**

  * `completed_at: timestamp|null`, `skipped: boolean`

> Keep snapshots immutable; changes to templates/settings affect **future** sessions only.

---

## 6) Urgency & Medals (keep pure & testable)

* **Expected Total:** `sum(expected_minutes of required tasks)`
* **Medals (defaults, configurable for future):**

  * Gold `actual_total ≤ 1.0 × expected_total`
  * Silver `≤ 1.3 × expected_total`
  * Bronze otherwise
* **Urgency inputs:**

  * `planned_start_at`, `planned_end_at`, `now`
  * `completed_expected / expected_total` → `progress_ratio`
  * `pace_delta = elapsed/total_window - progress_ratio`
* **Levels (initial heuristic; adjustable):**

  * L0: early; L1: normal; L2: late; L3: critical.
* **Mid-task nudge:** Trigger once if a task exceeds `1.5 × expected`.

> Implement as `computeMedal()` and `computeUrgency()` in `/packages/shared/logic/*` with exhaustive tests.

---

## 7) LLM & TTS Integration (phased)

* **Phase A (fake):** `/api/dev/fake-llm` and `/api/dev/fake-tts` for deterministic E2E.
* **Phase B (real LLM):** Server-only call to OpenAI. **Contract**: must return `{ text: string }` ≤ 120 chars. Validate & truncate server-side.
* **Phase C (real TTS):** Abstraction `synthesize(text, language, voice)`; provider strategy: Fake | WebSpeech | Cloud.
* **Autoplay:** Require a one-time “Enable Voice” gesture at session start.

> No on-screen text fallback; if calls fail, retry (limited) and continue silently to next event.

---

## 8) Observability & Errors

* **Structured logs** (API): request id, route, duration, result, error code.
* **Client event log** (debug build): last N speech events with timing.
* **Never crash on speech/LLM failures.** Log and continue.

---

## 9) Security & Privacy (basic for personal project)

* HTTPS if exposed beyond LAN.
* API keys only on server via env vars.
* Birthdates stored locally; no third-party analytics by default.
* CORS restricted to the web app origin (configurable).

---

## 10) Iteration Checklists (template)

> Copy this checklist into each iteration PR and fill it.

**Goal:**
**Scope:** (routes, data, UI)

**Acceptance Criteria:**

* [ ] Criteria 1
* [ ] Criteria 2

**Developer Tasks:**

* [ ] Schema/migration
* [ ] DTOs & zod validators
* [ ] API handlers + tests
* [ ] UI components + tests
* [ ] Manual iPad check

**Test Plan:**

* [ ] Unit (logic)
* [ ] API integration (supertest)
* [ ] Web (RTL)
* [ ] Manual script steps

**Risks & Mitigations:**

* [ ] …
* [ ] …

**Docs Updated:**

* [ ] README
* [ ] AGENTS.md (this file)

---

## 11) PR Quality Bar (reject if missing)

* ❌ No tests → reject.
* ❌ Failing CI → reject.
* ❌ Untyped or `any` without comment → reject.
* ❌ Silent API changes (no schema update) → reject.
* ❌ Feature flag missing for risky toggles → reject.

---

## 12) UI Guidelines (Kid Mode)

* Minimal on-screen text; one primary action per task.
* Progress bar and clear “Next up” hint.
* Motion subtle; no flashing.
* Buttons: large, high contrast; labels are action-first (“Mark Done”).

---

## 13) Manual Validation Scripts (living section)

Maintain quick scripts per iteration (copy into PR):

* **I2:** Start session, reload, task order persists.
* **I3:** Complete fast → Gold; slow → Silver/Bronze; boundary verified.
* **I4:** Shorten window, wait to cross 50/25/10%; dev banner shows L1/L2/L3.
* **I5:** Tap “Enable Voice”, complete task → audio within ~1s.
* **I6:** Switch language (EN/DA); messages swap; L3 phrasing is concise.
* **I7:** Two children running; independent timing/voice.
* **I8:** History shows last sessions; detail shows longest task.

> Update as new iterations are added.

---

## 14) When Adding New Capabilities

* Extend **shared types & zod** first → API → UI.
* Add **pure functions + unit tests** for any new calculation.
* Add **feature flag** if behavior changes are risky.
* Update **manual validation scripts** and this document.

---

## 15) Known Non-Goals (MVP)

* No offline mode.
* No email/password accounts.
* No text-on-screen fallback for voice messages.
* No external reward stores or sticker economies (yet).

---

## 16) Glossary

* **Today Session:** A per-child, per-day instance created from a template (immutable snapshot).
* **Expected Minutes:** Task-specific estimate used for medals and urgency pacing.
* **Urgency Level:** 0–3 scale that shapes nudge tone & frequency.

---

### Edit History

* **v0.1** — Initial guardrails for Iterations 0–3.
* (Append entries with summary per PR that updates this file.)

---

**Remember:** If a decision increases implementation risk or future refactor cost, **stop and update this file + the iteration plan first.**
