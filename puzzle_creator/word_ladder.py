#!/usr/bin/env python3
"""
Word ladder tool — verify paths and check puzzle uniqueness.

Commands:
  verify   <word> <word> ...        check each step in a specific path
  solve    "love,____,late,hate"    find all solutions for a puzzle layout
  paths    <start> <end> <steps>    list all paths of an exact length
  shortest <start> <end>            find the shortest path(s)

Examples:
  python word_ladder.py verify love live line lane late hate
  python word_ladder.py solve "love,____,late,hate"
  python word_ladder.py solve "love,____,line,____,____,hate"
  python word_ladder.py paths love hate 5
  python word_ladder.py shortest love hate
"""

import sys
from collections import defaultdict, deque

WORD_FILE = '/usr/share/dict/words'
MAX_PATHS = 200


def load_graph(length):
    words = {
        w.strip().lower() for w in open(WORD_FILE)
        if len(w.strip()) == length and w.strip().isalpha() and w.strip().islower()
    }
    graph = defaultdict(set)
    for w in words:
        for i in range(length):
            for c in 'abcdefghijklmnopqrstuvwxyz':
                n = w[:i] + c + w[i+1:]
                if n != w and n in words:
                    graph[w].add(n)
    return words, graph


def bfs_all(start, end, steps, graph, words, mid_anchors):
    """All paths of exactly `steps` steps, respecting mid_anchors = {pos: word}."""
    results = []
    queue = deque([[start]])

    while queue:
        path = queue.popleft()
        depth = len(path) - 1

        if len(results) >= MAX_PATHS:
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


COMMANDS = {
    'verify': cmd_verify,
    'solve': cmd_solve,
    'paths': cmd_paths,
    'shortest': cmd_shortest,
}

if __name__ == '__main__':
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print(__doc__)
        sys.exit(1)
    COMMANDS[sys.argv[1]](sys.argv[2:])
