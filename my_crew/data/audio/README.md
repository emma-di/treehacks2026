# Audio files (doctor–patient conversations)

Put recordings of doctor–patient conversations here for the **voice agent** to transcribe and use in nurse briefings.

- **Supported:** Any format supported by OpenAI `gpt-4o-transcribe` (e.g. `.mp3`, `.m4a`, `.wav`, `.webm`).
- **Naming:** Use a name that you can map to a patient (e.g. `patient_0.mp3`, `encounter_E001.mp3`, or by encounter_id).
- **Usage:**
  - CLI: `uv run run_voice_agent data/audio/patient_0.mp3`
  - In pipeline: pass `voice_audio_path="data/audio/patient_0.mp3"` (or full path) to `get_risk_for_row()`.

Audio files in this folder are ignored by git by default (see project `.gitignore`).
