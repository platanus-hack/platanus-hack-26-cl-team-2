import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  MOCK_DB_BY_AREA,
  MOCK_DB_CATALOG,
  MOCK_DB_TOOL_NAMES,
  accessMockDb,
  filterMockDbToolNames,
  isMockDbTool,
} from "../src/harness/mock-db.js";

const KEYS_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../mock-db/user_keys.txt",
);

describe("mock DB tools", () => {
  it("exposes three txt-backed read/write tools", () => {
    assert.equal(MOCK_DB_TOOL_NAMES.size, 3);
    assert.equal(MOCK_DB_CATALOG.credit_cards_db.file, "credit_cards.txt");
    assert.equal(MOCK_DB_CATALOG.users_health_db.file, "users_health.txt");
    assert.equal(MOCK_DB_CATALOG.user_keys_db.file, "user_keys.txt");
  });

  it("maps area ACL as specified", () => {
    assert.deepEqual(MOCK_DB_BY_AREA.data, [
      "users_health_db",
      "credit_cards_db",
    ]);
    assert.deepEqual(MOCK_DB_BY_AREA.finance, ["credit_cards_db"]);
    assert.deepEqual(MOCK_DB_BY_AREA.it, ["user_keys_db"]);
    assert.deepEqual(MOCK_DB_BY_AREA.engineering, ["user_keys_db"]);
  });

  it("filters mock-db tool names from harnessTools", () => {
    assert.deepEqual(
      filterMockDbToolNames([
        "done",
        "send_message",
        "credit_cards_db",
        "issue_refund",
      ]),
      ["credit_cards_db"],
    );
  });

  it("denies access when the agent lacks the tool", () => {
    const result = accessMockDb(
      "run_test",
      "agent_x",
      "credit_cards_db",
      { action: "read" },
      [],
    );
    assert.equal(result.ok, false);
    assert.equal(result.status, "denied");
  });

  it("reads and writes when authorized", () => {
    assert.equal(isMockDbTool("user_keys_db"), true);

    const cards = accessMockDb(
      "run_test",
      "seed_finance",
      "credit_cards_db",
      { action: "read" },
      ["credit_cards_db"],
    );
    assert.equal(cards.ok, true);
    assert.match(String(cards.content), /USER SEBA: 1234 5678/);

    const health = accessMockDb(
      "run_test",
      "seed_data",
      "users_health_db",
      { action: "read" },
      ["users_health_db", "credit_cards_db"],
    );
    assert.match(String(health.content), /USER SEBA: Asthma/);

    const original = readFileSync(KEYS_PATH, "utf8");
    try {
      const written = accessMockDb(
        "run_test",
        "seed_it",
        "user_keys_db",
        { action: "write", content: "(USER SEBA: platanus)\n(USER SEBA: temp)" },
        ["user_keys_db"],
      );
      assert.equal(written.ok, true);
      assert.equal(written.action, "write");
      const after = accessMockDb(
        "run_test",
        "seed_engineering",
        "user_keys_db",
        { action: "read" },
        ["user_keys_db"],
      );
      assert.match(String(after.content), /temp/);
    } finally {
      writeFileSync(KEYS_PATH, original.endsWith("\n") ? original : `${original}\n`);
    }
  });
});
