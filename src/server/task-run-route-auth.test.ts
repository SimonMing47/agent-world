import assert from "node:assert/strict";
import test from "node:test";
import { POST as resolveTaskRunIntervention } from "@/app/api/task-run-interventions/[id]/resolve/route";
import { GET as getTaskRunDependencyGraph } from "@/app/api/task-runs/[id]/dependency-graph/route";
import { GET as getTaskRunExecutionBoard } from "@/app/api/task-runs/[id]/execution-board/route";
import { POST as assignTaskRunFinding } from "@/app/api/task-runs/[id]/findings/[findingId]/assignment/route";
import { POST as createTaskRunFindingRemediation } from "@/app/api/task-runs/[id]/findings/[findingId]/remediation/route";
import { POST as triageTaskRunFinding } from "@/app/api/task-runs/[id]/findings/[findingId]/triage/route";
import { POST as retryTaskRunNode } from "@/app/api/task-runs/[id]/nodes/[nodeId]/retry/route";
import { GET as getTaskRunPolicyHits } from "@/app/api/task-runs/[id]/policy-hits/route";
import { POST as resumeTaskRun } from "@/app/api/task-runs/[id]/resume/route";
import { POST as appendTaskRunTeamNote } from "@/app/api/task-runs/[id]/team-notes/route";
import { POST as tickTaskRun } from "@/app/api/task-runs/[id]/tick/route";
import { POST as submitTaskRun } from "@/app/api/task-runs/submit/route";
import { uiText } from "@/lib/language-pack";

const routeCases: Array<{
  label: string;
  method: "GET" | "POST";
  path: string;
  invoke: (request: Request) => Promise<Response> | Response;
}> = [
  {
    label: "task run submit",
    method: "POST",
    path: "/api/task-runs/submit",
    invoke: submitTaskRun,
  },
  {
    label: "task run resume",
    method: "POST",
    path: "/api/task-runs/run_1/resume",
    invoke: (request) => resumeTaskRun(request, { params: Promise.resolve({ id: "run_1" }) }),
  },
  {
    label: "task run tick",
    method: "POST",
    path: "/api/task-runs/run_1/tick",
    invoke: (request) => tickTaskRun(request, { params: Promise.resolve({ id: "run_1" }) }),
  },
  {
    label: "task run node retry",
    method: "POST",
    path: "/api/task-runs/run_1/nodes/node_1/retry",
    invoke: (request) =>
      retryTaskRunNode(request, { params: Promise.resolve({ id: "run_1", nodeId: "node_1" }) }),
  },
  {
    label: "task run intervention resolve",
    method: "POST",
    path: "/api/task-run-interventions/intervention_1/resolve",
    invoke: (request) =>
      resolveTaskRunIntervention(request, { params: Promise.resolve({ id: "intervention_1" }) }),
  },
  {
    label: "task run dependency graph",
    method: "GET",
    path: "/api/task-runs/run_1/dependency-graph",
    invoke: (request) => getTaskRunDependencyGraph(request, { params: Promise.resolve({ id: "run_1" }) }),
  },
  {
    label: "task run execution board",
    method: "GET",
    path: "/api/task-runs/run_1/execution-board",
    invoke: (request) => getTaskRunExecutionBoard(request, { params: Promise.resolve({ id: "run_1" }) }),
  },
  {
    label: "task run policy hits",
    method: "GET",
    path: "/api/task-runs/run_1/policy-hits",
    invoke: (request) => getTaskRunPolicyHits(request, { params: Promise.resolve({ id: "run_1" }) }),
  },
  {
    label: "task run finding assignment",
    method: "POST",
    path: "/api/task-runs/run_1/findings/finding_1/assignment",
    invoke: (request) =>
      assignTaskRunFinding(request, { params: Promise.resolve({ id: "run_1", findingId: "finding_1" }) }),
  },
  {
    label: "task run finding remediation",
    method: "POST",
    path: "/api/task-runs/run_1/findings/finding_1/remediation",
    invoke: (request) =>
      createTaskRunFindingRemediation(request, {
        params: Promise.resolve({ id: "run_1", findingId: "finding_1" }),
      }),
  },
  {
    label: "task run finding triage",
    method: "POST",
    path: "/api/task-runs/run_1/findings/finding_1/triage",
    invoke: (request) =>
      triageTaskRunFinding(request, { params: Promise.resolve({ id: "run_1", findingId: "finding_1" }) }),
  },
  {
    label: "task run team note",
    method: "POST",
    path: "/api/task-runs/run_1/team-notes",
    invoke: (request) => appendTaskRunTeamNote(request, { params: Promise.resolve({ id: "run_1" }) }),
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
  test(`${routeCase.label} rejects bogus sessions before task-run side effects`, async () => {
    const request = buildRequest(routeCase.path, routeCase.method);
    await assertAuthenticationRequired(await routeCase.invoke(request));
  });
}
