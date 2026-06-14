import assert from "node:assert/strict";
import test from "node:test";
import {
  GET as getAccessRequests,
  PATCH as patchAccessRequests,
  POST as postAccessRequests,
} from "@/app/api/access-requests/route";
import {
  DELETE as deleteAccessWhitelist,
  GET as getAccessWhitelist,
  PATCH as patchAccessWhitelist,
  POST as postAccessWhitelist,
} from "@/app/api/access-whitelist/route";
import {
  DELETE as deleteAuthProviders,
  GET as getAuthProviders,
  PATCH as patchAuthProviders,
  POST as postAuthProviders,
} from "@/app/api/auth/providers/route";
import {
  DELETE as deleteKnowledgeAccessTokens,
  GET as getKnowledgeAccessTokens,
  POST as postKnowledgeAccessTokens,
} from "@/app/api/knowledge/access-tokens/route";
import {
  GET as getIdentityAccessSettings,
  PATCH as patchIdentityAccessSettings,
  POST as postIdentityAccessSettings,
} from "@/app/api/identity-access/settings/route";
import {
  GET as getPluginManifests,
  POST as postPluginManifests,
} from "@/app/api/plugins/manifests/route";
import {
  GET as getKnowledgeBaseSettings,
  PUT as putKnowledgeBaseSettings,
} from "@/app/api/system-settings/knowledge-base/route";
import { uiText } from "@/lib/language-pack";

type Handler = (request: Request) => Response | Promise<Response>;

type RouteCase = {
  label: string;
  path: string;
  read: Handler;
  writes: Array<{ method: string; handler: Handler }>;
};

const routeCases: RouteCase[] = [
  {
    label: "access requests",
    path: "/api/access-requests",
    read: getAccessRequests,
    writes: [
      { method: "POST", handler: postAccessRequests },
      { method: "PATCH", handler: patchAccessRequests },
    ],
  },
  {
    label: "access whitelist",
    path: "/api/access-whitelist",
    read: getAccessWhitelist,
    writes: [
      { method: "POST", handler: postAccessWhitelist },
      { method: "PATCH", handler: patchAccessWhitelist },
      { method: "DELETE", handler: deleteAccessWhitelist },
    ],
  },
  {
    label: "auth providers",
    path: "/api/auth/providers",
    read: getAuthProviders,
    writes: [
      { method: "POST", handler: postAuthProviders },
      { method: "PATCH", handler: patchAuthProviders },
      { method: "DELETE", handler: deleteAuthProviders },
    ],
  },
  {
    label: "identity access settings",
    path: "/api/identity-access/settings",
    read: getIdentityAccessSettings,
    writes: [
      { method: "POST", handler: postIdentityAccessSettings },
      { method: "PATCH", handler: patchIdentityAccessSettings },
    ],
  },
  {
    label: "knowledge access tokens",
    path: "/api/knowledge/access-tokens",
    read: getKnowledgeAccessTokens,
    writes: [
      { method: "POST", handler: postKnowledgeAccessTokens },
      { method: "DELETE", handler: deleteKnowledgeAccessTokens },
    ],
  },
  {
    label: "knowledge base settings",
    path: "/api/system-settings/knowledge-base",
    read: getKnowledgeBaseSettings,
    writes: [{ method: "PUT", handler: putKnowledgeBaseSettings }],
  },
  {
    label: "plugin manifests",
    path: "/api/plugins/manifests",
    read: getPluginManifests,
    writes: [{ method: "POST", handler: postPluginManifests }],
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
      await routeCase.read(new Request(`http://agentworld.test${routeCase.path}`)),
    );
  });

  for (const write of routeCase.writes) {
    test(`${routeCase.label} ${write.method} requires authentication before parsing the body`, async () => {
      await assertAuthenticationRequired(
        await write.handler(
          new Request(`http://agentworld.test${routeCase.path}`, {
            method: write.method,
            headers: { "Content-Type": "application/json" },
            body: "not-json",
          }),
        ),
      );
    });
  }
}
