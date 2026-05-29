export function getSentryTracesSampleRate(raw: string | undefined) {
    const fallback = process.env.NODE_ENV === 'production' ? 0.1 : 1.0;
    if (!raw) return fallback;

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;

    return Math.min(Math.max(parsed, 0), 1);
}

export function getSentryEnvironment() {
    return (
        process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
        process.env.SENTRY_ENVIRONMENT ??
        process.env.NODE_ENV
    );
}

export function getSentryRelease() {
    return (
        process.env.NEXT_PUBLIC_SENTRY_RELEASE ||
        process.env.SENTRY_RELEASE ||
        process.env._sentryRelease
    );
}
