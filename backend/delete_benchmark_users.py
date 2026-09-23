"""
Delete the throwaway accounts created by the model benchmark (see web/benchmark/).

Only ever touches accounts on the reserved BENCHMARK_EMAIL_DOMAIN, so it cannot affect a
real user. Pass --dry-run to see what would go without deleting anything.

Usage:
    DATABASE_URL=sqlite:///path/to/puzzle.db python delete_benchmark_users.py [--dry-run]
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app.auth import BENCHMARK_EMAIL_DOMAIN
from app.database import SessionLocal
from app.models import (
    Attempt,
    AuthToken,
    League,
    LeagueMember,
    PuzzleCompletionEvent,
    User,
)
from app.models import (
    Session as SessionModel,
)


def delete_benchmark_users(dry_run: bool = False) -> int:
    db = SessionLocal()
    try:
        print(f"Database: {os.environ.get('DATABASE_URL', '(default)')}")
        print(f"Matching: *{BENCHMARK_EMAIL_DOMAIN}\n")

        users = db.query(User).filter(User.email.endswith(BENCHMARK_EMAIL_DOMAIN)).all()
        if not users:
            print("No benchmark accounts found.")
            return 0

        user_ids = [user.id for user in users]

        # A benchmark account should never own a league, but refuse rather than cascade into
        # one if it somehow does — deleting it would take real members' standings with it.
        owned_leagues = db.query(League).filter(League.creator_id.in_(user_ids)).all()
        if owned_leagues:
            print("Refusing to delete: these benchmark accounts created leagues:")
            for league in owned_leagues:
                print(
                    f"  league {league.id} ({league.name}) created by user {league.creator_id}"
                )
            print("\nReassign or remove those leagues first.")
            return 1

        counts = {
            "attempts": db.query(Attempt).filter(Attempt.user_id.in_(user_ids)).count(),
            "sessions": db.query(SessionModel)
            .filter(SessionModel.user_id.in_(user_ids))
            .count(),
            "completion_events": db.query(PuzzleCompletionEvent)
            .filter(PuzzleCompletionEvent.user_id.in_(user_ids))
            .count(),
            "league_memberships": db.query(LeagueMember)
            .filter(LeagueMember.user_id.in_(user_ids))
            .count(),
            "auth_tokens": db.query(AuthToken)
            .filter(AuthToken.email.endswith(BENCHMARK_EMAIL_DOMAIN))
            .count(),
        }

        print(f"{len(users)} benchmark accounts")
        for table, count in counts.items():
            print(f"  {count} {table}")

        if dry_run:
            print("\n--dry-run: nothing deleted.")
            return 0

        # Children first — attempts/sessions have a non-null user_id.
        db.query(Attempt).filter(Attempt.user_id.in_(user_ids)).delete(
            synchronize_session=False
        )
        db.query(SessionModel).filter(SessionModel.user_id.in_(user_ids)).delete(
            synchronize_session=False
        )
        db.query(PuzzleCompletionEvent).filter(
            PuzzleCompletionEvent.user_id.in_(user_ids)
        ).delete(synchronize_session=False)
        db.query(LeagueMember).filter(LeagueMember.user_id.in_(user_ids)).delete(
            synchronize_session=False
        )
        db.query(AuthToken).filter(
            AuthToken.email.endswith(BENCHMARK_EMAIL_DOMAIN)
        ).delete(synchronize_session=False)
        db.query(User).filter(User.id.in_(user_ids)).delete(synchronize_session=False)
        db.commit()

        print(f"\nDeleted {len(users)} benchmark accounts and their data.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(delete_benchmark_users(dry_run="--dry-run" in sys.argv))
