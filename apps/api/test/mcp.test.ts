import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { DANGEROUS_TOOL, FINANCE_TOOLS } from "../src/harness/sandbox.js";
import { createMeshMcpServer, type MeshMcpOptions } from "../src/mcp/server.js";

/** No model calls: an MCP client talks to the server in-process. */
async function connect(opts: MeshMcpOptions = {}) {
  const mesh = createMeshMcpServer({ file: "spoof_eval_demo.json", logFile: null, ...opts });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await mesh.server.connect(serverSide);
  const client = new Client({ name: "mcp-test", version: "0.0.0" });
  await client.connect(clientSide);
  return { ...mesh, client, close: () => client.close() };
}

const firstText = (r: { content?: unknown }) => {
  const [c] = r.content as { type: string; text: string }[];
  assert.equal(c.type, "text");
  return c.text;
};

describe("MCP finance sandbox server", () => {
  it("lists the inbox tools and the lab's finance tools (same fields)", async () => {
    const { client, close } = await connect();
    const { tools } = await client.listTools();
    assert.deepEqual(
      tools.map((t) => t.name).sort(),
      ["issue_refund", "list_emails", "read_email", DANGEROUS_TOOL].sort(),
    );
    for (const lab of FINANCE_TOOLS) {
      const t = tools.find((x) => x.name === lab.name)!;
      assert.equal(t.description, lab.description);
      assert.deepEqual(Object.keys(t.inputSchema.properties ?? {}), Object.keys(lab.input_schema.properties ?? {}));
      assert.deepEqual(t.inputSchema.required, lab.input_schema.required);
    }
    await close();
  });

  it("defaults to the first attack email and lists it", async () => {
    const { client, email, close } = await connect();
    assert.equal(email.kind, "attack");
    const listed = JSON.parse(firstText(await client.callTool({ name: "list_emails", arguments: {} })));
    assert.equal(listed.emails[0].id, email.id);
    await close();
  });

  it("read_email returns the email, with the sender banner only when senderCheck is on", async () => {
    const off = await connect({ senderCheck: false });
    const plain = firstText(await off.client.callTool({ name: "read_email", arguments: { email_id: off.email.id } }));
    assert.ok(plain.startsWith("From:"), plain.slice(0, 80));
    assert.ok(!plain.includes("[Automated sender check"));
    await off.close();

    const on = await connect({ senderCheck: true });
    const flagged = firstText(await on.client.callTool({ name: "read_email", arguments: { email_id: on.email.id } }));
    assert.match(flagged, /^\[Automated sender check: SUSPICIOUS - /);
    assert.ok(flagged.includes(plain), "banner is prepended to the same email");
    await on.close();
  });

  it("read_email with an unknown id is an error", async () => {
    const { client, close } = await connect();
    const r = await client.callTool({ name: "read_email", arguments: { email_id: "nope" } });
    assert.equal(r.isError, true);
    await close();
  });

  it("blocks update_vendor_bank_account and records the attempt", async () => {
    const { client, attempts, close } = await connect();
    const r = await client.callTool({
      name: DANGEROUS_TOOL,
      arguments: { vendor_id: "V-1", iban: "CL00 1234" },
    });
    assert.deepEqual(JSON.parse(firstText(r)), { status: "blocked_by_sandbox", tool: DANGEROUS_TOOL });
    assert.equal(attempts.length, 1);
    assert.equal(attempts[0].tool, DANGEROUS_TOOL);
    assert.equal(attempts[0].dangerous, true);
    assert.equal(attempts[0].blocked, true);
    assert.deepEqual(attempts[0].args, { vendor_id: "V-1", iban: "CL00 1234" });
    await close();
  });

  it("simulates issue_refund and records it as allowed", async () => {
    const { client, attempts, close } = await connect();
    const r = await client.callTool({ name: "issue_refund", arguments: { order_id: "7712", amount: 19.99 } });
    assert.deepEqual(JSON.parse(firstText(r)), {
      status: "ok",
      simulated: true,
      order_id: "7712",
      amount: 19.99,
    });
    assert.equal(attempts.length, 1);
    assert.equal(attempts[0].blocked, false);
    assert.equal(attempts[0].dangerous, false);
    await close();
  });
});
