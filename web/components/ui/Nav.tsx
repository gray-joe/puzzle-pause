'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const PUBLIC_LINKS = [
    { href: '/', label: 'Calendar', testid: 'calendar' },
    { href: '/puzzle', label: 'Daily Puzzle', testid: 'puzzle' },
    { href: '/archive', label: 'Archive', testid: 'archive' },
];

const AUTH_LINKS = [
    { href: '/leagues', label: 'Leagues', testid: 'leagues' },
    { href: '/account', label: 'Account', testid: 'account' },
];

export default function Nav({
    className,
    isAdmin,
    isLoggedIn,
    linksOnly,
    title,
}: {
    className?: string;
    isAdmin?: boolean;
    isLoggedIn?: boolean;
    linksOnly?: boolean;
    title?: string;
}) {
    const pathname = usePathname();
    const links = isLoggedIn ? [...PUBLIC_LINKS, ...AUTH_LINKS] : PUBLIC_LINKS;
    const isActive = (href: string) =>
        href === '/' ? pathname === '/' : pathname.startsWith(href);

    return (
        <div className={`page-header${className ? ` ${className}` : ''}`}>
            {!linksOnly && (
                <div className="page-title" data-testid="title">
                    <span className="gt">&gt;</span>
                    {title ?? 'Puzzle Pause'}
                </div>
            )}
            <nav className="nav" data-testid="nav-bar">
                {isAdmin && pathname.startsWith('/admin') ? (
                    <>
                        <Link
                            href="/admin"
                            className={pathname === '/admin' ? 'active' : ''}
                            data-testid="admin-dashboard-nav-link"
                        >
                            <span className="gt">&gt;</span>Dashboard
                        </Link>
                        <Link
                            href="/admin/puzzles"
                            className={pathname.startsWith('/admin/puzzles') ? 'active' : ''}
                            data-testid="admin-puzzles-nav-link"
                        >
                            <span className="gt">&gt;</span>Puzzles
                        </Link>
                        <Link
                            href="/admin/attempts"
                            className={pathname.startsWith('/admin/attempts') ? 'active' : ''}
                            data-testid="admin-attempts-nav-link"
                        >
                            <span className="gt">&gt;</span>Attempts
                        </Link>
                        <Link
                            href="/admin/users"
                            className={pathname.startsWith('/admin/users') ? 'active' : ''}
                            data-testid="admin-users-nav-link"
                        >
                            <span className="gt">&gt;</span>Users
                        </Link>
                        <Link
                            href="/admin/completion-events"
                            className={
                                pathname.startsWith('/admin/completion-events') ? 'active' : ''
                            }
                            data-testid="admin-completion-events-nav-link"
                        >
                            <span className="gt">&gt;</span>Completion Events
                        </Link>
                    </>
                ) : (
                    <>
                        {links.map(({ href, label, testid }) => (
                            <Link
                                key={href}
                                href={href}
                                className={isActive(href) ? 'active' : ''}
                                data-testid={`${testid}-nav-link${isActive(href) ? '-active' : ''}`}
                            >
                                <span className="gt">&gt;</span>
                                {label}
                            </Link>
                        ))}
                        {isAdmin && (
                            <Link href="/admin" className="" data-testid="admin-nav-link">
                                <span className="gt">&gt;</span>Admin
                            </Link>
                        )}
                    </>
                )}
            </nav>
            {!linksOnly && <hr className="nav-line" />}
        </div>
    );
}
