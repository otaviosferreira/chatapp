import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20261124190407_prevent_employee_account_physical_deletion.sql", import.meta.url),
  "utf8",
);

test("blocks physical deletion of employee profiles and Auth identities", () => {
  assert.match(migration, /before delete on public\.profiles/i);
  assert.match(migration, /before delete on auth\.users/i);
  assert.match(migration, /errcode\s*=\s*'55000'/i);
});

test("revokes direct profile DELETE from application roles", () => {
  assert.match(
    migration,
    /revoke delete on table public\.profiles from public, anon, authenticated, service_role/i,
  );
});
