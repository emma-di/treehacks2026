# Atria — Project Story

## Inspiration

Hospital scheduling is chaotic: beds, nurses, and patient acuity change constantly, and underresourced sites often lack the data or models to predict demand. We were inspired by the idea that **federated learning** could let hospitals share a global model without sharing raw data—so a small clinic could benefit from patterns learned across a network. We wanted to build something that felt real: a globe showing that network, a 3D floor plan where you could see rooms and schedules, and a pipeline that used **local ML models** (trained on each site’s EHR and flow data) plus **multi-agent AI** to produce patient–room–nurse allocations. We also wanted nurses to have **context before each visit**—conversation summaries, to-dos, and briefings—so the inspiration was both “smarter scheduling” and “smarter handoffs.”

## What it does

**Atria** is a hospital scheduling and allocation demo with a full-stack UI and a Python/CrewAI backend.

- **Home:** A 3D globe shows hospital sites; gold ties connect each site to a “Global Model,” illustrating federated learning. Click a hospital to open its local floor plan. A “How it works” panel explains local models (ITM, TIC), agents, and the global model.

- **Hospital:** Interactive 3D floor plan (rooms R1–R60, 4 floors, 14 rooms per floor). Click a room to see its schedule (patient + nurse visits). Use **“Initiate Scheduling”** to run the pipeline: it reads demo patients from CSV, runs local ML (bed need, length of stay), assigns patients to rooms (first two floors), assigns nurses by certification and load, and writes JSON that the app uses for the floor plan and lists.

- **Patient / Provider:** Patient list with status and timeline; **Provider (nurse) view** with per-nurse schedules. Next to each patient: **Start recording** (capture nurse–patient conversation), **Show summary** (view LLM-generated summaries from past conversations, with prev/next by nurse). **Send briefings** sends a briefing email to a nurse with a todo list (from summaries) and conversation summaries. **Visit reminders** (e.g. 15 minutes before a visit) email the nurse with the same context. **Feedback** lets nurses report overwhelmed, missed visits, acuity; that feedback is stored and applied as load adjustments before the next scheduling run.

- **Certifications:** The pipeline uses nurse qualifications and room risk categories; nurses are matched to patients/rooms that need their certifications most.

- **Agent:** Live event stream (SSE) for pipeline progress; when the pipeline completes, Nurse 1 gets a schedule email (Resend).

Data flow: **my_crew** (Python/CrewAI) reads CSV, runs agents and local models (ITM, TIC), produces allocations and nurse assignments, writes JSON; the Next.js app reads those files and the Agent tab consumes server-sent events from the same pipeline.

## How we built it

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS. **Three.js** for the globe (home) and the 3D hospital floor plan (rooms, floors, occupancy). Framer Motion and custom shaders for the ethereal background. Patient, Provider, and Hospital pages consume schedule data from `my_crew/output/*.json`.

- **Backend / pipeline:** **CrewAI** (Python) for multi-agent orchestration. A CSV-driven pipeline (no LLM for allocation): reads `demo_patients.csv`, runs **Model 1** (bed need / admission probability) and **Model 2** (length of stay), then **room assignment** (alternating first two floors, random room on floor by next availability) and **nurse scheduling** (greedy allocation with certifications and feedback-based load). Output: `final_allocations.json`, `patient_view.json`, `nurse_view.json`, `hospital_space.json`. Optional **voice agent**: transcribes doctor–patient audio (OpenAI), extracts clinical summary for nurse briefings.

- **APIs:** Next.js API routes: `run-scheduling-async` (starts pipeline), `agent-events` (SSE + pipeline_complete → schedule email), `voice-summary` (GET/POST for conversation summaries), `send-nurse-briefing`, `send-visit-reminders`, `nurse-feedback` (store and load adjustments). **Resend** for schedule and briefing emails.

- **Federated learning narrative:** The globe and “How it works” panel describe a shared global model trained across sites; the app doesn’t run FL training but shows the vision (sites connected to the global model).

## Challenges we ran into

- **Integrating many systems:** Wiring Next.js ↔ Python pipeline (async run, SSE, file-based JSON) so the UI updates after “Initiate Scheduling” without blocking. We used an async API that runs `uv run run_from_csv` and streams events; the app reads output JSON and shows loading until data is ready.

- **Room panel not showing:** After scheduling, clicking a room didn’t open the right-side schedule panel until the user switched floors. The right panel had no reserved width in the flex layout. Fix: give the panel `min-width` (e.g. 320px) and `flex-shrink: 0` so it gets space as soon as a room is selected.

- **Nurse certifications and load:** Matching nurses to rooms by risk category and certs while respecting existing load and feedback (overwhelmed, missed visits). We added cert fields to the roster, risk-based required certs per room, and a greedy allocator that scores by cert match and load.

- **Stale data:** The app statically imports output JSON at build time; after a new pipeline run, the user had to refresh to see new schedules. We kept the file-based flow for the demo and used loading/SSE to signal when the pipeline is done so users know when to refresh (or we could add an API that serves the latest JSON).

## Accomplishments that we're proud of

- **End-to-end pipeline:** From CSV → local ML (ITM/TIC) → room assignment (first two floors) → nurse allocation (certs + load + feedback) → JSON → 3D floor plan and Patient/Provider views. One click to “Initiate Scheduling” and see results in the UI.

- **Nurse-centric features:** Voice-backed summaries, briefing and reminder emails with todo lists and conversation history, and a feedback loop that affects the next run. Nurses get context before each visit and can report overload or missed visits.

- **Clear federated story:** The globe and “How it works” make the idea of a global model and local models tangible for judges and users.

- **Certification-aware scheduling:** Rooms and nurses are matched by risk category and qualifications so the right skills are assigned to the right patients.

- **Polished UX:** 3D globe, 3D floor plan with room schedules, loading states, and Atria branding across the app and emails.

## What we learned

- **CrewAI** is effective for orchestrating multi-step pipelines (risk, allocation, output writing) and can be driven by CSV + local models without calling an LLM for every decision.
- **Local vs global models:** Presenting federated learning in the UI helped us think about how underresourced sites could use a global model while keeping data local.
- **Flex layout and Three.js:** Combining a responsive flex layout with a 3D canvas required careful handling of min-width and reflow so the schedule panel always had space when a room was selected.
- **Feedback as data:** Storing nurse feedback and feeding it back into load for the next run made the system feel responsive to real-world conditions.

## What's next for Atria

- **More sites on the globe:** Wire multiple “hospitals” to different pipelines or configs so the globe truly represents a network.
- **Live refresh:** After the pipeline completes, automatically reload schedule data (e.g. API that reads output JSON) so users don’t have to manually refresh.
- **Real federated training:** Integrate or simulate FL so the “Global Model” is updated from local model updates (e.g. gradients or weights) from each site.
- **Production hardening:** Auth, rate limits, and deployment for the scheduling API and email services; optional queue (e.g. Redis) for pipeline jobs.
- **Richer voice integration:** Tie voice summaries directly to the pipeline (e.g. acuity or risk from conversation) and more languages / modalities for nurse briefings.
