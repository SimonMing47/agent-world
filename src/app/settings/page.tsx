import { listProviders, listWebhooks } from "@/server/queries";

export default function SettingsPage() {
  const providers = listProviders();
  const webhooks = listWebhooks();

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
          Provider profiles
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
                <div>Default model: {provider.defaultModel}</div>
                <div>Enabled: {provider.isEnabled ? "Yes" : "No"}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
          Webhooks
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
                <div>Path key: {webhook.pathKey}</div>
                <div>Secret hint: {webhook.secretHint}</div>
                <div>Enabled: {webhook.isEnabled ? "Yes" : "No"}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
