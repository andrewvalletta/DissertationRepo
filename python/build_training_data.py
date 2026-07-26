from __future__ import annotations

import argparse
import os
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

import pandas as pd


LEVEL_COLUMNS = ("level_1", "level_2", "level_3")
OUTPUT_COLUMNS = (*LEVEL_COLUMNS, "attempt_result")


@dataclass(frozen=True)
class TrainingRow:
    level_1: int
    level_2: int
    level_3: int
    attempt_result: int


@dataclass(frozen=True)
class DatasetSpec:
    source: Path
    owner_profile: str
    output_name: str


OWNER_BY_DATASET = {
    "1000HighPitch": "high_accuracy",
    "obs1000LP": "low_accuracy",
    "obs1000MP": "moderate_accuracy",
}

DEFAULT_INPUT_DIR = Path(
    os.environ.get(
        "TRAINING_DATA_INPUT_DIR",
        r"C:\Users\valdr\OneDrive - Malta College of Arts, Science & Technology\Desktop\Lvl6\Dissertation\Datasets",
    )
)
DEFAULT_OUTPUT_DIR = Path(
    os.environ.get(
        "TRAINING_DATA_OUTPUT_DIR",
        Path(__file__).resolve().parent / "output",
    )
)


def encode_level(level: int) -> tuple[int, int, int]:
    """Convert a numeric level into a one-hot bit pattern.

    Level 1 becomes 001, level 2 becomes 010, and level 3 becomes 100.
    """
    if level not in (1, 2, 3):
        raise ValueError(f"Unsupported level: {level}")
    return (
        1 if level == 1 else 0,
        1 if level == 2 else 0,
        1 if level == 3 else 0,
    )


def load_events(dataset_path: Path) -> list[list[dict]]:
    """Load the JSON dataset and return its sessions as event lists.

    The file is expected to contain a top-level list of sessions, where each
    session is itself a list of event dictionaries.
    """
    with dataset_path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    if not isinstance(data, list):
        raise ValueError("Dataset root must be a list of sessions")

    sessions: list[list[dict]] = []
    for session_index, session_events in enumerate(data, start=1):
        if not isinstance(session_events, list):
            raise ValueError(f"Session {session_index} must be a list of events")
        sessions.append(session_events)
    return sessions


def extract_rows(session_events: Sequence[dict], owner_profile: str) -> list[TrainingRow]:
    """Extract training rows for the dataset owner from one session.

    Only TASK_ATTEMPT and TASK_RETRY events for the owner profile are kept.
    Each row uses the level active at the time of the event and the event's
    success flag as the label.
    """
    rows: list[TrainingRow] = []
    current_level: int | None = None

    for event in session_events:
        event_type = event.get("eventType")
        if event_type == "TASK_START":
            current_level = int(event["level"])
            continue

        if event_type not in {"TASK_ATTEMPT", "TASK_RETRY"}:
            continue

        if event.get("agentProfile") != owner_profile:
            continue

        if current_level is None:
            raise ValueError("Encountered task attempt before any TASK_START event")

        level_bits = encode_level(current_level)
        attempt_result = 1 if bool(event.get("success")) else 0
        rows.append(TrainingRow(*level_bits, attempt_result))

    return rows


def build_dataframe_rows(dataset_path: Path, owner_profile: str) -> list[TrainingRow]:
    """Collect all training rows for one dataset across every session."""
    rows: list[TrainingRow] = []
    for session_events in load_events(dataset_path):
        rows.extend(extract_rows(session_events, owner_profile))
    return rows


def build_dataframe(dataset_path: Path, owner_profile: str) -> pd.DataFrame:
    """Build a pandas DataFrame for one dataset using the target schema."""
    rows = build_dataframe_rows(dataset_path, owner_profile)
    return pd.DataFrame(
        [
            {
                "level_1": row.level_1,
                "level_2": row.level_2,
                "level_3": row.level_3,
                "attempt_result": row.attempt_result,
            }
            for row in rows
        ],
        columns=OUTPUT_COLUMNS,
    )


def write_csv(output_path: Path, dataframe: pd.DataFrame) -> int:
    """Write a DataFrame to CSV and return the number of output rows."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    dataframe.to_csv(output_path, index=False)
    return len(dataframe)


def resolve_dataset_specs(input_dir: Path) -> list[DatasetSpec]:
    """Resolve the dataset source paths and output filenames to process."""
    specs: list[DatasetSpec] = []
    for dataset_name, owner_profile in OWNER_BY_DATASET.items():
        source = input_dir / f"{dataset_name}.json"
        output_name = f"{dataset_name}.csv"
        specs.append(
            DatasetSpec(
                source=source,
                owner_profile=owner_profile,
                output_name=output_name,
            )
        )
    return specs


def main() -> None:
    """Parse CLI arguments and generate the training CSV files."""
    parser = argparse.ArgumentParser(
        description="Build training CSVs from simulation datasets."
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=DEFAULT_INPUT_DIR,
        help="Directory containing the JSON datasets.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="Directory where CSV files will be written.",
    )
    args = parser.parse_args()

    specs = resolve_dataset_specs(args.input_dir)
    for spec in specs:
        if not spec.source.exists():
            raise FileNotFoundError(f"Missing dataset: {spec.source}")

        dataframe = build_dataframe(spec.source, spec.owner_profile)
        output_path = args.output_dir / spec.output_name
        row_count = write_csv(output_path, dataframe)
        print(f"Wrote {row_count} rows to {output_path}")


if __name__ == "__main__":
    main()
