"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

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
    title: "新建运行时会话",
    mode: "single_agent",
    agentDefinitionId: "",
    runtimeBindingId: firstBinding?.id ?? "",
    providerProfileId: initialProvider?.id ?? "",
    agentTeamId: "",
    model: initialProvider?.defaultModel ?? "",
    systemPrompt:
      "Keep the interaction operational and explicit. Show planning changes, tool calls, and clear conclusions.",
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
      setMessage("创建失败");
      return;
    }

    const payload = (await response.json()) as { detail?: { session?: { id: string } } };
    const sessionId = payload.detail?.session?.id;
    if (!sessionId) {
      setMessage("会话创建成功，但未返回会话 ID");
      return;
    }

    router.push(`/interactions/${sessionId}`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="会话名称">
          <Input
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            placeholder="会话名称"
          />
        </FieldGroup>
        <FieldGroup label="模式">
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
              <option value="single_agent">单 Agent</option>
              <option value="agent_team">Agent Team</option>
            </Select>
          </FieldGroup>
        {form.mode === "single_agent" ? (
          <FieldGroup label="Agent 定义">
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
              <option value="">自由会话</option>
              {props.agentDefinitions.map((definition) => (
                <option key={definition.id} value={definition.id}>
                  {definition.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
        ) : null}
        <FieldGroup label="运行时">
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
        <FieldGroup label="模型接口">
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
          <FieldGroup label="Agent Team" className="md:col-span-2">
            <Select
              value={form.agentTeamId}
              onChange={(event) => setForm({ ...form, agentTeamId: event.target.value })}
            >
              <option value="">请选择 Agent Team</option>
              {props.agentTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
        ) : null}
        <FieldGroup label="模型">
          <Input
            value={form.model}
            onChange={(event) => setForm({ ...form, model: event.target.value })}
            placeholder={selectedProvider?.defaultModel ?? "模型名"}
          />
        </FieldGroup>
        <FieldGroup label="系统指令" className="md:col-span-2">
          <Textarea
            value={form.systemPrompt}
            onChange={(event) => setForm({ ...form, systemPrompt: event.target.value })}
            placeholder="Describe the operating policy for this session."
          />
        </FieldGroup>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Button type="button" onClick={submit} disabled={isSaving}>
          {isSaving ? "创建中" : "创建会话"}
        </Button>
        {message ? <div className="text-xs text-[var(--ink-muted)]">{message}</div> : null}
      </div>
    </div>
  );
}
