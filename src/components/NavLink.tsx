"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLink({
  href, label, children, variant = "side",
}: { href: string; label: string; children: React.ReactNode; variant?: "side" | "tab" }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  const accent = ({
    "/dashboard": "brand", "/animals": "brand", "/health": "info", "/vet": "info",
    "/breeding": "accent", "/feed": "warn", "/finance": "info",
    "/equipment": "warn", "/batches": "accent", "/customers": "accent", "/settings": "muted",
  } as Record<string, string>)[href] ?? "brand";
  const style = { "--nav-accent": `var(--${accent})` } as CSSProperties;

  if (variant === "tab") {
    return (
      <Link
        href={href}
        style={style}
        data-variant="tab"
        aria-current={active ? "page" : undefined}
        className={`nav-link flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
          active ? "text-brand" : "text-muted"
        }`}
      >
        <span className="nav-icon">{children}</span>
        <span className="truncate px-1">{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      style={style}
      data-variant="side"
      aria-current={active ? "page" : undefined}
      className={`nav-link flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] font-medium transition-colors ${
        active ? "text-brand" : "text-muted hover:bg-surface2 hover:text-ink"
      }`}
    >
      <span className="nav-icon">{children}</span>
      {label}
    </Link>
  );
}
