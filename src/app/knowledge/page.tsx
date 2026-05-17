import { BookOpen, Database, Layers3, RefreshCcw } from "lucide-react";
import { KnowledgeSpaceForm } from "@/components/knowledge-space-form";
import { PageHeader } from "@/components/page-header";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { listKnowledgeSpaceBindings, listKnowledgeSpaces } from "@/server/knowledge-core";
import { getKnowledgeManagementSnapshot } from "@/server/openviking-core";
import { listAgentTeams, listBusinessTeams } from "@/server/queries";

function syncStatusLabel(status: string) {
  if (status.startsWith("remote_")) return "已同步 OpenViking";
  if (status === "local_shadow") return "本地影子库";
  if (status === "remote_failed_local_shadow") return "远端失败，本地保留";
  return "待处理";
}

function typeLabel(type: string) {
  const labels: Record<string, string> = {
    global: "全局",
    team: "团队",
    project: "项目",
    agent_team: "AgentTeam",
  };
  return labels[type] ?? type;
}

export default async function KnowledgePage() {
  const [snapshot, spaces, bindings, businessTeams, agentTeams] = await Promise.all([
    getKnowledgeManagementSnapshot(),
    Promise.resolve(listKnowledgeSpaces()),
    Promise.resolve(listKnowledgeSpaceBindings()),
    Promise.resolve(listBusinessTeams()),
    Promise.resolve(listAgentTeams()),
  ]);
  const bindingCountBySpace = new Map<string, number>();
  bindings.forEach((binding) => {
    bindingCountBySpace.set(binding.knowledgeSpaceId, (bindingCountBySpace.get(binding.knowledgeSpaceId) ?? 0) + 1);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Knowledge"
        title="知识管理"
        description="基于 OpenViking 的团队级、项目级、AgentTeam 级知识空间，任务运行时会按权限解析并加载。"
        badges={[
          { label: snapshot.health.ok ? "OpenViking 已连接" : "OpenViking 未连接", variant: snapshot.health.ok ? "success" : "warning" },
          { label: `${spaces.length} 个知识空间`, variant: "accent" },
        ]}
        action={
          <KnowledgeSpaceForm
            businessTeams={businessTeams.map((team) => ({ id: team.id, name: team.name }))}
            agentTeams={agentTeams.map((team) => ({ id: team.id, businessTeamId: team.businessTeamId, name: team.name }))}
          />
        }
      />

      <Panel>
        <PanelBody className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <BookOpen className="h-4 w-4" />
              OpenViking
            </div>
            <div className="mt-2 text-sm text-[var(--ink-muted)]">Base URL: {snapshot.health.baseUrl}</div>
            <div className="mt-1 text-sm text-[var(--ink-muted)]">进程: {snapshot.process.status}</div>
            <div className="mt-1 text-sm text-[var(--ink-muted)]">状态: {snapshot.health.error ?? "healthy"}</div>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <Layers3 className="h-4 w-4" />
              知识空间
            </div>
            <div className="mt-2 text-3xl font-semibold text-[var(--ink)]">{spaces.length}</div>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <Database className="h-4 w-4" />
              知识条目
            </div>
            <div className="mt-2 text-3xl font-semibold text-[var(--ink)]">{snapshot.entries.length}</div>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <RefreshCcw className="h-4 w-4" />
              远端树
            </div>
            <div className="mt-2 text-3xl font-semibold text-[var(--ink)]">{snapshot.tree.length}</div>
            <div className="mt-1 text-sm text-[var(--ink-muted)]">L0 筛选 / L1 目录 / L2 原文</div>
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          eyebrow="Knowledge Spaces"
          title="团队知识体系"
          description="每个空间映射到稳定的 viking:// URI，可绑定业务团队、项目、AgentTeam 或任务蓝图。"
        />
        <DataTable>
          <DataTableHeader>
            <DataTableRow>
              <DataTableHead>名称</DataTableHead>
              <DataTableHead>类型</DataTableHead>
              <DataTableHead>可见性</DataTableHead>
              <DataTableHead>绑定</DataTableHead>
              <DataTableHead>OpenViking URI</DataTableHead>
            </DataTableRow>
          </DataTableHeader>
          <DataTableBody>
            {spaces.map((space) => (
              <DataTableRow key={space.id}>
                <DataTableCell className="min-w-56">
                  <div className="font-semibold text-[var(--ink)]">{space.name}</div>
                  <div className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">{space.description}</div>
                </DataTableCell>
                <DataTableCell>{typeLabel(space.spaceType)}</DataTableCell>
                <DataTableCell>{space.visibility}</DataTableCell>
                <DataTableCell>{bindingCountBySpace.get(space.id) ?? 0}</DataTableCell>
                <DataTableCell className="max-w-[520px] break-all font-mono text-xs">{space.vikingUri}</DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      </Panel>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel>
          <PanelHeader
            eyebrow="Skill Registry"
            title="Skill 注册表"
            description="Skill 内容同步到 OpenViking，AgentTeam 通过知识空间或蓝图 memoryPolicy 获取。"
          />
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Skill</DataTableHead>
                <DataTableHead>层</DataTableHead>
                <DataTableHead>状态</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {snapshot.skills.map((skill) => (
                <DataTableRow key={skill.id}>
                  <DataTableCell>
                    <div className="font-semibold text-[var(--ink)]">{skill.name}</div>
                    <div className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">{skill.description}</div>
                  </DataTableCell>
                  <DataTableCell>{skill.layer}</DataTableCell>
                  <DataTableCell>{skill.isEnabled ? "启用" : "停用"}</DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="Recent Knowledge"
            title="最近知识条目"
            description="任务上下文、Skill、人工反馈和归档结果都会进入这里。"
          />
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>条目</DataTableHead>
                <DataTableHead>同步</DataTableHead>
                <DataTableHead>URI</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {snapshot.entries.map((entry) => (
                <DataTableRow key={entry.id}>
                  <DataTableCell>
                    <div className="font-semibold text-[var(--ink)]">{entry.title}</div>
                    <div className="mt-1 text-xs text-[var(--ink-muted)]">{entry.sourceType}</div>
                  </DataTableCell>
                  <DataTableCell>{syncStatusLabel(entry.syncStatus)}</DataTableCell>
                  <DataTableCell className="max-w-[360px] break-all font-mono text-xs">{entry.vikingUri}</DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </Panel>
      </section>
    </div>
  );
}
