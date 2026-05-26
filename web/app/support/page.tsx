import type { Metadata } from 'next';
import Link from 'next/link';
import PageShell from '@/components/ui/PageShell';

const supportEmail = 'support@puzzlepause.app';
const supportSubject = encodeURIComponent('Puzzle Pause support request');
const supportBody = encodeURIComponent(
    'Please describe the issue you are seeing.\n\nDevice:\nApp version:\nAccount email, if applicable:\n'
);

export const metadata: Metadata = {
    title: 'Support',
    description: 'Support information for the Puzzle Pause mobile app.',
};

export default function SupportPage() {
    return (
        <PageShell title="Support">
            <main className="privacy-content">
                <h1>Puzzle Pause Support</h1>

                <p>
                    Need help with the Puzzle Pause mobile app? Email us at{' '}
                    <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
                </p>

                <a
                    className="action-btn"
                    href={`mailto:${supportEmail}?subject=${supportSubject}&body=${supportBody}`}
                >
                    <span className="gt">&gt;</span>
                    Email support
                </a>

                <h2>What to include</h2>
                <p>
                    Include a short description of the issue, the device you are using, your app
                    version, and your account email if the issue is account-related.
                </p>

                <h2>Account and data</h2>
                <p>
                    Review the <Link href="/privacy">Privacy Policy</Link> for details about how
                    Puzzle Pause handles data.
                </p>
                <p>
                    To request deletion of your account and associated data, visit the{' '}
                    <Link href="/data-deletion">Data Deletion</Link> page.
                </p>

                <h2>Common fixes</h2>
                <ul>
                    <li>Make sure you are using the latest version of the app.</li>
                    <li>Check your internet connection if puzzles or leagues are not loading.</li>
                    <li>Close and reopen the app if progress does not appear immediately.</li>
                </ul>
            </main>
        </PageShell>
    );
}
