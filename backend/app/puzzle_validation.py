"""
Puzzle validation service.

Each validator raises ValueError with a descriptive message if the puzzle
data is structurally invalid. Validators are intentionally strict about
format but lenient about content (e.g. we don't verify a maths answer is
numerically correct, only that it looks like a number).
"""

import json
import re


def validate_puzzle(puzzle_type: str, question: str, answer: str) -> None:
    """Validate question and answer for the given puzzle type.

    Raises ValueError with a human-readable message on failure.
    """
    validators = {
        "choice": _validate_choice,
        "match": _validate_match,
        "order": _validate_order,
        "connections": _validate_connections,
        "numgrid": _validate_numgrid,
        "countdown": _validate_countdown,
        "scrabble": _validate_scrabble,
        "word-wheel": _validate_word_wheel,
        "image-tap": _validate_image_tap,
        "image-order": _validate_image_order,
        "image-word": _validate_image_word,
        "wordsearch": _validate_wordsearch,
    }
    validator = validators.get(puzzle_type)
    if validator:
        validator(question, answer)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_json_question(question: str, required_keys: list[str]) -> dict:
    try:
        data = json.loads(question)
    except json.JSONDecodeError as e:
        raise ValueError(f"question must be valid JSON: {e}")
    if not isinstance(data, dict):
        raise ValueError("question JSON must be an object")
    for key in required_keys:
        if key not in data:
            raise ValueError(f"question JSON missing required field: '{key}'")
    return data


def _parse_index_answer(answer: str, expected_length: int, label: str = "answer") -> list[int]:
    """Parse a comma-separated list of integers and validate it covers 0..n-1 exactly once."""
    parts = [p.strip() for p in answer.split(",")]
    if len(parts) != expected_length:
        raise ValueError(
            f"{label} must have {expected_length} comma-separated indices "
            f"(one per item), got {len(parts)}"
        )
    try:
        indices = [int(p) for p in parts]
    except ValueError:
        raise ValueError(f"{label} must contain only integers separated by commas")
    valid = set(range(expected_length))
    if set(indices) != valid:
        raise ValueError(
            f"{label} must be a permutation of indices 0–{expected_length - 1}"
        )
    return indices


# ---------------------------------------------------------------------------
# Per-type validators
# ---------------------------------------------------------------------------

def _validate_choice(question: str, answer: str) -> None:
    """choice — question: 'prompt|OptionA|OptionB|...', answer: single letter A/B/C/..."""
    parts = question.split("|")
    if len(parts) < 3:
        raise ValueError(
            "choice question must be 'prompt|OptionA|OptionB|...' with at least 2 options"
        )
    options = parts[1:]

    if not re.fullmatch(r"[A-Za-z]", answer.strip()):
        raise ValueError("choice answer must be a single letter (e.g. A, B, C)")

    answer_index = ord(answer.strip().upper()) - ord("A")
    if answer_index < 0 or answer_index >= len(options):
        raise ValueError(
            f"choice answer '{answer.strip().upper()}' does not correspond to any option "
            f"(valid: A–{chr(ord('A') + len(options) - 1)})"
        )


def _validate_match(question: str, answer: str) -> None:
    """match — question JSON with left/right arrays; answer is a permutation of right indices."""
    data = _parse_json_question(question, ["prompt", "left", "right"])
    left = data["left"]
    right = data["right"]
    if not isinstance(left, list) or not isinstance(right, list):
        raise ValueError("match question 'left' and 'right' must be arrays")
    if len(left) != len(right):
        raise ValueError(
            f"match question 'left' ({len(left)}) and 'right' ({len(right)}) must have equal length"
        )
    if len(left) < 2:
        raise ValueError("match question must have at least 2 items in each column")
    _parse_index_answer(answer, len(right))


def _validate_order(question: str, answer: str) -> None:
    """order — question JSON with items array; answer is a permutation of indices."""
    data = _parse_json_question(question, ["prompt", "items"])
    items = data["items"]
    if not isinstance(items, list):
        raise ValueError("order question 'items' must be an array")
    if len(items) < 2:
        raise ValueError("order question must have at least 2 items")
    _parse_index_answer(answer, len(items))


def _validate_connections(question: str, answer: str) -> None:
    """connections — JSON with items/categories; answer is pipe-separated index groups."""
    data = _parse_json_question(question, ["prompt", "items", "categories"])
    items = data["items"]
    categories = data["categories"]
    if not isinstance(items, list) or not isinstance(categories, list):
        raise ValueError("connections question 'items' and 'categories' must be arrays")
    if len(categories) < 2:
        raise ValueError("connections question must have at least 2 categories")
    if len(items) < len(categories):
        raise ValueError("connections question must have at least as many items as categories")
    if len(items) % len(categories) != 0:
        raise ValueError(
            f"connections items ({len(items)}) must divide evenly across categories ({len(categories)})"
        )

    groups_raw = answer.split("|")
    if len(groups_raw) != len(categories):
        raise ValueError(
            f"connections answer must have {len(categories)} pipe-separated groups "
            f"(one per category), got {len(groups_raw)}"
        )

    group_size = len(items) // len(categories)
    all_indices: list[int] = []
    for i, group in enumerate(groups_raw):
        parts = [p.strip() for p in group.split(",")]
        if len(parts) != group_size:
            raise ValueError(
                f"connections answer group {i + 1} must have {group_size} indices, got {len(parts)}"
            )
        try:
            indices = [int(p) for p in parts]
        except ValueError:
            raise ValueError(f"connections answer group {i + 1} must contain only integers")
        all_indices.extend(indices)

    if set(all_indices) != set(range(len(items))) or len(all_indices) != len(items):
        raise ValueError(
            f"connections answer must cover each item index (0–{len(items) - 1}) exactly once"
        )


def _validate_numgrid(question: str, answer: str) -> None:
    """numgrid — JSON with a grid array containing exactly one null; answer is a number."""
    data = _parse_json_question(question, ["prompt", "grid"])
    grid = data["grid"]
    if not isinstance(grid, list):
        raise ValueError("numgrid question 'grid' must be an array")
    null_count = sum(1 for cell in grid if cell is None)
    if null_count != 1:
        raise ValueError(f"numgrid question 'grid' must contain exactly one null, found {null_count}")
    if not re.fullmatch(r"-?\d+(\.\d+)?", answer.strip()):
        raise ValueError("numgrid answer must be a number")


def _validate_countdown(question: str, answer: str) -> None:
    """countdown — JSON with target/numbers/operators; answer is a number."""
    data = _parse_json_question(question, ["prompt", "target", "numbers", "operators"])
    if not isinstance(data["numbers"], list) or len(data["numbers"]) < 1:
        raise ValueError("countdown question 'numbers' must be a non-empty array")
    if not isinstance(data["target"], (int, float)):
        raise ValueError("countdown question 'target' must be a number")
    if not re.fullmatch(r"-?\d+(\.\d+)?", answer.strip()):
        raise ValueError("countdown answer must be a number")


def _validate_scrabble(question: str, answer: str) -> None:
    """scrabble — JSON with board/modifiers/rack; answer is 'word score'."""
    data = _parse_json_question(question, ["prompt", "board", "modifiers", "rack"])
    for field in ("board", "modifiers", "rack"):
        if not isinstance(data[field], list):
            raise ValueError(f"scrabble question '{field}' must be an array")
    if not re.fullmatch(r"[A-Za-z]+ \d+", answer.strip()):
        raise ValueError("scrabble answer must be 'word score' (e.g. 'romance 34')")


def _validate_word_wheel(question: str, answer: str) -> None:
    """word-wheel — JSON with wheels array; answer has one word per wheel."""
    data = _parse_json_question(question, ["prompt", "wheels"])
    wheels = data["wheels"]
    if not isinstance(wheels, list) or len(wheels) < 1:
        raise ValueError("word-wheel question 'wheels' must be a non-empty array")
    for i, wheel in enumerate(wheels):
        if not isinstance(wheel, dict) or "letters" not in wheel:
            raise ValueError(f"word-wheel question wheel {i + 1} must have a 'letters' field")
        if not isinstance(wheel["letters"], list):
            raise ValueError(f"word-wheel question wheel {i + 1} 'letters' must be an array")

    answer_words = answer.strip().split()
    if len(answer_words) != len(wheels):
        raise ValueError(
            f"word-wheel answer must have {len(wheels)} word(s) (one per wheel), got {len(answer_words)}"
        )


def _validate_image_tap(question: str, answer: str) -> None:
    """image-tap — JSON with image_url; answer is 'x,y' floats in [0, 1]."""
    _parse_json_question(question, ["prompt", "image_url"])
    parts = answer.strip().split(",")
    if len(parts) != 2:
        raise ValueError("image-tap answer must be 'x,y' coordinates (e.g. '0.5,0.75')")
    try:
        x, y = float(parts[0]), float(parts[1])
    except ValueError:
        raise ValueError("image-tap answer coordinates must be numbers")
    if not (0.0 <= x <= 1.0 and 0.0 <= y <= 1.0):
        raise ValueError("image-tap answer coordinates must be between 0 and 1")


def _validate_image_order(question: str, answer: str) -> None:
    """image-order — JSON with images array; answer is a permutation of indices."""
    data = _parse_json_question(question, ["prompt", "images"])
    images = data["images"]
    if not isinstance(images, list) or len(images) < 2:
        raise ValueError("image-order question 'images' must be an array with at least 2 items")
    _parse_index_answer(answer, len(images))


def _validate_image_word(question: str, answer: str) -> None:
    """image-word — JSON with image_url; answer is freeform text (non-empty)."""
    _parse_json_question(question, ["prompt", "image_url"])
    if not answer.strip():
        raise ValueError("image-word answer must not be empty")


def _validate_wordsearch(question: str, answer: str) -> None:
    """wordsearch — question must contain 'Find:' section; answer is the word(s) to find."""
    if "Find:" not in question and "find:" not in question.lower():
        raise ValueError("wordsearch question must contain 'Find: WORD' specifying the target word(s)")
    if not answer.strip():
        raise ValueError("wordsearch answer must not be empty")
