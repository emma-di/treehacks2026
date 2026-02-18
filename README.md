# Atria

**Atria** is a hospital scheduling and allocation demo that combines **local ML models** (trained on each site’s EHR and flow data), **multi-agent orchestration** (CrewAI), and **federated learning** (a shared global model). The UI lets you explore the global network, run the scheduling pipeline, and view floor plans, patient lists, and provider schedules driven by the same data.

---

## What the project does

- **Home:** A 3D globe shows hospital sites; gold ties connect each site to the “Global Model.” You can open a **“How it works”** panel that explains local models, agents, and federated learning.
- **Hospital:** Click a hospital on the globe to open its **floor plan** (3D map + room schedule). You can run the **scheduling pipeline** from the header to generate patient/room/nurse allocations; output is written to `my_crew/output/` and reflected in the app.
- **Patient / Provider / Agent:** Patient list and statuses, provider (nurse) schedules, and a live **Agent** event stream for pipeline progress. When the pipeline completes, **Nurse 1** receives an **email** with their schedule (Resend).

Data flow: **my_crew** (Python/CrewAI) reads CSV, runs agents and local models (ITM, TIC), produces allocations and nurse assignments, writes JSON; the Next.js app reads those JSON files and the Agent tab consumes server-sent events from the same pipeline.

---

## Tech stack

- **Next.js 16** (App Router), **React 19**, **TypeScript**, **Tailwind CSS**
- **Three.js** for the globe and hospital 3D floor plan
- **Resend** + **@react-email/components** for schedule emails
- **Framer Motion** for the ethereal background
- **my_crew:** Python (CrewAI, pandas, etc.) for the scheduling pipeline; **uv** to run it

---

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Optional: scheduling pipeline and email

- **Pipeline:** Install [uv](https://docs.astral.sh/uv/), then from the **Hospital** page use **“Initiate Scheduling”** in the header. The pipeline runs in the background and writes to `my_crew/output/` (and streams events to the Agent tab).
- **Schedule email:** Set in `.env.local`:
  - `RESEND_API_KEY` – required for sending the Nurse 1 schedule email when the pipeline completes.
  - `ATRIA_LOGO_URL` – optional; URL to a logo image used in the email.

---

## Walkthrough: Home page

The home page is the main entry point. It explains the system and lets you jump into a hospital.

### 1. Globe and hospital sites

- The **3D globe** shows hospital sites as points on the sphere.
- **Gold ties** connect each site to the **“Global Model”** label above the globe. These ties represent participation in **federated learning**: each site can contribute to (and use) the shared global model.
- **Labels** on the front of the globe are white with a gold border; labels on the back appear as translucent navy so they don’t obscure the view.
- You can **click a hospital** to go to its floor plan and local system (`/hospital/local`).

### 2. “How it works” panel

Click **“How it works”** (with the info icon) to open a slide-in panel that describes the system in three layers:

- **Local level models**
  - **Inpatient Transition Model (ITM):** Trained on local EHR data; predicts odds of ED → inpatient admission.
  - **Time in Care Model (TIC):** Trained on local length-of-stay and flow data; predicts time in care given inpatient from ED.
- **Agents / process**
  - Gather patient data → Resource agent (hospital context) → **Orchestrator agent**, which:
    - Calls the risk agent (using the two models above), and
    - Allocates / makes the schedule.
- **Global level: federated learning**
  - A **global model** is trained in a federated way across sites. Hospitals without a strong local model (e.g. underresourced) can use this global model.

The note at the bottom ties this back to the globe: *“The ties on the globe indicate when a site participates in training the global model.”*

### 3. Layout and visuals

- The globe sits in a **rounded oval** on a **gold ethereal background** (animated). The rest of the app uses Atria branding (e.g. header logo, “Atria” name).
- Closing the panel returns to a single-column layout with the globe and the “Click a hospital…” hint.

---

## Rest of the app

| Route / area      | What it does |
|-------------------|--------------|
| **Hospital**      | 3D floor plan (rooms R1–R60 by floor), room schedule panel, “Initiate Scheduling” runs the pipeline. |
| **Patient**       | Patient list (scheduled / unscheduled), status, and timeline from `patient_view` / schedule data. |
| **Provider**       | Nurse/doctor list and **nurse schedules** (room, time, patient) from `nurse_view` and allocations. |
| **Agent**         | Live event stream (SSE) for pipeline events (e.g. pipeline_start, patient_complete, pipeline_complete). |
| **Schedule email**| On `pipeline_complete`, the app sends an email to Nurse 1 (e.g. emma.tingyu@gmail.com) with their schedule (Atria-branded, with briefings and to-dos). |

Schedule data is loaded from `my_crew/output/*.json` (e.g. `patient_view.json`, `nurse_view.json`, `hospital_space.json`). Placeholder JSON files are included so the app builds and runs even if the pipeline hasn’t been executed.

---

## Project structure (relevant parts)

```
app/
  page.tsx              # Home: globe, “How it works” panel
  layout.tsx            # Root layout, Atria title
  agent/page.tsx       # Agent event stream UI
  hospital/local/       # Hospital floor plan + scheduling
  patient/page.tsx      # Patient list view
  provider/page.tsx     # Provider (nurse) schedules
  components/
    Globe3D.tsx         # 3D globe, ties, labels
    AtriaLogo.tsx       # Atria logo (SVG)
    FloorPlanGrid.tsx   # Wraps 3D map + room schedule
    HospitalMap3D.tsx   # 3D floor plan (rooms, beds)
    PatientView.tsx     # Patient list and detail
    ProviderView.tsx    # Provider schedule
    schedule-email-template.tsx  # Email template (Atria)
  api/
    agent-events/       # SSE + POST events; triggers schedule email on pipeline_complete
    run-scheduling-async/  # Starts my_crew pipeline (uv run run_from_csv)
    send-schedule-email/   # Sends Nurse 1 schedule email (Resend)
  lib/
    scheduleData.ts     # Reads my_crew output JSON, helpers (formatTime, getNurseAssignments, etc.)
my_crew/                # Python scheduling pipeline (CrewAI, ITM/TIC, nurse scheduling)
```

---

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [Resend](https://resend.com) for email
- [CrewAI](https://crewai.com) for the agent pipeline
