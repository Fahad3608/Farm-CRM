"use client";

import { useState } from "react";
import ActionForm, { SubmitButton } from "./ActionForm";
import { addAnimalToBatchAction } from "@/app/actions/batches";
import { Field } from "./ui";

type AnimalOption = { id: string; name: string; tagId: string; species: string };

export default function BatchAnimalPicker({
  batchId,
  animals,
}: {
  batchId: string;
  animals: AnimalOption[];
}) {
  const [search, setSearch] = useState("");
  const filtered = animals.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.tagId.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <ActionForm action={addAnimalToBatchAction} className="grid gap-3" resetOnSuccess>
      <input type="hidden" name="batchId" value={batchId} />
      <Field label="Select animal *">
        <input
          type="text"
          placeholder="Search by name or tag..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input mb-1"
        />
        <select name="animalId" required className="input" size={Math.min(6, Math.max(2, filtered.length))}>
          {filtered.length === 0 ? (
            <option disabled>No animals available</option>
          ) : (
            filtered.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.tagId})
              </option>
            ))
          )}
        </select>
      </Field>
      <SubmitButton>Add to batch</SubmitButton>
    </ActionForm>
  );
}
