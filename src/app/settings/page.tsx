import { listExecutionEnvironments, listProviders, listWebhooks } from "@/server/queries";
import {
  getPluginSecurityModel,
  listBuiltinPluginManifests,
  listPluginExtensionPoints,
} from "@/server/plugin-core";
import { listProviderExecutionModes } from "@/server/provider-core";
import { translateBoolean } from "@/lib/presentation";

export default function SettingsPage() {
  const providers = listProviders();
  const webhooks = listWebhooks();
  const environments = listExecutionEnvironments();
  const pluginManifests = listBuiltinPluginManifests();
  const extensionPoints = listPluginExtensionPoints();
  const pluginSecurity = getPluginSecurityModel();
  const executionModes = listProviderExecutionModes();

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
          Provider 配置
        </div>
        <div className="mt-4 space-y-3">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-base font-semibold text-[var(--ink)]">{provider.name}</div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                  {provider.apiStyle}
                </div>
              </div>
              <div className="mt-2 space-y-1 text-sm text-[var(--ink-muted)]">
                <div>Base URL: {provider.baseUrl}</div>
                <div>默认模型: {provider.defaultModel}</div>
                <div>Key 引用: env:OPENAI_API_KEY / env:OPENCODE_API_KEY</div>
                <div>是否启用: {translateBoolean(provider.isEnabled)}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
          Provider 执行命令
        </div>
        <div className="mt-4 space-y-3">
          {executionModes.map((mode) => (
            <div key={mode.id} className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-base font-semibold text-[var(--ink)]">{mode.name}</div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">{mode.status}</div>
              </div>
              <div className="mt-2 space-y-1 text-sm text-[var(--ink-muted)]">
                <div>命令: {mode.command}</div>
                <div>密钥引用: {mode.secretRefs.join(", ")}</div>
                <div>{mode.note}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6 xl:col-span-2">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
          扩展插件（不改主干，只扩展）
        </div>
        <div className="mt-2 text-sm text-[var(--ink-muted)]">
          Provider / 邮件 / IM / 代码仓均通过插件声明扩展。默认 opencode 支持 API Key，主干只保存 secret ref，不保存明文 key。
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {pluginManifests.map((plugin) => (
            <div key={plugin.id} className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-base font-semibold text-[var(--ink)]">{plugin.name}</div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">{plugin.capability}</div>
              </div>
              <div className="mt-2 space-y-1 text-sm text-[var(--ink-muted)]">
                <div>版本: {plugin.version}</div>
                <div>挂载点: {plugin.mountPoint}</div>
                <div>生命周期: {plugin.lifecycle}</div>
                <div>配置: {plugin.configSchema}</div>
                <div>密钥引用: {plugin.requiredSecretRefs.join(", ")}</div>
                <div>权限: {plugin.permissions.join(", ")}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {extensionPoints.map((point) => (
            <div key={point.id} className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4">
              <div className="text-base font-semibold text-[var(--ink)]">{point.name}</div>
              <div className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{point.contract}</div>
              <div className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">
                {point.accepts.join(", ")}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4 text-sm leading-6 text-[var(--ink-muted)]">
          {pluginSecurity.permissionModel} {pluginSecurity.openSourceBoundary}
        </div>
      </section>

      <section className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6 xl:col-span-2">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
          执行环境
        </div>
        <div className="mt-2 text-sm text-[var(--ink-muted)]">
          环境层负责代码仓、执行人、私钥引用、执行路径、沙箱预留和任务记忆依赖。
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {environments.map((environment) => {
            const memoryLayers = JSON.parse(environment.memoryLayerRefsJson) as string[];
            const sandbox = JSON.parse(environment.sandboxProfileJson) as Record<string, unknown>;

            return (
              <div key={environment.id} className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-base font-semibold text-[var(--ink)]">{environment.name}</div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">{environment.visibility}</div>
                </div>
                <div className="mt-2 space-y-1 text-sm text-[var(--ink-muted)]">
                  <div>代码仓: {environment.repositoryProvider}/{environment.repositoryName}</div>
                  <div>分支 / 路径: {environment.defaultBranch} / {environment.workingDirectory}</div>
                  <div>执行人: {environment.executorRef}</div>
                  <div>私钥引用: {environment.privateKeyRef}</div>
                  <div>沙箱: {String(sandbox.isolation ?? "process")}</div>
                  <div>记忆层: {memoryLayers.join(", ")}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
          Webhook 配置
        </div>
        <div className="mt-4 space-y-3">
          {webhooks.map((webhook) => (
            <div
              key={webhook.id}
              className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-4 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-base font-semibold text-[var(--ink)]">{webhook.name}</div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                  {webhook.method}
                </div>
              </div>
              <div className="mt-2 space-y-1 text-sm text-[var(--ink-muted)]">
                <div>路径标识: {webhook.pathKey}</div>
                <div>密钥提示: {webhook.secretHint}</div>
                <div>是否启用: {translateBoolean(webhook.isEnabled)}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
