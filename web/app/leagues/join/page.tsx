import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { requireUser, getCookieHeader } from '@/lib/auth';

export default async function JoinLeaguePage({
    searchParams,
}: {
    searchParams: Promise<{ code?: string }>;
}) {
    const { code } = await searchParams;
    if (!code) redirect('/leagues');

    await requireUser();
    const cookieHeader = await getCookieHeader();

    let leagueId: number | null = null;
    try {
        const league = await api.leagues.join(code, cookieHeader);
        leagueId = league.id;
    } catch {
        // invalid code or API error
    }

    redirect(leagueId ? `/leagues/${leagueId}` : '/leagues');
}
