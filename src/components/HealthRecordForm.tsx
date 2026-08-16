"use client";

import { useState } from "react";
import ActionForm, { SubmitButton } from "./ActionForm";
import { saveHealthRecordAction } from "@/app/actions/health";
import { Field } from "./ui";
import { ROUTES } from "@/lib/domain";

type AnimalOpt = { id: string; label: string; species: string };

const TYPES = [
  ["VACCINATION", "Vaccination"], ["INJECTION", "Injection"], ["DEWORMING", "Deworming"],
  ["TREATMENT", "Treatment / illness"], ["CHECKUP", "Routine check-up"], ["PREGNANCY_CHECK", "Pregnancy check"],
  ["SURGERY", "Surgery"], ["LAB_TEST", "Lab test"], ["HOOF_CARE", "Hoof care"],
  ["DEATH_REPORT", "Death report"], ["OTHER", "Other"],
];

/**
 * The one form a vet uses. Cost fields are shown to whoever is entering the
 * visit (the vet bills it) but the finance pages stay owner-only.
 */
export default function HealthRecordForm({
  animals, animalId, vaccineSuggestions = [], onDone,
}: { animals: AnimalOpt[]; animalId?: string; vaccineSuggestions?: string[]; onDone?: () => void }) {
  const [type, setType] = useState("VACCINATION");
  const [selected, setSelected] = useState(animalId ?? animals[0]?.id ?? "");
  const today = new Date().toISOString().slice(0, 10);
  const isMedicine = ["VACCINATION", "INJECTION", "DEWORMING", "TREATMENT"].includes(type);

  return (
    <ActionForm action={saveHealthRecordAction} className="flex flex-col gap-4" resetOnSuccess onSuccess={onDone}>
      <div className="grid gap-4 sm:grid-cols-2">
        {animalId ? (
          <input type="hidden" name="animalId" value={animalId} />
        ) : (
          <Field label="Animal *">
            <select name="animalId" required value={selected} onChange={(e) => setSelected(e.target.value)} className="input">
              {animals.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </Field>
        )}

        <Field label="Type *">
          <select name="type" value={type} onChange={(e) => setType(e.target.value)} className="input">
            {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>

        <Field label="Date *">
          <input type="date" name="date" required defaultValue={today} className="input" />
        </Field>

        <Field label="Title / what was done *" className="sm:col-span-2">
          <input name="title" required className="input" placeholder="FMD vaccine — 2nd dose" list="vaccine-opts" />
          <datalist id="vaccine-opts">
            {vaccineSuggestions.map((v) => <option key={v} value={v} />)}
          </datalist>
        </Field>

        {isMedicine && (
          <>
            <Field label="Medicine / vaccine name"><input name="medicine" className="input" placeholder="Ivermectin 1%" /></Field>
            <Field label="Brand / manufacturer"><input name="brand" className="input" /></Field>
            <Field label="Dosage"><input name="dosage" className="input" placeholder="5 ml" /></Field>
            <Field label="Route">
              <input name="route" className="input" list="route-opts" placeholder="IM (intramuscular)" />
              <datalist id="route-opts">{ROUTES.map((r) => <option key={r} value={r} />)}</datalist>
            </Field>
            <Field label="Batch / lot no."><input name="batchNo" className="input" /></Field>
            <Field label="Milk / meat withdrawal until" hint="Do not sell produce before this date">
              <input type="date" name="withdrawalUntil" className="input" />
            </Field>
          </>
        )}

        <Field label="Symptoms observed" className="sm:col-span-2"><input name="symptoms" className="input" placeholder="Off feed, limping on right hind leg…" /></Field>
        <Field label="Diagnosis"><input name="diagnosis" className="input" /></Field>
        <Field label="Treatment given"><input name="treatment" className="input" /></Field>
        <Field label="Temperature (°C)"><input name="temperatureC" inputMode="decimal" className="input" placeholder="38.5" /></Field>
        <Field label="Weight (kg)" hint="Also saved to the growth chart"><input name="weightKg" inputMode="decimal" className="input" /></Field>

        <Field label="Next dose / follow-up date" hint="Shows up as a reminder on the dashboard">
          <input type="date" name="nextDueDate" className="input" />
        </Field>
        <Field label="Vet name" hint="Leave blank if you are the vet signed in"><input name="vetName" className="input" /></Field>

        <Field label="Medicine cost"><input name="medicineCost" inputMode="decimal" className="input" placeholder="0" /></Field>
        <Field label="Vet / doctor fee"><input name="vetFee" inputMode="decimal" className="input" placeholder="0" /></Field>

        <Field label="Notes" className="sm:col-span-2">
          <textarea name="notes" rows={2} className="input resize-y" />
        </Field>
      </div>

      <div><SubmitButton>Save record</SubmitButton></div>
    </ActionForm>
  );
}
