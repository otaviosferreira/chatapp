import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationPath = new URL("../supabase/migrations/20261119011619_revoke_public_private_function_execute.sql", import.meta.url);
const sql = await readFile(migrationPath, "utf8");

test("revokes default function execution from PUBLIC and anon in private schema", () => {
  assert.match(sql, /REVOKE\s+ALL\s+ON\s+ALL\s+FUNCTIONS\s+IN\s+SCHEMA\s+private\s+FROM\s+PUBLIC\s*;/i);
  assert.match(sql, /REVOKE\s+ALL\s+ON\s+ALL\s+FUNCTIONS\s+IN\s+SCHEMA\s+private\s+FROM\s+anon\s*;/i);
});

test("grants authenticated only the RLS helper functions required by policies", () => {
  for (const signature of [
    "can_manage_conversation(uuid)",
    "can_view_profile(uuid)",
    "has_role(text)",
    "is_active_profile(uuid)",
    "is_active_user()",
    "is_conversation_member(uuid)"
  ]) {
    assert.match(sql, new RegExp("GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+private\\." + signature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s+TO\\s+authenticated\\s*;", "i"));
  }
});
