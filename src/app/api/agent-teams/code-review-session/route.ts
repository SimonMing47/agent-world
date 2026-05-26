import { NextResponse } from "next/server";
import {
  queryOne,
  type AgentTeam,
  type BusinessTeam,
  type ProviderProfile,
  type ProviderRuntimeBinding,
  type TenantSpace,
} from "@/server/db";
import { getRequestAuthContext } from "@/server/auth-core";
import { createRuntimeSession, submitRuntimeSessionMessage } from "@/server/runtime-session-core";
import { submitTaskRun } from "@/server/queries";
import { uiText } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

const codeReviewPrompt = uiText("ui.agentTeamCodeReviewSession.prompt");

function resolveRuntimeDefaults() {
  const runtimeBinding = queryOne<ProviderRuntimeBinding>(
    "SELECT * FROM provider_runtime_bindings WHERE is_enabled = 1 ORDER BY updated_at DESC LIMIT 1",
  );
  if (!runtimeBinding) throw new Error(uiText("ui.agentTeamCodeReviewSession.errors.runtimeBindingMissing"));

  const providerProfile =
    (runtimeBinding.defaultProviderProfileId
      ? queryOne<ProviderProfile>(
          "SELECT * FROM provider_profiles WHERE id = ? AND is_enabled = 1",
          runtimeBinding.defaultProviderProfileId,
        )
      : null) ??
    queryOne<ProviderProfile>(
      "SELECT * FROM provider_profiles WHERE is_enabled = 1 ORDER BY updated_at DESC LIMIT 1",
    );
  if (!providerProfile) throw new Error(uiText("ui.agentTeamCodeReviewSession.errors.providerMissing"));

  return { runtimeBinding, providerProfile };
}

export async function POST(request: Request) {
  try {
    const authContext = await getRequestAuthContext();
    const actorName = authContext?.user.name?.trim() || authContext?.user.email?.trim();
    if (!actorName) {
      return NextResponse.json({ ok: false, error: uiText("identityAccess.errors.signInRequired") }, { status: 401 });
    }

    const body = (await request.json()) as { teamId?: string };
    if (!body.teamId?.trim()) {
      return NextResponse.json({ ok: false, error: uiText("ui.agentTeamCodeReviewSession.errors.teamIdMissing") }, { status: 400 });
    }

    const team = queryOne<AgentTeam>("SELECT * FROM agent_teams WHERE id = ?", body.teamId);
    if (!team) {
      return NextResponse.json({ ok: false, error: uiText("ui.agentTeamCodeReviewSession.errors.teamMissing") }, { status: 404 });
    }

    const businessTeam = queryOne<BusinessTeam>(
      "SELECT * FROM business_teams WHERE id = ?",
      team.businessTeamId,
    );
    if (!businessTeam) throw new Error(uiText("ui.agentTeamCodeReviewSession.errors.businessTeamMissing"));

    const tenantSpace = queryOne<TenantSpace>(
      "SELECT * FROM tenant_spaces WHERE id = ?",
      businessTeam.tenantSpaceId,
    );
    if (!tenantSpace) throw new Error(uiText("ui.agentTeamCodeReviewSession.errors.tenantSpaceMissing"));

    const { runtimeBinding, providerProfile } = resolveRuntimeDefaults();
    const taskRun = submitTaskRun({
      teamId: team.id,
      sourceType: "manual",
      sourceRef: "agentworld-code-review",
      requestedBy: actorName,
      priority: 85,
      plannerMode: team.workflowType === "dag" ? "leader_agent" : "rule",
      summary: uiText("ui.agentTeamCodeReviewSession.task.summary"),
      inputPayload: {
        taskType: "code_review",
        repository: "AgentWorld",
        objective: uiText("ui.agentTeamCodeReviewSession.task.objective"),
        requestedOutputs: ["review_comments", "risk_summary", "fix_suggestions"],
      },
      permissionSnapshot: {
        repositoryAccess: "read_only",
        externalActions: "disabled",
      },
      agentTeamRunPlan: {
        strategy: team.workflowType,
        teamObjective: uiText("ui.agentTeamCodeReviewSession.task.objective"),
      },
      executionPolicySnapshot: {
        mode: "one_off_code_review",
        requireEvidence: true,
      },
      environmentSnapshot: {
        templateId: null,
        environmentId: null,
        payload: {
          workspace: {
            id: "agentworld-local-workspace",
            repository: "AgentWorld",
            root: process.cwd(),
          },
          instructions: codeReviewPrompt,
        },
      },
    });
    if (!taskRun) {
      throw new Error(uiText("ui.agentTeamCodeReviewSession.errors.taskRunUnreadable"));
    }

    const detail = createRuntimeSession({
      tenantSpaceId: tenantSpace.id,
      businessTeamId: businessTeam.id,
      agentTeamId: team.id,
      agentDefinitionId: null,
      runtimeBindingId: runtimeBinding.id,
      providerProfileId: providerProfile.id,
      mode: "agent_team",
      title: uiText("ui.agentTeamCodeReviewSession.session.title", undefined, { team: team.name }),
      systemPrompt: [team.orchestrationPrompt, `Task run id: ${taskRun.taskRun.id}`].filter(Boolean).join("\n\n"),
      model: providerProfile.defaultModel,
      createdBy: actorName,
    });
    if (!detail) {
      throw new Error(uiText("ui.agentTeamCodeReviewSession.errors.sessionUnreadable"));
    }

    await submitRuntimeSessionMessage({
      sessionId: detail.session.id,
      actorId: authContext?.user.id ?? null,
      actorName,
      content: uiText("ui.agentTeamCodeReviewSession.session.message", undefined, {
        prompt: codeReviewPrompt,
        taskRunId: taskRun.taskRun.id,
      }),
    });

    return NextResponse.json({
      ok: true,
      sessionId: detail.session.id,
      taskRunId: taskRun.taskRun.id,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : uiText("ui.agentTeamCodeReviewSession.errors.createFailed") },
      { status: 400 },
    );
  }
}
