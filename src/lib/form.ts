/** Small helpers for reading FormData in server actions. */

export function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export function reqStr(fd: FormData, key: string, label = key): string {
  const s = str(fd, key);
  if (!s) throw new Error(`${label} is required.`);
  return s;
}

export function dec(fd: FormData, key: string): number | null {
  const s = str(fd, key);
  if (s === null) return null;
  const n = Number(s.replace(/,/g, ""));
  if (!Number.isFinite(n)) throw new Error(`${key} must be a number.`);
  return n;
}

export function int(fd: FormData, key: string): number | null {
  const n = dec(fd, key);
  return n === null ? null : Math.round(n);
}

export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

export function date(fd: FormData, key: string): Date | null {
  const s = str(fd, key);
  if (!s) return null;
  const d = new Date(s + (s.length === 10 ? "T12:00:00" : ""));
  if (Number.isNaN(d.getTime())) throw new Error(`${key} is not a valid date.`);
  return d;
}

export function reqDate(fd: FormData, key: string, label = key): Date {
  const d = date(fd, key);
  if (!d) throw new Error(`${label} is required.`);
  return d;
}

export function enumOf<T extends string>(fd: FormData, key: string, allowed: readonly T[], fallback: T): T {
  const s = str(fd, key);
  return s && (allowed as readonly string[]).includes(s) ? (s as T) : fallback;
}
