import type { Metadata, Viewport } from 'next';
import './globals.css';

const appName = 'Puzzle Pause';
const appDescription = 'Daily word and logic puzzles';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
    metadataBase: new URL(siteUrl),
    applicationName: appName,
    title: {
        default: appName,
        template: `%s | ${appName}`,
    },
    description: appDescription,
    manifest: '/manifest.webmanifest',
    icons: {
        icon: [
            {
                url: '/app_icon_dark.png',
                sizes: '1254x1254',
                type: 'image/png',
            },
        ],
        apple: [
            {
                url: '/app_icon_light.png',
                sizes: '1254x1254',
                type: 'image/png',
                media: '(prefers-color-scheme: light)',
            },
            {
                url: '/app_icon_dark.png',
                sizes: '1254x1254',
                type: 'image/png',
                media: '(prefers-color-scheme: dark)',
            },
        ],
    },
    appleWebApp: {
        capable: true,
        title: appName,
        statusBarStyle: 'black-translucent',
        startupImage: [
            {
                url: '/app_splash_light.png',
                media: '(prefers-color-scheme: light)',
            },
            {
                url: '/app_splash_dark.png',
                media: '(prefers-color-scheme: dark)',
            },
        ],
    },
    openGraph: {
        title: appName,
        description: appDescription,
        url: '/',
        siteName: appName,
        images: [
            {
                url: '/app_splash_dark.png',
                width: 896,
                height: 1755,
                alt: appName,
            },
        ],
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: appName,
        description: appDescription,
        images: ['/app_splash_dark.png'],
    },
};

export const viewport: Viewport = {
    themeColor: '#0f172a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body suppressHydrationWarning>
                <div style={{ maxWidth: 600, margin: '0 auto', padding: 20, minHeight: '100vh' }}>
                    {children}
                </div>
            </body>
        </html>
    );
}
