type P = { className?: string };
const base = "h-[18px] w-[18px] shrink-0";
const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const Icon = {
  dashboard: (p: P) => (
    <svg viewBox="0 0 24 24" className={p.className ?? base} {...s}><path d="M3 12h6v9H3zM15 3h6v18h-6zM9 7h6v14H9z" /></svg>
  ),
  animals: (p: P) => (
    <svg viewBox="0 0 24 24" className={p.className ?? base} {...s}><path d="M5 11c-2-1-3-3.5-2.5-6C5 5 7 6.5 8 9M19 11c2-1 3-3.5 2.5-6C19 5 17 6.5 16 9" /><path d="M6 14a6 6 0 0 1 12 0v3a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4z" /><path d="M10 14h.01M14 14h.01M10.5 18h3" /></svg>
  ),
  health: (p: P) => (
    <svg viewBox="0 0 24 24" className={p.className ?? base} {...s}><path d="M12 21s-7.5-4.7-9.3-9.4A5.3 5.3 0 0 1 12 6.6a5.3 5.3 0 0 1 9.3 5C19.5 16.3 12 21 12 21z" /><path d="M8.5 12h2l1-2 1.5 4 1-2h1.5" /></svg>
  ),
  syringe: (p: P) => (
    <svg viewBox="0 0 24 24" className={p.className ?? base} {...s}><path d="m18 2 4 4M17 7l-1.5-1.5M20.5 9.5 14 3M15 8 4 19v1h1L16 9" /><path d="m9 12 2 2M12 9l2 2" /></svg>
  ),
  feed: (p: P) => (
    <svg viewBox="0 0 24 24" className={p.className ?? base} {...s}><path d="M12 3c3 3 4.5 6 4.5 9A4.5 4.5 0 0 1 12 16.5 4.5 4.5 0 0 1 7.5 12c0-3 1.5-6 4.5-9z" /><path d="M12 16.5V21M8 21h8" /></svg>
  ),
  finance: (p: P) => (
    <svg viewBox="0 0 24 24" className={p.className ?? base} {...s}><path d="M3 17V8M8.5 17V5M14 17v-6M19.5 17V9" /><path d="M2 21h20" /></svg>
  ),
  breeding: (p: P) => (
    <svg viewBox="0 0 24 24" className={p.className ?? base} {...s}><circle cx="9" cy="9" r="4" /><circle cx="16" cy="16" r="4" /><path d="M12 12 9 15M15 5h4v4" /></svg>
  ),
  settings: (p: P) => (
    <svg viewBox="0 0 24 24" className={p.className ?? base} {...s}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></svg>
  ),
  plus: (p: P) => (<svg viewBox="0 0 24 24" className={p.className ?? base} {...s}><path d="M12 5v14M5 12h14" /></svg>),
  logout: (p: P) => (<svg viewBox="0 0 24 24" className={p.className ?? base} {...s}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>),
  back: (p: P) => (<svg viewBox="0 0 24 24" className={p.className ?? base} {...s}><path d="M19 12H5M12 19l-7-7 7-7" /></svg>),
  camera: (p: P) => (<svg viewBox="0 0 24 24" className={p.className ?? base} {...s}><path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.5" /></svg>),
  trash: (p: P) => (<svg viewBox="0 0 24 24" className={p.className ?? base} {...s}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></svg>),
  search: (p: P) => (<svg viewBox="0 0 24 24" className={p.className ?? base} {...s}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>),
  scale: (p: P) => (<svg viewBox="0 0 24 24" className={p.className ?? base} {...s}><path d="M12 3v18M7 21h10M4 8h16l-2 6H6z" /></svg>),
  milk: (p: P) => (<svg viewBox="0 0 24 24" className={p.className ?? base} {...s}><path d="M9 2h6v3l2 4v11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9l2-4z" /><path d="M7 13h10" /></svg>),
};
