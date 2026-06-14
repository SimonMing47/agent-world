import assert from "node:assert/strict";
import test from "node:test";
import {
  GET as getRuntimeSessionDetail,
  DELETE as deleteRuntimeSessionDetail,
} from "@/app/api/runtime-sessions/[id]/route";
import {
  POST as postRuntimeSessionMessage,
} from "@/app/api/runtime-sessions/[id]/messages/route";
import {
  GET as streamRuntimeSession,
} from "@/app/api/runtime-sessions/[id]/stream/route";
import {
  GET as getRuntimeSessions,
  POST as postRuntimeSessions,
} from "@/app/api/runtime-sessions/route";
import { uiText } from "@/lib/language-pack";

async function assertAuthenticationRequired(response: Response) {
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("content-type")?.includes("application/json"), true);
  const body = (await response.json()) as { ok?: boolean; error?: string };
  assert.equal(body.ok, false);
  assert.equal(body.error, uiText("ui.api.errors.authenticationRequired", "Authentication required."));
}

test("runtime sessions GET requires authentication", async () => {
  await assertAuthenticationRequired(await getRuntimeSessions(new Request("http://agentworld.test/api/runtime-sessions")));
});

test("runtime sessions POST requires authentication before parsing the body", async () => {
  await assertAuthenticationRequired(
    await postRuntimeSessions(
      new Request("http://agentworld.test/api/runtime-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      }),
    ),
  );
});

test("runtime session detail GET requires authentication", async () => {
  await assertAuthenticationRequired(
    await getRuntimeSessionDetail(new Request("http://agentworld.test/api/runtime-sessions/session-a"), {
      params: Promise.resolve({ id: "session-a" }),
    }),
  );
});

test("runtime session detail DELETE requires authentication before deleting", async () => {
  await assertAuthenticationRequired(
    await deleteRuntimeSessionDetail(new Request("http://agentworld.test/api/runtime-sessions/session-a", {
      method: "DELETE",
    }), {
      params: Promise.resolve({ id: "session-a" }),
    }),
  );
});

test("runtime session messages POST requires authentication before parsing the body", async () => {
  await assertAuthenticationRequired(
    await postRuntimeSessionMessage(
      new Request("http://agentworld.test/api/runtime-sessions/session-a/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      }),
      {
        params: Promise.resolve({ id: "session-a" }),
      },
    ),
  );
});

test("runtime session stream GET requires authentication before opening the stream", async () => {
  await assertAuthenticationRequired(
    await streamRuntimeSession(new Request("http://agentworld.test/api/runtime-sessions/session-a/stream"), {
      params: Promise.resolve({ id: "session-a" }),
    }),
  );
});
