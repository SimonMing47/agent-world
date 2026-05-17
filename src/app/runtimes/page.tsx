import { Eye, PencilLine, Plus } from "lucide-react";
import { DeleteResourceButton } from "@/components/delete-resource-button";
import { PageHeader } from "@/components/page-header";
import { ProviderProfileForm } from "@/components/provider-profile-form";
import { Badge } from "@/components/ui/badge";
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
import { SummaryStrip } from "@/components/ui/summary-strip";
import { getSettingsSnapshot } from "@/server/queries";

function parseModels(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function visibleConfig(value: string) {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return {
      contextWindow: parsed.contextWindow ?? "未配置",
      maxTokens: parsed.maxTokens ?? "未配置",
      reasoning: parsed.reasoning === false ? "关闭" : "开启",
      headers: parsed.headers && typeof parsed.headers === "object" ? Object.keys(parsed.headers).length : 0,
    };
  } catch {
    return { contextWindow: "未配置", maxTokens: "未配置", reasoning: "未知", headers: 0 };
  }
}

function EnabledBadge({ enabled }: { enabled: boolean | number }) {
  return <Badge variant={enabled ? "success" : "neutral"}>{enabled ? "启用" : "停用"}</Badge>;
}

export default function AiProvidersPage() {
  const snapshot = getSettingsSnapshot();
  const tenantSpaceId = snapshot.tenantSpaces[0]?.id ?? "";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI Provider"
        title="AI Provider 配置"
        description="维护模型接口、Base URL、API Key 引用、默认模型和模型能力。运行接口由系统内置，控制台只暴露可治理的模型接口。"
        badges={[
          { label: `${snapshot.providers.length} 个接口`, variant: "accent" },
          { label: `启用 ${snapshot.providers.filter((provider) => provider.isEnabled).length}`, variant: "success" },
        ]}
      />

      <SummaryStrip
        items={[
          {
            label: "模型接口",
            value: snapshot.providers.length,
            detail: "OpenAI Compatible / Anthropic / Azure 等",
          },
          {
            label: "启用接口",
            value: snapshot.providers.filter((provider) => provider.isEnabled).length,
            detail: "可被 Agent 和任务调用",
          },
          {
            label: "模型总数",
            value: snapshot.providers.reduce((total, provider) => total + parseModels(provider.modelsJson).length, 0),
            detail: "按接口配置去重前统计",
          },
          {
            label: "业务团队",
            value: snapshot.businessTeams.length,
            detail: "Provider 可被团队策略选择",
          },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="Provider Catalog"
          title="模型接口目录"
          description="已配置内容进入表格陈列，新增、查看、编辑均通过弹窗完成。"
          action={
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary">
                  <Plus className="h-4 w-4" />
                  新增 Provider
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[min(94vw,860px)]">
                <DialogHeader>
                  <DialogTitle>新增 AI Provider</DialogTitle>
                  <DialogDescription>配置模型网关、模型列表和密钥引用。</DialogDescription>
                </DialogHeader>
                <DialogBody>
                  <ProviderProfileForm
                    embedded
                    provider={{
                      id: "",
                      tenantSpaceId,
                      name: "新增 AI Provider",
                      baseUrl: "https://api.openai.com/v1",
                      apiStyle: "openai-compatible",
                      defaultModel: "gpt-5.4",
                      modelsJson: JSON.stringify(["gpt-5.4"], null, 2),
                      apiKeyRef: "env:OPENAI_API_KEY",
                      configJson: JSON.stringify(
                        {
                          supportsResponsesApi: false,
                          supportsChatCompletions: true,
                          reasoning: true,
                          headers: {},
                        },
                        null,
                        2,
                      ),
                      isEnabled: 1,
                    }}
                    title="新增 AI Provider"
                  />
                </DialogBody>
              </DialogContent>
            </Dialog>
          }
        />
        <PanelBody className="p-0">
          <DataTable>
            <DataTableHeader>
              <DataTableRow className="hover:bg-transparent">
                <DataTableHead>Provider</DataTableHead>
                <DataTableHead>API 风格</DataTableHead>
                <DataTableHead>默认模型</DataTableHead>
                <DataTableHead>模型数</DataTableHead>
                <DataTableHead>能力</DataTableHead>
                <DataTableHead>状态</DataTableHead>
                <DataTableHead align="right">操作</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {snapshot.providers.map((provider) => {
                const models = parseModels(provider.modelsJson);
                const config = visibleConfig(provider.configJson);
                return (
                  <DataTableRow key={provider.id}>
                    <DataTableCell className="min-w-[260px]">
                      <div className="font-semibold text-[var(--ink)]">{provider.name}</div>
                      <div className="mt-1 break-all text-xs text-[var(--ink-muted)]">{provider.baseUrl}</div>
                    </DataTableCell>
                    <DataTableCell>{provider.apiStyle}</DataTableCell>
                    <DataTableCell>{provider.defaultModel}</DataTableCell>
                    <DataTableCell>{models.length}</DataTableCell>
                    <DataTableCell>
                      <div className="text-sm text-[var(--ink)]">Reasoning {config.reasoning}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">Headers {config.headers}</div>
                    </DataTableCell>
                    <DataTableCell>
                      <EnabledBadge enabled={provider.isEnabled} />
                    </DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <Eye className="h-4 w-4" />
                              查看
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{provider.name}</DialogTitle>
                              <DialogDescription>Provider 明细。</DialogDescription>
                            </DialogHeader>
                            <DialogBody className="space-y-5">
                              <DefinitionList
                                items={[
                                  { label: "Provider ID", value: provider.id },
                                  { label: "API 风格", value: provider.apiStyle },
                                  { label: "Base URL", value: provider.baseUrl },
                                  { label: "默认模型", value: provider.defaultModel },
                                  { label: "API Key 引用", value: provider.apiKeyRef },
                                  { label: "上下文窗口", value: String(config.contextWindow) },
                                  { label: "最大输出 Tokens", value: String(config.maxTokens) },
                                  { label: "状态", value: provider.isEnabled ? "启用" : "停用" },
                                ]}
                              />
                              <div className="flex flex-wrap gap-2">
                                {models.map((model) => (
                                  <Badge key={model} variant="neutral">
                                    {model}
                                  </Badge>
                                ))}
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
                          <DialogContent className="w-[min(94vw,860px)]">
                            <DialogHeader>
                              <DialogTitle>编辑 AI Provider</DialogTitle>
                              <DialogDescription>{provider.name}</DialogDescription>
                            </DialogHeader>
                            <DialogBody>
                              <ProviderProfileForm embedded provider={provider} title={provider.name} />
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton endpoint="/api/provider-profiles" id={provider.id} confirmText={`确认删除 AI Provider「${provider.name}」？`} />
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
        </PanelBody>
      </Panel>
    </div>
  );
}
