"use client";

import { useMemo, useState } from "react";
import ActionForm, { SubmitButton } from "./ActionForm";
import { recordSaleAction, recordSaleRangeAction } from "@/app/actions/customers";
import { Field } from "./ui";
import { INCOME_CATEGORIES, SALE_PRODUCTS, SALE_UNITS, saleProductPreset } from "@/lib/domain";
import { money } from "@/lib/format";

export type SaleRate = {
  id: string;
  product: string;
  unit: string;
  unitPrice: number;
  dailyQty: number | null;
  category: string;
};

const OTHER = "__other__";

/**
 * Logs what a buyer actually took: one day, or the same quantity every day
 * across a range (how a month of milk is usually settled). The total is worked
 * out as you type so the number in the ledger is never a surprise.
 */
export default function SaleForm({
  customerId, rates, currency,
}: {
  customerId: string;
  rates: SaleRate[];
  currency: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";

  const [rateId, setRateId] = useState(rates[0]?.id ?? OTHER);
  const rate = rates.find((r) => r.id === rateId) ?? null;

  const [range, setRange] = useState(false);
  const [qty, setQty] = useState(rate?.dailyQty != null ? String(rate.dailyQty) : "");
  const [price, setPrice] = useState(rate ? String(rate.unitPrice) : "");
  const [unit, setUnit] = useState(rate?.unit ?? "litre");
  const [category, setCategory] = useState(rate?.category ?? "Milk Sales");
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);

  function onRate(id: string) {
    setRateId(id);
    const next = rates.find((r) => r.id === id);
    if (!next) return;
    setQty(next.dailyQty != null ? String(next.dailyQty) : "");
    setPrice(String(next.unitPrice));
    setUnit(next.unit);
    setCategory(next.category);
  }

  function onProduct(value: string) {
    const preset = saleProductPreset(value);
    if (!preset) return;
    setUnit(preset.unit);
    setCategory(preset.category);
  }

  const days = useMemo(() => {
    if (!range) return 1;
    const a = new Date(`${from}T12:00:00`).getTime();
    const b = new Date(`${to}T12:00:00`).getTime();
    if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
    return Math.round((b - a) / 86400000) + 1;
  }, [range, from, to]);

  const perDay = (Number(qty) || 0) * (Number(price) || 0);
  const total = perDay * days;

  return (
    <ActionForm
      key={range ? "range" : "single"}
      action={range ? recordSaleRangeAction : recordSaleAction}
      className="grid gap-4"
      resetOnSuccess={false}
    >
      <input type="hidden" name="customerId" value={customerId} />

      <div className="flex gap-1 rounded-xl border border-line bg-surface2 p-1 text-[13px]">
        <button
          type="button" onClick={() => setRange(false)}
          className={`flex-1 rounded-lg px-3 py-1.5 ${!range ? "bg-surface font-medium shadow-sm" : "text-muted"}`}
        >
          One-off
        </button>
        <button
          type="button" onClick={() => setRange(true)}
          className={`flex-1 rounded-lg px-3 py-1.5 ${range ? "bg-surface font-medium shadow-sm" : "text-muted"}`}
        >
          Monthly
        </button>
      </div>

      <Field label="What they took *">
        <select className="input" value={rateId} onChange={(e) => onRate(e.target.value)}>
          {rates.map((r) => (
            <option key={r.id} value={r.id}>
              {r.product} — {money(r.unitPrice, currency)} / {r.unit}
            </option>
          ))}
          <option value={OTHER}>Something else (one-off)</option>
        </select>
      </Field>

      {rate ? (
        <input type="hidden" name="rateId" value={rate.id} />
      ) : (
        <>
          <Field label="Product *">
            <input
              name="product" required className="input" list="sale-form-products"
              placeholder="Milk" onChange={(e) => onProduct(e.target.value)}
            />
            <datalist id="sale-form-products">
              {SALE_PRODUCTS.map((p) => <option key={p.product} value={p.product} />)}
            </datalist>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Unit *">
              <input name="unit" required className="input" list="sale-form-units" value={unit} onChange={(e) => setUnit(e.target.value)} />
              <datalist id="sale-form-units">
                {SALE_UNITS.map((u) => <option key={u} value={u} />)}
              </datalist>
            </Field>
            <Field label="Income category">
              <input name="category" className="input" list="sale-form-categories" value={category} onChange={(e) => setCategory(e.target.value)} />
              <datalist id="sale-form-categories">
                {INCOME_CATEGORIES.map((c) => <option key={c} value={c} />)}
              </datalist>
            </Field>
          </div>
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={range ? `Quantity per day (${unit}) *` : `Quantity (${unit}) *`}>
          <input
            name="quantity" required inputMode="decimal" className="input"
            value={qty} onChange={(e) => setQty(e.target.value)} placeholder="12"
          />
        </Field>
        <Field label={`Price per ${unit} *`} hint={rate ? "Change it here for this entry only" : undefined}>
          <input
            name="unitPrice" required inputMode="decimal" className="input"
            value={price} onChange={(e) => setPrice(e.target.value)} placeholder="220"
          />
        </Field>
      </div>

      {range ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="From *">
            <input type="date" name="from" required className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To *">
            <input type="date" name="to" required className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
      ) : (
        <Field label="Date *">
          <input type="date" name="date" required className="input" defaultValue={today} />
        </Field>
      )}

      <Field label="Notes">
        <input name="notes" className="input" placeholder="Optional" />
      </Field>

      <div className="rounded-xl border border-line bg-surface2 px-3 py-2.5 text-[13.5px]">
        {range ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted">Per day</span>
              <span className="tabular-nums text-muted">{money(perDay, currency)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3 border-t border-line pt-1">
              <span className="text-muted">{days > 0 ? `Monthly total (${days} day${days === 1 ? "" : "s"})` : "Check the dates"}</span>
              <span className="font-semibold tabular-nums">{days > 0 ? money(total, currency) : "—"}</span>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">Total</span>
            <span className="font-semibold tabular-nums">{money(perDay, currency)}</span>
          </div>
        )}
      </div>

      <SubmitButton>{range ? "Record monthly total" : "Record delivery"}</SubmitButton>
    </ActionForm>
  );
}
