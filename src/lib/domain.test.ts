import assert from "node:assert/strict";
import { test } from "node:test";
import { CATEGORY_GROUPS, DEFAULT_CATEGORY_GROUP, EXPENSE_GROUP_LABELS, categoryGroupOf } from "./domain";

test("built-in categories roll up into the spreadsheet's main categories", () => {
  const none = new Map<string, string>();
  assert.equal(categoryGroupOf("Farm Rent", none), "Monthly Operational Cost");
  assert.equal(categoryGroupOf("Worker Salary", none), "Monthly Operational Cost");
  assert.equal(categoryGroupOf("Feeding Cost", none), "Running Expense");
  assert.equal(categoryGroupOf("Direct Purchase - Feed", none), "Running Expense");
  assert.equal(categoryGroupOf("Vet Cost", none), "Running Expense");
  assert.equal(categoryGroupOf("Equipment", none), "Fix Cost");
  assert.equal(categoryGroupOf("Construction", none), "Fix Cost");
  assert.equal(categoryGroupOf("Labour Cost", none), "Fix Cost");
  assert.equal(categoryGroupOf("Tenent Advance", none), "To be Received");
});

test("an explicit assignment wins, and an unknown category falls back to Misc", () => {
  assert.equal(categoryGroupOf("Equipment", new Map([["Equipment", "Running Expense"]])), "Running Expense");
  assert.equal(categoryGroupOf("Something never seen", new Map()), "Misc");
});

test("every default group is one of the known main categories", () => {
  for (const name of ["Farm Rent", "Feeding Cost", "Equipment", "mics", "Tenent Advance"]) {
    assert.ok(CATEGORY_GROUPS.includes(categoryGroupOf(name, new Map()) as never), name);
  }
});

test("every main category a sub-category maps to is labelled for the UI", () => {
  for (const group of new Set(Object.values(DEFAULT_CATEGORY_GROUP))) {
    assert.ok(CATEGORY_GROUPS.includes(group), `${group} is not a known main category`);
    assert.ok(EXPENSE_GROUP_LABELS[group], `${group} has no label`);
  }
  // The fallback for an ungrouped category needs a label too.
  assert.ok(EXPENSE_GROUP_LABELS[categoryGroupOf("brand new category", new Map())]);
});
