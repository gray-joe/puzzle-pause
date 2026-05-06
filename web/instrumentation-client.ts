import * as Sentry from '@sentry/nextjs';
import { getSentryEnvironment, getSentryRelease, getSentryTracesSampleRate } from './sentry.shared';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
    Sentry.init({
        dsn,
        environment: getSentryEnvironment(),
        release: getSentryRelease(),
        tracesSampleRate: getSentryTracesSampleRate(
            process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE
        ),
        sendDefaultPii: false,
    });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
