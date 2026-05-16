"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type WebhookEndpointFormProps = {
  webhook: {
    id: string;
    businessTeamId: string;
    teamId: string;
    name: string;
    pathKey: string;
    method: string;
    requestSchemaJson: string;
    secretHint: string;
    isEnabled: number;
  };
  title: string;
  businessTeamOptions: Array<{ id: string; name: string }>;
  agentTeamOptions: Array<{ id: string; name: string }>;
};

function normalizeJson(value: string, fallback: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return fallback;
  }
}

export function WebhookEndpointForm({
  webhook,
  title,
  businessTeamOptions,
  agentTeamOptions,
}: WebhookEndpointFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: webhook.id,
    businessTeamId: webhook.businessTeamId,
    teamId: webhook.teamId,
    name: webhook.name,
    pathKey: webhook.pathKey,
    method: webhook.method,
    requestSchemaJson: normalizeJson(webhook.requestSchemaJson, "{}"),
    secretHint: webhook.secretHint,
    isEnabled: webhook.isEnabled === 1,
  });

  async function save() {
    setIsSaving(true);
    setMessage(null);

    try {
      JSON.parse(form.requestSchemaJson);
    } catch {
      setIsSaving(false);
      setMessage("请求 Schema 不是合法 JSON");
      return;
    }

    const response = await fetch("/api/webhooks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: form.id || crypto.randomUUID(),
        businessTeamId: form.businessTeamId,
        teamId: form.teamId,
        name: form.name,
        pathKey: form.pathKey,
        method: form.method,
        requestSchemaJson: form.requestSchemaJson,
        secretHint: form.secretHint,
        isEnabled: form.isEnabled ? 1 : 0,
      }),
    });

    setIsSaving(false);
    if (!response.ok) {
      setMessage("保存失败");
      return;
    }

    setMessage("已保存");
    router.refresh();
  }

  return (
    <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-base font-semibold text-[var(--ink)]">{title}</div>
        <label className="flex items-center gap-2 text-sm text-[var(--ink-muted)]">
          <input
            type="checkbox"
            checked={form.isEnabled}
            onChange={(event) => setForm({ ...form, isEnabled: event.target.checked })}
          />
          启用
        </label>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <input
          className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="Webhook 名称"
        />
        <input
          className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]"
          value={form.pathKey}
          onChange={(event) => setForm({ ...form, pathKey: event.target.value })}
          placeholder="路径标识，例如 enterprise-mr"
        />
        <select
          className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]"
          value={form.businessTeamId}
          onChange={(event) => setForm({ ...form, businessTeamId: event.target.value })}
        >
          <option value="">选择业务团队</option>
          {businessTeamOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]"
          value={form.teamId}
          onChange={(event) => setForm({ ...form, teamId: event.target.value })}
        >
          <option value="">选择 Agent 团队</option>
          {agentTeamOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]"
          value={form.method}
          onChange={(event) => setForm({ ...form, method: event.target.value })}
        >
          {["POST", "PUT", "PATCH"].map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
        <input
          className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]"
          value={form.secretHint}
          onChange={(event) => setForm({ ...form, secretHint: event.target.value })}
          placeholder="签名密钥引用，例如 env:CODE_PLATFORM_WEBHOOK_SECRET"
        />
      </div>

      <textarea
        className="mt-2 min-h-28 w-full rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm leading-6 text-[var(--ink)]"
        value={form.requestSchemaJson}
        onChange={(event) => setForm({ ...form, requestSchemaJson: event.target.value })}
        placeholder='{"repo_id":"string","mr_id":"string","diff_ref":"string"}'
      />

      <div className="mt-2 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isSaving}
          className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm font-medium text-[var(--ink)] disabled:opacity-50"
        >
          {isSaving ? "保存中" : "保存 Webhook"}
        </button>
        {message ? <div className="text-xs text-[var(--ink-muted)]">{message}</div> : null}
      </div>
    </div>
  );
}
