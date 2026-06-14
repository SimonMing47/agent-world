import assert from "node:assert/strict";
import test from "node:test";
import {
  DELETE as deleteKnowledgeEntries,
  GET as getKnowledgeEntries,
  PATCH as patchKnowledgeEntries,
  POST as postKnowledgeEntries,
} from "@/app/api/knowledge/entries/route";
import {
  GET as getKnowledgeEntryVersions,
  POST as postKnowledgeEntryVersions,
} from "@/app/api/knowledge/entry-versions/route";
import { POST as postKnowledgeImport } from "@/app/api/knowledge/import/route";
import { GET as getKnowledgeLayers } from "@/app/api/knowledge/layers/route";
import { POST as postKnowledgeRetrievalTest } from "@/app/api/knowledge/retrieval-test/route";
import { PATCH as patchKnowledgeSkill } from "@/app/api/knowledge/skills/[id]/route";
import { GET as getKnowledgeSkills } from "@/app/api/knowledge/skills/route";
import {
  DELETE as deleteKnowledgeSpaces,
  GET as getKnowledgeSpaces,
  PATCH as patchKnowledgeSpaces,
  POST as postKnowledgeSpaces,
} from "@/app/api/knowledge/spaces/route";
import { POST as postKnowledgeSync } from "@/app/api/knowledge/sync/route";
import { uiText } from "@/lib/language-pack";

type Handler = (request: Request) => Promise<Response> | Response;

const patchSkillHandler: Handler = (request) =>
  patchKnowledgeSkill(request, { params: Promise.resolve({ id: "skill-bogus" }) });

const routeCases: Array<{
  label: string;
  path: string;
  method: "DELETE" | "GET" | "PATCH" | "POST";
  handler: Handler;
}> = [
  {
    label: "knowledge entries GET",
    path: "/api/knowledge/entries",
    method: "GET",
    handler: getKnowledgeEntries,
  },
  {
    label: "knowledge entries POST",
    path: "/api/knowledge/entries",
    method: "POST",
    handler: postKnowledgeEntries,
  },
  {
    label: "knowledge entries PATCH",
    path: "/api/knowledge/entries",
    method: "PATCH",
    handler: patchKnowledgeEntries,
  },
  {
    label: "knowledge entries DELETE",
    path: "/api/knowledge/entries",
    method: "DELETE",
    handler: deleteKnowledgeEntries,
  },
  {
    label: "knowledge entry versions GET",
    path: "/api/knowledge/entry-versions?entryId=entry-bogus",
    method: "GET",
    handler: getKnowledgeEntryVersions,
  },
  {
    label: "knowledge entry versions POST",
    path: "/api/knowledge/entry-versions",
    method: "POST",
    handler: postKnowledgeEntryVersions,
  },
  {
    label: "knowledge import",
    path: "/api/knowledge/import",
    method: "POST",
    handler: postKnowledgeImport,
  },
  {
    label: "knowledge layers",
    path: "/api/knowledge/layers",
    method: "GET",
    handler: getKnowledgeLayers,
  },
  {
    label: "knowledge retrieval test",
    path: "/api/knowledge/retrieval-test",
    method: "POST",
    handler: postKnowledgeRetrievalTest,
  },
  {
    label: "knowledge skills GET",
    path: "/api/knowledge/skills",
    method: "GET",
    handler: getKnowledgeSkills,
  },
  {
    label: "knowledge skill PATCH",
    path: "/api/knowledge/skills/skill-bogus",
    method: "PATCH",
    handler: patchSkillHandler,
  },
  {
    label: "knowledge spaces GET",
    path: "/api/knowledge/spaces",
    method: "GET",
    handler: getKnowledgeSpaces,
  },
  {
    label: "knowledge spaces POST",
    path: "/api/knowledge/spaces",
    method: "POST",
    handler: postKnowledgeSpaces,
  },
  {
    label: "knowledge spaces PATCH",
    path: "/api/knowledge/spaces",
    method: "PATCH",
    handler: patchKnowledgeSpaces,
  },
  {
    label: "knowledge spaces DELETE",
    path: "/api/knowledge/spaces",
    method: "DELETE",
    handler: deleteKnowledgeSpaces,
  },
  {
    label: "knowledge sync",
    path: "/api/knowledge/sync",
    method: "POST",
    handler: postKnowledgeSync,
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
  test(`${routeCase.label} rejects bogus sessions before parsing or side effects`, async () => {
    await assertAuthenticationRequired(await routeCase.handler(buildRequest(routeCase.path, routeCase.method)));
  });
}
