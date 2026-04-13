import { listProviders, listWebhooks } from "@/server/queries";

export default function SettingsPage() {
  const providers = listProviders();
  const webhooks = listWebhooks();

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <section className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
          OpenAI-style providers
        </div>
        <div className="mt-4 space-y-3">
          {providers.map((provider) => (
            <div key={provider.id} className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-lg font-semibold text-[var(--ink)]">{provider.name}</div>
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                  {provider.isEnabled ? "enabled" : "disabled"}
                </div>
              </div>
              <div className="mt-1 text-sm text-[var(--ink-muted)]">{provider.baseUrl}</div>
              <div className="mt-3 text-sm text-[var(--ink-muted)]">
                Default model: {provider.defaultModel}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
          Webhook endpoints
        </div>
        <div className="mt-4 space-y-3">
          {webhooks.map((webhook) => (
            <div key={webhook.id} className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-lg font-semibold text-[var(--ink)]">{webhook.name}</div>
              <div className="mt-1 text-sm text-[var(--ink-muted)]">
                {webhook.method} /api/webhooks/{webhook.pathKey}
              </div>
              <div className="mt-3 text-sm text-[var(--ink-muted)]">
                Secret hint: {webhook.secretHint}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
