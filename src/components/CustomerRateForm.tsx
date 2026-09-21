"use client";

import { useState } from "react";
import ActionForm, { SubmitButton } from "./ActionForm";
import { saveRateAction } from "@/app/actions/customers";
import { Field } from "./ui";
import { INCOME_CATEGORIES, SALE_PRODUCTS, SALE_UNITS, saleProductPreset } from "@/lib/domain";

export type RateInput = {
  id: string;
  product: string;
  unit: string;
  unitPrice: number;
  dailyQty: number | null;
  category: string;
  notes: string | null;
  active: boolean;
};

/** One line of a buyer's rate card: what they take, in what unit, at what price. */
export default function CustomerRateForm({ customerId, rate }: { customerId: string; rate?: RateInput }) {
  const [unit, setUnit] = useState(rate?.unit ?? "litre");
  const [category, setCategory] = useState(rate?.category ?? "Milk Sales");

  // Typing a product we know the shape of fills in its usual unit and the
  // ledger category its income belongs under — both still editable.
  function onProduct(value: string) {
    const preset = saleProductPreset(value);
    if (!preset) return;
    setUnit(preset.unit);
    setCategory(preset.category);
  }

  return (
    <ActionForm action={saveRateAction} className="grid gap-4" resetOnSuccess={!rate}>
      <input type="hidden" name="customerId" value={customerId} />
      {rate && <input type="hidden" name="id" value={rate.id} />}

      <Field label="Product *" hint="What this buyer takes — milk, ghee, manure…">
        <input
          name="product" required className="input" list="sale-products"
          defaultValue={rate?.product ?? ""} placeholder="Milk"
          onChange={(e) => onProduct(e.target.value)}
        />
        <datalist id="sale-products">
          {SALE_PRODUCTS.map((p) => <option key={p.product} value={p.product} />)}
        </datalist>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Unit *">
          <input
            name="unit" required className="input" list="sale-units"
            value={unit} onChange={(e) => setUnit(e.target.value)}
          />
          <datalist id="sale-units">
            {SALE_UNITS.map((u) => <option key={u} value={u} />)}
          </datalist>
        </Field>
        <Field label={`Price per ${unit || "unit"} *`}>
          <input
            name="unitPrice" required inputMode="decimal" className="input"
            defaultValue={rate ? String(rate.unitPrice) : ""} placeholder="220"
          />
        </Field>
      </div>

      <Field label="Usual quantity per day" hint="Used for the monthly income estimate, and to pre-fill deliveries">
        <input
          name="dailyQty" inputMode="decimal" className="input"
          defaultValue={rate?.dailyQty != null ? String(rate.dailyQty) : ""} placeholder="e.g. 12"
        />
      </Field>

      <Field label="Income category" hint="Where these sales land in the finance ledger">
        <input
          name="category" className="input" list="sale-income-categories"
          value={category} onChange={(e) => setCategory(e.target.value)}
        />
        <datalist id="sale-income-categories">
          {INCOME_CATEGORIES.map((c) => <option key={c} value={c} />)}
        </datalist>
      </Field>

      <Field label="Notes">
        <input name="notes" className="input" defaultValue={rate?.notes ?? ""} placeholder="Optional" />
      </Field>

      {rate && (
        <label className="flex items-center gap-2 text-[13.5px]">
          <input type="checkbox" name="active" defaultChecked={rate.active} className="h-4 w-4 accent-[rgb(var(--brand))]" />
          Current price (uncheck for an old rate)
        </label>
      )}

      <SubmitButton>{rate ? "Update price" : "Add price"}</SubmitButton>
    </ActionForm>
  );
}
