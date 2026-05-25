import { NextResponse } from "next/server";
import {
  queryOne,
  type AgentTeam,
  type BusinessTeam,
  type ProviderProfile,
  type ProviderRuntimeBinding,
  type TenantSpace,
} from "@/server/db";
import { createRuntimeSession, submitRuntimeSessionMessage } from "@/server/runtime-session-core";
import { submitTaskRun } from "@/server/queries";

export const dynamic = "force-dynamic";

const codeReviewPrompt = `请以这个 Agent Team 执行一次性任务：检视 AgentWorld 代码，生成多个检视意见。

目标：
- 根据团队成员分工检视代码，而不是只给泛泛总结
- 输出多条 review comment
- 每条意见包含标题、严重程度、相关位置、风险说明、建议修改方式
- 优先关注 Agent 调度、Agent 调用、工具权限、安全边界、TypeScript 类型、错误处理和用户体验`;

function resolveRuntimeDefaults() {
  const runtimeBinding = queryOne<ProviderRuntimeBinding>(
    "SELECT * FROM provider_runtime_bindings WHERE is_enabled = 1 ORDER BY updated_at DESC LIMIT 1",
  );
  if (!runtimeBinding) throw new Error("没有可用的运行时绑定。");

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
  if (!providerProfile) throw new Error("没有可用的模型 Provider。");

  return { runtimeBinding, providerProfile };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { teamId?: string };
    if (!body.teamId?.trim()) {
      return NextResponse.json({ ok: false, error: "缺少 teamId。" }, { status: 400 });
    }

    const team = queryOne<AgentTeam>("SELECT * FROM agent_teams WHERE id = ?", body.teamId);
    if (!team) {
      return NextResponse.json({ ok: false, error: "找不到 Agent Team。" }, { status: 404 });
    }

    const businessTeam = queryOne<BusinessTeam>(
      "SELECT * FROM business_teams WHERE id = ?",
      team.businessTeamId,
    );
    if (!businessTeam) throw new Error("找不到团队所属业务团队。");

    const tenantSpace = queryOne<TenantSpace>(
      "SELECT * FROM tenant_spaces WHERE id = ?",
      businessTeam.tenantSpaceId,
    );
    if (!tenantSpace) throw new Error("找不到租户空间。");

    const { runtimeBinding, providerProfile } = resolveRuntimeDefaults();
    const taskRun = submitTaskRun({
      teamId: team.id,
      sourceType: "manual",
      sourceRef: "agentworld-code-review",
      requestedBy: "agent-team-console",
      priority: 85,
      plannerMode: team.workflowType === "dag" ? "leader_agent" : "rule",
      summary: "AgentWorld 代码检视任务已创建。",
      inputPayload: {
        taskType: "code_review",
        repository: "AgentWorld",
        objective: "检视 AgentWorld 代码，生成多个检视意见。",
        requestedOutputs: ["review_comments", "risk_summary", "fix_suggestions"],
      },
      permissionSnapshot: {
        repositoryAccess: "read_only",
        externalActions: "disabled",
      },
      agentTeamRunPlan: {
        strategy: team.workflowType,
        teamObjective: "检视 AgentWorld 代码，生成多个检视意见。",
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
      throw new Error("代码检视任务创建后无法读取详情。");
    }

    const detail = createRuntimeSession({
      tenantSpaceId: tenantSpace.id,
      businessTeamId: businessTeam.id,
      agentTeamId: team.id,
      agentDefinitionId: null,
      runtimeBindingId: runtimeBinding.id,
      providerProfileId: providerProfile.id,
      mode: "agent_team",
      title: `${team.name} · AgentWorld 代码检视`,
      systemPrompt: [team.orchestrationPrompt, `Task run id: ${taskRun.taskRun.id}`].filter(Boolean).join("\n\n"),
      model: providerProfile.defaultModel,
      createdBy: "agent-team-console",
    });
    if (!detail) {
      throw new Error("运行时会话创建后无法读取详情。");
    }

    await submitRuntimeSessionMessage({
      sessionId: detail.session.id,
      actorName: "Operator",
      content: `${codeReviewPrompt}\n\n关联任务运行：${taskRun.taskRun.id}`,
    });

    return NextResponse.json({
      ok: true,
      sessionId: detail.session.id,
      taskRunId: taskRun.taskRun.id,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "创建代码检视任务或会话失败。" },
      { status: 400 },
    );
  }
}
