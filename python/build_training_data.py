from __future__ import annotations

import argparse
import json
import os
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

import pandas as pd


OUTPUT_COLUMNS = (
    "level_t",
    "a_t_minus_5",
    "a_t_minus_4",
    "a_t_minus_3",
    "a_t_minus_2",
    "a_t_minus_1",
    "a_t",
)


@dataclass(frozen=True)
class TrainingRow:
    level_t: int
    a_t_minus_5: int
    a_t_minus_4: int
    a_t_minus_3: int
    a_t_minus_2: int
    a_t_minus_1: int
    a_t: int


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


def encode_level(level: int) -> int:
    """Validate and return the classifier level value."""
    if level not in (1, 2, 3):
        raise ValueError(f"Unsupported level: {level}")
    return level


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

    Rows are only emitted once a session has at least five prior attempt results,
    so the lagged history columns are always fully populated.
    """
    rows: list[TrainingRow] = []
    recent_attempt_results: deque[int] = deque(maxlen=5)
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

        attempt_result = 1 if bool(event.get("success")) else 0
        if len(recent_attempt_results) < 5:
            recent_attempt_results.append(attempt_result)
            continue

        lagged_attempts = list(recent_attempt_results)
        rows.append(
            TrainingRow(
                encode_level(current_level),
                lagged_attempts[0],
                lagged_attempts[1],
                lagged_attempts[2],
                lagged_attempts[3],
                lagged_attempts[4],
                attempt_result,
            )
        )
        recent_attempt_results.append(attempt_result)

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
                "level_t": row.level_t,
                "a_t_minus_5": row.a_t_minus_5,
                "a_t_minus_4": row.a_t_minus_4,
                "a_t_minus_3": row.a_t_minus_3,
                "a_t_minus_2": row.a_t_minus_2,
                "a_t_minus_1": row.a_t_minus_1,
                "a_t": row.a_t,
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
