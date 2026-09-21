import assert from "node:assert/strict";
import { test } from "node:test";
import { monthlyExpenses, monthlyExpenseHref } from "./monthlyExpenses";

const entry = (date: string, category: string, amount: string, type = "EXPENSE") => ({ date: new Date(date), category, amount, type });

test("monthly categories reconcile without rounding drift and exclude income", () => {
  const months = monthlyExpenses([
    entry("2026-09-01T12:00:00Z", "Feed", "0.10"),
    entry("2026-09-02T12:00:00Z", "Feed", "0.20"),
    entry("2026-09-02T12:00:00Z", "Equipment", "50.00"),
    entry("2026-09-02T12:00:00Z", "Animal Purchase", "100.00"),
    entry("2026-09-02T12:00:00Z", "Unclear", "7.00"),
    entry("2026-09-02T12:00:00Z", "Milk Sales", "900", "INCOME"),
  ], new Map());
  assert.equal(months.length, 1);
  assert.equal(months[0].total, 157.3);
  assert.deepEqual(months[0].groups.map(g => [g.name, g.total]), [["Operational", 0.3], ["Capital & Construction", 50], ["Animal Purchases", 100], ["Other", 7]]);
  assert.equal(months[0].groups[0].categories[0].count, 2);
});

test("explicit category assignments override defaults and months with no expenses are omitted", () => {
  const months = monthlyExpenses([
    entry("2026-01-31T23:59:59Z", "Equipment", "20"),
    entry("2026-03-01T00:00:00Z", "Custom", "10"),
    entry("2026-02-10T12:00:00Z", "Milk Sales", "5", "INCOME"),
  ], new Map([["Equipment", "Operational"], ["Custom", "Capital & Construction"]]));
  assert.deepEqual(months.map(m => m.key), ["2026-03", "2026-01"]);
  assert.equal(months[1].groups[0].name, "Operational");
  assert.equal(months[0].groups[0].name, "Capital & Construction");
  assert.deepEqual(monthlyExpenses([], new Map()), []);
});

test("category links preserve payer and partial date range but reset pagination", () => {
  const params = new URLSearchParams("from=2026-09-12&to=2026-09-21&paidBy=Fahad&page=3&category=Feed&category=Medicine&type=ALL");
  const url = new URL(monthlyExpenseHref(params, "2026-09", "Medicine"), "https://farm.test");
  assert.equal(url.hash, "#ledger");
  assert.equal(url.searchParams.get("from"), "2026-09-12");
  assert.equal(url.searchParams.get("to"), "2026-09-21");
  assert.equal(url.searchParams.get("paidBy"), "Fahad");
  assert.equal(url.searchParams.get("type"), "EXPENSE");
  assert.deepEqual(url.searchParams.getAll("category"), ["Medicine"]);
  assert.equal(url.searchParams.has("page"), false);
  assert.equal(params.get("page"), "3");
});

test("month links keep selected categories and use correct leap-year bounds", () => {
  const url = new URL(monthlyExpenseHref(new URLSearchParams("from=2024-01-01&to=2024-12-31&category=Feed&category=Medicine"), "2024-02"), "https://farm.test");
  assert.equal(url.searchParams.get("from"), "2024-02-01");
  assert.equal(url.searchParams.get("to"), "2024-02-29");
  assert.deepEqual(url.searchParams.getAll("category"), ["Feed", "Medicine"]);
});
