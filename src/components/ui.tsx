import Link from "next/link";
import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function Section({
  title, subtitle, action, children, className = "",
}: { title?: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card overflow-hidden ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="h2 truncate">{title}</h2>}
            {subtitle && <p className="text-[13px] text-muted truncate">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

const TONES = {
  brand: "border-brand/30 bg-brand/10 text-brand",
  good: "border-good/30 bg-good/10 text-good",
  warn: "border-warn/30 bg-warn/10 text-warn",
  bad: "border-bad/30 bg-bad/10 text-bad",
  muted: "border-line bg-surface2 text-muted",
} as const;

export function Badge({
  children, tone = "muted", className = "",
}: { children: ReactNode; tone?: keyof typeof TONES; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function StatTile({
  label, value, hint, tone = "muted", href,
}: { label: string; value: ReactNode; hint?: string; tone?: keyof typeof TONES; href?: string }) {
  const body = (
    <div className="card h-full px-4 py-3.5 transition-colors hover:bg-surface2/50">
      <div className="text-[12px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-[26px] font-semibold leading-tight tracking-tight ${
        tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "text-ink"
      }`}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[12.5px] text-muted">{hint}</div>}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

export function Empty({ icon = "🌾", title, hint, action }: { icon?: string; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="text-3xl" aria-hidden>{icon}</div>
      <div className="font-medium">{title}</div>
      {hint && <p className="max-w-sm text-[13.5px] text-muted">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="h1">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[14px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Field({
  label, children, hint, className = "",
}: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-muted">{hint}</span>}
    </label>
  );
}

export function Avatar({
  photoId, name, size = 44, emoji = "🐾",
}: { photoId?: string | null; name: string; size?: number; emoji?: string }) {
  if (photoId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/photos/${photoId}?v=thumb`}
        alt={name}
        width={size}
        height={size}
        className="shrink-0 rounded-xl border border-line object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl border border-line bg-surface2"
      style={{ width: size, height: size, fontSize: size * 0.46 }}
      aria-hidden
    >
      {emoji}
    </div>
  );
}
