"use client";

import { useMemo, useState } from "react";
import ActionForm, { SubmitButton } from "./ActionForm";
import { recordMonthlyBillAction } from "@/app/actions/customers";
import { Field } from "./ui";
import { money, num } from "@/lib/format";

export type BillRate = {
  id: string;
  product: string;
  unit: string;
  unitPrice: number;
  dailyQty: number | null;
};

const daysInMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return y && m ? new Date(y, m, 0).getDate() : 30;
};

/**
 * Bills a month in one go. The quantity starts from the buyer's usual daily
 * amount across that month's days, so an unchanged month is accepted as-is —
 * and when they took more or less, the total is simply typed over.
 */
export default function MonthlyBillForm({
  customerId, rates, currency,
}: {
  customerId: string;
  rates: BillRate[];
  currency: string;
}) {
  const thisMonth = new Date().toISOString().slice(0, 7);

  const [rateId, setRateId] = useState(rates[0]?.id ?? "");
  const rate = rates.find((r) => r.id === rateId) ?? null;

  const [month, setMonth] = useState(thisMonth);
  const [price, setPrice] = useState(rate ? String(rate.unitPrice) : "");
  const [qty, setQty] = useState("");
  const [touched, setTouched] = useState(false);

  const days = daysInMonth(month);
  // Until the quantity is edited it tracks the usual daily amount, so changing
  // the month re-estimates instead of leaving a stale total behind.
  const suggested = rate?.dailyQty != null ? Math.round(rate.dailyQty * days * 1000) / 1000 : null;
  const effectiveQty = touched || suggested === null ? qty : String(suggested);

  const total = useMemo(
    () => (Number(effectiveQty) || 0) * (Number(price) || 0),
    [effectiveQty, price],
  );

  function onRate(id: string) {
    setRateId(id);
    const next = rates.find((r) => r.id === id);
    if (!next) return;
    setPrice(String(next.unitPrice));
    setTouched(false);
  }

  const unit = rate?.unit ?? "litre";

  return (
    <ActionForm action={recordMonthlyBillAction} className="grid gap-4" resetOnSuccess={false}>
      <input type="hidden" name="customerId" value={customerId} />
      {rate && <input type="hidden" name="rateId" value={rate.id} />}

      {rates.length > 1 && (
        <Field label="Product *">
          <select className="input" value={rateId} onChange={(e) => onRate(e.target.value)}>
            {rates.map((r) => (
              <option key={r.id} value={r.id}>
                {r.product} — {money(r.unitPrice, currency)} / {r.unit}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Month *">
        <input
          type="month" name="month" required className="input"
          value={month} onChange={(e) => setMonth(e.target.value)}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={`Total ${unit}s this month *`}
          hint={suggested !== null ? `Usual: ${num(suggested, 3)} (${rate?.dailyQty}/day × ${days} days)` : `Across all ${days} days`}
        >
          <input
            name="quantity" required inputMode="decimal" className="input"
            value={effectiveQty}
            onChange={(e) => { setTouched(true); setQty(e.target.value); }}
            placeholder={suggested !== null ? String(suggested) : "60"}
          />
        </Field>
        <Field label={`Price per ${unit} *`} hint="For this month only">
          <input
            name="unitPrice" required inputMode="decimal" className="input"
            value={price} onChange={(e) => setPrice(e.target.value)} placeholder="190"
          />
        </Field>
      </div>

      <Field label="Notes">
        <input name="notes" className="input" placeholder="Optional" />
      </Field>

      <div className="rounded-xl border border-line bg-surface2 px-3 py-2.5 text-[13.5px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted">Bill for this month</span>
          <span className="font-semibold tabular-nums">{money(total, currency)}</span>
        </div>
      </div>

      <SubmitButton>Save month&rsquo;s bill</SubmitButton>
    </ActionForm>
  );
}
