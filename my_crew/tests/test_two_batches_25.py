"""
Test: run pipeline for 25 patients, then another 25 patients.
Writes to output/batch_test/batch_01_first_25/ and output/batch_test/batch_02_next_25/.

Run from my_crew directory:
  uv run python tests/test_two_batches_25.py
Or:
  uv run run_two_batches_25
"""

from my_crew.main import run_two_batches_25

if __name__ == "__main__":
    run_two_batches_25()
