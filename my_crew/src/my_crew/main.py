#!/usr/bin/env python
import json
import os
import sys
import warnings

from my_crew.crew import MyCrew
from my_crew.csv_pipeline import run_csv_pipeline, write_pipeline_output
from my_crew.output_writer import write_allocation_output

warnings.filterwarnings("ignore", category=SyntaxWarning, module="pysbd")

# Directory for final allocation output files (final_allocations.json, nurse_view.json, patient_view.json)
# Resolved relative to my_crew package root so output/ appears next to src/, data/, etc.
_OUTPUT_DIR_REL = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "output")
OUTPUT_DIR = os.path.abspath(_OUTPUT_DIR_REL)

# This main file is intended to be a way for you to run your
# crew locally, so refrain from adding unnecessary logic into this file.
# Replace with inputs you want to test with, it will automatically
# interpolate any tasks and agents information

# ---------------------------------------------------------------------------
# Scenario: default (moderate risk, observation)
# ---------------------------------------------------------------------------
SAMPLE_CLINICAL_RECORDS = """
Structured:
- Vitals (last 24h): HR 72–88, BP 118/76–132/84, SpO2 96–98%, Temp 36.8–37.2°C
- Meds: Lisinopril 10mg daily, Metformin 500mg BID, Aspirin 81mg daily
- Labs: HbA1c 7.2%, Creatinine 1.1, eGFR 72, WBC 8.2, Hgb 12.4

Unstructured (physician notes / lab history):
- Admitted for observation after fall; no fracture. History of Type 2 DM, HTN.
- Last HbA1c 3 months ago 7.4%; renal function stable. No recent infections.
"""

SAMPLE_REAL_TIME_VITALS = """
Trends (last 2 hours):
- Heart rate: 78 → 82 → 85 → 88 (gradual rise)
- SpO2: 97% → 95% → 93% → 91% (declining over 2h)
- Blood pressure: 128/80 → 132/82 → 138/84 (slight rise)
"""

# Sample inputs for the Resource Agent task (staff roster + hospital map)
SAMPLE_STAFF_ROSTER = """[
  {"name": "Sarah", "certifications": ["ICU-certified", "ER-specialist"], "current_load": 2},
  {"name": "James", "certifications": ["ICU-certified"], "current_load": 4},
  {"name": "Maria", "certifications": ["ER-specialist", "General"], "current_load": 3},
  {"name": "David", "certifications": ["General"], "current_load": 5}
]"""

SAMPLE_HOSPITAL_MAP = """[
  {"room_id": "302", "room_type": "Isolation", "available": true, "equipment": ["ventilator"]},
  {"room_id": "205", "room_type": "Negative Pressure", "available": true, "equipment": []},
  {"room_id": "101", "room_type": "General", "available": true, "equipment": []},
  {"room_id": "410", "room_type": "General", "available": false, "equipment": []}
]"""

SAMPLE_RISK_PROFILE_CONTEXT = """
Risk category: Observation. Prefer nurses with ICU-certified or ER-specialist certification.
Allowed room types: Isolation, Negative Pressure, or General. Prefer nurses with lowest current load (max_nurse_load 5).
"""

# Encounter ID for Risk Agent model tools (must exist in data/demo_patients.csv; UUIDs from your demo_patients.csv)
SAMPLE_ENCOUNTER_ID = "cabced5f-8a58-4c55-9976-f544a9885196"
# Sample inputs for the Orchestrator Agent task (risk profile + feasibility)
SAMPLE_PATIENT_ID = "Patient A"
SAMPLE_RISK_PROFILE_JSON = '{"risk_profile": {"numeric_score": 0.4, "risk_category": "Observation"}, "predicted_duration_of_stay": "24-48 hours"}'
SAMPLE_FEASIBILITY_LIST = """Feasibility list:
- Room 302 (Isolation) is open and Nurse Sarah has current load 2 and the correct certification for this risk profile.
- Room 205 (Negative Pressure) is open and Nurse James has current load 4 and the correct certification for this risk profile.
- Room 101 (General) is open and Nurse Maria has current load 3 and the correct certification for this risk profile."""
SAMPLE_FEASIBILITY_OPTIONS = """[
  {"nurse_name": "Sarah", "room_id": "302", "room_type": "Isolation", "nurse_load": 2},
  {"nurse_name": "James", "room_id": "205", "room_type": "Negative Pressure", "nurse_load": 4},
  {"nurse_name": "Maria", "room_id": "101", "room_type": "General", "nurse_load": 3}
]"""

# ---------------------------------------------------------------------------
# Scenario: critical (high acuity, multi-system, declining vitals)
# ---------------------------------------------------------------------------
CRITICAL_CLINICAL_RECORDS = """
Structured:
- Vitals (last 6h): HR 98–118, BP 88/52–102/68, SpO2 88–94%, Temp 38.2–39.1°C, Lactate 3.2, Cr 2.4 (rising), WBC 18.4, Platelets 82k
- Meds: Norepinephrine 0.15 mcg/kg/min, Vancomycin 1g q12h, Piperacillin-tazobactam 4.5g q6h, Insulin drip, Fentanyl drip
- Labs: pH 7.28, HCO3 16, K 5.6, BUN 48, Bilirubin 4.2, INR 1.8, D-dimer elevated

Unstructured (physician notes / lab history):
- Sepsis with acute kidney injury and possible DIC. Admitted from ED after collapse at home.
- CT abdomen: no obvious source; line sepsis being ruled out. Nephrology and ICU consulted.
- Family updated on critical status; goals of care discussion pending.
"""

CRITICAL_REAL_TIME_VITALS = """
Trends (last 1 hour):
- Heart rate: 112 → 118 → 124 (sustained tachycardia)
- SpO2: 92% → 90% → 88% on 6L NC (declining; consider HFNC or escalation)
- Blood pressure: 98/62 → 92/58 → 88/54 (hypotension despite pressors)
- Urine output: <10 mL/h last 2h
"""

CRITICAL_STAFF_ROSTER = """[
  {"name": "Miller", "certifications": ["ICU-certified", "ACLS", "CRRT"], "current_load": 1},
  {"name": "Chen", "certifications": ["ICU-certified", "ER-specialist"], "current_load": 2},
  {"name": "O'Brien", "certifications": ["ICU-certified"], "current_load": 3},
  {"name": "Sarah", "certifications": ["ICU-certified", "ER-specialist"], "current_load": 2},
  {"name": "James", "certifications": ["ICU-certified"], "current_load": 4}
]"""

CRITICAL_HOSPITAL_MAP = """[
  {"room_id": "405", "room_type": "Negative Pressure", "available": true, "equipment": ["ventilator", "monitor"]},
  {"room_id": "412", "room_type": "Isolation", "available": true, "equipment": ["ventilator"]},
  {"room_id": "302", "room_type": "Isolation", "available": false, "equipment": ["ventilator"]},
  {"room_id": "205", "room_type": "Negative Pressure", "available": true, "equipment": []},
  {"room_id": "101", "room_type": "General", "available": true, "equipment": []}
]"""

CRITICAL_RISK_PROFILE_CONTEXT = """
Risk category: Critical. Require ICU-certified nurses only. Room types: Negative Pressure or Isolation only (infectious/septic precautions). Max nurse load 3.
"""

CRITICAL_PATIENT_ID = "Patient B"
CRITICAL_RISK_PROFILE_JSON = '{"risk_profile": {"numeric_score": 0.92, "risk_category": "Critical"}, "predicted_duration_of_stay": "5-7 days"}'
CRITICAL_FEASIBILITY_LIST = """Feasibility list (Critical – ICU only, Negative Pressure/Isolation):
- Room 405 (Negative Pressure) is open and Nurse Miller has current load 1 and the correct certification.
- Room 412 (Isolation) is open and Nurse Chen has current load 2 and the correct certification.
- Room 205 (Negative Pressure) is open and Nurse O'Brien has current load 3 and the correct certification."""
CRITICAL_FEASIBILITY_OPTIONS = """[
  {"nurse_name": "Miller", "room_id": "405", "room_type": "Negative Pressure", "nurse_load": 1},
  {"nurse_name": "Chen", "room_id": "412", "room_type": "Isolation", "nurse_load": 2},
  {"nurse_name": "O'Brien", "room_id": "205", "room_type": "Negative Pressure", "nurse_load": 3}
]"""

# ---------------------------------------------------------------------------
# Scenario: complex (large roster, many rooms, mixed certs and loads)
# ---------------------------------------------------------------------------
COMPLEX_CLINICAL_RECORDS = """
Structured:
- Vitals (last 24h): HR 82–96, BP 108/68–128/82, SpO2 94–98%, Temp 37.0–37.8°C
- Meds: Amlodipine 5mg, Atorvastatin 20mg, Apixaban 5mg BID, Metformin 1000mg BID
- Labs: HbA1c 8.1%, Creatinine 1.4, eGFR 52, Troponin negative, BNP 320, Echo: EF 45%, moderate MR

Unstructured (physician notes / lab history):
- CHF exacerbation with volume overload; diuresis ongoing. History of AF on anticoagulation, DM2, CKD stage 3a.
- Rule-out ACS; troponin trend negative. Cardiology following. May need step-down if O2 weans.
- Social: lives alone; PT/OT evaluating for disposition.
"""

COMPLEX_REAL_TIME_VITALS = """
Trends (last 4 hours):
- Heart rate: 88 → 84 → 82 (improving with rate control)
- SpO2: 95% on 2L NC → 96% on 2L → 97% room air (weaning)
- Blood pressure: 118/76 → 122/78 → 126/80 (stable)
- Weight: down 1.2 kg from admission (diuresis)
"""

COMPLEX_STAFF_ROSTER = """[
  {"name": "Sarah", "certifications": ["ICU-certified", "ER-specialist"], "current_load": 2},
  {"name": "James", "certifications": ["ICU-certified"], "current_load": 4},
  {"name": "Maria", "certifications": ["ER-specialist", "General"], "current_load": 3},
  {"name": "David", "certifications": ["General"], "current_load": 5},
  {"name": "Miller", "certifications": ["ICU-certified", "ACLS"], "current_load": 1},
  {"name": "Chen", "certifications": ["ICU-certified", "ER-specialist"], "current_load": 2},
  {"name": "Patel", "certifications": ["ER-specialist", "General"], "current_load": 4},
  {"name": "Kim", "certifications": ["General"], "current_load": 3}
]"""

COMPLEX_HOSPITAL_MAP = """[
  {"room_id": "302", "room_type": "Isolation", "available": true, "equipment": ["ventilator"]},
  {"room_id": "205", "room_type": "Negative Pressure", "available": true, "equipment": []},
  {"room_id": "101", "room_type": "General", "available": true, "equipment": []},
  {"room_id": "104", "room_type": "General", "available": true, "equipment": []},
  {"room_id": "303", "room_type": "Isolation", "available": false, "equipment": []},
  {"room_id": "406", "room_type": "Negative Pressure", "available": true, "equipment": ["monitor"]},
  {"room_id": "201", "room_type": "General", "available": true, "equipment": []}
]"""

COMPLEX_RISK_PROFILE_CONTEXT = """
Risk category: Observation / High. Prefer ICU or ER-specialist certification. Room types: Isolation, Negative Pressure, or General. Max nurse load 5.
"""

COMPLEX_PATIENT_ID = "Patient C"
COMPLEX_RISK_PROFILE_JSON = '{"risk_profile": {"numeric_score": 0.55, "risk_category": "Observation"}, "predicted_duration_of_stay": "3-5 days"}'
COMPLEX_FEASIBILITY_LIST = """Feasibility list (many options):
- Room 302 (Isolation): Nurse Sarah (load 2), Nurse Miller (load 1), Nurse Chen (load 2).
- Room 205 (Negative Pressure): Nurse James (load 4), Nurse Miller (load 1).
- Room 101 (General): Nurse Maria (load 3), Nurse Patel (load 4), Nurse Kim (load 3).
- Room 104 (General): Nurse David (load 5), Nurse Kim (load 3).
- Room 406 (Negative Pressure): Nurse Miller (load 1), Nurse Chen (load 2).
- Room 201 (General): Nurse Maria (load 3), Nurse Patel (load 4)."""
COMPLEX_FEASIBILITY_OPTIONS = """[
  {"nurse_name": "Sarah", "room_id": "302", "room_type": "Isolation", "nurse_load": 2},
  {"nurse_name": "Miller", "room_id": "302", "room_type": "Isolation", "nurse_load": 1},
  {"nurse_name": "Chen", "room_id": "302", "room_type": "Isolation", "nurse_load": 2},
  {"nurse_name": "James", "room_id": "205", "room_type": "Negative Pressure", "nurse_load": 4},
  {"nurse_name": "Miller", "room_id": "205", "room_type": "Negative Pressure", "nurse_load": 1},
  {"nurse_name": "Maria", "room_id": "101", "room_type": "General", "nurse_load": 3},
  {"nurse_name": "Miller", "room_id": "406", "room_type": "Negative Pressure", "nurse_load": 1},
  {"nurse_name": "Chen", "room_id": "406", "room_type": "Negative Pressure", "nurse_load": 2},
  {"nurse_name": "Kim", "room_id": "201", "room_type": "General", "nurse_load": 3}
]"""

# ---------------------------------------------------------------------------
# Scenario: waitlist (no feasible options – tests priority queue path)
# ---------------------------------------------------------------------------
WAITLIST_CLINICAL_RECORDS = """
Structured:
- Vitals: HR 102, BP 95/60, SpO2 89% on 4L NC, Temp 38.8°C
- Meds: Broad-spectrum antibiotics, fluids, pressors considered
- Labs: WBC 22, Lactate 4.1, Cr rising

Unstructured:
- Severe sepsis; ICU bed requested. No isolation or negative pressure beds available at this time.
"""

WAITLIST_REAL_TIME_VITALS = """
Trends: SpO2 declining, BP labile. ICU transfer pending bed availability.
"""

WAITLIST_STAFF_ROSTER = """[
  {"name": "Miller", "certifications": ["ICU-certified"], "current_load": 3},
  {"name": "Chen", "certifications": ["ICU-certified"], "current_load": 3}
]"""

WAITLIST_HOSPITAL_MAP = """[
  {"room_id": "405", "room_type": "Negative Pressure", "available": false, "equipment": []},
  {"room_id": "412", "room_type": "Isolation", "available": false, "equipment": []},
  {"room_id": "101", "room_type": "General", "available": true, "equipment": []}
]"""

WAITLIST_RISK_PROFILE_CONTEXT = """
Risk category: Critical. Require ICU-certified and Negative Pressure or Isolation only. No general beds for this acuity.
"""

WAITLIST_PATIENT_ID = "Patient D"
WAITLIST_RISK_PROFILE_JSON = '{"risk_profile": {"numeric_score": 0.88, "risk_category": "Critical"}, "predicted_duration_of_stay": "unknown"}'
WAITLIST_FEASIBILITY_LIST = """No feasible options: all ICU-capable rooms are occupied. Patient must be placed on waitlist by risk score."""
WAITLIST_FEASIBILITY_OPTIONS = "[]"

# Multi-patient scenario: three patients, one assignment each (batch)
MULTI_PATIENTS_JSON = json.dumps([
    {"patient_id": "Patient A", "risk_profile": SAMPLE_RISK_PROFILE_JSON, "feasibility_options": SAMPLE_FEASIBILITY_OPTIONS},
    {"patient_id": "Patient B", "risk_profile": CRITICAL_RISK_PROFILE_JSON, "feasibility_options": CRITICAL_FEASIBILITY_OPTIONS},
    {"patient_id": "Patient C", "risk_profile": COMPLEX_RISK_PROFILE_JSON, "feasibility_options": COMPLEX_FEASIBILITY_OPTIONS},
])


def get_inputs(scenario: str = "default"):
    """Return inputs dict for the given scenario. Use CREWAI_SCENARIO env var or pass scenario name."""
    # Build patients_json (one per patient) for orchestrator: one assignment per patient
    default_patients = json.dumps([{"patient_id": SAMPLE_PATIENT_ID, "risk_profile": SAMPLE_RISK_PROFILE_JSON, "feasibility_options": SAMPLE_FEASIBILITY_OPTIONS}])
    critical_patients = json.dumps([{"patient_id": CRITICAL_PATIENT_ID, "risk_profile": CRITICAL_RISK_PROFILE_JSON, "feasibility_options": CRITICAL_FEASIBILITY_OPTIONS}])
    complex_patients = json.dumps([{"patient_id": COMPLEX_PATIENT_ID, "risk_profile": COMPLEX_RISK_PROFILE_JSON, "feasibility_options": COMPLEX_FEASIBILITY_OPTIONS}])
    waitlist_patients = json.dumps([{"patient_id": WAITLIST_PATIENT_ID, "risk_profile": WAITLIST_RISK_PROFILE_JSON, "feasibility_options": WAITLIST_FEASIBILITY_OPTIONS}])

    scenarios = {
        "default": {
            "encounter_id": SAMPLE_ENCOUNTER_ID,
            "clinical_records": SAMPLE_CLINICAL_RECORDS,
            "real_time_vitals": SAMPLE_REAL_TIME_VITALS,
            "staff_roster": SAMPLE_STAFF_ROSTER,
            "hospital_map": SAMPLE_HOSPITAL_MAP,
            "risk_profile_context": SAMPLE_RISK_PROFILE_CONTEXT,
            "patient_id": SAMPLE_PATIENT_ID,
            "risk_profile": SAMPLE_RISK_PROFILE_JSON,
            "feasibility_list": SAMPLE_FEASIBILITY_LIST,
            "feasibility_options": SAMPLE_FEASIBILITY_OPTIONS,
            "patients_json": default_patients,
        },
        "critical": {
            "encounter_id": "644e8f9e-d2bc-41bc-a0a8-dbeefaac4bcf",
            "clinical_records": CRITICAL_CLINICAL_RECORDS,
            "real_time_vitals": CRITICAL_REAL_TIME_VITALS,
            "staff_roster": CRITICAL_STAFF_ROSTER,
            "hospital_map": CRITICAL_HOSPITAL_MAP,
            "risk_profile_context": CRITICAL_RISK_PROFILE_CONTEXT,
            "patient_id": CRITICAL_PATIENT_ID,
            "risk_profile": CRITICAL_RISK_PROFILE_JSON,
            "feasibility_list": CRITICAL_FEASIBILITY_LIST,
            "feasibility_options": CRITICAL_FEASIBILITY_OPTIONS,
            "patients_json": critical_patients,
        },
        "complex": {
            "encounter_id": "85a9a3b1-2ef1-4dbe-ace9-b856751ad156",
            "clinical_records": COMPLEX_CLINICAL_RECORDS,
            "real_time_vitals": COMPLEX_REAL_TIME_VITALS,
            "staff_roster": COMPLEX_STAFF_ROSTER,
            "hospital_map": COMPLEX_HOSPITAL_MAP,
            "risk_profile_context": COMPLEX_RISK_PROFILE_CONTEXT,
            "patient_id": COMPLEX_PATIENT_ID,
            "risk_profile": COMPLEX_RISK_PROFILE_JSON,
            "feasibility_list": COMPLEX_FEASIBILITY_LIST,
            "feasibility_options": COMPLEX_FEASIBILITY_OPTIONS,
            "patients_json": complex_patients,
        },
        "waitlist": {
            "encounter_id": "8db55a98-2954-4f41-a13b-951fe709ace2",
            "clinical_records": WAITLIST_CLINICAL_RECORDS,
            "real_time_vitals": WAITLIST_REAL_TIME_VITALS,
            "staff_roster": WAITLIST_STAFF_ROSTER,
            "hospital_map": WAITLIST_HOSPITAL_MAP,
            "risk_profile_context": WAITLIST_RISK_PROFILE_CONTEXT,
            "patient_id": WAITLIST_PATIENT_ID,
            "risk_profile": WAITLIST_RISK_PROFILE_JSON,
            "feasibility_list": WAITLIST_FEASIBILITY_LIST,
            "feasibility_options": WAITLIST_FEASIBILITY_OPTIONS,
            "patients_json": waitlist_patients,
        },
        "multi": {
            "encounter_id": SAMPLE_ENCOUNTER_ID,
            "clinical_records": SAMPLE_CLINICAL_RECORDS,
            "real_time_vitals": SAMPLE_REAL_TIME_VITALS,
            "staff_roster": COMPLEX_STAFF_ROSTER,
            "hospital_map": COMPLEX_HOSPITAL_MAP,
            "risk_profile_context": SAMPLE_RISK_PROFILE_CONTEXT,
            "patient_id": SAMPLE_PATIENT_ID,
            "risk_profile": SAMPLE_RISK_PROFILE_JSON,
            "feasibility_list": SAMPLE_FEASIBILITY_LIST,
            "feasibility_options": SAMPLE_FEASIBILITY_OPTIONS,
            "patients_json": MULTI_PATIENTS_JSON,
        },
    }
    if scenario not in scenarios:
        raise ValueError(f"Unknown scenario: {scenario}. Choose from: {list(scenarios.keys())}")
    return scenarios[scenario].copy()


def run_from_csv():
    """
    Run the CSV-driven pipeline: one patient per row from demo_patients.csv.
    For each patient: model 1 (bed need); if >35% then model 2 (length of stay).
    Patient assignment updates hospital space and patients array.
    After all patients: nurse schedule for next 12h only (4 nurses per occupied room, 15/20/30 min slots).
    Writes output to output/: final_allocations.json, patient_view.json, nurse_view.json, hospital_space.json.
    """
    import logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)s [%(name)s] %(message)s",
    )
    csv_path = os.environ.get("CREWAI_CSV_PATH", "")
    if not csv_path:
        csv_path = None  # use default in pipeline
    room_ids_str = os.environ.get("CREWAI_ROOM_IDS", "")
    hospital_room_ids = [s.strip() for s in room_ids_str.split(",") if s.strip()] if room_ids_str else None
    roster_str = os.environ.get("CREWAI_ROSTER", "")
    roster = None
    if roster_str:
        try:
            roster = json.loads(roster_str)
            if not isinstance(roster, list):
                roster = None
        except json.JSONDecodeError:
            roster = None
    try:
        result = run_csv_pipeline(csv_path=csv_path, hospital_room_ids=hospital_room_ids, roster=roster)
        paths = write_pipeline_output(result, OUTPUT_DIR)
        print("CSV pipeline output written to:")
        for p in paths:
            print("  ", os.path.abspath(p))
    except Exception as e:
        raise Exception(f"CSV pipeline error: {e}") from e


def run_two_batches_25():
    """
    Test: run pipeline for 25 patients, then another 25 patients.
    Writes to output/batch_test/batch_01_first_25/ and output/batch_test/batch_02_next_25/.
    """
    from pathlib import Path
    import logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)s [%(name)s] %(message)s",
    )
    base_out = Path(OUTPUT_DIR) / "batch_test"
    base_out.mkdir(parents=True, exist_ok=True)
    print("Running pipeline: first 25 patients (rows 0–24)...")
    result1 = run_csv_pipeline(max_patients=25, start_index=0)
    out1 = base_out / "batch_01_first_25"
    paths1 = write_pipeline_output(result1, str(out1))
    print(f"  Wrote {len(paths1)} files to {out1}")
    for p in paths1:
        print(f"    - {Path(p).name}")
    print("\nRunning pipeline: next 25 patients (rows 25–49) using state from batch 1...")
    result2 = run_csv_pipeline(
        max_patients=25,
        start_index=25,
        initial_hospital_space=result1["hospital_space"],
    )
    out2 = base_out / "batch_02_next_25"
    paths2 = write_pipeline_output(result2, str(out2))
    print(f"  Wrote {len(paths2)} files to {out2}")
    for p in paths2:
        print(f"    - {Path(p).name}")
    print(f"\nDone. Outputs under: {base_out}")


def run():
    """
    Run the crew. Scenario from CREWAI_SCENARIO env var: default | critical | complex | waitlist.
    Writes final allocations to output/: final_allocations.json, nurse_view.json, patient_view.json.
    """
    scenario = os.environ.get("CREWAI_SCENARIO", "default")
    inputs = get_inputs(scenario)

    try:
        result = MyCrew().crew().kickoff(inputs=inputs)
        paths = write_allocation_output(result, output_dir=OUTPUT_DIR)
        if paths:
            print("Allocation output written to:")
            for p in paths:
                print("  ", os.path.abspath(p))
        else:
            print("No orchestrator output found; output files were not written. Check that the crew completed and the last task returned allocations.")
    except Exception as e:
        raise Exception(f"An error occurred while running the crew: {e}")


def train():
    """
    Train the crew for a given number of iterations.
    Scenario from CREWAI_SCENARIO env var: default | critical | complex | waitlist.
    """
    scenario = os.environ.get("CREWAI_SCENARIO", "default")
    inputs = get_inputs(scenario)
    try:
        MyCrew().crew().train(n_iterations=int(sys.argv[1]), filename=sys.argv[2], inputs=inputs)

    except Exception as e:
        raise Exception(f"An error occurred while training the crew: {e}")

def replay():
    """
    Replay the crew execution from a specific task.
    """
    try:
        MyCrew().crew().replay(task_id=sys.argv[1])

    except Exception as e:
        raise Exception(f"An error occurred while replaying the crew: {e}")

def test():
    """
    Test the crew execution and returns the results.
    Scenario from CREWAI_SCENARIO env var: default | critical | complex | waitlist.
    """
    scenario = os.environ.get("CREWAI_SCENARIO", "default")
    inputs = get_inputs(scenario)

    try:
        MyCrew().crew().test(n_iterations=int(sys.argv[1]), eval_llm=sys.argv[2], inputs=inputs)

    except Exception as e:
        raise Exception(f"An error occurred while testing the crew: {e}")

def run_with_trigger():
    """
    Run the crew with trigger payload.
    """
    import json

    if len(sys.argv) < 2:
        raise Exception("No trigger payload provided. Please provide JSON payload as argument.")

    try:
        trigger_payload = json.loads(sys.argv[1])
    except json.JSONDecodeError:
        raise Exception("Invalid JSON payload provided as argument")

    scenario = trigger_payload.get("scenario", "default")
    base = get_inputs(scenario)
    inputs = {"crewai_trigger_payload": trigger_payload}
    for key in base:
        inputs[key] = trigger_payload.get(key, base[key])

    try:
        result = MyCrew().crew().kickoff(inputs=inputs)
        paths = write_allocation_output(result, output_dir=OUTPUT_DIR)
        if paths:
            print("Allocation output written to:")
            for p in paths:
                print("  ", os.path.abspath(p))
        else:
            print("No orchestrator output found; output files were not written.")
        return result
    except Exception as e:
        raise Exception(f"An error occurred while running the crew with trigger: {e}")
