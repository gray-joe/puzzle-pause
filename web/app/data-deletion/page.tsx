import type { Metadata } from 'next';
import Link from 'next/link';
import PageShell from '@/components/ui/PageShell';

const supportEmail = 'support@puzzlepause.app';
const deletionSubject = encodeURIComponent('Puzzle Pause data deletion request');
const deletionBody = encodeURIComponent(
    'Please delete my Puzzle Pause account and associated personal data.\n\nAccount email:\n'
);

export const metadata: Metadata = {
    title: 'Data Deletion',
    description: 'Request deletion of your Puzzle Pause account data.',
};

export default function DataDeletionPage() {
    return (
        <PageShell title="Data Deletion">
            <main className="privacy-content">
                <h1>Request Data Deletion</h1>

                <p>
                    You can request deletion of your Puzzle Pause account and associated personal
                    data at any time.
                </p>

                <h2>How to request deletion</h2>
                <p>
                    Email <a href={`mailto:${supportEmail}`}>{supportEmail}</a> from the email
                    address used for your Puzzle Pause account and ask us to delete your data.
                </p>
                <p>
                    If you cannot send from your account email, include the account email address in
                    your request so we can verify ownership before deleting data.
                </p>

                <a
                    className="action-btn"
                    href={`mailto:${supportEmail}?subject=${deletionSubject}&body=${deletionBody}`}
                >
                    <span className="gt">&gt;</span>
                    Email deletion request
                </a>

                <h2>What we delete</h2>
                <p>
                    We delete account information, saved gameplay progress, scores, league
                    membership, and active sessions associated with your account.
                </p>

                <h2>What may remain temporarily</h2>
                <p>
                    Limited records may remain temporarily in backups, security logs, or records we
                    must keep for legitimate business or legal reasons.
                </p>

                <p>
                    See the <Link href="/privacy">Privacy Policy</Link> for more information.
                </p>
            </main>
        </PageShell>
    );
}
