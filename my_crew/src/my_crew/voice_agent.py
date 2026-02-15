"""
Voice agent: transcribe doctor–patient conversation and extract clinically relevant info
for the nurse briefing. Uses OpenAI gpt-4o-transcribe and an LLM to summarize.

Flow: audio file → transcription → LLM extraction → clinical summary → inform nurse briefing.
"""

from __future__ import annotations

import logging
from io import BytesIO
from pathlib import Path

logger = logging.getLogger(__name__)

# Optional: OpenAI client (add openai to pyproject.toml if not present)
try:
    from openai import OpenAI
except ImportError:
    OpenAI = None  # type: ignore[misc, assignment]


# System prompt for extracting clinically relevant information for nurses
CLINICAL_EXTRACT_SYSTEM = """You are a clinical documentation assistant. Given a transcription of a conversation between a doctor and a patient, extract only the information that is clinically relevant for a nurse who will check on the patient later. Output a concise summary (2–5 sentences) that includes:
- Chief complaint or reason for visit
- Key symptoms or concerns mentioned by the patient
- Relevant findings or plans mentioned by the doctor (e.g., tests ordered, medications, follow-up)
- Any specific instructions or precautions the nurse should know

Write in plain language suitable for a nurse briefing. Do not include small talk or non-clinical content. If the transcription is empty or unintelligible, respond with "No clinically relevant information extracted."
"""


def transcribe_audio(audio_path: str | Path, model: str | None = None) -> str:
    """
    Transcribe an audio file (doctor–patient conversation) using OpenAI.
    Uses gpt-4o-transcribe by default; falls back to whisper-1 if the file is rejected
    (e.g. "corrupted or unsupported"). Pass model= to force a specific model.
    Returns raw transcription text.
    """
    if OpenAI is None:
        raise RuntimeError("openai package is required for voice agent. Install with: pip install openai")
    path = Path(audio_path).resolve()
    if not path.exists():
        raise FileNotFoundError(f"Audio file not found: {path}")
    # Load into BytesIO with explicit .name so API recognizes format (fixes "Invalid file format")
    data = path.read_bytes()
    if not data:
        raise ValueError(f"Audio file is empty: {path}")
    file_obj = BytesIO(data)
    file_obj.name = path.name
    client = OpenAI()
    model = model or "gpt-4o-transcribe"
    try:
        transcription = client.audio.transcriptions.create(
            model=model,
            file=file_obj,
        )
    except Exception as e:
        err_str = str(e).lower()
        # Many files rejected by gpt-4o-transcribe work with whisper-1
        if "corrupted" in err_str or "unsupported" in err_str or "invalid" in err_str:
            if model == "gpt-4o-transcribe":
                logger.warning("gpt-4o-transcribe rejected file, retrying with whisper-1: %s", e)
                file_obj = BytesIO(data)
                file_obj.name = path.name
                transcription = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=file_obj,
                )
                model = "whisper-1"
            else:
                raise
        else:
            raise
    text = getattr(transcription, "text", None) or str(transcription)
    logger.info("Voice agent: transcribed %s chars from %s (model=%s)", len(text), path.name, model)
    return text.strip()


def extract_clinical_info(transcription_text: str) -> str:
    """
    Use an LLM to extract clinically relevant information from the transcription
    for the nurse briefing. Returns a short summary (2–5 sentences).
    """
    if OpenAI is None:
        raise RuntimeError("openai package is required for voice agent. Install with: pip install openai")
    if not (transcription_text or "").strip():
        return "No clinically relevant information extracted."
    client = OpenAI()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": CLINICAL_EXTRACT_SYSTEM},
            {"role": "user", "content": transcription_text},
        ],
        max_tokens=400,
    )
    summary = (response.choices[0].message.content or "").strip()
    logger.info("Voice agent: extracted clinical summary %s chars", len(summary))
    return summary


def get_clinical_summary_from_voice(audio_path: str | Path) -> str:
    """
    Full pipeline: transcribe the audio, then extract clinically relevant info with the LLM.
    Returns a nurse-oriented clinical summary suitable for appending to the nurse briefing.
    """
    transcription = transcribe_audio(audio_path)
    return extract_clinical_info(transcription)


def enhance_nurse_briefing(base_briefing: str, voice_clinical_summary: str | None) -> str:
    """
    Merge the base nurse briefing (from risk models) with voice-derived clinical context.
    When voice_clinical_summary is None or empty, returns base_briefing unchanged.
    """
    if not (voice_clinical_summary or "").strip():
        return base_briefing
    return (
        base_briefing.rstrip(".")
        + ". From doctor–patient conversation: "
        + voice_clinical_summary.strip()
    )
