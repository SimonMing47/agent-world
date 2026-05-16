import Link from "next/link";
import { ExecutionEnvironmentForm } from "@/components/execution-environment-form";
import { ProviderProfileForm } from "@/components/provider-profile-form";
import { ProviderRuntimeBindingForm } from "@/components/provider-runtime-binding-form";
import { WebhookEndpointForm } from "@/components/webhook-endpoint-form";
import { translateStatus } from "@/lib/presentation";
import { getSettingsSnapshot } from "@/server/queries";

export default function SettingsPage() {
  const snapshot = getSettingsSnapshot();
  const tenantSpaceId = snapshot.tenantSpaces[0]?.id ?? "";
  const defaultBusinessTeamId = snapshot.businessTeams[0]?.id ?? null;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-5">
          <div className="text-sm text-[var(--ink-muted)]">模型接口</div>
          <div className="mt-2 text-3xl font-semibold text-[var(--ink)]">{snapshot.metrics.providerProfileCount}</div>
          <div className="mt-1 text-sm text-[var(--ink-muted)]">启用 {snapshot.metrics.enabledProviderProfileCount}</div>
        </div>
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-5">
          <div className="text-sm text-[var(--ink-muted)]">执行引擎实例</div>
          <div className="mt-2 text-3xl font-semibold text-[var(--ink)]">{snapshot.metrics.runtimeBindingCount}</div>
          <div className="mt-1 text-sm text-[var(--ink-muted)]">启用 {snapshot.metrics.enabledRuntimeBindingCount}</div>
        </div>
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-5">
          <div className="text-sm text-[var(--ink-muted)]">任务蓝图</div>
          <div className="mt-2 text-3xl font-semibold text-[var(--ink)]">{snapshot.metrics.blueprintCount}</div>
          <div className="mt-1 text-sm text-[var(--ink-muted)]">启用 {snapshot.metrics.enabledBlueprintCount}</div>
        </div>
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-5">
          <div className="text-sm text-[var(--ink-muted)]">Webhook</div>
          <div className="mt-2 text-3xl font-semibold text-[var(--ink)]">{snapshot.webhooks.length}</div>
          <div className="mt-1 text-sm text-[var(--ink-muted)]">环境 {snapshot.environments.length}</div>
        </div>
      </section>

      <section className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
          OpenCode 执行引擎
        </div>
        <div className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
          这里配置真正进入数据库的 OpenCode 运行参数：运行地址、启动命令、工作目录、默认模型接口和 API Key 引用。
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {snapshot.providerRuntimeBindings.map((binding) => (
            <ProviderRuntimeBindingForm
              key={binding.id}
              binding={binding}
              title={binding.name}
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

      <section className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
          模型接口目录
        </div>
        <div className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
          这里配置具体的 AI 模型接口，不再写死在种子数据里。每条记录都保存 Base URL、模型列表、默认模型、API 风格和 Key 引用。
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
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

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            环境
          </div>
          <div className="mt-4 space-y-4">
            {snapshot.environments.map((environment) => (
              <ExecutionEnvironmentForm key={environment.id} environment={environment} title={environment.name} />
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
            />
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Webhook
          </div>
          <div className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
            Webhook 入口本身也落库管理。路径、签名密钥提示、归属业务团队和接收 Agent 团队都在这里维护。
          </div>
          <div className="mt-4 space-y-4">
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
        </div>
      </section>

      <section className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
          任务蓝图状态
        </div>
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {snapshot.taskBlueprints.map((blueprint) => (
              <Link
                key={blueprint.id}
                href={`/task-blueprints/${blueprint.id}`}
                className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4 transition hover:bg-[var(--canvas)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-base font-semibold text-[var(--ink)]">{blueprint.name}</div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                    {translateStatus(blueprint.status)}
                  </div>
                </div>
                <div className="mt-2 space-y-1 text-sm text-[var(--ink-muted)]">
                  <div>类别: {blueprint.category}</div>
                  <div>Provider Adapter: {blueprint.providerAdapterId}</div>
                  <div>环境: {blueprint.environmentId ?? "未绑定"}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
    </div>
  );
}
