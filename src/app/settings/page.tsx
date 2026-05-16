import { listProviders, listWebhooks } from "@/server/queries";
import { listBuiltinPluginManifests } from "@/server/plugin-core";
import { translateBoolean } from "@/lib/presentation";

export default function SettingsPage() {
  const providers = listProviders();
  const webhooks = listWebhooks();
  const pluginManifests = listBuiltinPluginManifests();

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
                <div>是否启用: {translateBoolean(provider.isEnabled)}</div>
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
          Provider / 邮件 / IM / 代码仓均通过插件声明扩展。默认 opencode 支持 API Key（建议用环境变量 OPENAI_API_KEY 或 OPENCODE_API_KEY 注入）。
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
                <div>配置: {plugin.configSchema}</div>
                <div>权限: {plugin.permissions.join(", ")}</div>
              </div>
            </div>
          ))}
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
