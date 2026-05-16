import { AgentEditForm } from "@/components/agent-edit-form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { listAgents, listAgentTeams, listBusinessTeams } from "@/server/queries";
import { translateVisibility, translateWorkflowType } from "@/lib/presentation";

function parseStringArray(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export default function AgentTeamsPage() {
  const teams = listAgentTeams();
  const agents = listAgents();
  const business_teams = listBusinessTeams();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Agent Teams"
        title="Agent 团队编排"
        description="查看 Leader、协作 Agent、工作流类型和每个 Agent 的在线定义。"
        badges={[
          { label: `${teams.length} 个 Agent 团队`, variant: "accent" },
          { label: `${agents.length} 个 Agent`, variant: "neutral" },
        ]}
      />

      {teams.map((team) => {
        const members = agents.filter((agent) => agent.teamId === team.id);
        const leader = members.find((agent) => agent.id === team.leaderAgentId);
        const businessTeam = business_teams.find((item) => item.id === team.businessTeamId);

        return (
          <Panel key={team.id}>
            <PanelHeader
              eyebrow={`Agent 团队 · ${businessTeam?.name ?? "未知业务团队"}`}
              title={team.name}
              description={team.description}
              action={<Badge variant="neutral">{translateVisibility(team.visibility)}</Badge>}
            />
            <PanelBody className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 text-sm text-[var(--ink-muted)]">
                <div>工作流类型: <span className="font-medium text-[var(--ink)]">{translateWorkflowType(team.workflowType)}</span></div>
                <div>Agent 数量: <span className="font-medium text-[var(--ink)]">{members.length}</span></div>
                <div>超时时间: <span className="font-medium text-[var(--ink)]">{Math.round(team.timeoutMs / 60000)} 分钟</span></div>
                <div>成功率目标: <span className="font-medium text-[var(--ink)]">{Math.round(team.successRateThreshold * 100)}%</span></div>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 text-sm font-medium text-[var(--ink)]">
                Leader: {leader?.name ?? "未指定，将由编排策略选择"}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {members.map((agent) => (
                  <div key={agent.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-base font-semibold text-[var(--ink)]">{agent.name}</div>
                      <Badge variant="neutral">{agent.role}</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{agent.personaPrompt}</p>
                    <div className="mt-3 space-y-1 text-sm text-[var(--ink-muted)]">
                      <div>模型: {agent.model}</div>
                      <div>工具集: {parseStringArray(agent.toolBindingsJson).join(", ") || "未配置"}</div>
                      <div>记忆范围: {agent.memoryScope}</div>
                    </div>
                    <AgentEditForm agent={agent} />
                  </div>
                ))}
              </div>
            </PanelBody>
          </Panel>
        );
      })}
    </div>
  );
}
