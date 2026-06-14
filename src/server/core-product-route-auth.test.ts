import assert from "node:assert/strict";
import test from "node:test";
import {
  DELETE as deleteAgentTeams,
  GET as getAgentTeams,
  PATCH as patchAgentTeams,
  POST as postAgentTeams,
} from "@/app/api/agent-teams/route";
import {
  DELETE as deleteAgentTeamDetail,
  GET as getAgentTeamDetail,
  PATCH as patchAgentTeamDetail,
} from "@/app/api/agent-teams/[id]/route";
import {
  DELETE as deleteBusinessTeams,
  GET as getBusinessTeams,
  PATCH as patchBusinessTeams,
  POST as postBusinessTeams,
} from "@/app/api/business-teams/route";
import {
  DELETE as deleteTaskBlueprints,
  GET as getTaskBlueprints,
  PATCH as patchTaskBlueprints,
  POST as postTaskBlueprints,
} from "@/app/api/task-blueprints/route";
import {
  DELETE as deleteTaskBlueprintDetail,
  GET as getTaskBlueprintDetail,
  PATCH as patchTaskBlueprintDetail,
} from "@/app/api/task-blueprints/[id]/route";
import {
  GET as getTaskBlueprintPermissionPreview,
} from "@/app/api/task-blueprints/[id]/permission-preview/route";
import { uiText } from "@/lib/language-pack";

type RootHandler = (request: Request) => Promise<Response> | Response;
type DetailHandler = (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => Promise<Response> | Response;

const rootRouteCases: Array<{
  label: string;
  path: string;
  handlers: {
    delete: RootHandler;
    get: RootHandler;
    patch: RootHandler;
    post: RootHandler;
  };
}> = [
  {
    label: "business teams",
    path: "/api/business-teams",
    handlers: {
      delete: deleteBusinessTeams,
      get: getBusinessTeams,
      patch: patchBusinessTeams,
      post: postBusinessTeams,
    },
  },
  {
    label: "agent teams",
    path: "/api/agent-teams",
    handlers: {
      delete: deleteAgentTeams,
      get: getAgentTeams,
      patch: patchAgentTeams,
      post: postAgentTeams,
    },
  },
  {
    label: "task blueprints",
    path: "/api/task-blueprints",
    handlers: {
      delete: deleteTaskBlueprints,
      get: getTaskBlueprints,
      patch: patchTaskBlueprints,
      post: postTaskBlueprints,
    },
  },
];

const detailRouteCases: Array<{
  label: string;
  path: string;
  handlers: {
    delete?: DetailHandler;
    get: DetailHandler;
    patch?: DetailHandler;
  };
}> = [
  {
    label: "agent team detail",
    path: "/api/agent-teams/team_1",
    handlers: {
      delete: deleteAgentTeamDetail,
      get: getAgentTeamDetail,
      patch: patchAgentTeamDetail,
    },
  },
  {
    label: "task blueprint detail",
    path: "/api/task-blueprints/blueprint_1",
    handlers: {
      delete: deleteTaskBlueprintDetail,
      get: getTaskBlueprintDetail,
      patch: patchTaskBlueprintDetail,
    },
  },
  {
    label: "task blueprint permission preview",
    path: "/api/task-blueprints/blueprint_1/permission-preview",
    handlers: {
      get: getTaskBlueprintPermissionPreview,
    },
  },
];

function buildRequest(path: string, method = "GET") {
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

for (const routeCase of rootRouteCases) {
  test(`${routeCase.label} GET rejects bogus sessions`, async () => {
    await assertAuthenticationRequired(await routeCase.handlers.get(buildRequest(routeCase.path)));
  });

  test(`${routeCase.label} POST rejects bogus sessions before parsing the body`, async () => {
    await assertAuthenticationRequired(await routeCase.handlers.post(buildRequest(routeCase.path, "POST")));
  });

  test(`${routeCase.label} PATCH rejects bogus sessions before parsing the body`, async () => {
    await assertAuthenticationRequired(await routeCase.handlers.patch(buildRequest(routeCase.path, "PATCH")));
  });

  test(`${routeCase.label} DELETE rejects bogus sessions before parsing the body`, async () => {
    await assertAuthenticationRequired(await routeCase.handlers.delete(buildRequest(routeCase.path, "DELETE")));
  });
}

for (const routeCase of detailRouteCases) {
  const context = { params: Promise.resolve({ id: "entity_1" }) };

  test(`${routeCase.label} GET rejects bogus sessions`, async () => {
    await assertAuthenticationRequired(await routeCase.handlers.get(buildRequest(routeCase.path), context));
  });

  if (routeCase.handlers.patch) {
    const handler = routeCase.handlers.patch;
    test(`${routeCase.label} PATCH rejects bogus sessions before parsing the body`, async () => {
      await assertAuthenticationRequired(await handler(buildRequest(routeCase.path, "PATCH"), context));
    });
  }

  if (routeCase.handlers.delete) {
    const handler = routeCase.handlers.delete;
    test(`${routeCase.label} DELETE rejects bogus sessions before parsing the body`, async () => {
      await assertAuthenticationRequired(await handler(buildRequest(routeCase.path, "DELETE"), context));
    });
  }
}
