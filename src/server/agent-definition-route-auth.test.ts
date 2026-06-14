import assert from "node:assert/strict";
import test from "node:test";
import { DELETE, GET, PATCH, POST } from "@/app/api/agent-definitions/route";
import {
  DELETE as DELETE_BY_ID,
  GET as GET_BY_ID,
  PATCH as PATCH_BY_ID,
} from "@/app/api/agent-definitions/[id]/route";
import { uiText } from "@/lib/language-pack";

const routeContext = {
  params: Promise.resolve({ id: "agent-smoke" }),
};

async function assertAuthenticationRequired(response: Response) {
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("content-type")?.includes("application/json"), true);
  const body = (await response.json()) as { ok?: boolean; error?: string };
  assert.equal(body.ok, false);
  assert.equal(body.error, uiText("ui.api.errors.authenticationRequired", "Authentication required."));
}

test("agent definitions GET requires authentication", async () => {
  await assertAuthenticationRequired(await GET(new Request("http://agentworld.test/api/agent-definitions")));
});

test("agent definitions POST requires authentication before parsing the body", async () => {
  await assertAuthenticationRequired(
    await POST(
      new Request("http://agentworld.test/api/agent-definitions", {
        method: "POST",
        body: "not-json",
      }),
    ),
  );
});

test("agent definitions PATCH requires authentication before parsing the body", async () => {
  await assertAuthenticationRequired(
    await PATCH(
      new Request("http://agentworld.test/api/agent-definitions", {
        method: "PATCH",
        body: "not-json",
      }),
    ),
  );
});

test("agent definitions DELETE requires authentication before parsing the body", async () => {
  await assertAuthenticationRequired(
    await DELETE(
      new Request("http://agentworld.test/api/agent-definitions", {
        method: "DELETE",
        body: "not-json",
      }),
    ),
  );
});

test("agent definition detail GET requires authentication", async () => {
  await assertAuthenticationRequired(
    await GET_BY_ID(new Request("http://agentworld.test/api/agent-definitions/agent-smoke"), routeContext),
  );
});

test("agent definition detail PATCH requires authentication before parsing the body", async () => {
  await assertAuthenticationRequired(
    await PATCH_BY_ID(
      new Request("http://agentworld.test/api/agent-definitions/agent-smoke", {
        method: "PATCH",
        body: "not-json",
      }),
      routeContext,
    ),
  );
});

test("agent definition detail DELETE requires authentication", async () => {
  await assertAuthenticationRequired(
    await DELETE_BY_ID(
      new Request("http://agentworld.test/api/agent-definitions/agent-smoke", {
        method: "DELETE",
      }),
      routeContext,
    ),
  );
});
