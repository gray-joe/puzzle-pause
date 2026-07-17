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
    explanation?: string | null;
    has_hint: boolean;
    total_hints: number;
    revealed_hint?: string | null;
    puzzle_number: number | null;
    attempt?: AttemptDetail;
    solved?: boolean;
};

export type AttemptDetail = {
    solved: boolean;
    score: number | null;
    incorrect_guesses: number;
    hint_used: number;
    completed_at: string | null;
    opened_at?: string | null;
};

export type AttemptResult = {
    correct: boolean;
    score: number | null;
    incorrect_guesses: number;
    solved: boolean;
    answer: string | null;
    question?: string | null;
    explanation?: string | null;
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

export type LeaderboardEntry = {
    user_id: number;
    display_name: string;
    score: number;
    rank: number;
};
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

export type CompletedDatesResponse = { completed_dates: string[] };

export type CalendarPuzzle = Pick<Puzzle, 'id' | 'puzzle_date'>;

export type AdminPuzzle = Puzzle & { answer: string };

export type AdminStats = {
    puzzles: number;
    players: number;
    attempts: number;
    completion_events: number;
    guest_completion_events: number;
    auth_completion_events: number;
};

export type AdminUser = {
    id: number;
    email: string;
    display_name: string | null;
    created_at: string;
};

export type AdminAttempt = {
    id: number;
    user_id: number;
    user_email: string;
    user_display_name: string | null;
    puzzle_id: number;
    puzzle_date: string;
    puzzle_name: string;
    puzzle_type: string;
    opened_at: string | null;
    completed_at: string | null;
    solved: boolean;
    score: number | null;
    incorrect_guesses: number;
    hint_used: boolean;
};

export type AdminCompletionEvent = {
    id: number;
    puzzle_id: number;
    puzzle_date: string;
    puzzle_name: string;
    puzzle_type: string;
    user_id: number | null;
    user_email: string | null;
    user_display_name: string | null;
    guest_session_id: string | null;
    source: 'daily' | 'archive';
    completed_at: string;
    wrong_guess_count: number | null;
    time_to_complete_seconds: number | null;
};

export type AdminCompletionEventFilters = {
    source?: 'daily' | 'archive';
    actor?: 'guest' | 'auth';
    puzzle_type?: string;
    completed_from?: string;
    completed_to?: string;
    limit?: number;
    offset?: number;
};

export type ArchiveListFilters = {
    limit?: number;
    offset?: number;
    status?: 'all' | 'solved' | 'unsolved';
};

export type AdminListFilters = {
    limit?: number;
    offset?: number;
};

function paginationParams(filters: AdminListFilters | ArchiveListFilters) {
    const params = new URLSearchParams();
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.offset) params.set('offset', String(filters.offset));
    if ('status' in filters && filters.status && filters.status !== 'all') {
        params.set('status', filters.status);
    }
    return params;
}

class ApiError extends Error {
    constructor(
        public status: number,
        message: string
    ) {
        super(message);
    }
}

function buildUrl(path: string): string {
    // Server-side fetch requires an absolute URL; client-side uses relative paths
    // so Next.js rewrites can proxy /api/* to the backend.
    if (typeof window === 'undefined') {
        const apiUrl = process.env.API_URL ?? 'http://localhost:8000';
        return `${apiUrl}${path}`;
    }
    return path;
}

async function apiFetch<T>(
    path: string,
    options: RequestInit = {},
    cookieHeader?: string
): Promise<T> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
    };
    if (cookieHeader) headers['Cookie'] = cookieHeader;

    const res = await fetch(buildUrl(path), {
        ...options,
        headers,
        credentials: 'include',
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
            apiFetch<{ message: string }>('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email }),
            }),

        verify: (email: string, code: string) =>
            apiFetch<AuthResponse>('/api/auth/verify', {
                method: 'POST',
                body: JSON.stringify({ email, code }),
            }),

        logout: () => apiFetch<{ message: string }>('/api/auth/logout', { method: 'POST' }),

        me: (cookieHeader?: string) => apiFetch<User>('/api/auth/me', {}, cookieHeader),
    },

    puzzle: {
        today: (cookieHeader?: string) => apiFetch<Puzzle>('/api/puzzle/today', {}, cookieHeader),

        calendar: (start: string, end: string, cookieHeader?: string) => {
            const params = new URLSearchParams({ start, end });
            return apiFetch<CalendarPuzzle[]>(
                `/api/puzzle/calendar?${params.toString()}`,
                {},
                cookieHeader
            );
        },

        attempt: (
            puzzle_id: number,
            guess: string,
            opened_at?: string,
            penalties?: { incorrect_guesses: number; hints_used: number }
        ) =>
            apiFetch<AttemptResult>('/api/puzzle/attempt', {
                method: 'POST',
                body: JSON.stringify({ puzzle_id, guess, opened_at, ...penalties }),
            }),

        hint: (puzzle_id: number) =>
            apiFetch<{ hint: string; total_hints: number }>('/api/puzzle/hint', {
                method: 'POST',
                body: JSON.stringify({ puzzle_id }),
            }),

        giveUp: (puzzle_id: number) =>
            apiFetch<AttemptResult>('/api/puzzle/give-up', {
                method: 'POST',
                body: JSON.stringify({ puzzle_id }),
            }),

        result: (cookieHeader?: string) =>
            apiFetch<{ puzzle: Puzzle; attempt: AttemptDetail }>(
                '/api/puzzle/result',
                {},
                cookieHeader
            ),
    },

    archive: {
        list: (cookieHeader?: string, filters: ArchiveListFilters = {}) => {
            const params = paginationParams(filters);
            const query = params.toString();
            const path = query ? `/api/archive?${query}` : '/api/archive';
            return apiFetch<Puzzle[]>(path, {}, cookieHeader);
        },

        get: (id: number, cookieHeader?: string) =>
            apiFetch<Puzzle>(`/api/archive/${id}`, {}, cookieHeader),

        attempt: (
            puzzle_id: number,
            guess: string,
            opened_at?: string,
            penalties?: { incorrect_guesses: number; hints_used: number }
        ) =>
            apiFetch<AttemptResult>(`/api/archive/${puzzle_id}/attempt`, {
                method: 'POST',
                body: JSON.stringify({ puzzle_id, guess, opened_at, ...penalties }),
            }),

        hint: (puzzle_id: number) =>
            apiFetch<{ hint: string; total_hints: number }>(`/api/archive/${puzzle_id}/hint`, {
                method: 'POST',
            }),

        giveUp: (puzzle_id: number) =>
            apiFetch<AttemptResult>(`/api/archive/${puzzle_id}/give-up`, {
                method: 'POST',
            }),

        result: (puzzle_id: number, cookieHeader?: string) =>
            apiFetch<{ puzzle: Puzzle; attempt: AttemptDetail }>(
                `/api/archive/${puzzle_id}/result`,
                {},
                cookieHeader
            ),
    },

    leagues: {
        list: (cookieHeader?: string) => apiFetch<League[]>('/api/leagues', {}, cookieHeader),

        create: (name: string) =>
            apiFetch<League>('/api/leagues', {
                method: 'POST',
                body: JSON.stringify({ name }),
            }),

        get: (id: number, cookieHeader?: string) =>
            apiFetch<LeagueDetail>(`/api/leagues/${id}`, {}, cookieHeader),

        join: (invite_code: string, cookieHeader?: string) =>
            apiFetch<League>(
                '/api/leagues/join',
                {
                    method: 'POST',
                    body: JSON.stringify({ invite_code }),
                },
                cookieHeader
            ),

        leave: (id: number) =>
            apiFetch<{ message: string }>(`/api/leagues/${id}/leave`, { method: 'POST' }),

        delete: (id: number) => apiFetch<void>(`/api/leagues/${id}`, { method: 'DELETE' }),
    },

    account: {
        get: (cookieHeader?: string) => apiFetch<Account>('/api/account', {}, cookieHeader),

        completedDates: (start: string, end: string, cookieHeader?: string) => {
            const params = new URLSearchParams({ start, end });
            return apiFetch<CompletedDatesResponse>(
                `/api/account/completed-dates?${params.toString()}`,
                {},
                cookieHeader
            );
        },

        update: (display_name: string) =>
            apiFetch<User>('/api/account', {
                method: 'PATCH',
                body: JSON.stringify({ display_name }),
            }),

        delete: () => apiFetch<{ message: string }>('/api/account', { method: 'DELETE' }),
    },

    admin: {
        stats: (cookieHeader?: string) =>
            apiFetch<AdminStats>('/api/admin/stats', {}, cookieHeader),

        listPuzzles: (cookieHeader?: string, filters: AdminListFilters = {}) => {
            const query = paginationParams(filters).toString();
            const path = query ? `/api/admin/puzzles?${query}` : '/api/admin/puzzles';
            return apiFetch<AdminPuzzle[]>(path, {}, cookieHeader);
        },

        getPuzzle: (id: number, cookieHeader?: string) =>
            apiFetch<AdminPuzzle>(`/api/admin/puzzles/${id}`, {}, cookieHeader),

        createPuzzle: (data: Partial<AdminPuzzle>) =>
            apiFetch<AdminPuzzle>('/api/admin/puzzles', {
                method: 'POST',
                body: JSON.stringify(data),
            }),

        updatePuzzle: (id: number, data: Partial<AdminPuzzle>) =>
            apiFetch<AdminPuzzle>(`/api/admin/puzzles/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data),
            }),

        deletePuzzle: (id: number) =>
            apiFetch<void>(`/api/admin/puzzles/${id}`, { method: 'DELETE' }),

        listAttempts: (cookieHeader?: string, filters: AdminListFilters = {}) => {
            const query = paginationParams(filters).toString();
            const path = query ? `/api/admin/attempts?${query}` : '/api/admin/attempts';
            return apiFetch<AdminAttempt[]>(path, {}, cookieHeader);
        },

        getAttempt: (id: number, cookieHeader?: string) =>
            apiFetch<AdminAttempt>(`/api/admin/attempts/${id}`, {}, cookieHeader),

        updateAttempt: (
            id: number,
            data: Partial<
                Pick<
                    AdminAttempt,
                    | 'solved'
                    | 'score'
                    | 'incorrect_guesses'
                    | 'hint_used'
                    | 'opened_at'
                    | 'completed_at'
                >
            >
        ) =>
            apiFetch<AdminAttempt>(`/api/admin/attempts/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data),
            }),

        listUsers: (cookieHeader?: string, filters: AdminListFilters = {}) => {
            const query = paginationParams(filters).toString();
            const path = query ? `/api/admin/users?${query}` : '/api/admin/users';
            return apiFetch<AdminUser[]>(path, {}, cookieHeader);
        },

        listCompletionEvents: (filters: AdminCompletionEventFilters = {}, cookieHeader?: string) => {
            const params = new URLSearchParams();
            if (filters.source) params.set('source', filters.source);
            if (filters.actor) params.set('actor', filters.actor);
            if (filters.puzzle_type) params.set('puzzle_type', filters.puzzle_type);
            if (filters.completed_from) params.set('completed_from', filters.completed_from);
            if (filters.completed_to) params.set('completed_to', filters.completed_to);
            if (filters.limit) params.set('limit', String(filters.limit));
            if (filters.offset) params.set('offset', String(filters.offset));
            const query = params.toString();
            const path = query
                ? `/api/admin/completion-events?${query}`
                : '/api/admin/completion-events';
            return apiFetch<AdminCompletionEvent[]>(path, {}, cookieHeader);
        },
    },
};

export { ApiError };
