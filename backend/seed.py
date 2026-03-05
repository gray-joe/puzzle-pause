"""
Data integrity verification script for V2 migration.
Run after mounting the existing SQLite volume.

Usage:
    DATABASE_URL=sqlite:///path/to/puzzle.db python seed.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app.models import User, Puzzle, Attempt, League, LeagueMember


def verify():
    db = SessionLocal()
    try:
        users = db.query(User).count()
        puzzles = db.query(Puzzle).count()
        attempts = db.query(Attempt).count()
        leagues = db.query(League).count()
        members = db.query(LeagueMember).count()

        print(f"Users:          {users}")
        print(f"Puzzles:        {puzzles}")
        print(f"Attempts:       {attempts}")
        print(f"Leagues:        {leagues}")
        print(f"League members: {members}")

        # Verify integrity
        orphan_attempts = db.execute(
            __import__("sqlalchemy").text(
                "SELECT COUNT(*) FROM attempts a "
                "WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = a.user_id) "
                "OR NOT EXISTS (SELECT 1 FROM puzzles p WHERE p.id = a.puzzle_id)"
            )
        ).scalar()

        if orphan_attempts:
            print(f"WARNING: {orphan_attempts} orphaned attempts found")
        else:
            print("No orphaned attempts — data looks clean")

        solved = db.query(Attempt).filter(Attempt.solved == 1).count()
        print(f"Solved attempts: {solved}")

        print("\nVerification complete.")
    finally:
        db.close()


if __name__ == "__main__":
    verify()
