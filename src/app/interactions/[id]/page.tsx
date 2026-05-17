import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { RuntimeInteractionConsole } from "@/components/runtime-interaction-console";
import { translateHumanIntervention, translateSessionMode, translateStatus } from "@/lib/presentation";
import { formatDateTime } from "@/lib/utils";
import { buildAgentHarnessExecutionProfile } from "@/server/agent-harness-core";
import { getRuntimeSessionDetail } from "@/server/runtime-session-core";

function statusVariant(status: string): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (status === "running") return "accent";
  if (status === "error") return "danger";
  if (status === "idle") return "neutral";
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
        eyebrow="ui.generated.c5446baecd9"
        title={detail.session.title}
        description="ui.generated.c9ae641eb8d"
        badges={[
          { label: translateSessionMode(detail.session.mode), variant: "neutral" },
          { label: translateStatus(detail.session.status), variant: statusVariant(detail.session.status) },
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
            role: "ui.common.humanCollaboration",
            kind: "human" as const,
          },
        ]}
        compactFacts={[
          {
            label: "ui.generated.c8e175e7aa9",
            value: detail.runtimeBinding?.name ?? "ui.generated.c3bf179d8d0",
            detail: detail.runtimeDescriptor?.executionMode ?? "unknown",
          },
          {
            label: "ui.generated.cbc56f948bb",
            value: detail.providerProfile?.name ?? "ui.generated.c3bf179d8d0",
            detail: detail.session.model,
          },
          {
            label: "ui.generated.c2bca55a7ed",
            value: detail.agentDefinition?.name ?? "ui.generated.c72077749f7",
            detail: harnessProfile
              ? `${harnessProfile.approvalMode} · ${harnessProfile.thinkingLevel}`
              : "ui.generated.c7ff55ad2c8",
          },
          {
            label: "ui.generated.c70f970c1fc",
            value: detail.agentTeam?.name ?? "ui.generated.c72077749f7",
            detail: detail.agentTeam
              ? <>{detail.agents.length} ui.common.count.members</>
              : "ui.generated.c8aa0dfdca3",
          },
          {
            label: "ui.generated.c8d8f100fb8",
            value: translateHumanIntervention(
              harnessProfile?.humanIntervention ?? detail.runtimeDescriptor?.humanIntervention ?? "manual",
            ),
            detail: detail.session.createdBy,
          },
          {
            label: "ui.generated.c093dea88c9",
            value: formatDateTime(detail.session.updatedAt),
            detail: <>ui.common.createdAtPrefix {formatDateTime(detail.session.createdAt)}</>,
          },
        ]}
      />
    </div>
  );
}
