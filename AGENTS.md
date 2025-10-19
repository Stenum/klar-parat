# AGENTS.md

Guidelines for the coding agent (and human reviewer) building **Klar Parat** in **small, testable iterations**.
This file is the rulebook for *how* to build; it must evolve as the code evolves—**update it immediately when process, contracts, or conventions change.**

It works with two sibling docs:

* **[`PRD.md`](./PRD.md)** — the Product Requirements (**what** & **why**).
* **[`PLAN.md`](./PLAN.md)** — the Implementation Plan (**when** & **in what order**).

Together: **PRD = What**, **PLAN = When/How**, **AGENTS = How to build correctly & verify progress.**

---

## 0) Non-negotiables

* **Follow `PLAN.md`** exactly: one iteration at a time, end-to-end, demoable.
* **Keep `PLAN.md` up to date**: status + notes after every PR.
* **Reflect the `PRD.md`**: if behavior or data changes, update PRD *in the same PR*.
* **Online-only**: assume network for LLM & TTS; **no offline**, **no text fallbacks**.
* **Multi-child** from day one; isolate per-child state.
* **Kid-first UX**: big targets, minimal text, immediate voice feedback.

---

## 1) Tracking Progress (MANDATORY)

In `PLAN.md`, every iteration carries a status:

| Status            | Meaning                               |
| ----------------- | ------------------------------------- |
| 🟦 Ready to Start | Approved next iteration               |
| 🟨 In Progress    | Development underway (branch open)    |
| 🟩 Complete       | Merged to `main` & manually validated |
| 🟥 Blocked        | Waiting on dependency/decision        |
| ⬜ Not Started     | Scheduled but idle                    |

**Agent workflow:**

1. Before starting: change the chosen iteration to `🟨 In Progress (AgentX – YYYY-MM-DD)` and commit.
2. On merge: set to `🟩 Complete`, link the PR, add a 1–2 line “What changed / How verified”.
3. If blocked: set `🟥 Blocked` and write *why* + *what unblocks*.
4. **Never** start the next iteration until the current one is `🟩 Complete`.

---

## 2) Branch/PR Discipline

* Branches: `feat/I<nr>-<slug>` (e.g., `feat/I3-medal-engine`), fixes `fix/<slug>`.
* Conventional commits (`feat:`, `fix:`, `test:`, `refactor:`, `chore:`).
* **PR title:** `feat(I3): Timing & Medal Engine`.
* **One iteration = one PR** (avoid bundling).
* **PR must include**:

  * Link to `PLAN.md#iteration-<nr>` and related `PRD.md` sections.
  * Acceptance criteria checklist (copied from PLAN).
  * Manual validation steps + results (screenshots/GIFs, or cURL for API).
  * Any schema changes (migration summary).
  * Notes on flags/toggles.
  * Rollback plan (how to revert safely).

**Quality gate (reject PR if missing):**

* Iteration status in `PLAN.md` not updated.
* Tests or CI fail (lint, typecheck, test).
* API or schema changes without Zod validators + PRD update.
* Unexplained `any` or disabled ESLint rules.
* Behavior drift from PRD.

---

## 3) Repository Layout (expected)

```
/apps
  /web       # React + Vite + Tailwind
  /api       # Express + Prisma (SQLite)
/packages
  /shared    # Types, Zod schemas, pure logic (urgency/medals)
/docs
  PRD.md
  PLAN.md
  AGENTS.md
/.github/workflows  # CI: lint, typecheck, test
```

> If the layout changes, update `AGENTS.md`, `PRD.md`, and `PLAN.md` in the same PR.

---

## 4) Coding Standards

**Language & tooling**

* TypeScript with `strict: true`.
* ESLint + Prettier enforced in CI.
* Absolute imports via TS paths (`@shared/*`).

**API (apps/api)**

* REST, JSON only.
* Validate all inputs with **Zod**; share DTO types via `/packages/shared`.
* Error shape:

  ```json
  { "error": { "code": "BAD_REQUEST", "message": "..." } }
  ```
* Idempotent completion endpoints (double taps are no-ops).
* Migrations: one migration per schema change; include seed fixtures where useful.

**Web (apps/web)**

* React + Vite; state via React Query + a tiny global store (Zustand/RTK) for session state.
* Accessibility: ≥44px tap targets, ARIA, keyboard nav.
* Performance: avoid unnecessary re-renders; memoize lists.
* iPad Safari voice policy: require one-tap **Enable Voice** at session start.

### apps/web component layout & conventions

* `App.tsx` is the orchestration layer only—no presentational JSX beyond shell layout. It wires navigation, shared session state, and hands props to feature components.
* Feature components live under `apps/web/src/components/<feature>/` (e.g. `children/ChildrenManager.tsx`, `templates/TemplatesManager.tsx`, `today/TodayManager.tsx`, `kid-mode/KidMode.tsx`). Keep supporting helpers and form types colocated within the component file unless they are shared.
* Cross-component types belong in `apps/web/src/types/` and reusable utilities in `apps/web/src/utils/`. Update or create helpers (e.g. `utils/sessionProgress.ts`) instead of duplicating derivation logic.
* Component files should:
  * export a single `FC` (named export) and keep hook calls at the top.
  * wrap asynchronous handlers in `useCallback` and memoise derived data with `useMemo` to keep renders predictable.
  * perform side effects via `useEffect` with exhaustive dependency arrays—prefer derived primitives over entire objects to avoid runaway loops.
  * surface local validation errors through state rather than throwing.
  * never embed unrelated components inline inside another component file; add a new file when JSX exceeds a focused responsibility.

**Styling**

* Tailwind; factor out repeated utility groups into components.
* Subtle motion; avoid flashing colors.

**Time & math**

* Use **dayjs** or **luxon** consistently.
* Pure functions for all calculations (`computeMedal`, `computeUrgency`); inject `now`—no direct `Date.now()`.

**Feature flags**

* Env or config: `USE_FAKE_LLM`, `USE_FAKE_TTS`, `ENABLE_URGENCY`, `ENABLE_MEDALS`, `DEBUG_UI`.

---

## 5) LLM & TTS (strict contracts)

**LLM**

* Server-only call (never expose keys).
* Contract: respond with JSON `{ "text": string }`, ≤ 120 chars, language from settings.
* Inputs include: child name/age, completed task, next task, urgency level, time remaining.
* On failure: retry (bounded). If still failing, synthesize a **short minimal line** server-side and speak it (no UI text fallback), then continue; log the incident.

**TTS**

* Abstraction `synthesize(text, language, voice) → { audioUrl }`.
* Providers: Fake → WebSpeech → Cloud (flag-controlled).
* Respect autoplay; play within ~1s post-completion when possible.

---

## 6) Testing Conventions

**Pyramid**

* **Unit**: pure logic & validators (fast, many).
* **API integration**: supertest; CRUD + session lifecycle + idempotency.
* **Component**: React Testing Library for critical flows.
* **Manual**: follow `PLAN.md` scripts on iPad Safari.

**Rules**

* Tests mirror source folders; filenames `*.spec.ts`.
* DB tests use deterministic seeds; reset per suite.
* Mock LLM/TTS by default; never hit the network in unit tests.
* Coverage targets:

  * `/packages/shared/logic/*` ≥ **85%**
  * API handlers ≥ **70%**

---

## 7) Observability & Ops

* Structured logs (API): request id, route, duration, result, error code.
* Client debug panel (dev only): last N speech events (LLM latency, TTS latency, audio play time).
* On errors: never crash the flow; log and continue.

---

## 8) Security & Privacy (right-sized)

* HTTPS for any non-LAN exposure.
* Keys in server env only; never ship to client.
* Store first names + birthdates; no extra PII.
* No analytics/trackers in MVP.

---

## 9) Data & Contracts (source of truth: `PRD.md`)

* **Children**: `first_name`, `birthdate`, `active`.
* **Templates**: `id`, `name`, `default_start_time`, `default_end_time`.
* **Template tasks**: `title`, `emoji?`, `hint?`, `expected_minutes` (defaults allowed).
* **Sessions**: immutable snapshot; planned/actual times; `allow_skip`; medal.
* **Session tasks**: ordered list (`order_index`); timestamps; skipped flag.

**Rules**

* Snapshots are immutable.
* Settings changes apply to **future** sessions only.
* Times are 24h strings for UI, store UTC internally.

---

## 10) Urgency & Medals (canonical)

* **Expected total** = sum of `expected_minutes`.
* **Medals**: Gold ≤ 1.0×, Silver ≤ 1.3×, else Bronze (configurable for future).
* **Urgency**:

  * Inputs: planned window, elapsed, time remaining, progress ratio, pace delta.
  * Levels 0–3; thresholds per PRD.
  * Mid-task nudge once if `> 1.5×` expected minutes.

Implement as pure utilities in `/packages/shared/logic/` with exhaustive boundary tests.

---

## 11) Documentation Rules (keep the trio in sync)

| File          | Owns                     | Update when…                                  |
| ------------- | ------------------------ | --------------------------------------------- |
| **PRD.md**    | Behavior, data model, UX | Any change to logic, schema, or flows         |
| **PLAN.md**   | Sequence, statuses       | Start/finish/block an iteration; scope shifts |
| **AGENTS.md** | Process, conventions     | New tools/rules, CI/testing/process changes   |

**Every PR** that changes any of the above must include doc edits.
PRs without required doc updates are **rejected**.

---

## 12) Iteration PR Checklist (paste into PR)

* **Iteration:** I<n> — <title> (link to `PLAN.md#iteration-<n>`)
* **Acceptance criteria:** (copy from PLAN)
* **Changes:** schema/migrations, routes, UI components
* **Tests:** unit, API, component (list)
* **Manual validation:** steps + result (screenshots/GIF/cURL)
* **Flags:** which toggles used
* **Docs updated:** PRD / PLAN / AGENTS
* **Rollback:** how to revert safely

---

## 13) Do’s & Don’ts

**Do**

* Build *vertical slices* (DB → API → UI → TTS).
* Keep functions pure; inject time.
* Gate risky behavior with flags.
* Fail soft for LLM/TTS; keep the session flowing.
* Validate everything at API boundaries.

**Don’t**

* Don’t start an iteration without flipping its status to `🟨 In Progress` in `PLAN.md`.
* Don’t ship schema changes without migrations + PRD updates.
* Don’t hardcode times, locales, or thresholds in UI.
* Don’t expose keys or call LLM from the client.
* Don’t introduce text fallbacks for voice (MVP rule).

---

## 14) UI (Kid Mode) Rules

* One primary action per screen (Complete).
* Always show progress and “next task”.
* Urgency cues are subtle; avoid alarming red countdowns.
* Voice is the star; UI supports it.
* Large targets; high contrast option.

---

## 15) Adding/Changing Iterations

1. Propose/change in `PLAN.md` (add iteration with `⬜ Not Started` + criteria + manual script).
2. If it alters behavior or data, update `PRD.md`.
3. If process/tooling shifts, update `AGENTS.md`.
4. Only then implement.

---

## 16) Glossary

* **Today Session**: per-child routine instance (immutable snapshot).
* **Urgency Level**: 0–3 pacing signal informing LLM tone & nudge frequency.
* **Medal**: Gold/Silver/Bronze from timing vs expected.

---

## 17) Edit History

* **v1.0 (2025-10-18)** — Finalized best-practice version: strict PLAN progress tracking, PR gates, contracts, tests, and documentation sync requirements.

---

> **Remember:** The project heartbeat is the trio **PRD / PLAN / AGENTS**.
> If code, tests, and docs don’t tell the same story, fix the story first—then the code.
