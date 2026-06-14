import assert from "node:assert/strict";
import test from "node:test";
import { PUT } from "@/app/api/system-settings/language-pack/route";
import { GET as getLanguagePackTemplate } from "@/app/api/system-settings/language-pack/template/route";
import { uiText } from "@/lib/language-pack";

async function assertAuthenticationRequired(response: Response) {
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("content-type")?.includes("application/json"), true);
  const body = (await response.json()) as { ok?: boolean; error?: string };
  assert.equal(body.ok, false);
  assert.equal(body.error, uiText("ui.api.errors.authenticationRequired", "Authentication required."));
}

test("language pack settings PUT requires an authenticated system administrator", async () => {
  await assertAuthenticationRequired(
    await PUT(
      new Request("http://agentworld.test/api/system-settings/language-pack", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeLocale: "en-US" }),
      }),
    ),
  );
});

test("language pack template GET requires an authenticated system administrator", async () => {
  await assertAuthenticationRequired(
    await getLanguagePackTemplate(
      new Request("http://agentworld.test/api/system-settings/language-pack/template"),
    ),
  );
});
