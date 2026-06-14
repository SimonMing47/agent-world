import assert from "node:assert/strict";
import test from "node:test";
import {
  DELETE as deleteTeamAssets,
  GET as getTeamAssets,
  PATCH as patchTeamAssets,
  POST as postTeamAssets,
} from "@/app/api/team-assets/route";
import {
  DELETE as deleteTeamMembers,
  GET as getTeamMembers,
  PATCH as patchTeamMembers,
  POST as postTeamMembers,
} from "@/app/api/team-members/route";
import {
  DELETE as deleteTeamPermissions,
  GET as getTeamPermissions,
  PATCH as patchTeamPermissions,
  POST as postTeamPermissions,
} from "@/app/api/team-permissions/route";
import { uiText } from "@/lib/language-pack";

type RouteHandlers = {
  delete: (request: Request) => Promise<Response>;
  get: (request: Request) => Promise<Response>;
  patch: (request: Request) => Promise<Response>;
  post: (request: Request) => Promise<Response>;
};

const routeCases: Array<{ label: string; path: string; handlers: RouteHandlers }> = [
  {
    label: "team assets",
    path: "/api/team-assets",
    handlers: {
      delete: deleteTeamAssets,
      get: getTeamAssets,
      patch: patchTeamAssets,
      post: postTeamAssets,
    },
  },
  {
    label: "team members",
    path: "/api/team-members",
    handlers: {
      delete: deleteTeamMembers,
      get: getTeamMembers,
      patch: patchTeamMembers,
      post: postTeamMembers,
    },
  },
  {
    label: "team permissions",
    path: "/api/team-permissions",
    handlers: {
      delete: deleteTeamPermissions,
      get: getTeamPermissions,
      patch: patchTeamPermissions,
      post: postTeamPermissions,
    },
  },
];

async function assertAuthenticationRequired(response: Response) {
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("content-type")?.includes("application/json"), true);
  const body = (await response.json()) as { ok?: boolean; error?: string };
  assert.equal(body.ok, false);
  assert.equal(body.error, uiText("ui.api.errors.authenticationRequired", "Authentication required."));
}

for (const routeCase of routeCases) {
  test(`${routeCase.label} GET requires authentication`, async () => {
    await assertAuthenticationRequired(
      await routeCase.handlers.get(new Request(`http://agentworld.test${routeCase.path}`)),
    );
  });

  test(`${routeCase.label} POST requires authentication before parsing the body`, async () => {
    await assertAuthenticationRequired(
      await routeCase.handlers.post(
        new Request(`http://agentworld.test${routeCase.path}`, {
          method: "POST",
          body: "not-json",
        }),
      ),
    );
  });

  test(`${routeCase.label} PATCH requires authentication before parsing the body`, async () => {
    await assertAuthenticationRequired(
      await routeCase.handlers.patch(
        new Request(`http://agentworld.test${routeCase.path}`, {
          method: "PATCH",
          body: "not-json",
        }),
      ),
    );
  });

  test(`${routeCase.label} DELETE requires authentication before parsing the body`, async () => {
    await assertAuthenticationRequired(
      await routeCase.handlers.delete(
        new Request(`http://agentworld.test${routeCase.path}`, {
          method: "DELETE",
          body: "not-json",
        }),
      ),
    );
  });
}
