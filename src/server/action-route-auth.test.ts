import assert from "node:assert/strict";
import test from "node:test";
import { POST as optimizeAgentDefinition } from "@/app/api/agent-definitions/optimize/route";
import { POST as testAgentDefinition } from "@/app/api/agent-definitions/test/route";
import { POST as assembleAgentTeam } from "@/app/api/agent-teams/assemble/route";
import { POST as createCodeReviewSession } from "@/app/api/agent-teams/code-review-session/route";
import { POST as optimizeAgentTeam } from "@/app/api/agent-teams/optimize/route";
import {
  DELETE as deleteSkills,
  GET as getSkills,
  PATCH as patchSkills,
  POST as postSkills,
} from "@/app/api/skills/route";
import { POST as importSkills } from "@/app/api/skills/import/route";
import { POST as optimizeSkill } from "@/app/api/skills/optimize/route";
import { POST as syncSkill } from "@/app/api/skills/sync/route";
import { uiText } from "@/lib/language-pack";

type Handler = (request: Request) => Promise<Response> | Response;

const routeCases: Array<{
  label: string;
  path: string;
  method: "DELETE" | "GET" | "PATCH" | "POST";
  handler: Handler;
}> = [
  {
    label: "agent definition optimize",
    path: "/api/agent-definitions/optimize",
    method: "POST",
    handler: optimizeAgentDefinition,
  },
  {
    label: "agent definition test",
    path: "/api/agent-definitions/test",
    method: "POST",
    handler: testAgentDefinition,
  },
  {
    label: "agent team assemble",
    path: "/api/agent-teams/assemble",
    method: "POST",
    handler: assembleAgentTeam,
  },
  {
    label: "agent team optimize",
    path: "/api/agent-teams/optimize",
    method: "POST",
    handler: optimizeAgentTeam,
  },
  {
    label: "agent team code review session",
    path: "/api/agent-teams/code-review-session",
    method: "POST",
    handler: createCodeReviewSession,
  },
  {
    label: "skills GET",
    path: "/api/skills",
    method: "GET",
    handler: getSkills,
  },
  {
    label: "skills POST",
    path: "/api/skills",
    method: "POST",
    handler: postSkills,
  },
  {
    label: "skills PATCH",
    path: "/api/skills",
    method: "PATCH",
    handler: patchSkills,
  },
  {
    label: "skills DELETE",
    path: "/api/skills",
    method: "DELETE",
    handler: deleteSkills,
  },
  {
    label: "skills import",
    path: "/api/skills/import",
    method: "POST",
    handler: importSkills,
  },
  {
    label: "skills optimize",
    path: "/api/skills/optimize",
    method: "POST",
    handler: optimizeSkill,
  },
  {
    label: "skills sync",
    path: "/api/skills/sync",
    method: "POST",
    handler: syncSkill,
  },
];

function buildRequest(path: string, method: string) {
  const init: RequestInit = {
    method,
    headers: {
      cookie: "agentworld_session=bogus",
    },
  };
  if (method !== "GET") {
    init.body = "not-json";
  }
  return new Request(`http://agentworld.test${path}`, init);
}

async function assertAuthenticationRequired(response: Response) {
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("content-type")?.includes("application/json"), true);
  const body = (await response.json()) as { ok?: boolean; error?: string };
  assert.equal(body.ok, false);
  assert.equal(body.error, uiText("ui.api.errors.authenticationRequired", "Authentication required."));
}

for (const routeCase of routeCases) {
  test(`${routeCase.label} rejects bogus sessions before side effects`, async () => {
    await assertAuthenticationRequired(await routeCase.handler(buildRequest(routeCase.path, routeCase.method)));
  });
}
