from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# Auth
class LoginRequest(BaseModel):
    email: EmailStr


class VerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(max_length=10)


class AuthResponse(BaseModel):
    token: str
    user: "UserResponse"


class UserResponse(BaseModel):
    id: int
    email: str
    display_name: str | None = None


# Puzzle
class PuzzleResponse(BaseModel):
    id: int
    puzzle_date: str
    puzzle_type: str
    puzzle_name: str
    question: str
    hint: str | None = None
    has_hint: bool = False
    puzzle_number: int | None = None


class PuzzleAdminResponse(PuzzleResponse):
    answer: str


class AttemptRequest(BaseModel):
    puzzle_id: int
    guess: str = Field(max_length=1000)
    opened_at: datetime | None = None


class AttemptResponse(BaseModel):
    correct: bool
    score: int | None = None
    incorrect_guesses: int
    solved: bool
    answer: str | None = None
    question: str | None = None
    streak: int | None = None
    opened_at: datetime | None = None


class HintRequest(BaseModel):
    puzzle_id: int


class HintResponse(BaseModel):
    hint: str
    total_hints: int = 1


class ResultResponse(BaseModel):
    puzzle: PuzzleResponse
    attempt: "AttemptDetailResponse"


class AttemptDetailResponse(BaseModel):
    solved: bool
    score: int | None = None
    incorrect_guesses: int
    hint_used: bool
    completed_at: datetime | None = None
    opened_at: datetime | None = None


# Archive
class ArchivePuzzleResponse(PuzzleResponse):
    solved: bool | None = None


# League
class LeagueResponse(BaseModel):
    id: int
    name: str
    invite_code: str
    creator_id: int
    member_count: int
    user_rank: int | None = None
    user_score: int = 0


class CreateLeagueRequest(BaseModel):
    name: str = Field(max_length=100)


class JoinLeagueRequest(BaseModel):
    invite_code: str = Field(max_length=20)


class LeaderboardEntry(BaseModel):
    user_id: int
    display_name: str
    score: int
    rank: int


class LeagueDetailResponse(LeagueResponse):
    leaderboard_today: list[LeaderboardEntry]
    leaderboard_weekly: list[LeaderboardEntry]
    leaderboard_alltime: list[LeaderboardEntry]
    tags: "LeagueTagsResponse"


class LeagueTagsResponse(BaseModel):
    guesser: "TagEntry | None" = None
    one_shotter: "TagEntry | None" = None
    early_riser: "TagEntry | None" = None
    hint_lover: "TagEntry | None" = None


class TagEntry(BaseModel):
    user_id: int
    display_name: str


# Account
class AccountStatsResponse(BaseModel):
    puzzles_solved: int
    average_score: float
    alltime_total: int
    weekly_total: int
    today_score: int | None
    percentile: int | None
    streak: int


class AccountResponse(BaseModel):
    id: int
    email: str
    display_name: str | None = None
    stats: AccountStatsResponse


class UpdateAccountRequest(BaseModel):
    display_name: str = Field(max_length=40)


# Admin attempt
class UpdateAttemptRequest(BaseModel):
    solved: bool | None = None
    score: int | None = None
    incorrect_guesses: int | None = None
    hint_used: bool | None = None
    opened_at: datetime | None = None
    completed_at: datetime | None = None


# Admin puzzle
class CreatePuzzleRequest(BaseModel):
    puzzle_date: str = Field(max_length=10)
    puzzle_type: str = Field(max_length=20)
    puzzle_name: str = Field(default="", max_length=200)
    question: str = Field(max_length=10000)
    answer: str = Field(max_length=1000)
    hint: str | None = Field(default=None, max_length=500)


class UpdatePuzzleRequest(BaseModel):
    puzzle_date: str | None = Field(default=None, max_length=10)
    puzzle_type: str | None = Field(default=None, max_length=20)
    puzzle_name: str | None = Field(default=None, max_length=200)
    question: str | None = Field(default=None, max_length=10000)
    answer: str | None = Field(default=None, max_length=1000)
    hint: str | None = Field(default=None, max_length=500)
