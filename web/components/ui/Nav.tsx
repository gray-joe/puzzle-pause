"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PUBLIC_LINKS = [
  { href: "/puzzle", label: "Daily Puzzle", testid: "puzzle" },
  { href: "/archive", label: "Archive", testid: "archive" },
];

const AUTH_LINKS = [
  { href: "/leagues", label: "Leagues", testid: "leagues" },
  { href: "/account", label: "Account", testid: "account" },
];

export default function Nav({ isAdmin, isLoggedIn }: { isAdmin?: boolean; isLoggedIn?: boolean }) {
  const pathname = usePathname();
  const links = isLoggedIn ? [...PUBLIC_LINKS, ...AUTH_LINKS] : PUBLIC_LINKS;

  return (
    <div className="page-header">
      <div className="page-title" data-testid="title">
        <span className="gt">&gt;</span>Puzzle Pause
      </div>
      <nav className="nav" data-testid="nav-bar">
        {links.map(({ href, label, testid }) => (
          <Link
            key={href}
            href={href}
            className={pathname.startsWith(href) ? "active" : ""}
            data-testid={`${testid}-nav-link${pathname.startsWith(href) ? "-active" : ""}`}
          >
            <span className="gt">&gt;</span>{label}
          </Link>
        ))}
        {isAdmin && (
          <Link
            href="/admin/puzzles"
            className={pathname.startsWith("/admin") ? "active" : ""}
            data-testid={"admin-puzzles-nav-link"}
          >
            <span className="gt">&gt;</span>admin
          </Link>
        )}
      </nav>
      <hr className="nav-line" />
    </div>
  );
}
