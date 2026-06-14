import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

test("proxy returns JSON 401 for protected API requests without a session", async () => {
  const response = proxy(new NextRequest("http://agentworld.test/api/task-runs/submit"));

  assert.equal(response.status, 401);
  assert.equal(response.headers.get("content-type")?.includes("application/json"), true);
  const body = (await response.json()) as { ok?: boolean; code?: string };
  assert.equal(body.ok, false);
  assert.equal(body.code, "authentication_required");
});

test("proxy keeps browser redirects for protected pages without a session", () => {
  const response = proxy(new NextRequest("http://agentworld.test/task-runs"));

  assert.equal(response.status, 307);
  const location = response.headers.get("location");
  assert.ok(location);
  const url = new URL(location);
  assert.equal(url.pathname, "/");
  assert.equal(url.searchParams.get("next"), "/task-runs");
});

test("proxy allows protected API requests with a session cookie to continue", () => {
  const response = proxy(
    new NextRequest("http://agentworld.test/api/task-runs/submit", {
      headers: { Cookie: "agentworld_session=example" },
    }),
  );

  assert.equal(response.status, 200);
});
