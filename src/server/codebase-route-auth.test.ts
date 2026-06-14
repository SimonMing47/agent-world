import assert from "node:assert/strict";
import test from "node:test";
import { DELETE, GET, PATCH, POST } from "@/app/api/codebases/route";
import { uiText } from "@/lib/language-pack";

async function assertAuthenticationRequired(response: Response) {
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("content-type")?.includes("application/json"), true);
  const body = (await response.json()) as { ok?: boolean; error?: string };
  assert.equal(body.ok, false);
  assert.equal(body.error, uiText("ui.api.errors.authenticationRequired", "Authentication required."));
}

test("codebases GET requires authentication", async () => {
  await assertAuthenticationRequired(await GET(new Request("http://agentworld.test/api/codebases")));
});

test("codebases POST requires authentication before parsing the body", async () => {
  await assertAuthenticationRequired(
    await POST(
      new Request("http://agentworld.test/api/codebases", {
        method: "POST",
        body: "not-json",
      }),
    ),
  );
});

test("codebases PATCH requires authentication before parsing the body", async () => {
  await assertAuthenticationRequired(
    await PATCH(
      new Request("http://agentworld.test/api/codebases", {
        method: "PATCH",
        body: "not-json",
      }),
    ),
  );
});

test("codebases DELETE requires authentication before parsing the body", async () => {
  await assertAuthenticationRequired(
    await DELETE(
      new Request("http://agentworld.test/api/codebases", {
        method: "DELETE",
        body: "not-json",
      }),
    ),
  );
});
