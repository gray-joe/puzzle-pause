import Link from 'next/link';
import { api, type AccountStats, type Puzzle } from '@/lib/api';
import { getCookieHeader, getUser } from '@/lib/auth';
import Nav from '@/components/ui/Nav';

export const dynamic = 'force-dynamic';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type PageSearchParams = Record<string, string | string[] | undefined>;

type CalendarDay = {
    day: number;
    date: string;
    href?: string;
    muted: boolean;
    selected: boolean;
    completed: boolean;
    future: boolean;
};

function formatDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function formatMonth(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    return `${year}-${month}`;
}

function addMonths(date: Date, amount: number) {
    return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function monthHref(date: Date, currentMonthDate: Date) {
    const month = formatMonth(date);

    return month === formatMonth(currentMonthDate) ? '/' : `/?month=${month}`;
}

function dateFromPuzzleDate(puzzleDate?: string) {
    if (!puzzleDate) return new Date();

    const [year, month, day] = puzzleDate.split('-').map(Number);
    if (!year || !month || !day) return new Date();

    return new Date(year, month - 1, day);
}

function monthFromSearchParam(value: string | string[] | undefined, fallbackDate: Date) {
    const monthParam = Array.isArray(value) ? value[0] : value;
    if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
        return new Date(fallbackDate.getFullYear(), fallbackDate.getMonth(), 1);
    }

    const [year, month] = monthParam.split('-').map(Number);
    if (!year || !month || month < 1 || month > 12) {
        return new Date(fallbackDate.getFullYear(), fallbackDate.getMonth(), 1);
    }

    return new Date(year, month - 1, 1);
}

function buildCalendarDays(
    calendarMonthDate: Date,
    todayDate: Date,
    completedDates: string[],
    puzzleHrefs: Record<string, string>
): CalendarDay[] {
    const year = calendarMonthDate.getFullYear();
    const month = calendarMonthDate.getMonth();
    const selectedDate = new Date(
        todayDate.getFullYear(),
        todayDate.getMonth(),
        todayDate.getDate()
    );
    const selectedDateString = formatDate(selectedDate);
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPreviousMonth = new Date(year, month, 0).getDate();
    const completedDateSet = new Set(completedDates);
    const days: CalendarDay[] = [];

    for (let index = firstDay - 1; index >= 0; index -= 1) {
        const dayDate = new Date(year, month - 1, daysInPreviousMonth - index);
        days.push({
            day: dayDate.getDate(),
            date: formatDate(dayDate),
            muted: true,
            selected: false,
            completed: false,
            future: dayDate > selectedDate,
        });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        const dayDate = new Date(year, month, day);
        const dateString = formatDate(dayDate);
        days.push({
            day,
            date: dateString,
            href: dayDate <= selectedDate ? puzzleHrefs[dateString] : undefined,
            muted: false,
            selected: dateString === selectedDateString,
            completed: completedDateSet.has(dateString),
            future: dayDate > selectedDate,
        });
    }

    const nextMonthDays = 42 - days.length;
    for (let day = 1; day <= nextMonthDays; day += 1) {
        const dayDate = new Date(year, month + 1, day);
        days.push({
            day,
            date: formatDate(dayDate),
            muted: true,
            selected: false,
            completed: false,
            future: dayDate > selectedDate,
        });
    }

    return days;
}

function monthRange(date: Date) {
    const year = date.getFullYear();
    const month = date.getMonth();

    return {
        start: formatDate(new Date(year, month, 1)),
        end: formatDate(new Date(year, month + 1, 0)),
    };
}

async function getTodayPuzzle(cookieHeader?: string): Promise<Puzzle | null> {
    try {
        return await api.puzzle.today(cookieHeader);
    } catch {
        return null;
    }
}

async function getAccountStats(cookieHeader?: string): Promise<AccountStats | null> {
    if (!cookieHeader) return null;

    try {
        const account = await api.account.get(cookieHeader);
        return account.stats;
    } catch {
        return null;
    }
}

async function getCompletedDates(cookieHeader: string | undefined, calendarDate: Date): Promise<string[]> {
    const { start, end } = monthRange(calendarDate);

    try {
        const response = await api.account.completedDates(start, end, cookieHeader);
        return response.completed_dates;
    } catch {
        return [];
    }
}

async function getCalendarPuzzleHrefs(
    cookieHeader: string | undefined,
    calendarDate: Date,
    todayPuzzle: Puzzle | null
): Promise<Record<string, string>> {
    const { start, end } = monthRange(calendarDate);
    const hrefs: Record<string, string> = {};

    if (todayPuzzle?.puzzle_date) {
        hrefs[todayPuzzle.puzzle_date] = '/puzzle';
    }

    try {
        const calendarPuzzles = await api.puzzle.calendar(start, end, cookieHeader);
        for (const calendarPuzzle of calendarPuzzles) {
            hrefs[calendarPuzzle.puzzle_date] = `/archive/${calendarPuzzle.id}`;
        }
    } catch {
        return hrefs;
    }

    if (todayPuzzle?.puzzle_date) {
        hrefs[todayPuzzle.puzzle_date] = '/puzzle';
    }

    return hrefs;
}

export default async function Home({
    searchParams,
}: {
    searchParams?: Promise<PageSearchParams>;
}) {
    const params = (await searchParams) ?? {};
    const [user, cookieHeader] = await Promise.all([getUser(), getCookieHeader()]);
    const [puzzle, stats] = await Promise.all([
        getTodayPuzzle(cookieHeader),
        user ? getAccountStats(cookieHeader) : Promise.resolve(null),
    ]);
    const isAdmin = user
        ? (process.env.ADMIN_EMAILS ?? '')
              .split(',')
              .map((e) => e.trim().toLowerCase())
              .includes(user.email.toLowerCase())
        : false;
    const todayDate = dateFromPuzzleDate(puzzle?.puzzle_date);
    const calendarDate = monthFromSearchParam(params.month, todayDate);
    const monthName = calendarDate.toLocaleString('en', { month: 'long', year: 'numeric' });
    const previousMonthHref = monthHref(addMonths(calendarDate, -1), todayDate);
    const nextMonthHref = monthHref(addMonths(calendarDate, 1), todayDate);
    const [completedDates, puzzleHrefs] = await Promise.all([
        getCompletedDates(cookieHeader, calendarDate),
        getCalendarPuzzleHrefs(cookieHeader, calendarDate, puzzle),
    ]);
    const calendarDays = buildCalendarDays(calendarDate, todayDate, completedDates, puzzleHrefs);

    return (
        <>
            <main className="landing-page" data-testid="landing-page">
                <section className="landing-hero" aria-labelledby="landing-title">
                    <h1 id="landing-title" className="landing-title" data-testid="landing-title">
                        <span>Puzzle Pause</span>
                    </h1>

                <div className="landing-calendar" data-testid="landing-calendar">
                    <div className="landing-calendar-month">
                        <Link
                            href={previousMonthHref}
                            className="landing-calendar-month-link"
                            aria-label="Previous month"
                        >
                            &lt;
                        </Link>
                        <span>{monthName}</span>
                        <Link
                            href={nextMonthHref}
                            className="landing-calendar-month-link"
                            aria-label="Next month"
                        >
                            &gt;
                        </Link>
                    </div>
                    <div className="landing-calendar-weekdays" aria-hidden="true">
                        {WEEKDAY_LABELS.map((label, index) => (
                            <div key={`${label}-${index}`}>{label}</div>
                        ))}
                    </div>
                    <div className="landing-calendar-grid">
                        {calendarDays.map((day, index) => (
                            <div
                                key={`${day.date}-${index}`}
                                className={`landing-calendar-day${day.muted ? ' muted' : ''}${day.selected ? ' selected' : ''}${day.completed ? ' completed' : ''}${!day.muted && !day.completed && !day.future ? ' incomplete' : ''}${day.future ? ' future' : ''}`}
                                aria-current={day.selected ? 'date' : undefined}
                                aria-label={`${day.date}${day.completed ? ', completed' : !day.muted && !day.future ? ', not completed' : ''}${day.future ? ', future' : ''}`}
                                data-testid={day.selected ? 'landing-selected-day' : undefined}
                            >
                                {day.href ? (
                                    <Link href={day.href} className="landing-calendar-day-link">
                                        <span
                                            className="landing-puzzle-piece"
                                            data-testid={
                                                day.completed
                                                    ? 'landing-completed-day'
                                                    : 'landing-incomplete-day'
                                            }
                                        >
                                            {day.day}
                                        </span>
                                    </Link>
                                ) : !day.muted && !day.future ? (
                                    <span className="landing-calendar-day-link inactive">
                                        <span
                                            className="landing-puzzle-piece"
                                            data-testid={
                                                day.completed
                                                    ? 'landing-completed-day'
                                                    : 'landing-incomplete-day'
                                            }
                                        >
                                            {day.day}
                                        </span>
                                    </span>
                                ) : (
                                    <span className="landing-calendar-day-number">{day.day}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

            </section>

            <section className="landing-stats" aria-label="Puzzle stats">
                {stats ? (
                    <>
                        <div className="landing-stat-block">
                            <span className="landing-stat-icon" aria-hidden="true">
                                &gt;
                            </span>
                            <div>
                                <div className="landing-stat-value" data-testid="landing-streak">
                                    {stats.streak}
                                </div>
                                <div className="landing-stat-label">Day Streak</div>
                            </div>
                        </div>
                        <div className="landing-stat-divider" aria-hidden="true" />
                        <div className="landing-stat-block">
                            <div>
                                <div className="landing-stat-value" data-testid="landing-solved">
                                    {stats.puzzles_solved}
                                </div>
                                <div className="landing-stat-label">Puzzles Solved</div>
                            </div>
                            <span className="landing-stat-icon trophy" aria-hidden="true">
                                &gt;
                            </span>
                        </div>
                    </>
                ) : (
                    <div className="landing-login-prompt" data-testid="landing-login-prompt">
                        <p>Log in to track your streak and puzzles solved.</p>
                        <Link
                            href="/login"
                            className="landing-login-link"
                            data-testid="landing-login-link"
                        >
                            Log in for stats
                        </Link>
                    </div>
                )}
            </section>
            </main>
            <Nav
                className="landing-bottom-nav"
                isAdmin={isAdmin}
                isLoggedIn={!!user}
                linksOnly
            />
        </>
    );
}
