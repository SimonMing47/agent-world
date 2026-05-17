import { BookOpen, Database, Eye, Layers3, RefreshCcw } from "lucide-react";
import { DeleteResourceButton } from "@/components/delete-resource-button";
import { KnowledgeEntryForm } from "@/components/knowledge-entry-form";
import { KnowledgeSpaceForm } from "@/components/knowledge-space-form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import { DefinitionList } from "@/components/ui/definition-list";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
    agent_team: "Agent 团队",
  };
  return labels[type] ?? type;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    active: "启用",
    paused: "停用",
    archived: "归档",
  };
  return labels[status] ?? status;
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
        eyebrow="知识库"
        title="知识管理"
        description="维护团队、项目和 Agent 团队可访问的知识空间。"
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
          eyebrow="知识空间"
          title="团队知识体系"
          description="查看 URI、归属、访问范围和同步状态。"
        />
        <DataTable>
          <DataTableHeader>
            <DataTableRow>
              <DataTableHead>名称</DataTableHead>
              <DataTableHead>类型</DataTableHead>
              <DataTableHead>可见性</DataTableHead>
              <DataTableHead>状态</DataTableHead>
              <DataTableHead>绑定</DataTableHead>
              <DataTableHead>OpenViking URI</DataTableHead>
              <DataTableHead>操作</DataTableHead>
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
                <DataTableCell>{statusLabel(space.status)}</DataTableCell>
                <DataTableCell>{bindingCountBySpace.get(space.id) ?? 0}</DataTableCell>
                <DataTableCell className="max-w-[520px] break-all font-mono text-xs">{space.vikingUri}</DataTableCell>
                <DataTableCell>
                  <div className="flex flex-wrap gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Eye className="h-4 w-4" />
                          详情
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="w-[min(92vw,920px)]">
                        <DialogHeader>
                          <DialogTitle>{space.name}</DialogTitle>
                          <DialogDescription>知识空间的团队归属、OpenViking 地址和运行时加载策略。</DialogDescription>
                        </DialogHeader>
                        <DialogBody>
                          <DefinitionList
                            columnsClassName="sm:grid-cols-2"
                            items={[
                              { label: "ID", value: space.id },
                              { label: "标识", value: space.slug },
                              { label: "类型", value: typeLabel(space.spaceType) },
                              { label: "状态", value: statusLabel(space.status) },
                              { label: "业务团队", value: space.businessTeamId ?? "未绑定" },
                              { label: "Agent 团队", value: space.agentTeamId ?? "未绑定" },
                              { label: "项目 Key", value: space.projectKey ?? "未绑定" },
                              { label: "可见性", value: space.visibility },
                              { label: "OpenViking URI", value: <span className="break-all font-mono text-xs">{space.vikingUri}</span> },
                              {
                                label: "保留策略",
                                value: <pre className="whitespace-pre-wrap break-all font-mono text-xs">{space.retentionPolicyJson}</pre>,
                              },
                              { label: "描述", value: space.description || "未填写" },
                              { label: "更新时间", value: space.updatedAt },
                            ]}
                          />
                        </DialogBody>
                      </DialogContent>
                    </Dialog>
                    <KnowledgeSpaceForm
                      businessTeams={businessTeams.map((team) => ({ id: team.id, name: team.name }))}
                      agentTeams={agentTeams.map((team) => ({ id: team.id, businessTeamId: team.businessTeamId, name: team.name }))}
                      space={space}
                      triggerLabel="编辑"
                    />
                    <DeleteResourceButton
                      endpoint="/api/knowledge/spaces"
                      id={space.id}
                      confirmText={`确认删除知识空间「${space.name}」？`}
                    />
                  </div>
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      </Panel>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel>
          <PanelHeader
            eyebrow="Skill 目录"
            title="Skill 注册表"
            description="查看 Skill 的空间、版本和适用范围。"
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
            eyebrow="最近知识"
            title="最近知识条目"
            description="最近写入的上下文、反馈和归档结果。"
            action={
              <KnowledgeEntryForm
                spaces={spaces.map((space) => ({ id: space.id, name: space.name }))}
                triggerLabel="新增知识条目"
              />
            }
          />
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>条目</DataTableHead>
                <DataTableHead>同步</DataTableHead>
                <DataTableHead>URI</DataTableHead>
                <DataTableHead>操作</DataTableHead>
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
                  <DataTableCell>
                    <div className="flex flex-wrap gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="ghost">
                            <Eye className="h-4 w-4" />
                            查看
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="w-[min(96vw,980px)]">
                          <DialogHeader>
                            <DialogTitle>{entry.title}</DialogTitle>
                            <DialogDescription>知识条目的元数据、OpenViking 地址和 Markdown 内容。</DialogDescription>
                          </DialogHeader>
                          <DialogBody className="space-y-5">
                            <DefinitionList
                              columnsClassName="sm:grid-cols-2"
                              items={[
                                { label: "ID", value: entry.id },
                                { label: "知识空间", value: entry.knowledgeSpaceId ?? "按知识层归档" },
                                { label: "层", value: entry.layer },
                                { label: "Scope", value: entry.scopeKey },
                                { label: "来源", value: entry.sourceType },
                                { label: "同步", value: syncStatusLabel(entry.syncStatus) },
                                { label: "OpenViking URI", value: <span className="break-all font-mono text-xs">{entry.vikingUri}</span> },
                                {
                                  label: "元数据",
                                  value: <pre className="whitespace-pre-wrap break-all font-mono text-xs">{entry.metadataJson}</pre>,
                                },
                              ]}
                            />
                            <pre className="max-h-[420px] overflow-auto rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4 text-xs leading-5 text-[var(--ink-muted)]">
                              {entry.contentMd}
                            </pre>
                          </DialogBody>
                        </DialogContent>
                      </Dialog>
                      <KnowledgeEntryForm
                        spaces={spaces.map((space) => ({ id: space.id, name: space.name }))}
                        entry={entry}
                        triggerLabel="编辑"
                      />
                      <DeleteResourceButton
                        endpoint="/api/knowledge/entries"
                        id={entry.id}
                        confirmText={`确认删除知识条目「${entry.title}」？`}
                      />
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </Panel>
      </section>
    </div>
  );
}
