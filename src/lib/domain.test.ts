import assert from "node:assert/strict";
import { test } from "node:test";
import { CATEGORY_GROUPS, categoryDrillHref, categoryGroupOf } from "./domain";

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

test("drill-down links carry the category and keep the payer filter", () => {
  const sub = new URL(categoryDrillHref("sub", "Worker Salary"), "https://farm.test");
  assert.equal(sub.searchParams.get("sub"), "Worker Salary");
  assert.equal(sub.searchParams.has("paidBy"), false);

  const main = new URL(categoryDrillHref("main", "Fix Cost", "Fahad"), "https://farm.test");
  assert.equal(main.searchParams.get("main"), "Fix Cost");
  assert.equal(main.searchParams.get("paidBy"), "Fahad");
});
