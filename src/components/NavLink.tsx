"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLink({
  href, label, children, variant = "side",
}: { href: string; label: string; children: React.ReactNode; variant?: "side" | "tab" }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  if (variant === "tab") {
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
          active ? "text-brand" : "text-muted"
        }`}
      >
        {children}
        <span className="truncate px-1">{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] font-medium transition-colors ${
        active ? "bg-brand/12 text-brand" : "text-muted hover:bg-surface2 hover:text-ink"
      }`}
    >
      {children}
      {label}
    </Link>
  );
}
