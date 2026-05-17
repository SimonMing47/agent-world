import { Eye, PencilLine, Plus } from "lucide-react";
import { AgentDefinitionForm } from "@/components/agent-definition-form";
import { DeleteResourceButton } from "@/components/delete-resource-button";
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
import { Panel, PanelHeader } from "@/components/ui/panel";
import { SummaryStrip } from "@/components/ui/summary-strip";
import { formatDateTime } from "@/lib/utils";
import { translateStatus, translateVisibility } from "@/lib/presentation";
import {
  buildAgentHarnessExecutionProfile,
  buildDefaultAgentHarnessConfig,
  buildDefaultAgentPermissionPolicy,
} from "@/server/agent-harness-core";
import {
  listAgentDefinitions,
  listAgentDefinitionShares,
  listBusinessTeams,
  listProviders,
  listProviderRuntimeBindings,
  listTenantSpaces,
} from "@/server/queries";

function parseStringArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export default function AgentsPage() {
  const definitions = listAgentDefinitions();
  const shares = listAgentDefinitionShares();
  const businessTeams = listBusinessTeams();
  const providers = listProviders();
  const runtimeBindings = listProviderRuntimeBindings();
  const tenantSpaceId = listTenantSpaces()[0]?.id ?? "";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Agent 管理"
        title="Agent 目录"
        description="维护 Agent 定义、共享范围、模型服务和验证状态。"
        badges={[
          { label: `${definitions.length} 个 Agent`, variant: "accent" },
          { label: `${definitions.filter((item) => item.validationStatus === "passed").length} 个已验证`, variant: "neutral" },
        ]}
      />

      <SummaryStrip
        items={[
          {
            label: "个人可见",
            value: definitions.filter((item) => item.visibility === "personal").length,
            detail: "只面向个人使用",
          },
          {
            label: "团队 / 共享",
            value: definitions.filter((item) => item.visibility === "team").length,
            detail: `${shares.length} 条共享关系`,
          },
          {
            label: "全局可见",
            value: definitions.filter((item) => item.visibility === "global").length,
            detail: "可被多个团队复用",
          },
          {
            label: "可验证",
            value: runtimeBindings.length,
            detail: `${providers.length} 个模型服务可参与优化`,
          },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="目录"
          title="Agent 目录"
          description="按归属、共享、模型服务和验证状态管理。"
          action={
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary">
                  <Plus className="h-4 w-4" />
                  新增 Agent
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[min(94vw,980px)]">
                <DialogHeader>
                  <DialogTitle>新增 Agent</DialogTitle>
                  <DialogDescription>通过默认系统提示词、运行约束和模型服务验证职责边界。</DialogDescription>
                </DialogHeader>
                <DialogBody>
                  <AgentDefinitionForm
                    embedded
                    definition={{
                      id: "",
                      tenantSpaceId,
                      ownerBusinessTeamId: businessTeams[0]?.id ?? null,
                      ownerUserId: "console",
                      sourceAgentId: null,
                      slug: "",
                      name: "New Agent",
                      role: "analyst",
                      description: "",
                      systemPrompt: "",
                      model: providers[0]?.defaultModel ?? "GLM-5.1",
                      defaultProviderProfileId: providers[0]?.id ?? null,
                      defaultRuntimeBindingId: runtimeBindings[0]?.id ?? null,
                      toolBindingsJson: JSON.stringify([], null, 2),
                      harnessConfigJson: JSON.stringify(buildDefaultAgentHarnessConfig(), null, 2),
                      permissionPolicyJson: JSON.stringify(buildDefaultAgentPermissionPolicy(), null, 2),
                      memoryScope: "private",
                      tagsJson: JSON.stringify([], null, 2),
                      visibility: "personal",
                      status: "draft",
                      validationStatus: "untested",
                      lastValidatedAt: null,
                      lastValidationSummary: null,
                    }}
                    shareBusinessTeamIds={[]}
                    title="新增 Agent"
                    businessTeamOptions={businessTeams.map((team) => ({ id: team.id, name: team.name }))}
                    providerOptions={providers.map((provider) => ({
                      id: provider.id,
                      name: provider.name,
                      defaultModel: provider.defaultModel,
                    }))}
                    runtimeBindingOptions={runtimeBindings.map((binding) => ({
                      id: binding.id,
                      name: binding.name,
                      defaultProviderProfileId: binding.defaultProviderProfileId,
                    }))}
                  />
                </DialogBody>
              </DialogContent>
            </Dialog>
          }
        />
        <div className="overflow-hidden rounded-b-2xl">
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Agent</DataTableHead>
                <DataTableHead>归属团队</DataTableHead>
                <DataTableHead>模型服务 / 模型</DataTableHead>
                <DataTableHead>可见性</DataTableHead>
                <DataTableHead>验证</DataTableHead>
                <DataTableHead>更新时间</DataTableHead>
                <DataTableHead align="right">操作</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {definitions.map((definition) => {
                const ownerTeam = businessTeams.find((team) => team.id === definition.ownerBusinessTeamId);
                const provider = providers.find((item) => item.id === definition.defaultProviderProfileId);
                const definitionShares = shares.filter((share) => share.agentDefinitionId === definition.id);
                const harnessProfile = buildAgentHarnessExecutionProfile(definition);
                const sharedTeamNames = definitionShares
                  .map((share) => businessTeams.find((team) => team.id === share.businessTeamId)?.name)
                  .filter(Boolean)
                  .join(", ");

                return (
                  <DataTableRow key={definition.id}>
                    <DataTableCell className="min-w-[260px]">
                      <div className="font-medium text-[var(--ink)]">{definition.name}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{definition.role} · {translateStatus(definition.status)}</div>
                    </DataTableCell>
                    <DataTableCell>
                      <div>{ownerTeam?.name ?? "未指定"}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">
                        {sharedTeamNames ? `共享到 ${sharedTeamNames}` : "未共享"}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <div>{provider?.name ?? "未绑定模型服务"}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{definition.model}</div>
                    </DataTableCell>
                    <DataTableCell>{translateVisibility(definition.visibility)}</DataTableCell>
                    <DataTableCell>
                      <div>{translateStatus(definition.validationStatus)}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">
                        {definition.lastValidatedAt ? formatDateTime(definition.lastValidatedAt) : "尚未验证"}
                      </div>
                    </DataTableCell>
                    <DataTableCell>{formatDateTime(definition.updatedAt)}</DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex items-center justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <Eye className="h-4 w-4" />
                              查看
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-[min(92vw,880px)]">
                            <DialogHeader>
                              <DialogTitle>{definition.name}</DialogTitle>
                              <DialogDescription>查看 Agent 定义、默认系统提示词、运行约束和共享范围。</DialogDescription>
                            </DialogHeader>
                            <DialogBody className="space-y-5">
                              <DefinitionList
                                items={[
                                  { label: "角色", value: definition.role },
                                  { label: "归属团队", value: ownerTeam?.name ?? "未指定" },
                                  { label: "可见性", value: translateVisibility(definition.visibility) },
                                  { label: "模型", value: definition.model },
                                  { label: "模型服务", value: provider?.name ?? "未绑定" },
                                  { label: "验证状态", value: translateStatus(definition.validationStatus) },
                                ]}
                              />
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-[var(--ink)]">定义说明</div>
                                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 text-sm leading-6 text-[var(--ink)]">
                                  {definition.description || "未填写"}
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-[var(--ink)]">默认系统提示词</div>
                                <pre className="max-h-[280px] overflow-auto whitespace-pre-wrap rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4 text-xs leading-5 text-[var(--ink)]">
                                  {definition.systemPrompt}
                                </pre>
                              </div>
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-[var(--ink)]">运行约束</div>
                                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 text-sm leading-6 text-[var(--ink)]">
                                  审批模式: {harnessProfile.approvalMode}
                                  <br />
                                  推理强度: {harnessProfile.thinkingLevel}
                                  <br />
                                  人工介入: {harnessProfile.humanIntervention}
                                  <br />
                                  仓库权限: {harnessProfile.repositoryAccess}
                                  <br />
                                  记忆权限: {harnessProfile.memoryAccess}
                                  <br />
                                  密钥权限: {harnessProfile.secretAccess}
                                  <br />
                                  允许工具: {harnessProfile.allowedToolNames.join(", ") || "全部只读工具"}
                                  <br />
                                  禁止工具: {harnessProfile.deniedToolNames.join(", ") || "无"}
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-[var(--ink)]">工具 / 标签</div>
                                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 text-sm leading-6 text-[var(--ink)]">
                                  工具: {parseStringArray(definition.toolBindingsJson).join(", ") || "未配置"}
                                  <br />
                                  标签: {parseStringArray(definition.tagsJson).join(", ") || "未配置"}
                                  <br />
                                  共享团队: {sharedTeamNames || "未共享"}
                                </div>
                              </div>
                            </DialogBody>
                          </DialogContent>
                        </Dialog>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <PencilLine className="h-4 w-4" />
                              编辑
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-[min(94vw,980px)]">
                            <DialogHeader>
                              <DialogTitle>编辑 Agent</DialogTitle>
                              <DialogDescription>{definition.name}</DialogDescription>
                            </DialogHeader>
                            <DialogBody>
                              <AgentDefinitionForm
                                embedded
                                definition={definition}
                                shareBusinessTeamIds={definitionShares.map((share) => share.businessTeamId)}
                                title={definition.name}
                                businessTeamOptions={businessTeams.map((team) => ({ id: team.id, name: team.name }))}
                                providerOptions={providers.map((provider) => ({
                                  id: provider.id,
                                  name: provider.name,
                                  defaultModel: provider.defaultModel,
                                }))}
                                runtimeBindingOptions={runtimeBindings.map((binding) => ({
                                  id: binding.id,
                                  name: binding.name,
                                  defaultProviderProfileId: binding.defaultProviderProfileId,
                                }))}
                              />
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton endpoint="/api/agent-definitions" id={definition.id} confirmText={`确认删除 Agent「${definition.name}」？`} />
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
        </div>
      </Panel>
    </div>
  );
}
