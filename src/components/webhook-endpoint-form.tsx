"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLanguageText } from "@/components/language-pack-provider";
import { editableSecretValue, SecretInput } from "@/components/secret-field";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

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
  embedded?: boolean;
  onSaved?: () => void;
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
  embedded = false,
  onSaved,
}: WebhookEndpointFormProps) {
  const router = useRouter();
  const text = useLanguageText();
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
    secretHint: editableSecretValue(webhook.secretHint),
    isEnabled: webhook.isEnabled === 1,
  });

  async function save() {
    setIsSaving(true);
    setMessage(null);

    try {
      JSON.parse(form.requestSchemaJson);
    } catch {
      setIsSaving(false);
      setMessage("ui.generated.c8201863b3a");
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
      setMessage("ui.generated.c40525a7328");
      return;
    }

    setMessage("ui.generated.ccdfab96f75");
    onSaved?.();
    router.refresh();
  }

  const enabledControl = (
    <label className="flex items-center gap-2 text-sm text-[var(--ink-muted)]">
      <input
        type="checkbox"
        checked={form.isEnabled}
        onChange={(event) => setForm({ ...form, isEnabled: event.target.checked })}
      />
      ui.generated.cd4e9ca3dd4
    </label>
  );

  const content = (
    <>
      {embedded ? <div className="flex justify-end">{enabledControl}</div> : null}
      <div className={embedded ? "space-y-4" : ""}>
        <div className="grid gap-3 md:grid-cols-2">
          <FieldGroup label="ui.generated.c0f6b89c79b">
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="ui.generated.c286e8511b1"
            />
          </FieldGroup>
          <FieldGroup label="ui.generated.c9614806f47">
            <Input
              value={form.pathKey}
              onChange={(event) => setForm({ ...form, pathKey: event.target.value })}
              placeholder="enterprise-mr"
            />
          </FieldGroup>
          <FieldGroup label="ui.generated.c26f30fd79b">
            <Select
              value={form.businessTeamId}
              onChange={(event) => setForm({ ...form, businessTeamId: event.target.value })}
            >
              <option value="">ui.generated.cc51fbedf93</option>
              {businessTeamOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="ui.generated.c0701a2538a">
            <Select
              value={form.teamId}
              onChange={(event) => setForm({ ...form, teamId: event.target.value })}
            >
              <option value="">ui.generated.c9750d7aa4d</option>
              {agentTeamOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="ui.generated.cb1d337493c">
            <Select
              value={form.method}
              onChange={(event) => setForm({ ...form, method: event.target.value })}
            >
              {["POST", "PUT", "PATCH"].map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="ui.generated.cf7981046c3">
            <SecretInput
              value={form.secretHint}
              onChange={(value) => setForm({ ...form, secretHint: value })}
              placeholder={text("ui.webhookEndpointForm.secret.placeholder")}
            />
          </FieldGroup>
          <FieldGroup label="ui.generated.c02aa35d407" className="md:col-span-2">
            <Textarea
              className="min-h-28"
              value={form.requestSchemaJson}
              onChange={(event) => setForm({ ...form, requestSchemaJson: event.target.value })}
              placeholder='{"repo_id":"string","mr_id":"string","diff_ref":"string"}'
            />
          </FieldGroup>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <Button
            type="button"
            onClick={save}
            disabled={isSaving}
          >
            {isSaving ? "ui.generated.ca032e8fdda" : "ui.generated.c2edacd603b"}
          </Button>
          {message ? <div className="text-xs text-[var(--ink-muted)]">{message}</div> : null}
        </div>
      </div>
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <Panel>
      <PanelHeader
        title={title}
        description="ui.generated.cac19706e0f"
        action={enabledControl}
      />
      <PanelBody>{content}</PanelBody>
    </Panel>
  );
}
