"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Fixtures" },
  { href: "/settings", label: "System Status" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 h-16 border-b"
      style={{
        background: "var(--surface-panel)",
        borderColor: "var(--surface-border)",
      }}
    >
      <div className="max-w-6xl mx-auto h-full px-6 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div
            className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--accent-primary)" }}
          >
            {/* Simple pitch icon */}
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="1"
                y="3"
                width="16"
                height="12"
                rx="1"
                stroke="var(--text-inverse)"
                strokeWidth="1.5"
                fill="none"
              />
              <circle cx="9" cy="9" r="2.5" stroke="var(--text-inverse)" strokeWidth="1.5" fill="none" />
              <line x1="9" y1="3" x2="9" y2="15" stroke="var(--text-inverse)" strokeWidth="1" />
            </svg>
          </div>
          <span
            className="font-bold text-lg tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            JPredict
          </span>
          <span
            className="text-xs font-mono tracking-widest uppercase hidden sm:inline"
            style={{ color: "var(--text-tertiary)" }}
          >
            Analytics
          </span>
        </Link>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-2 rounded text-sm font-medium transition-colors"
                style={{
                  color: isActive ? "var(--accent-primary)" : "var(--text-secondary)",
                  background: isActive ? "var(--accent-glow)" : "transparent",
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
