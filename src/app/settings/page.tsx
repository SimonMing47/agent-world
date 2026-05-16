import Link from "next/link";
import { ExecutionEnvironmentForm } from "@/components/execution-environment-form";
import { PageHeader } from "@/components/page-header";
import { ProviderProfileForm } from "@/components/provider-profile-form";
import { ProviderRuntimeBindingForm } from "@/components/provider-runtime-binding-form";
import { WebhookEndpointForm } from "@/components/webhook-endpoint-form";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody } from "@/components/ui/panel";
import { translateStatus } from "@/lib/presentation";
import { getSettingsSnapshot } from "@/server/queries";

export default function SettingsPage() {
  const snapshot = getSettingsSnapshot();
  const tenantSpaceId = snapshot.tenantSpaces[0]?.id ?? "";
  const defaultBusinessTeamId = snapshot.businessTeams[0]?.id ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="平台配置"
        description="在同一组控制台页面里维护模型接口、执行引擎、环境、Webhook 和蓝图入口。"
        badges={[
          { label: `${snapshot.metrics.providerProfileCount} 个模型接口`, variant: "accent" },
          { label: `${snapshot.metrics.runtimeBindingCount} 个执行引擎`, variant: "neutral" },
        ]}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["模型接口", snapshot.metrics.providerProfileCount, `启用 ${snapshot.metrics.enabledProviderProfileCount}`],
          ["执行引擎实例", snapshot.metrics.runtimeBindingCount, `启用 ${snapshot.metrics.enabledRuntimeBindingCount}`],
          ["任务蓝图", snapshot.metrics.blueprintCount, `启用 ${snapshot.metrics.enabledBlueprintCount}`],
          ["Webhook", snapshot.webhooks.length, `环境 ${snapshot.environments.length}`],
        ].map(([label, value, detail]) => (
          <Panel key={String(label)}>
            <PanelBody className="p-5">
              <div className="text-sm text-[var(--ink-muted)]">{label}</div>
              <div className="mt-2 text-3xl font-semibold text-[var(--ink)]">{value}</div>
              <div className="mt-1 text-sm text-[var(--ink-muted)]">{detail}</div>
            </PanelBody>
          </Panel>
        ))}
      </section>

      <section className="space-y-4">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--ink-muted)]">OpenCode Runtime</div>
          <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">执行引擎实例</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
            配置真正进入数据库的 OpenCode 运行地址、命令、默认模型接口、API Key 引用和环境变量。
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {snapshot.providerRuntimeBindings.map((binding) => (
            <ProviderRuntimeBindingForm
              key={binding.id}
              binding={binding}
              title={binding.name}
              businessTeamOptions={snapshot.businessTeams.map((team) => ({
                id: team.id,
                name: team.name,
              }))}
              providerOptions={snapshot.providers.map((provider) => ({
                id: provider.id,
                name: `${provider.name} / ${provider.defaultModel}`,
              }))}
              adapterOptions={snapshot.providerAdapters.map((adapter) => ({
                id: adapter.id,
                name: adapter.name,
              }))}
            />
          ))}
          <ProviderRuntimeBindingForm
            binding={{
              id: "",
              tenantSpaceId,
              businessTeamId: defaultBusinessTeamId,
              adapterDefinitionId: "opencode-provider",
              name: "新增执行引擎实例",
              runtimeKind: "opencode",
              baseUrl: "http://127.0.0.1:4096",
              command: "opencode",
              workspaceRoot: process.cwd(),
              defaultProviderProfileId: snapshot.providers[0]?.id ?? null,
              apiKeyRef: "env:OPENCODE_API_KEY",
              configJson: JSON.stringify(
                {
                  defaultModel: snapshot.providers[0]?.defaultModel ?? "gpt-5.4",
                  env: {
                    OPENAI_API_KEY: "ref:env:OPENAI_API_KEY",
                  },
                },
                null,
                2,
              ),
              isEnabled: 1,
            }}
            title="新增执行引擎实例"
            businessTeamOptions={snapshot.businessTeams.map((team) => ({
              id: team.id,
              name: team.name,
            }))}
            providerOptions={snapshot.providers.map((provider) => ({
              id: provider.id,
              name: `${provider.name} / ${provider.defaultModel}`,
            }))}
            adapterOptions={snapshot.providerAdapters.map((adapter) => ({
              id: adapter.id,
              name: adapter.name,
            }))}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--ink-muted)]">Model Providers</div>
          <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">模型接口目录</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
            维护 Base URL、默认模型、模型列表、API 风格和 Key 引用。
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {snapshot.providers.map((provider) => (
            <ProviderProfileForm key={provider.id} provider={provider} title={provider.name} />
          ))}
          <ProviderProfileForm
            provider={{
              id: "",
              tenantSpaceId,
              name: "新增模型接口",
              baseUrl: "https://api.openai.com/v1",
              apiStyle: "openai",
              defaultModel: "gpt-5.4",
              modelsJson: JSON.stringify(["gpt-5.4"], null, 2),
              apiKeyRef: "env:OPENAI_API_KEY",
              configJson: JSON.stringify({ supportsResponsesApi: true }, null, 2),
              isEnabled: 1,
            }}
            title="新增模型接口"
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <section className="space-y-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--ink-muted)]">Environments</div>
            <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">执行环境</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">代码仓、执行路径、私钥引用与记忆依赖。</p>
          </div>
          <div className="space-y-4">
            {snapshot.environments.map((environment) => (
              <ExecutionEnvironmentForm
                key={environment.id}
                environment={environment}
                title={environment.name}
                businessTeamOptions={snapshot.businessTeams.map((team) => ({
                  id: team.id,
                  name: team.name,
                }))}
              />
            ))}
            <ExecutionEnvironmentForm
              environment={{
                id: "",
                businessTeamId: defaultBusinessTeamId ?? "",
                name: "新增执行环境",
                repositoryProvider: "git",
                repositoryName: "",
                repositoryUrl: "",
                defaultBranch: "main",
                executorRef: "",
                privateKeyRef: "",
                workingDirectory: ".",
                sandboxProfileJson: JSON.stringify({ isolation: "process" }, null, 2),
                memoryLayerRefsJson: JSON.stringify([], null, 2),
                visibility: "team",
                status: "active",
              }}
              title="新增执行环境"
              businessTeamOptions={snapshot.businessTeams.map((team) => ({
                id: team.id,
                name: team.name,
              }))}
            />
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--ink-muted)]">Webhook Intake</div>
            <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">Webhook 入口</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
              路径、签名密钥提示、归属业务团队和接收 Agent 团队全部落库管理。
            </p>
          </div>
          <div className="space-y-4">
            {snapshot.webhooks.map((webhook) => (
              <WebhookEndpointForm
                key={webhook.id}
                webhook={webhook}
                title={webhook.name}
                businessTeamOptions={snapshot.businessTeams.map((team) => ({
                  id: team.id,
                  name: team.name,
                }))}
                agentTeamOptions={snapshot.agentTeams.map((team) => ({
                  id: team.id,
                  name: team.name,
                }))}
              />
            ))}
            <WebhookEndpointForm
              webhook={{
                id: "",
                businessTeamId: defaultBusinessTeamId ?? "",
                teamId: snapshot.agentTeams[0]?.id ?? "",
                name: "新增 Webhook 入口",
                pathKey: "",
                method: "POST",
                requestSchemaJson: JSON.stringify({}, null, 2),
                secretHint: "env:CODE_PLATFORM_WEBHOOK_SECRET",
                isEnabled: 1,
              }}
              title="新增 Webhook 入口"
              businessTeamOptions={snapshot.businessTeams.map((team) => ({
                id: team.id,
                name: team.name,
              }))}
              agentTeamOptions={snapshot.agentTeams.map((team) => ({
                id: team.id,
                name: team.name,
                }))}
            />
          </div>
        </section>
      </section>

      <Panel>
        <PanelBody className="space-y-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--ink-muted)]">Blueprint Status</div>
            <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">任务蓝图入口</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
              进入蓝图详情页查看触发器、权限预览、最近运行和提交控制台。
            </p>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
          {snapshot.taskBlueprints.map((blueprint) => (
            <Link
              key={blueprint.id}
              href={`/task-blueprints/${blueprint.id}`}
              className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-4 transition hover:border-[var(--line-strong)] hover:bg-white"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-medium text-[var(--ink)]">{blueprint.name}</div>
                  <div className="mt-2 space-y-1 text-sm text-[var(--ink-muted)]">
                    <div>类别: {blueprint.category}</div>
                    <div>Provider Adapter: {blueprint.providerAdapterId}</div>
                    <div>环境: {blueprint.environmentId ?? "未绑定"}</div>
                  </div>
                </div>
                <Badge variant={blueprint.status === "active" ? "success" : "neutral"}>
                  {translateStatus(blueprint.status)}
                </Badge>
              </div>
            </Link>
          ))}
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}
