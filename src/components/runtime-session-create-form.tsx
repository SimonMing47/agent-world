"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { uiText } from "@/lib/language-pack";

type RuntimeSessionCreateFormProps = {
  tenantSpaceId: string;
  businessTeamId: string;
  runtimeBindings: Array<{
    id: string;
    name: string;
    defaultProviderProfileId: string | null;
  }>;
  providerProfiles: Array<{
    id: string;
    name: string;
    defaultModel: string;
  }>;
  agentTeams: Array<{
    id: string;
    name: string;
  }>;
  agentDefinitions: Array<{
    id: string;
    name: string;
    systemPrompt: string;
    model: string;
    defaultProviderProfileId: string | null;
    defaultRuntimeBindingId: string | null;
    harnessConfigJson: string;
    permissionPolicyJson: string;
  }>;
};

export function RuntimeSessionCreateForm(props: RuntimeSessionCreateFormProps) {
  const router = useRouter();
  const firstBinding = props.runtimeBindings[0];
  const initialProviderId =
    firstBinding?.defaultProviderProfileId ?? props.providerProfiles[0]?.id ?? "";
  const initialProvider =
    props.providerProfiles.find((provider) => provider.id === initialProviderId) ??
    props.providerProfiles[0];
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: uiText("ui.generated.c200cb4b94a"),
    mode: "single_agent",
    agentDefinitionId: "",
    runtimeBindingId: firstBinding?.id ?? "",
    providerProfileId: initialProvider?.id ?? "",
    agentTeamId: "",
    model: initialProvider?.defaultModel ?? "",
    systemPrompt: uiText("ui.common.runtimeSessionSystemPromptDefault"),
  });

  const selectedProvider = useMemo(
    () => props.providerProfiles.find((provider) => provider.id === form.providerProfileId) ?? null,
    [form.providerProfileId, props.providerProfiles],
  );

  async function submit() {
    setIsSaving(true);
    setMessage(null);

    const response = await fetch("/api/runtime-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantSpaceId: props.tenantSpaceId,
        businessTeamId: props.businessTeamId,
        agentTeamId: form.mode === "agent_team" ? form.agentTeamId || null : null,
        agentDefinitionId: form.mode === "single_agent" ? form.agentDefinitionId || null : null,
        runtimeBindingId: form.runtimeBindingId,
        providerProfileId: form.providerProfileId,
        mode: form.mode,
        title: form.title,
        systemPrompt: form.systemPrompt,
        model: form.model,
        createdBy: "console",
      }),
    });

    setIsSaving(false);
    if (!response.ok) {
      setMessage("ui.generated.cdeb3990191");
      return;
    }

    const payload = (await response.json()) as { detail?: { session?: { id: string } } };
    const sessionId = payload.detail?.session?.id;
    if (!sessionId) {
      setMessage("ui.generated.ca22e464204");
      return;
    }

    router.push(`/interactions/${sessionId}`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="ui.generated.c864aff361d">
          <Input
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            placeholder="ui.generated.c864aff361d"
          />
        </FieldGroup>
        <FieldGroup label="ui.generated.ced0eea8f20">
          <Select
            value={form.mode}
            onChange={(event) =>
              setForm({
                ...form,
                mode: event.target.value,
                agentTeamId: event.target.value === "agent_team" ? form.agentTeamId : "",
                agentDefinitionId: event.target.value === "single_agent" ? form.agentDefinitionId : "",
              })
            }
          >
              <option value="single_agent">ui.generated.c20b7e967a5</option>
              <option value="agent_team">ui.generated.c70f970c1fc</option>
            </Select>
          </FieldGroup>
        {form.mode === "single_agent" ? (
          <FieldGroup label="ui.generated.c2bca55a7ed">
            <Select
              value={form.agentDefinitionId}
              onChange={(event) => {
                const definition = props.agentDefinitions.find((item) => item.id === event.target.value);
                const providerId = definition?.defaultProviderProfileId ?? form.providerProfileId;
                const runtimeBindingId = definition?.defaultRuntimeBindingId ?? form.runtimeBindingId;
                const provider = props.providerProfiles.find((item) => item.id === providerId) ?? selectedProvider;
                setForm({
                  ...form,
                  agentDefinitionId: event.target.value,
                  title: definition?.name ?? form.title,
                  systemPrompt: definition?.systemPrompt ?? form.systemPrompt,
                  providerProfileId: providerId,
                  runtimeBindingId,
                  model: definition?.model ?? provider?.defaultModel ?? form.model,
                });
              }}
            >
              <option value="">ui.generated.caf6ff1122c</option>
              {props.agentDefinitions.map((definition) => (
                <option key={definition.id} value={definition.id}>
                  {definition.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
        ) : null}
        <FieldGroup label="ui.generated.c8e175e7aa9">
          <Select
            value={form.runtimeBindingId}
            onChange={(event) => {
              const runtimeBinding = props.runtimeBindings.find((binding) => binding.id === event.target.value);
              const providerId = runtimeBinding?.defaultProviderProfileId ?? form.providerProfileId;
              const provider = props.providerProfiles.find((item) => item.id === providerId) ?? selectedProvider;
              setForm({
                ...form,
                runtimeBindingId: event.target.value,
                providerProfileId: providerId,
                model: provider?.defaultModel ?? form.model,
              });
            }}
          >
            {props.runtimeBindings.map((binding) => (
              <option key={binding.id} value={binding.id}>
                {binding.name}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label="ui.generated.cbc56f948bb">
          <Select
            value={form.providerProfileId}
            onChange={(event) => {
              const provider = props.providerProfiles.find((item) => item.id === event.target.value);
              setForm({
                ...form,
                providerProfileId: event.target.value,
                model: provider?.defaultModel ?? form.model,
              });
            }}
          >
            {props.providerProfiles.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </Select>
        </FieldGroup>
        {form.mode === "agent_team" ? (
          <FieldGroup label="ui.generated.c70f970c1fc" className="md:col-span-2">
            <Select
              value={form.agentTeamId}
              onChange={(event) => setForm({ ...form, agentTeamId: event.target.value })}
            >
              <option value="">ui.generated.c0ceb68320e</option>
              {props.agentTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
        ) : null}
        <FieldGroup label="ui.generated.c98fd0cbd9c">
          <Input
            value={form.model}
            onChange={(event) => setForm({ ...form, model: event.target.value })}
            placeholder={selectedProvider?.defaultModel ?? "ui.generated.c5e65d873e8"}
          />
        </FieldGroup>
        <FieldGroup label="ui.generated.c63f3275e5c" className="md:col-span-2">
          <Textarea
            value={form.systemPrompt}
            onChange={(event) => setForm({ ...form, systemPrompt: event.target.value })}
            placeholder="ui.generated.c29a6fb09d6"
          />
        </FieldGroup>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Button type="button" onClick={submit} disabled={isSaving}>
          {isSaving ? "ui.generated.c0db71cb110" : "ui.generated.c69feaeaa1c"}
        </Button>
        {message ? <div className="text-xs text-[var(--ink-muted)]">{message}</div> : null}
      </div>
    </div>
  );
}
