import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { RuntimeInteractionConsole } from "@/components/runtime-interaction-console";
import { formatDateTime } from "@/lib/utils";
import { buildAgentHarnessExecutionProfile } from "@/server/agent-harness-core";
import { getRuntimeSessionDetail } from "@/server/runtime-session-core";

function statusVariant(status: string): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (status === "running") return "accent";
  if (status === "error") return "danger";
  return "success";
}

export default async function RuntimeInteractionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolved = await params;
  const detail = getRuntimeSessionDetail(resolved.id);

  if (!detail) {
    notFound();
  }

  const harnessProfile = detail.agentDefinition
    ? buildAgentHarnessExecutionProfile(detail.agentDefinition, detail.runtimeBinding)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Interaction Detail"
        title={detail.session.title}
        description="真实模型交互、Agent Team 协作和人工介入都在这里展开。"
        badges={[
          { label: detail.session.mode, variant: "neutral" },
          { label: detail.session.status, variant: statusVariant(detail.session.status) },
          { label: detail.session.model, variant: "accent" },
        ]}
      />

      <RuntimeInteractionConsole
        sessionId={detail.session.id}
        sessionMode={detail.session.mode as "single_agent" | "agent_team"}
        initialStatus={detail.session.status}
        initialMessages={detail.messages.map((message) => ({
          id: message.id,
          actorType: message.actorType,
          actorName: message.actorName,
          role: message.role,
          content: message.content,
          createdAt: message.createdAt,
        }))}
        initialEvents={detail.events.map((event) => ({
          id: event.id,
          actorName: event.actorName,
          eventType: event.eventType,
          payload: event.payload,
          createdAt: event.createdAt,
        }))}
        participants={[
          ...detail.agents.map((agent) => ({
            id: agent.id,
            name: agent.name,
            role: agent.role,
            kind: "agent" as const,
            isLeader: agent.id === detail.agentTeam?.leaderAgentId,
          })),
          {
            id: "human-operator",
            name: "Operator",
            role: "人工协作",
            kind: "human" as const,
          },
        ]}
        compactFacts={[
          {
            label: "运行时",
            value: detail.runtimeBinding?.name ?? "未绑定",
            detail: detail.runtimeDescriptor?.executionMode ?? "unknown",
          },
          {
            label: "模型接口",
            value: detail.providerProfile?.name ?? "未绑定",
            detail: detail.session.model,
          },
          {
            label: "Agent 定义",
            value: detail.agentDefinition?.name ?? "无",
            detail: harnessProfile
              ? `${harnessProfile.approvalMode} · ${harnessProfile.thinkingLevel}`
              : "未绑定默认画像",
          },
          {
            label: "Agent Team",
            value: detail.agentTeam?.name ?? "无",
            detail: detail.agentTeam
              ? `${detail.agents.length} 个成员`
              : "单 Agent 会话",
          },
          {
            label: "人工介入",
            value: harnessProfile?.humanIntervention ?? detail.runtimeDescriptor?.humanIntervention ?? "manual",
            detail: detail.session.createdBy,
          },
          {
            label: "更新时间",
            value: formatDateTime(detail.session.updatedAt),
            detail: `创建于 ${formatDateTime(detail.session.createdAt)}`,
          },
        ]}
      />
    </div>
  );
}
