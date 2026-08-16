import Link from "next/link";

export default function Tabs({
  base, current, tabs,
}: { base: string; current: string; tabs: { key: string; label: string; count?: number }[] }) {
  return (
    <div className="scroll-x mb-4 border-b border-line">
      <div className="flex min-w-max gap-1">
        {tabs.map((t) => {
          const active = current === t.key;
          return (
            <Link
              key={t.key}
              href={`${base}?tab=${t.key}`}
              aria-current={active ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2.5 text-[14px] font-medium transition-colors ${
                active ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="ml-1.5 rounded-full bg-surface2 px-1.5 py-0.5 text-[11px] tabular-nums">{t.count}</span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
