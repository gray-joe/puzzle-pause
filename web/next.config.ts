import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
    output: 'standalone',
    async rewrites() {
        const apiUrl = process.env.API_URL ?? 'http://localhost:8000';
        return [
            {
                source: '/api/:path*',
                destination: `${apiUrl}/api/:path*`,
            },
        ];
    },
};

const sentryEnvironment =
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV;
const sentryRelease = process.env.NEXT_PUBLIC_SENTRY_RELEASE || process.env.SENTRY_RELEASE;

export default withSentryConfig(nextConfig, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    silent: !process.env.CI,
    widenClientFileUpload: true,
    sourcemaps: {
        deleteSourcemapsAfterUpload: true,
    },
    release: {
        name: sentryRelease,
        ...(sentryEnvironment ? { deploy: { env: sentryEnvironment } } : {}),
    },
    webpack: {
        treeshake: {
            removeDebugLogging: true,
        },
    },
});
