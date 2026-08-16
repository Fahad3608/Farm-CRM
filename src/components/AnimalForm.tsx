"use client";

import Link from "next/link";
import { useState } from "react";
import ActionForm, { SubmitButton } from "./ActionForm";
import { saveAnimalAction } from "@/app/actions/animals";
import { Field } from "./ui";

type Option = { id: string; label: string };

export type AnimalFormValues = {
  id?: string;
  tagId?: string; name?: string; species?: string; breed?: string | null; sex?: string;
  color?: string | null; markings?: string | null; hornStatus?: string | null; microchip?: string | null;
  dateOfBirth?: string; ageIsEstimated?: boolean; dateJoined?: string; acquisition?: string;
  sourceName?: string | null; purchasePrice?: string | null; status?: string;
  exitDate?: string; exitReason?: string | null; salePrice?: string | null; buyerName?: string | null;
  reproStatus?: string; expectedDueDate?: string; penOrLocation?: string | null;
  insuranceNo?: string | null; notes?: string | null; motherId?: string | null; fatherId?: string | null;
};

const SPECIES = [
  ["COW", "Cow 🐄"], ["BUFFALO", "Buffalo 🐃"], ["GOAT", "Goat 🐐"], ["SHEEP", "Sheep 🐑"],
  ["HORSE", "Horse 🐎"], ["POULTRY", "Poultry 🐓"], ["OTHER", "Other 🐾"],
];
const STATUS = [["ACTIVE", "On farm"], ["SOLD", "Sold"], ["DECEASED", "Deceased"], ["CULLED", "Culled"], ["LOANED_OUT", "Loaned out"]];
const REPRO = [["NOT_APPLICABLE", "Not applicable"], ["OPEN", "Open (not pregnant)"], ["BRED", "Bred — awaiting confirmation"],
  ["PREGNANT", "Pregnant"], ["LACTATING", "Lactating"], ["DRY", "Dry"], ["CASTRATED", "Castrated"]];
const ACQ = [["BORN_ON_FARM", "Born on farm"], ["PURCHASED", "Purchased"], ["GIFTED", "Gifted"], ["INHERITED", "Inherited"], ["OTHER", "Other"]];

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="card p-4">
      <legend className="px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">{title}</legend>
      <div className="mt-2 grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export default function AnimalForm({
  values = {}, mothers, fathers, showPrices, currency,
}: { values?: AnimalFormValues; mothers: Option[]; fathers: Option[]; showPrices: boolean; currency: string }) {
  const [acquisition, setAcquisition] = useState(values.acquisition ?? "BORN_ON_FARM");
  const [status, setStatus] = useState(values.status ?? "ACTIVE");
  const [sex, setSex] = useState(values.sex ?? "FEMALE");
  const [repro, setRepro] = useState(values.reproStatus ?? "NOT_APPLICABLE");

  return (
    <ActionForm action={saveAnimalAction} className="flex flex-col gap-4">
      {values.id && <input type="hidden" name="id" value={values.id} />}

      <Group title="Identity">
        <Field label="Tag / Farm ID *" hint="Must be unique — e.g. COW-001">
          <input name="tagId" required defaultValue={values.tagId} className="input" placeholder="COW-001" />
        </Field>
        <Field label="Name *">
          <input name="name" required defaultValue={values.name} className="input" placeholder="Cow One" />
        </Field>
        <Field label="Species *">
          <select name="species" defaultValue={values.species ?? "COW"} className="input">
            {SPECIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Sex *">
          <select name="sex" value={sex} onChange={(e) => setSex(e.target.value)} className="input">
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
          </select>
        </Field>
        <Field label="Breed"><input name="breed" defaultValue={values.breed ?? ""} className="input" placeholder="Sahiwal, Beetal…" /></Field>
        <Field label="Pen / location"><input name="penOrLocation" defaultValue={values.penOrLocation ?? ""} className="input" placeholder="Shed A" /></Field>
      </Group>

      <Group title="Age & arrival">
        <Field label="Date of birth" hint="Leave blank if unknown">
          <input type="date" name="dateOfBirth" defaultValue={values.dateOfBirth} className="input" />
        </Field>
        <Field label="Date joined the farm *">
          <input type="date" name="dateJoined" required defaultValue={values.dateJoined ?? new Date().toISOString().slice(0, 10)} className="input" />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2.5 text-[14px]">
          <input type="checkbox" name="ageIsEstimated" defaultChecked={values.ageIsEstimated} className="h-4 w-4 accent-[rgb(var(--brand))]" />
          Date of birth is an estimate
        </label>
        <Field label="How it joined">
          <select name="acquisition" value={acquisition} onChange={(e) => setAcquisition(e.target.value)} className="input">
            {ACQ.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        {acquisition !== "BORN_ON_FARM" && (
          <Field label="Seller / source"><input name="sourceName" defaultValue={values.sourceName ?? ""} className="input" placeholder="Market / previous owner" /></Field>
        )}
        {showPrices && acquisition !== "BORN_ON_FARM" && (
          <Field label={`Purchase price (${currency})`} hint="Added to your expenses automatically">
            <input name="purchasePrice" inputMode="decimal" defaultValue={values.purchasePrice ?? ""} className="input" placeholder="0" />
          </Field>
        )}
      </Group>

      <Group title="Appearance & features">
        <Field label="Colour"><input name="color" defaultValue={values.color ?? ""} className="input" placeholder="Black & white" /></Field>
        <Field label="Horns"><input name="hornStatus" defaultValue={values.hornStatus ?? ""} className="input" placeholder="Horned / polled / dehorned" list="horn-opts" /></Field>
        <datalist id="horn-opts"><option value="Horned" /><option value="Polled (naturally hornless)" /><option value="Dehorned" /></datalist>
        <Field label="Distinguishing marks" className="sm:col-span-2">
          <input name="markings" defaultValue={values.markings ?? ""} className="input" placeholder="White patch on forehead, torn left ear…" />
        </Field>
        <Field label="Microchip / RFID"><input name="microchip" defaultValue={values.microchip ?? ""} className="input" /></Field>
        <Field label="Insurance policy no."><input name="insuranceNo" defaultValue={values.insuranceNo ?? ""} className="input" /></Field>
      </Group>

      <Group title="Parentage">
        <Field label="Mother (dam)">
          <select name="motherId" defaultValue={values.motherId ?? ""} className="input">
            <option value="">— Unknown / not on farm —</option>
            {mothers.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Father (sire)">
          <select name="fatherId" defaultValue={values.fatherId ?? ""} className="input">
            <option value="">— Unknown / not on farm —</option>
            {fathers.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </Field>
      </Group>

      {sex === "FEMALE" && (
        <Group title="Reproduction">
          <Field label="Current status">
            <select name="reproStatus" value={repro} onChange={(e) => setRepro(e.target.value)} className="input">
              {REPRO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          {(repro === "PREGNANT" || repro === "BRED") && (
            <Field label="Expected delivery date" hint="Breeding records fill this in for you">
              <input type="date" name="expectedDueDate" defaultValue={values.expectedDueDate} className="input" />
            </Field>
          )}
        </Group>
      )}

      <Group title="Status on the farm">
        <Field label="Status">
          <select name="status" value={status} onChange={(e) => setStatus(e.target.value)} className="input">
            {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        {status !== "ACTIVE" && (
          <>
            <Field label="Date left the farm"><input type="date" name="exitDate" defaultValue={values.exitDate} className="input" /></Field>
            <Field label="Reason / notes"><input name="exitReason" defaultValue={values.exitReason ?? ""} className="input" /></Field>
            {status === "SOLD" && (
              <>
                <Field label="Buyer"><input name="buyerName" defaultValue={values.buyerName ?? ""} className="input" /></Field>
                {showPrices && (
                  <Field label={`Sale price (${currency})`}>
                    <input name="salePrice" inputMode="decimal" defaultValue={values.salePrice ?? ""} className="input" />
                  </Field>
                )}
              </>
            )}
          </>
        )}
        <Field label="Notes" className="sm:col-span-2">
          <textarea name="notes" rows={3} defaultValue={values.notes ?? ""} className="input resize-y" placeholder="Temperament, history, anything worth remembering…" />
        </Field>
      </Group>

      <div className="flex items-center gap-2">
        <SubmitButton>{values.id ? "Save changes" : "Add animal"}</SubmitButton>
        <Link href={values.id ? `/animals/${values.id}` : "/animals"} className="btn-ghost">Cancel</Link>
      </div>
    </ActionForm>
  );
}
