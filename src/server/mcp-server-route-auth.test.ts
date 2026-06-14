import assert from "node:assert/strict";
import test from "node:test";
import { DELETE, GET, PATCH, POST } from "@/app/api/mcp-servers/route";
import { uiText } from "@/lib/language-pack";

async function assertAuthenticationRequired(response: Response) {
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("content-type")?.includes("application/json"), true);
  const body = (await response.json()) as { ok?: boolean; error?: string };
  assert.equal(body.ok, false);
  assert.equal(body.error, uiText("ui.api.errors.authenticationRequired", "Authentication required."));
}

test("MCP servers GET requires authentication", async () => {
  await assertAuthenticationRequired(await GET(new Request("http://agentworld.test/api/mcp-servers")));
});

test("MCP servers POST requires authentication before parsing the body", async () => {
  await assertAuthenticationRequired(
    await POST(
      new Request("http://agentworld.test/api/mcp-servers", {
        method: "POST",
        body: "not-json",
      }),
    ),
  );
});

test("MCP servers PATCH requires authentication before parsing the body", async () => {
  await assertAuthenticationRequired(
    await PATCH(
      new Request("http://agentworld.test/api/mcp-servers", {
        method: "PATCH",
        body: "not-json",
      }),
    ),
  );
});

test("MCP servers DELETE requires authentication before parsing the body", async () => {
  await assertAuthenticationRequired(
    await DELETE(
      new Request("http://agentworld.test/api/mcp-servers", {
        method: "DELETE",
        body: "not-json",
      }),
    ),
  );
});
