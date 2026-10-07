"use client";

import { useMemo, useState } from "react";
import ActionForm, { SubmitButton } from "./ActionForm";
import { saveHealthRecordAction, saveVetVisitAction } from "@/app/actions/health";
import { Field } from "./ui";

type AnimalOpt = { id: string; label: string; species: string };

const TYPES = [
  ["VACCINATION", "Vaccination"], ["INJECTION", "Injection"], ["DEWORMING", "Deworming"],
  ["TREATMENT", "Treatment / illness"], ["CHECKUP", "Routine check-up"], ["PREGNANCY_CHECK", "Pregnancy check"],
  ["SURGERY", "Surgery"], ["LAB_TEST", "Lab test"], ["HOOF_CARE", "Hoof care"],
  ["DEATH_REPORT", "Death report"], ["OTHER", "Other"],
];

export default function HealthRecordForm({
  animals, animalId, vaccineSuggestions = [], showCosts = true, onDone,
}: { animals: AnimalOpt[]; animalId?: string; vaccineSuggestions?: string[]; showCosts?: boolean; onDone?: () => void }) {
  const [type, setType] = useState("VACCINATION");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const today = new Date().toISOString().slice(0, 10);
  const isMedicine = ["VACCINATION", "INJECTION", "DEWORMING", "TREATMENT"].includes(type);
  const multiAnimal = !animalId && animals.length > 0;

  const filtered = useMemo(() => {
    if (!search) return animals;
    const q = search.toLowerCase();
    return animals.filter((a) => a.label.toLowerCase().includes(q));
  }, [animals, search]);

  function toggleAnimal(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === animals.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(animals.map((a) => a.id)));
  }

  return (
    <ActionForm
      action={multiAnimal ? saveVetVisitAction : saveHealthRecordAction}
      className="flex flex-col gap-4"
      resetOnSuccess
      onSuccess={() => { setSelectedIds(new Set()); onDone?.(); }}
    >
      {animalId && <input type="hidden" name="animalId" value={animalId} />}

      {multiAnimal && (
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[13px] font-semibold uppercase tracking-wide text-muted">
              Animals *
              {selectedIds.size > 0 && <span className="ml-1 normal-case tracking-normal text-ink">({selectedIds.size} selected)</span>}
            </span>
            <button type="button" onClick={toggleAll} className="text-[13px] text-brand hover:underline">
              {selectedIds.size === animals.length ? "Deselect all" : "Select all"}
            </button>
          </div>
          {animals.length > 8 && (
            <input
              type="search" placeholder="Search animals…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input mb-2"
            />
          )}
          <div className="max-h-48 overflow-y-auto rounded-xl border border-line bg-surface2 p-1">
            {filtered.map((a) => (
              <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[14px] hover:bg-surface">
                <input
                  type="checkbox" name="animalId" value={a.id}
                  checked={selectedIds.has(a.id)}
                  onChange={() => toggleAnimal(a.id)}
                  className="h-4 w-4 accent-[rgb(var(--brand))]"
                />
                {a.label}
              </label>
            ))}
            {filtered.length === 0 && (
              <p className="px-2.5 py-2 text-[13px] text-muted">No animals match &ldquo;{search}&rdquo;</p>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
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
          <Field label="Medicine / vaccine name"><input name="medicine" className="input" placeholder="Ivermectin 1%" /></Field>
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

        {showCosts && (
          <>
            <Field label="Medicine cost" hint={multiAnimal && selectedIds.size > 1 ? "Per animal" : undefined}>
              <input name="medicineCost" inputMode="decimal" className="input" placeholder="0" />
            </Field>
            <Field label="Vet / doctor fee" hint={multiAnimal && selectedIds.size > 1 ? "Per animal" : undefined}>
              <input name="vetFee" inputMode="decimal" className="input" placeholder="0" />
            </Field>
          </>
        )}

        <Field label="Notes" className="sm:col-span-2">
          <textarea name="notes" rows={2} className="input resize-y" />
        </Field>
      </div>

      <div>
        <SubmitButton>
          {multiAnimal && selectedIds.size > 1
            ? `Save for ${selectedIds.size} animals`
            : "Save record"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
