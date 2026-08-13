#!/usr/bin/env python3
"""
Word ladder tool — verify paths, check uniqueness, and generate puzzles.

Commands:
  verify   <word> <word> ...        check each step in a specific path
  solve    "love,____,late,hate"    find all solutions for a puzzle layout
  paths    <start> <end> <steps>    list all paths of an exact length
  shortest <start> <end>            find the shortest path(s)
  generate [<length> [<steps>]]     random unique puzzle (default 4 letters, 5 steps)
  generate <start> <end> [<steps>]  unique puzzle between two words

Examples:
  python word_ladder.py verify love live line lane late hate
  python word_ladder.py solve "love,____,late,hate"
  python word_ladder.py solve "love,____,line,____,____,hate"
  python word_ladder.py paths love hate 5
  python word_ladder.py shortest love hate
  python word_ladder.py generate
  python word_ladder.py generate 4 6
  python word_ladder.py generate love hate
  python word_ladder.py generate love hate 5
"""

import os
import random
import sys
from collections import defaultdict, deque

WORD_FILE_CANDIDATES = (
    os.environ.get('WORD_FILE'),
    '/usr/share/dict/words',
    '/usr/share/dict/american-english',
    '/usr/share/dict/british-english',
)
MAX_PATHS = 200
MIN_BLANKS = 2
GENERATE_ATTEMPTS = 400
MIN_PATH_DEGREE = 4
MIN_END_DEGREE = 8


def find_word_file():
    for path in WORD_FILE_CANDIDATES:
        if path and os.path.isfile(path):
            return path
    sys.exit(
        "No word list found. Install a dictionary (e.g. `sudo apt install wamerican`) "
        "or set WORD_FILE to a word-list path."
    )


def load_graph(length):
    word_file = find_word_file()
    words = {
        w.strip().lower() for w in open(word_file)
        if len(w.strip()) == length
        and w.strip().isascii()
        and w.strip().isalpha()
        and w.strip().islower()
    }
    graph = defaultdict(set)
    for w in words:
        for i in range(length):
            for c in 'abcdefghijklmnopqrstuvwxyz':
                n = w[:i] + c + w[i+1:]
                if n != w and n in words:
                    graph[w].add(n)
    return words, graph


def bfs_all(start, end, steps, graph, words, mid_anchors, max_paths=MAX_PATHS):
    """All paths of exactly `steps` steps, respecting mid_anchors = {pos: word}."""
    results = []
    queue = deque([[start]])

    while queue:
        path = queue.popleft()
        depth = len(path) - 1

        if len(results) >= max_paths:
            return results, True

        if depth == steps:
            if path[-1] == end:
                results.append(path)
            continue

        next_pos = depth + 1
        required = mid_anchors.get(next_pos)

        if required:
            neighbours = [required] if required in graph[path[-1]] else []
        else:
            neighbours = sorted(graph[path[-1]])

        for nbr in neighbours:
            if nbr not in words or nbr in path:
                continue
            queue.append(path + [nbr])

    return results, False


def bfs_shortest(start, end, graph, words):
    """All shortest paths from start to end."""
    results = []
    min_len = None
    queue = deque([[start]])

    while queue:
        path = queue.popleft()

        if min_len is not None and len(path) >= min_len:
            continue

        for nbr in sorted(graph[path[-1]]):
            if nbr not in words or nbr in path:
                continue
            new_path = path + [nbr]
            if nbr == end:
                if min_len is None:
                    min_len = len(new_path)
                if len(new_path) == min_len:
                    results.append(new_path)
                    if len(results) >= MAX_PATHS:
                        return results, True
            elif min_len is None:
                queue.append(new_path)

    return results, False


def print_paths(paths, truncated):
    for p in paths:
        print(f"  {' → '.join(p)}")
    if truncated:
        print(f"  ... (stopped at {MAX_PATHS} — more exist)")


def cmd_verify(args):
    if len(args) < 2:
        sys.exit("Usage: verify <word> <word> ...")

    path = [w.lower() for w in args]
    if len({len(w) for w in path}) > 1:
        sys.exit("All words must be the same length")

    words, graph = load_graph(len(path[0]))
    ok = True

    for word in path:
        if word not in words:
            print(f"  ✗ '{word}' not in dictionary")
            ok = False

    if ok:
        for a, b in zip(path, path[1:]):
            diffs = sum(x != y for x, y in zip(a, b))
            if diffs == 1:
                print(f"  ✓ {a} → {b}")
            else:
                print(f"  ✗ {a} → {b}  ({diffs} letters differ, need 1)")
                ok = False

    print()
    print("Valid ✓" if ok else "Invalid ✗")


def cmd_solve(args):
    if len(args) != 1:
        sys.exit('Usage: solve "love,____,late,hate"')

    parts = [p.strip().lower() for p in args[0].split(',')]
    start, end = parts[0], parts[-1]
    steps = len(parts) - 1
    mid_anchors = {i: p for i, p in enumerate(parts) if p != '____' and 0 < i < steps}
    blanks = sum(1 for p in parts if p == '____')

    words, graph = load_graph(len(start))

    for w in [start, end] + list(mid_anchors.values()):
        if w not in words:
            print(f"  Warning: '{w}' not in dictionary")

    paths, truncated = bfs_all(start, end, steps, graph, words, mid_anchors)

    label = f"≥{MAX_PATHS}" if truncated else str(len(paths))
    print(f"Puzzle : {args[0]}")
    print(f"Blanks : {blanks}")
    print()

    if not paths:
        print("No solutions found.")
    elif len(paths) == 1 and not truncated:
        print("Unique solution ✓")
        print_paths(paths, False)
    else:
        print(f"{label} solutions — not unique ✗")
        print_paths(paths, truncated)


def cmd_paths(args):
    if len(args) != 3:
        sys.exit("Usage: paths <start> <end> <steps>")

    start, end, steps = args[0].lower(), args[1].lower(), int(args[2])
    words, graph = load_graph(len(start))
    paths, truncated = bfs_all(start, end, steps, graph, words, {})

    label = f"≥{MAX_PATHS}" if truncated else str(len(paths))
    print(f"{label} path(s) of {steps} step(s) from '{start}' to '{end}':\n")
    print_paths(paths, truncated)


def cmd_shortest(args):
    if len(args) != 2:
        sys.exit("Usage: shortest <start> <end>")

    start, end = args[0].lower(), args[1].lower()
    words, graph = load_graph(len(start))

    for w in (start, end):
        if w not in words:
            sys.exit(f"'{w}' not in dictionary")

    paths, truncated = bfs_shortest(start, end, graph, words)

    if not paths:
        print(f"No path from '{start}' to '{end}'")
        return

    steps = len(paths[0]) - 1
    label = f"≥{MAX_PATHS}" if truncated else str(len(paths))
    print(f"Shortest: {steps} step(s), {label} path(s):\n")
    print_paths(paths, truncated)


def random_walk(start, steps, graph, rng, min_degree=MIN_PATH_DEGREE):
    path = [start]
    used = {start}
    for _ in range(steps):
        neighbours = [
            n for n in graph[path[-1]]
            if n not in used and len(graph[n]) >= min_degree
        ]
        if not neighbours:
            return None
        nxt = rng.choice(neighbours)
        path.append(nxt)
        used.add(nxt)
    return path


def uniquify_blanking(path, graph, words):
    """Reveal the fewest middle words so the blanks have a unique solution."""
    start, end = path[0], path[-1]
    steps = len(path) - 1
    anchors = {}

    while True:
        results, truncated = bfs_all(
            start, end, steps, graph, words, anchors, max_paths=30
        )
        unique = len(results) == 1 and not truncated
        if unique:
            return anchors

        if not results:
            return None

        remaining = [i for i in range(1, steps) if i not in anchors]
        if not remaining:
            return None

        def diversity(i):
            return len({p[i] for p in results if i < len(p)})

        best = max(remaining, key=diversity)
        anchors[best] = path[best]


def format_puzzle(path, anchors):
    parts = []
    answers = []
    last = len(path) - 1
    for i, word in enumerate(path):
        if i == 0 or i == last or i in anchors:
            parts.append(word.capitalize())
        else:
            parts.append('____')
            answers.append(word)
    return ', '.join(parts), ', '.join(answers)


def print_puzzle(path, anchors):
    question, answer = format_puzzle(path, anchors)
    blanks = question.count('____')
    print(f"Question : {question}")
    print(f"Answer   : {answer}")
    print(f"Path     : {' → '.join(path)}")
    print(f"Blanks   : {blanks}")
    print("Unique   : yes")


def puzzle_from_paths(paths, graph, words):
    best = None
    best_blanks = -1
    for path in paths:
        anchors = uniquify_blanking(path, graph, words)
        if anchors is None:
            continue
        blanks = (len(path) - 2) - len(anchors)
        if blanks > best_blanks:
            best = (path, anchors)
            best_blanks = blanks
            if blanks == len(path) - 2:
                break
    if best is None or best_blanks < MIN_BLANKS:
        return None
    return best


def generate_random(length, steps, words, graph, rng):
    connected = [w for w in words if len(graph[w]) >= MIN_END_DEGREE]
    if not connected:
        sys.exit(f"No {length}-letter words with enough neighbours in the dictionary")

    for _ in range(GENERATE_ATTEMPTS):
        start = rng.choice(connected)
        path = random_walk(start, steps, graph, rng)
        if not path or path[-1] == path[0]:
            continue
        if len(graph[path[-1]]) < MIN_END_DEGREE:
            continue
        anchors = uniquify_blanking(path, graph, words)
        if anchors is None:
            continue
        blanks = (len(path) - 2) - len(anchors)
        if blanks >= MIN_BLANKS:
            return path, anchors
    return None


def cmd_generate(args):
    usage = 'Usage: generate [<length> [<steps>]] | generate <start> <end> [<steps>]'
    start = end = None
    length = 4
    steps = None

    if not args:
        steps = 5
    elif args[0].isdigit():
        if len(args) > 2:
            sys.exit(usage)
        length = int(args[0])
        steps = int(args[1]) if len(args) > 1 else 5
        if length < 2 or steps < 3:
            sys.exit("length must be >= 2 and steps must be >= 3")
    elif len(args) in (2, 3):
        start, end = args[0].lower(), args[1].lower()
        if len(start) != len(end):
            sys.exit("Start and end must be the same length")
        length = len(start)
        if len(args) == 3:
            if not args[2].isdigit():
                sys.exit(usage)
            steps = int(args[2])
            if steps < 3:
                sys.exit("steps must be >= 3")
    else:
        sys.exit(usage)

    words, graph = load_graph(length)
    rng = random.Random()

    if start is None:
        result = generate_random(length, steps, words, graph, rng)
        if result is None:
            sys.exit(
                f"Could not generate a unique {length}-letter puzzle with {steps} steps. "
                "Try different length/steps."
            )
        print_puzzle(*result)
        return

    for w in (start, end):
        if w not in words:
            sys.exit(f"'{w}' not in dictionary")

    if steps is None:
        paths, _truncated = bfs_shortest(start, end, graph, words)
    else:
        paths, _truncated = bfs_all(start, end, steps, graph, words, {}, max_paths=50)

    if not paths:
        target = f"{steps} step(s)" if steps is not None else "any length"
        sys.exit(f"No path of {target} from '{start}' to '{end}'")

    result = puzzle_from_paths(paths, graph, words)
    if result is None:
        sys.exit(
            f"Could not build a unique puzzle with at least {MIN_BLANKS} blanks "
            f"from '{start}' to '{end}'."
        )
    print_puzzle(*result)


COMMANDS = {
    'verify': cmd_verify,
    'solve': cmd_solve,
    'paths': cmd_paths,
    'shortest': cmd_shortest,
    'generate': cmd_generate,
}

if __name__ == '__main__':
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print(__doc__)
        sys.exit(1)
    COMMANDS[sys.argv[1]](sys.argv[2:])
