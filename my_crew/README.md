# MyCrew Crew

Welcome to the MyCrew Crew project, powered by [crewAI](https://crewai.com). This template is designed to help you set up a multi-agent AI system with ease, leveraging the powerful and flexible framework provided by crewAI. Our goal is to enable your agents to collaborate effectively on complex tasks, maximizing their collective intelligence and capabilities.

## Installation

Ensure you have Python >=3.10 <3.14 installed on your system. This project uses [UV](https://docs.astral.sh/uv/) for dependency management and package handling, offering a seamless setup and execution experience.

First, if you haven't already, install uv:

```bash
pip install uv
```

Next, navigate to your project directory and install the dependencies:

(Optional) Lock the dependencies and install them by using the CLI command:
```bash
crewai install
```

**macOS: LightGBM (Model 2) needs OpenMP.** If you see `Library not loaded: @rpath/libomp.dylib` when running the CSV pipeline, install libomp:
```bash
brew install libomp
```
Place your `.pkl` model files in `my_crew/saved_models/` (e.g. `task1_fl_model.pkl`, `task2_fl_model.pkl`).

**Model 2 (length of stay) input format** follows the training script (`train_2.py`): features are the CSV with `encounter_id` and `LoS` dropped; categorical columns use `fillna('missing')` then label encoding; then `fillna(0)` and float. For correct feature order and count, you can pass a reference CSV (e.g. `data/train_client_1_task_2.csv` or `data/test_task_2.csv`) when creating `ModelInference`: `ModelInference(demo_patients_path=..., task2_reference_csv="path/to/train_client_1_task_2.csv")`. The pipeline will then build the feature vector in the same column order as the training data (missing columns filled with 0).

### Customizing

**Add your `OPENAI_API_KEY` into the `.env` file**

- Modify `src/my_crew/config/agents.yaml` to define your agents
- Modify `src/my_crew/config/tasks.yaml` to define your tasks
- Modify `src/my_crew/crew.py` to add your own logic, tools and specific args
- Modify `src/my_crew/main.py` to add custom inputs for your agents and tasks

## Running the Project

To kickstart your crew of AI agents and begin task execution, run this from the root folder of your project:

```bash
$ crewai run
```

This command initializes the my_crew Crew, assembling the agents and assigning them tasks as defined in your configuration.

### Test scenarios (more complicated examples)

You can run the crew with different scenarios via the `CREWAI_SCENARIO` environment variable:

| Scenario   | Description |
|-----------|-------------|
| `default` | Moderate risk (Observation), small roster and map. |
| `critical` | High acuity (Critical): sepsis, declining vitals, ICU-only staff and Negative Pressure/Isolation rooms. |
| `complex` | Large staff roster, many rooms, mixed certs and loads; CHF exacerbation, multiple feasible options. |
| `waitlist` | No feasible options (ICU rooms occupied, General only); tests priority queue / waitlist path. |
| `multi` | **Multiple patients** (A, B, C): orchestrator produces **one assignment per patient** via batch tool; no double-booking. |

Examples:

```bash
# Default (Observation, small example)
crewai run

# Critical patient (ICU, Negative Pressure/Isolation)
CREWAI_SCENARIO=critical crewai run

# Complex (many nurses/rooms, Observation)
CREWAI_SCENARIO=complex crewai run

# Waitlist (no room ready – tests waitlist position by risk score)
CREWAI_SCENARIO=waitlist crewai run

# Multi-patient (one assignment per patient; batch allocation, no double-booking)
CREWAI_SCENARIO=multi crewai run
```

### CSV-driven pipeline (no LLM)

Run the scheduler from **demo_patients.csv**: one patient per row, model 1 (bed need) → if >35% then model 2 (length of stay), then room assignment and nurse schedule for the **next 12 hours only** (4 different nurses per occupied room, 15/20/30 min slots). Start/stop are floats in hours; unassigned use -1.

```bash
# From my_crew directory (after uv install / crewai install)
uv run run_from_csv
# or
python -m my_crew.main  # then call run_from_csv() from code
```

Optional env: `CREWAI_CSV_PATH`, `CREWAI_ROOM_IDS` (comma-separated), `CREWAI_ROSTER` (JSON array of `{ "name", "load" }`). Output is written to **`output/`**: `final_allocations.json`, `patient_view.json`, `nurse_view.json`, `hospital_space.json`.

### Voice agent (doctor–patient conversation → nurse briefing)

A separate **voice agent** transcribes doctor–patient conversations and uses an LLM to extract clinically relevant information for the nurse briefing. Flow: **audio file → OpenAI gpt-4o-transcribe → LLM extraction → clinical summary → merged into nurse briefing** so nurses have more context before checking on the patient.

- **Where to put audio:** Use **`my_crew/data/audio/`** for doctor–patient recordings (e.g. `data/audio/patient_0.mp3`). See `data/audio/README.md`.
- **Requires:** `OPENAI_API_KEY` in `.env` and `openai` (included in dependencies).
- **CLI:** Run from the **`my_crew`** directory. Transcribe and extract clinical summary from an audio file:
  ```bash
  cd my_crew
  uv run run_voice_agent data/audio/audio.mp3
  ```
- **In the pipeline:** When calling `get_risk_for_row()` you can pass `voice_audio_path="data/audio/patient_0.mp3"` (or the full path); the nurse briefing will be enhanced with the voice-derived summary (e.g. chief complaint, symptoms, plan, precautions).

### Output files

After each run, final allocations are written under **`output/`** (relative to the project root):

| File | Description |
|------|-------------|
| `output/final_allocations.json` | Full orchestrator output: one record per assigned patient (patient, room, nurse_rounds). |
| `output/nurse_view.json` | Nurse-centric view: each nurse with their check rounds (patient_id, room_id, start, stop in hours). |
| `output/patient_view.json` | Patient-centric view: each patient with room, start/stop, and nurse_rounds. |

## Understanding Your Crew

The my_crew Crew is composed of multiple AI agents, each with unique roles, goals, and tools. These agents collaborate on a series of tasks, defined in `config/tasks.yaml`, leveraging their collective skills to achieve complex objectives. The `config/agents.yaml` file outlines the capabilities and configurations of each agent in your crew.

## Support

For support, questions, or feedback regarding the MyCrew Crew or crewAI.
- Visit our [documentation](https://docs.crewai.com)
- Reach out to us through our [GitHub repository](https://github.com/joaomdmoura/crewai)
- [Join our Discord](https://discord.com/invite/X4JWnZnxPb)
- [Chat with our docs](https://chatg.pt/DWjSBZn)

Let's create wonders together with the power and simplicity of crewAI.
