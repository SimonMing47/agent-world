import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { RuntimeInteractionConsole } from "@/components/runtime-interaction-console";
import { translateWithPack } from "@/lib/language-pack";
import { formatDateTime } from "@/lib/utils";
import { buildAgentHarnessExecutionProfile } from "@/server/agent-harness-core";
import { canAccessBusinessTeam, getRequestAuthContext } from "@/server/auth-core";
import { getActiveLanguagePack } from "@/server/language-pack-store";
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
  const authContext = await getRequestAuthContext();
  const languagePack = getActiveLanguagePack();
  const t = (key: string, fallback?: string, params?: Record<string, string | number>) =>
    translateWithPack(languagePack, key, fallback, params);
  const label = (group: string, value: string) => t(`labels.${group}.${value}`, value);

  if (!detail) {
    notFound();
  }
  if (!authContext) {
    redirect(`/signin?next=${encodeURIComponent(`/interactions/${resolved.id}`)}`);
  }
  if (!canAccessBusinessTeam(authContext, detail.session.businessTeamId)) {
    notFound();
  }

  const humanActorName =
    authContext?.user.name?.trim() ||
    authContext?.user.email?.trim() ||
    detail.session.createdBy ||
    "User";
  const humanActorId = authContext?.user.id ?? "human-user";
  const humanRole = authContext?.user.title?.trim() || "ui.common.humanCollaboration";
  const displayCreatedBy =
    detail.session.createdBy === "Operator" || detail.session.createdBy === "agent-team-console"
      ? humanActorName
      : detail.session.createdBy;
  const normalizeHumanActorName = (message: { actorType?: string; role?: string; actorName: string }) =>
    (message.actorType === "human" || message.role === "user") && message.actorName === "Operator"
      ? humanActorName
      : message.actorName;
  const normalizeEventActorName = (actorName: string | null) =>
    actorName === "Operator" ? humanActorName : actorName;

  const harnessProfile = detail.agentDefinition
    ? buildAgentHarnessExecutionProfile(detail.agentDefinition, detail.runtimeBinding)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="console.interactions.detail.eyebrow"
        title={detail.session.title}
        description="console.interactions.detail.description"
        badges={[
          { label: label("sessionMode", detail.session.mode), variant: "neutral" },
          { label: label("status", detail.session.status), variant: statusVariant(detail.session.status) },
          { label: detail.session.model, variant: "accent" },
        ]}
      />

      <RuntimeInteractionConsole
        sessionId={detail.session.id}
        sessionMode={detail.session.mode as "single_agent" | "agent_team"}
        initialStatus={detail.session.status}
        teamContext={detail.agentTeam
          ? {
              id: detail.agentTeam.id,
              name: detail.agentTeam.name,
              description: detail.agentTeam.description,
              workflowType: detail.agentTeam.workflowType,
              leaderAgentId: detail.agentTeam.leaderAgentId,
            }
          : null}
        initialMessages={detail.messages.map((message) => ({
          id: message.id,
          actorType: message.actorType,
          actorId:
            (message.actorType === "human" || message.role === "user") && message.actorName === "Operator"
              ? humanActorId
              : message.actorId,
          actorName: normalizeHumanActorName(message),
          role: message.role,
          content: message.content,
          turnIndex: message.turnIndex,
          createdAt: message.createdAt,
        }))}
        initialEvents={detail.events.map((event) => ({
          id: event.id,
          actorName: normalizeEventActorName(event.actorName),
          eventType: event.eventType,
          payload: event.payload,
          createdAt: event.createdAt,
        }))}
        participants={[
          ...detail.agents.map((agent) => ({
            id: agent.id,
            name: agent.name,
            displayName: agent.displayName,
            role: agent.role,
            kind: "agent" as const,
            isLeader: agent.id === detail.agentTeam?.leaderAgentId,
            mentionHandle: agent.mentionHandle,
            avatarConfigJson: agent.avatarConfigJson,
            capabilityProfileJson: agent.capabilityProfileJson,
          })),
          {
            id: humanActorId,
            name: humanActorName,
            role: humanRole,
            kind: "human" as const,
          },
        ]}
        compactFacts={[
          {
            label: "ui.common.resources.runtimeBinding",
            value: detail.runtimeBinding?.name ?? "ui.common.unbound",
            detail: detail.runtimeDescriptor?.executionMode ?? "unknown",
          },
          {
            label: "ui.common.resources.providerProfile",
            value: detail.providerProfile?.name ?? "ui.common.unbound",
            detail: detail.session.model,
          },
          {
            label: "ui.common.resources.agent",
            value: detail.agentDefinition?.name ?? "ui.common.none",
            detail: harnessProfile
              ? `${harnessProfile.approvalMode} · ${harnessProfile.thinkingLevel}`
              : "console.interactions.detail.unboundDefaultProfile",
          },
          {
            label: "ui.common.resources.agentTeam",
            value: detail.agentTeam?.name ?? "ui.common.none",
            detail: detail.agentTeam
              ? <>{detail.agents.length} ui.common.count.members</>
              : "console.interactions.detail.singleAgentSession",
          },
          {
            label: "ui.common.humanCollaboration",
            value: label(
              "humanIntervention",
              harnessProfile?.humanIntervention ?? detail.runtimeDescriptor?.humanIntervention ?? "manual",
            ),
            detail: displayCreatedBy,
          },
          {
            label: "ui.common.updatedAt",
            value: formatDateTime(detail.session.updatedAt),
            detail: <>ui.common.createdAtPrefix {formatDateTime(detail.session.createdAt)}</>,
          },
        ]}
      />
    </div>
  );
}
