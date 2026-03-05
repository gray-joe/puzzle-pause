// Typed API client. All paths are relative — Next.js rewrites /api/* to the backend.

export type User = { id: number; email: string; display_name: string | null };
export type AuthResponse = { token: string; user: User };

export type Puzzle = {
  id: number;
  puzzle_date: string;
  puzzle_type: string;
  puzzle_name: string;
  question: string;
  hint: string | null;
  has_hint: boolean;
  puzzle_number: number | null;
  attempt?: AttemptDetail;
  solved?: boolean;
};

export type AttemptDetail = {
  solved: boolean;
  score: number | null;
  incorrect_guesses: number;
  hint_used: boolean;
  completed_at: string | null;
};

export type AttemptResult = {
  correct: boolean;
  score: number | null;
  incorrect_guesses: number;
  solved: boolean;
  answer: string | null;
  streak?: number | null;
};

export type League = {
  id: number;
  name: string;
  invite_code: string;
  creator_id: number;
  member_count: number;
  user_rank: number | null;
  user_score: number;
};

export type LeaderboardEntry = { user_id: number; display_name: string; score: number; rank: number };
export type TagEntry = { user_id: number; display_name: string };
export type LeagueTags = {
  guesser: TagEntry | null;
  one_shotter: TagEntry | null;
  early_riser: TagEntry | null;
  hint_lover: TagEntry | null;
};

export type LeagueDetail = League & {
  leaderboard_today: LeaderboardEntry[];
  leaderboard_weekly: LeaderboardEntry[];
  leaderboard_alltime: LeaderboardEntry[];
  tags: LeagueTags;
};

export type AccountStats = {
  puzzles_solved: number;
  average_score: number;
  alltime_total: number;
  weekly_total: number;
  today_score: number | null;
  percentile: number | null;
  streak: number;
};

export type Account = User & { stats: AccountStats };

export type AdminPuzzle = Puzzle & { answer: string };

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function buildUrl(path: string): string {
  // Server-side fetch requires an absolute URL; client-side uses relative paths
  // so Next.js rewrites can proxy /api/* to the backend.
  if (typeof window === "undefined") {
    const apiUrl = process.env.API_URL ?? "http://localhost:8000";
    return `${apiUrl}${path}`;
  }
  return path;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  cookieHeader?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (cookieHeader) headers["Cookie"] = cookieHeader;

  const res = await fetch(buildUrl(path), {
    ...options,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const api = {
  auth: {
    login: (email: string) =>
      apiFetch<{ message: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),

    verify: (email: string, code: string) =>
      apiFetch<AuthResponse>("/api/auth/verify", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      }),

    logout: () =>
      apiFetch<{ message: string }>("/api/auth/logout", { method: "POST" }),

    me: (cookieHeader?: string) =>
      apiFetch<User>("/api/auth/me", {}, cookieHeader),
  },

  puzzle: {
    today: (cookieHeader?: string) =>
      apiFetch<Puzzle>("/api/puzzle/today", {}, cookieHeader),

    attempt: (puzzle_id: number, guess: string) =>
      apiFetch<AttemptResult>("/api/puzzle/attempt", {
        method: "POST",
        body: JSON.stringify({ puzzle_id, guess }),
      }),

    hint: (puzzle_id: number) =>
      apiFetch<{ hint: string }>("/api/puzzle/hint", {
        method: "POST",
        body: JSON.stringify({ puzzle_id }),
      }),

    result: (cookieHeader?: string) =>
      apiFetch<{ puzzle: Puzzle; attempt: AttemptDetail }>("/api/puzzle/result", {}, cookieHeader),
  },

  archive: {
    list: (cookieHeader?: string) =>
      apiFetch<Puzzle[]>("/api/archive", {}, cookieHeader),

    get: (id: number, cookieHeader?: string) =>
      apiFetch<Puzzle>(`/api/archive/${id}`, {}, cookieHeader),

    attempt: (puzzle_id: number, guess: string) =>
      apiFetch<AttemptResult>(`/api/archive/${puzzle_id}/attempt`, {
        method: "POST",
        body: JSON.stringify({ puzzle_id, guess }),
      }),

    hint: (puzzle_id: number) =>
      apiFetch<{ hint: string }>(`/api/archive/${puzzle_id}/hint`, {
        method: "POST",
      }),

    result: (puzzle_id: number, cookieHeader?: string) =>
      apiFetch<{ puzzle: Puzzle; attempt: AttemptDetail }>(
        `/api/archive/${puzzle_id}/result`,
        {},
        cookieHeader,
      ),
  },

  leagues: {
    list: (cookieHeader?: string) =>
      apiFetch<League[]>("/api/leagues", {}, cookieHeader),

    create: (name: string) =>
      apiFetch<League>("/api/leagues", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),

    get: (id: number, cookieHeader?: string) =>
      apiFetch<LeagueDetail>(`/api/leagues/${id}`, {}, cookieHeader),

    join: (invite_code: string) =>
      apiFetch<League>("/api/leagues/join", {
        method: "POST",
        body: JSON.stringify({ invite_code }),
      }),

    leave: (id: number) =>
      apiFetch<{ message: string }>(`/api/leagues/${id}/leave`, { method: "POST" }),

    delete: (id: number) =>
      apiFetch<void>(`/api/leagues/${id}`, { method: "DELETE" }),
  },

  account: {
    get: (cookieHeader?: string) =>
      apiFetch<Account>("/api/account", {}, cookieHeader),

    update: (display_name: string) =>
      apiFetch<User>("/api/account", {
        method: "PATCH",
        body: JSON.stringify({ display_name }),
      }),
  },

  admin: {
    listPuzzles: (cookieHeader?: string) =>
      apiFetch<AdminPuzzle[]>("/api/admin/puzzles", {}, cookieHeader),

    getPuzzle: (id: number, cookieHeader?: string) =>
      apiFetch<AdminPuzzle>(`/api/admin/puzzles/${id}`, {}, cookieHeader),

    createPuzzle: (data: Partial<AdminPuzzle>) =>
      apiFetch<AdminPuzzle>("/api/admin/puzzles", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    updatePuzzle: (id: number, data: Partial<AdminPuzzle>) =>
      apiFetch<AdminPuzzle>(`/api/admin/puzzles/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    deletePuzzle: (id: number) =>
      apiFetch<void>(`/api/admin/puzzles/${id}`, { method: "DELETE" }),
  },
};

export { ApiError };
