from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    balanced_accuracy_score,
    classification_report,
    cohen_kappa_score,
    confusion_matrix,
    f1_score,
    log_loss,
    matthews_corrcoef,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


# The model uses only the current task level plus the five most recent attempt outcomes.
FEATURE_COLUMNS = [
    "level_t",
    "a_t_minus_5",
    "a_t_minus_4",
    "a_t_minus_3",
    "a_t_minus_2",
    "a_t_minus_1",
]
TARGET_COLUMN = "a_t"

# Each dataset is treated as one independent binary classification problem.
DATASETS = {
    "1000HighPitch": "1000HighPitch.csv",
    "obs1000LP": "obs1000LP.csv",
    "obs1000MP": "obs1000MP.csv",
}

DEFAULT_RANDOM_SEED = 42
DEFAULT_VALIDATION_FRACTION = 1 / 3
DEFAULT_INPUT_DIR = Path(__file__).resolve().parent / "output"
DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent / "model_artifacts"


@dataclass(frozen=True)
class DatasetPaths:
    name: str
    source_path: Path
    artifact_dir: Path


def load_dataset(csv_path: Path) -> pd.DataFrame:
    dataframe = pd.read_csv(csv_path)
    required_columns = FEATURE_COLUMNS + [TARGET_COLUMN]
    missing_columns = [column for column in required_columns if column not in dataframe.columns]
    if missing_columns:
        raise ValueError(f"Missing columns in {csv_path.name}: {', '.join(missing_columns)}")

    # Keep the original CSV row identity so validation predictions can be traced back later.
    cleaned = dataframe[required_columns].copy()
    cleaned.insert(0, "source_row_number", np.arange(1, len(cleaned) + 1, dtype=int))
    cleaned.insert(0, "source_row_index", np.arange(len(cleaned), dtype=int))
    return cleaned


def shuffle_dataset(dataframe: pd.DataFrame, random_seed: int) -> pd.DataFrame:
    # Shuffle before splitting so the validation rows are not tied to source order.
    return dataframe.sample(frac=1.0, random_state=random_seed).reset_index(drop=True)


def build_model(random_seed: int) -> Pipeline:
    # Balanced class weights help when one class dominates the training split.
    return Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("scaler", StandardScaler()),
            (
                "logistic_regression",
                LogisticRegression(
                    max_iter=5000,
                    random_state=random_seed,
                    solver="lbfgs",
                    class_weight="balanced",
                ),
            ),
        ]
    )


def safe_metric(metric_name: str, y_true: pd.Series, y_proba: np.ndarray | None) -> float | None:
    try:
        if metric_name == "roc_auc":
            if y_proba is None:
                return None
            return float(roc_auc_score(y_true, y_proba))
        if metric_name == "average_precision":
            if y_proba is None:
                return None
            return float(average_precision_score(y_true, y_proba))
        if metric_name == "log_loss":
            if y_proba is None:
                return None
            return float(log_loss(y_true, y_proba, labels=[0, 1]))
    except ValueError:
        return None

    raise ValueError(f"Unsupported metric: {metric_name}")


def calculate_metrics(y_true: pd.Series, y_pred: np.ndarray, y_proba: np.ndarray | None) -> dict[str, Any]:
    confusion = confusion_matrix(y_true, y_pred, labels=[0, 1])
    tn, fp, fn, tp = (int(value) for value in confusion.ravel())
    specificity = tn / (tn + fp) if (tn + fp) else None
    negative_predictive_value = tn / (tn + fn) if (tn + fn) else None

    metrics: dict[str, Any] = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "balanced_accuracy": float(balanced_accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1_score": float(f1_score(y_true, y_pred, zero_division=0)),
        "matthews_corrcoef": float(matthews_corrcoef(y_true, y_pred)),
        "cohen_kappa": float(cohen_kappa_score(y_true, y_pred)),
        "roc_auc": safe_metric("roc_auc", y_true, y_proba),
        "average_precision": safe_metric("average_precision", y_true, y_proba),
        "log_loss": safe_metric("log_loss", y_true, y_proba),
        "specificity": float(specificity) if specificity is not None else None,
        "negative_predictive_value": float(negative_predictive_value) if negative_predictive_value is not None else None,
        "confusion_matrix": {
            "tn": tn,
            "fp": fp,
            "fn": fn,
            "tp": tp,
            "matrix": confusion.tolist(),
        },
        "classification_report": classification_report(
            y_true,
            y_pred,
            labels=[0, 1],
            target_names=["class_0", "class_1"],
            output_dict=True,
            zero_division=0,
        ),
    }

    return metrics


def to_jsonable(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: to_jsonable(item) for key, item in value.items()}
    if isinstance(value, list):
        return [to_jsonable(item) for item in value]
    if isinstance(value, tuple):
        return [to_jsonable(item) for item in value]
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, np.generic):
        return value.item()
    return value


def format_optional_value(value: Any) -> str:
    return "n/a" if value is None else f"{value:.6f}" if isinstance(value, float) else str(value)


def build_metrics_report(
    dataset_name: str,
    source_path: Path,
    train_rows: int,
    validation_rows: int,
    feature_columns: list[str],
    metrics: dict[str, Any],
) -> str:
    confusion = metrics["confusion_matrix"]
    report = metrics["classification_report"]
    lines = [
        f"Dataset: {dataset_name}",
        f"Source: {source_path}",
        f"Training rows: {train_rows}",
        f"Validation rows: {validation_rows}",
        "",
        f"Features: {', '.join(feature_columns)}",
        "",
        "Overall metrics",
        f"Accuracy: {format_optional_value(metrics['accuracy'])}",
        f"Balanced accuracy: {format_optional_value(metrics['balanced_accuracy'])}",
        f"Precision: {format_optional_value(metrics['precision'])}",
        f"Recall: {format_optional_value(metrics['recall'])}",
        f"F1 score: {format_optional_value(metrics['f1_score'])}",
        f"MCC: {format_optional_value(metrics['matthews_corrcoef'])}",
        f"Cohen kappa: {format_optional_value(metrics['cohen_kappa'])}",
        f"ROC AUC: {format_optional_value(metrics['roc_auc'])}",
        f"Average precision: {format_optional_value(metrics['average_precision'])}",
        f"Log loss: {format_optional_value(metrics['log_loss'])}",
        f"Specificity: {format_optional_value(metrics['specificity'])}",
        f"Negative predictive value: {format_optional_value(metrics['negative_predictive_value'])}",
        "",
        "Confusion matrix",
        f"TN={confusion['tn']} FP={confusion['fp']} FN={confusion['fn']} TP={confusion['tp']}",
        f"Matrix: {confusion['matrix']}",
        "",
        "Classification report",
    ]

    for label, stats in report.items():
        if isinstance(stats, dict):
            lines.append(
                f"{label}: precision={format_optional_value(stats.get('precision'))}, "
                f"recall={format_optional_value(stats.get('recall'))}, "
                f"f1={format_optional_value(stats.get('f1-score'))}, "
                f"support={format_optional_value(stats.get('support'))}"
            )
        else:
            lines.append(f"{label}: {format_optional_value(stats)}")

    return "\n".join(lines)


def save_dataset_artifacts(
    dataset_paths: DatasetPaths,
    model: Pipeline,
    feature_columns: list[str],
    metrics: dict[str, Any],
    predictions: pd.DataFrame,
    train_rows: int,
    validation_rows: int,
    random_seed: int,
) -> None:
    dataset_paths.artifact_dir.mkdir(parents=True, exist_ok=True)

    # Persist the fitted pipeline so the exact preprocessing and classifier can be reused later.
    joblib.dump(model, dataset_paths.artifact_dir / "model.joblib")

    with (dataset_paths.artifact_dir / "feature_names.json").open("w", encoding="utf-8") as handle:
        json.dump(feature_columns, handle, indent=2)

    model_metadata = {
        "dataset_name": dataset_paths.name,
        "source_path": str(dataset_paths.source_path),
        "train_rows": train_rows,
        "validation_rows": validation_rows,
        "random_seed": random_seed,
        "feature_columns": feature_columns,
    }
    with (dataset_paths.artifact_dir / "model_metadata.json").open("w", encoding="utf-8") as handle:
        json.dump(model_metadata, handle, indent=2)

    with (dataset_paths.artifact_dir / "metrics.json").open("w", encoding="utf-8") as handle:
        json.dump(to_jsonable(metrics), handle, indent=2)

    report_text = build_metrics_report(
        dataset_name=dataset_paths.name,
        source_path=dataset_paths.source_path,
        train_rows=train_rows,
        validation_rows=validation_rows,
        feature_columns=feature_columns,
        metrics=metrics,
    )
    (dataset_paths.artifact_dir / "metrics_report.txt").write_text(report_text, encoding="utf-8")

    # Keep the validation predictions because they are useful for inspection and error analysis.
    predictions.to_csv(dataset_paths.artifact_dir / "validation_predictions.csv", index=False)


def train_dataset(
    dataset_paths: DatasetPaths,
    random_seed: int,
    validation_fraction: float,
    stratify_split: bool,
) -> None:
    dataframe = load_dataset(dataset_paths.source_path)
    shuffled = shuffle_dataset(dataframe, random_seed=random_seed)

    source_row_ids = shuffled[["source_row_index", "source_row_number"]]
    X = shuffled[FEATURE_COLUMNS]
    y = shuffled[TARGET_COLUMN]

    # Stratify preserves the class ratio so the 66/33 split is comparable across runs.
    stratify_target = y if stratify_split and y.nunique() > 1 else None
    X_train, X_validation, y_train, y_validation, ids_train, ids_validation = train_test_split(
        X,
        y,
        source_row_ids,
        test_size=validation_fraction,
        random_state=random_seed,
        stratify=stratify_target,
    )

    model = build_model(random_seed=random_seed)
    model.fit(X_train, y_train)

    y_pred = np.asarray(model.predict(X_validation))
    y_probability = None
    if hasattr(model, "predict_proba"):
        y_probability = np.asarray(model.predict_proba(X_validation)[:, 1])

    metrics = calculate_metrics(y_validation, y_pred, y_probability)

    prediction_results = ids_validation.reset_index(drop=True).copy()
    prediction_results.insert(0, "validation_split_index", np.arange(len(prediction_results), dtype=int))
    prediction_results.insert(3, "actual", y_validation.to_numpy())
    prediction_results = prediction_results.join(X_validation.reset_index(drop=True))
    prediction_results["predicted"] = y_pred
    if y_probability is not None:
        prediction_results["probability_class_0"] = 1 - y_probability
        prediction_results["probability_class_1"] = y_probability
    prediction_results["correct"] = (prediction_results["actual"] == prediction_results["predicted"]).astype(int)

    save_dataset_artifacts(
        dataset_paths=dataset_paths,
        model=model,
        feature_columns=FEATURE_COLUMNS,
        metrics=metrics,
        predictions=prediction_results,
        train_rows=len(X_train),
        validation_rows=len(X_validation),
        random_seed=random_seed,
    )

    print(
        f"Finished {dataset_paths.name}: train={len(X_train)} validation={len(X_validation)} "
        f"-> {dataset_paths.artifact_dir}"
    )


def resolve_dataset_paths(input_dir: Path, output_dir: Path) -> list[DatasetPaths]:
    return [
        DatasetPaths(
            name=dataset_name,
            source_path=input_dir / file_name,
            artifact_dir=output_dir / dataset_name,
        )
        for dataset_name, file_name in DATASETS.items()
    ]


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Train one logistic regression model per dataset and save evaluation artifacts."
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=DEFAULT_INPUT_DIR,
        help="Directory containing the CSV datasets.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="Directory where model artifacts will be written.",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=DEFAULT_RANDOM_SEED,
        help="Fixed random seed used for shuffling and splitting.",
    )
    parser.add_argument(
        "--validation-fraction",
        type=float,
        default=DEFAULT_VALIDATION_FRACTION,
        help="Fraction of rows reserved for validation.",
    )
    parser.add_argument(
        "--no-stratify",
        action="store_true",
        help="Disable stratified splitting.",
    )
    args = parser.parse_args()

    dataset_paths = resolve_dataset_paths(args.input_dir, args.output_dir)
    for path_info in dataset_paths:
        if not path_info.source_path.exists():
            raise FileNotFoundError(f"Missing dataset: {path_info.source_path}")

    for path_info in dataset_paths:
        train_dataset(
            dataset_paths=path_info,
            random_seed=args.seed,
            validation_fraction=args.validation_fraction,
            stratify_split=not args.no_stratify,
        )


if __name__ == "__main__":
    main()