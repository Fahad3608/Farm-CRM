type RateMap = Record<string, number>;

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** One day's rates for `from`, tried against a CDN mirror then a Cloudflare Pages fallback. */
async function fetchRates(from: string, dateKey: string): Promise<RateMap | null> {
  const currency = from.toLowerCase();
  const hosts = [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateKey}/v1/currencies/${currency}.json`,
    `https://${dateKey}.currency-api.pages.dev/v1/currencies/${currency}.json`,
  ];
  for (const url of hosts) {
    try {
      const res = await fetch(url, { next: { revalidate: dateKey === "latest" ? 3600 : 60 * 60 * 24 * 30 } });
      if (!res.ok) continue;
      const data = await res.json();
      const rates = data?.[currency];
      if (rates && typeof rates === "object") return rates as RateMap;
    } catch {
      // try the next host
    }
  }
  return null;
}

/**
 * Historical from->to rates for a batch of dates, one lookup per distinct
 * day — sourced from the free, keyless @fawazahmed0/currency-api. A date
 * with no published rate yet (today, or a future date on an animal/health
 * record) falls back to the latest available rate. A date whose rate
 * can't be found at all maps to null, so the UI can say so rather than
 * showing a wrong number.
 */
export async function historicalRates(from: string, to: string, dates: Date[]): Promise<Map<string, number | null>> {
  if (from.toUpperCase() === to.toUpperCase()) {
    return new Map(dates.map((d) => [isoDate(d), 1]));
  }

  const today = isoDate(new Date());
  const keys = [...new Set(dates.map(isoDate))];

  const perDate = await Promise.all(
    keys.map(async (key) => {
      const dateKey = key > today ? "latest" : key;
      let rates = await fetchRates(from, dateKey);
      if (!rates && dateKey !== "latest") rates = await fetchRates(from, "latest");
      const rate = rates?.[to.toLowerCase()];
      return [key, typeof rate === "number" ? rate : null] as const;
    })
  );

  return new Map(perDate);
}

export { isoDate };
