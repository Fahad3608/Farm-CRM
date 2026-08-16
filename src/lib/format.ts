export function money(value: unknown, currency = "PKR") {
  const n = toNum(value);
  if (n === null) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: n % 1 === 0 ? 0 : 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString()}`;
  }
}

export function toNum(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(n) ? n : null;
}

export function num(value: unknown, digits = 0) {
  const n = toNum(value);
  return n === null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function dateInput(d: Date | string | null | undefined) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

/** Human age like "2 y 4 m" or "5 months" — the farm's usual way of saying it. */
export function ageFrom(dob: Date | string | null | undefined, until: Date | string | null = null) {
  if (!dob) return null;
  const start = new Date(dob);
  const end = until ? new Date(until) : new Date();
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  if (months < 0) return null;
  if (months < 1) {
    const days = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
    return { months, label: `${days} day${days === 1 ? "" : "s"}` };
  }
  if (months < 24) return { months, label: `${months} month${months === 1 ? "" : "s"}` };
  const y = Math.floor(months / 12);
  const m = months % 12;
  return { months, label: m ? `${y} y ${m} m` : `${y} years` };
}

export function daysUntil(d: Date | string | null | undefined) {
  if (!d) return null;
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function relativeDue(d: Date | string | null | undefined) {
  const n = daysUntil(d);
  if (n === null) return "—";
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "1 day overdue";
  if (n < 0) return `${Math.abs(n)} days overdue`;
  return `in ${n} days`;
}
