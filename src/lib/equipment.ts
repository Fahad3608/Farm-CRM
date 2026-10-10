export const EQUIPMENT_STATUS = { PLANNED: "Planned", IN_PROGRESS: "In progress", COMPLETED: "Completed" } as const;
export const EQUIPMENT_KIND = { EQUIPMENT: "Equipment", CONSTRUCTION: "Construction" } as const;
export const EQUIPMENT_COST_CATEGORIES = ["Equipment", "Construction"] as const;

/** Only ordinary farm-wide expenses can be attached to a build. */
export const LINKABLE_EQUIPMENT_EXPENSE = {
  type: "EXPENSE" as const,
  animalId: null,
  healthRecordId: null,
  feedLogId: null,
  batchCostId: null,
  saleId: null,
  equipmentId: null,
};
