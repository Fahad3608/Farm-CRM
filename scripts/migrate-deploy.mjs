// `prisma migrate deploy`, plus recovery from a migration that failed on an
// earlier deploy.
//
// When a migration errors, Prisma leaves it in the history unfinished and then
// refuses every later deploy with P3009 until someone marks it rolled back.
// The build is the only thing that reaches the production database, so without
// this the app can never deploy again — a fixed migration is not enough.
// Postgres runs each migration in a transaction, so a failed one left nothing
// behind and is safe to re-apply.

import { spawnSync } from "node:child_process";

function prisma(...args) {
  const run = spawnSync("npx", ["prisma", ...args], { encoding: "utf8" });
  const output = `${run.stdout ?? ""}${run.stderr ?? ""}`;
  process.stdout.write(output);
  return { code: run.status ?? 1, output };
}

const deploy = prisma("migrate", "deploy");
if (deploy.code === 0) process.exit(0);

const failed = deploy.output.includes("P3009")
  ? [...deploy.output.matchAll(/The `(.+?)` migration started at .*? failed/g)].map((m) => m[1])
  : [];
if (failed.length === 0) process.exit(deploy.code);

for (const name of failed) {
  console.log(`Marking failed migration ${name} as rolled back so it can re-apply.`);
  const resolved = prisma("migrate", "resolve", "--rolled-back", name);
  if (resolved.code !== 0) process.exit(resolved.code);
}

process.exit(prisma("migrate", "deploy").code);
