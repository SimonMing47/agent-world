import assert from "node:assert/strict";
import test from "node:test";
import {
  DELETE as deleteAccessGrants,
  GET as getAccessGrants,
  PATCH as patchAccessGrants,
  POST as postAccessGrants,
} from "@/app/api/access-grants/route";
import {
  DELETE as deleteExecutionPolicies,
  GET as getExecutionPolicies,
  PATCH as patchExecutionPolicies,
  POST as postExecutionPolicies,
} from "@/app/api/execution-policies/route";
import {
  GET as getRuntimeDiscoveries,
  POST as postRuntimeDiscoveries,
} from "@/app/api/runtimes/discover/route";
import {
  DELETE as deleteServiceCatalog,
  GET as getServiceCatalog,
  PATCH as patchServiceCatalog,
  POST as postServiceCatalog,
} from "@/app/api/service-catalog/route";
import {
  DELETE as deleteTenantSpaces,
  GET as getTenantSpaces,
  PATCH as patchTenantSpaces,
  POST as postTenantSpaces,
} from "@/app/api/tenant-spaces/route";
import {
  DELETE as deleteWebhooks,
  GET as getWebhooks,
  PATCH as patchWebhooks,
  POST as postWebhooks,
} from "@/app/api/webhooks/route";
import { uiText } from "@/lib/language-pack";

type Handler = (request: Request) => Response | Promise<Response>;

type CrudRouteCase = {
  label: string;
  path: string;
  handlers: {
    delete: Handler;
    get: Handler;
    patch: Handler;
    post: Handler;
  };
};

const crudRouteCases: CrudRouteCase[] = [
  {
    label: "access grants",
    path: "/api/access-grants",
    handlers: {
      delete: deleteAccessGrants,
      get: getAccessGrants,
      patch: patchAccessGrants,
      post: postAccessGrants,
    },
  },
  {
    label: "execution policies",
    path: "/api/execution-policies",
    handlers: {
      delete: deleteExecutionPolicies,
      get: getExecutionPolicies,
      patch: patchExecutionPolicies,
      post: postExecutionPolicies,
    },
  },
  {
    label: "service catalog",
    path: "/api/service-catalog",
    handlers: {
      delete: deleteServiceCatalog,
      get: getServiceCatalog,
      patch: patchServiceCatalog,
      post: postServiceCatalog,
    },
  },
  {
    label: "tenant spaces",
    path: "/api/tenant-spaces",
    handlers: {
      delete: deleteTenantSpaces,
      get: getTenantSpaces,
      patch: patchTenantSpaces,
      post: postTenantSpaces,
    },
  },
  {
    label: "webhooks",
    path: "/api/webhooks",
    handlers: {
      delete: deleteWebhooks,
      get: getWebhooks,
      patch: patchWebhooks,
      post: postWebhooks,
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

function requestFor(path: string, method = "GET") {
  return new Request(`http://agentworld.test${path}`, {
    method,
    headers: {
      Cookie: "agentworld_session=bogus",
    },
    body: method === "GET" ? undefined : "not-json",
  });
}

for (const routeCase of crudRouteCases) {
  test(`${routeCase.label} GET rejects bogus sessions`, async () => {
    await assertAuthenticationRequired(
      await routeCase.handlers.get(requestFor(routeCase.path)),
    );
  });

  test(`${routeCase.label} POST rejects bogus sessions before parsing the body`, async () => {
    await assertAuthenticationRequired(
      await routeCase.handlers.post(requestFor(routeCase.path, "POST")),
    );
  });

  test(`${routeCase.label} PATCH rejects bogus sessions before parsing the body`, async () => {
    await assertAuthenticationRequired(
      await routeCase.handlers.patch(requestFor(routeCase.path, "PATCH")),
    );
  });

  test(`${routeCase.label} DELETE rejects bogus sessions before parsing the body`, async () => {
    await assertAuthenticationRequired(
      await routeCase.handlers.delete(requestFor(routeCase.path, "DELETE")),
    );
  });
}

test("runtime discovery GET rejects bogus sessions", async () => {
  await assertAuthenticationRequired(
    await getRuntimeDiscoveries(requestFor("/api/runtimes/discover")),
  );
});

test("runtime discovery POST rejects bogus sessions before refreshing catalogs", async () => {
  await assertAuthenticationRequired(
    await postRuntimeDiscoveries(requestFor("/api/runtimes/discover", "POST")),
  );
});
