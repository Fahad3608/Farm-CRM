import { saveEquipmentAction } from "@/app/actions/equipment";
import { EQUIPMENT_KIND, EQUIPMENT_STATUS } from "@/lib/equipment";
import ActionForm, { SubmitButton } from "./ActionForm";
import { Field } from "./ui";

type Item = { id: string; name: string; kind: string; status: string; location: string | null; notes: string | null };
export default function EquipmentForm({ item }: { item?: Item }) {
  return <ActionForm action={saveEquipmentAction} className="grid gap-4 sm:grid-cols-2">
    {item && <input type="hidden" name="id" value={item.id} />}
    <Field label="Item name *" className="sm:col-span-2"><input className="input" name="name" required defaultValue={item?.name} placeholder="e.g. Feed trolley, water tank stand, shed partition" /></Field>
    <Field label="Type"><select name="kind" className="input" defaultValue={item?.kind ?? "EQUIPMENT"}>{Object.entries(EQUIPMENT_KIND).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
    <Field label="Status"><select name="status" className="input" defaultValue={item?.status ?? "PLANNED"}>{Object.entries(EQUIPMENT_STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
    <Field label="Location" className="sm:col-span-2"><input name="location" className="input" defaultValue={item?.location ?? ""} placeholder="e.g. Main shed" /></Field>
    <Field label="Notes" className="sm:col-span-2"><textarea name="notes" className="input" rows={3} defaultValue={item?.notes ?? ""} placeholder="Dimensions, materials needed, or progress" /></Field>
    <div className="sm:col-span-2"><SubmitButton>{item ? "Save changes" : "Add item"}</SubmitButton></div>
  </ActionForm>;
}
