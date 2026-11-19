import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readMigration = (name) => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
const privateFunctions = await readMigration("20261119011619_revoke_public_private_function_execute.sql");
const anonPrivileges = await readMigration("20261119011810_revoke_anon_table_and_excess_authenticated_privileges.sql");
const profileRead = await readMigration("20261119011824_grant_authenticated_profile_select.sql");

test("revokes default function execution from PUBLIC and anon in private schema", () => {
  assert.match(privateFunctions, /REVOKE\s+ALL\s+ON\s+ALL\s+FUNCTIONS\s+IN\s+SCHEMA\s+private\s+FROM\s+PUBLIC\s*;/i);
  assert.match(privateFunctions, /REVOKE\s+ALL\s+ON\s+ALL\s+FUNCTIONS\s+IN\s+SCHEMA\s+private\s+FROM\s+anon\s*;/i);
});

test("grants authenticated the RLS helper functions required by policies", () => {
  for (const signature of [
    "can_manage_conversation(uuid)",
    "can_view_profile(uuid)",
    "has_role(text)",
    "is_active_profile(uuid)",
    "is_active_user()",
    "is_conversation_member(uuid)"
  ]) {
    assert.ok(privateFunctions.includes(`GRANT EXECUTE ON FUNCTION private.${signature} TO authenticated;`));
  }
});

test("removes anonymous table and sequence privileges and maintenance rights", () => {
  assert.match(anonPrivileges, /REVOKE\s+ALL\s+PRIVILEGES\s+ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+public\s+FROM\s+anon\s*;/i);
  assert.match(anonPrivileges, /REVOKE\s+ALL\s+PRIVILEGES\s+ON\s+ALL\s+SEQUENCES\s+IN\s+SCHEMA\s+public\s+FROM\s+anon\s*;/i);
  assert.match(anonPrivileges, /REVOKE\s+TRUNCATE,\s*REFERENCES,\s*TRIGGER,\s*MAINTAIN\s+ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+public\s+FROM\s+authenticated/i);
  assert.match(anonPrivileges, /ALTER\s+DEFAULT\s+PRIVILEGES\s+FOR\s+ROLE\s+postgres\s+IN\s+SCHEMA\s+public/i);
});

test("allows authenticated profile reads while retaining RLS policies", () => {
  assert.match(profileRead, /GRANT\s+SELECT\s+ON\s+TABLE\s+public\.profiles\s+TO\s+authenticated\s*;/i);
});
