"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ProviderRuntimeBindingFormProps = {
  binding: {
    id: string;
    tenantSpaceId: string;
    businessTeamId: string | null;
    adapterDefinitionId: string;
    name: string;
    runtimeKind: string;
    baseUrl: string;
    command: string;
    workspaceRoot: string;
    defaultProviderProfileId: string | null;
    apiKeyRef: string;
    configJson: string;
    isEnabled: number;
  };
  title: string;
  providerOptions: Array<{ id: string; name: string }>;
  adapterOptions: Array<{ id: string; name: string }>;
  businessTeamOptions: Array<{ id: string; name: string }>;
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

function parseConfig(value: string) {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function ProviderRuntimeBindingForm({
  binding,
  title,
  providerOptions,
  businessTeamOptions,
  embedded = false,
  onSaved,
}: ProviderRuntimeBindingFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const parsedConfig = parseConfig(binding.configJson);
  const [form, setForm] = useState({
    id: binding.id,
    tenantSpaceId: binding.tenantSpaceId,
    businessTeamId: binding.businessTeamId ?? "",
    adapterDefinitionId: binding.adapterDefinitionId,
    name: binding.name,
    runtimeKind: binding.runtimeKind,
    baseUrl: binding.baseUrl,
    command: binding.command,
    workspaceRoot: binding.workspaceRoot,
    defaultProviderProfileId: binding.defaultProviderProfileId ?? "",
    apiKeyRef: binding.apiKeyRef,
    defaultModel:
      typeof parsedConfig.defaultModel === "string" ? parsedConfig.defaultModel : "",
    approvalMode:
      typeof parsedConfig.approvalMode === "string" ? parsedConfig.approvalMode : "ask",
    eventContract:
      typeof parsedConfig.eventContract === "string" ? parsedConfig.eventContract : "provider_event_v1",
    envJson: normalizeJson(
      JSON.stringify(
        parsedConfig.env && typeof parsedConfig.env === "object" && !Array.isArray(parsedConfig.env)
          ? parsedConfig.env
          : {},
      ),
      "{}",
    ),
    configJson: normalizeJson(binding.configJson, "{}"),
    isEnabled: binding.isEnabled === 1,
  });

  async function save() {
    setIsSaving(true);
    setMessage(null);

    try {
      JSON.parse(form.envJson);
      JSON.parse(form.configJson);
    } catch {
      setIsSaving(false);
      setMessage("JSON 格式不正确");
      return;
    }

    const extraConfig = parseConfig(form.configJson);
    const nextConfig = {
      ...extraConfig,
      defaultModel: form.defaultModel || undefined,
      approvalMode: form.approvalMode,
      eventContract: form.eventContract,
      env: JSON.parse(form.envJson) as Record<string, unknown>,
    };

    const response = await fetch("/api/provider-runtime-bindings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: form.id || crypto.randomUUID(),
        tenantSpaceId: form.tenantSpaceId,
        businessTeamId: form.businessTeamId || null,
        adapterDefinitionId: form.adapterDefinitionId,
        name: form.name,
        runtimeKind: form.runtimeKind,
        baseUrl: form.baseUrl,
        command: form.command,
        workspaceRoot: form.workspaceRoot,
        defaultProviderProfileId: form.defaultProviderProfileId || null,
        apiKeyRef: form.apiKeyRef,
        configJson: JSON.stringify(nextConfig, null, 2),
        isEnabled: form.isEnabled ? 1 : 0,
      }),
    });

    setIsSaving(false);
    if (!response.ok) {
      setMessage("保存失败");
      return;
    }

    setMessage("已保存");
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
      启用
    </label>
  );

  const content = (
    <>
      {embedded ? <div className="flex justify-end">{enabledControl}</div> : null}
      <div className={embedded ? "space-y-4" : ""}>
        <div className="grid gap-3 md:grid-cols-2">
          <FieldGroup label="归属业务团队">
            <Select
              value={form.businessTeamId}
              onChange={(event) => setForm({ ...form, businessTeamId: event.target.value })}
            >
              <option value="">全局默认</option>
              {businessTeamOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="执行配置名称">
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="默认执行配置"
            />
          </FieldGroup>
          <FieldGroup label="服务地址">
            <Input
              value={form.baseUrl}
              onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
              placeholder="embedded://agentworld/default"
            />
          </FieldGroup>
          <FieldGroup label="启动命令">
            <Input
              value={form.command}
              onChange={(event) => setForm({ ...form, command: event.target.value })}
              placeholder="embedded"
            />
          </FieldGroup>
          <FieldGroup label="工作目录">
            <Input
              value={form.workspaceRoot}
              onChange={(event) => setForm({ ...form, workspaceRoot: event.target.value })}
              placeholder="/workspace"
            />
          </FieldGroup>
          <FieldGroup label="审批模式">
            <Select
              value={form.approvalMode}
              onChange={(event) => setForm({ ...form, approvalMode: event.target.value })}
            >
              {["ask", "allow", "deny", "manual"].map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="事件协议">
            <Input
              value={form.eventContract}
              onChange={(event) => setForm({ ...form, eventContract: event.target.value })}
              placeholder="provider_event_v1"
            />
          </FieldGroup>
          <FieldGroup label="默认模型覆盖">
            <Input
              value={form.defaultModel}
              onChange={(event) => setForm({ ...form, defaultModel: event.target.value })}
              placeholder="gpt-5.4"
            />
          </FieldGroup>
          <FieldGroup label="Provider API Key 引用" className="md:col-span-2">
            <Input
              value={form.apiKeyRef}
              onChange={(event) => setForm({ ...form, apiKeyRef: event.target.value })}
              placeholder="env:AGENTWORLD_GLM_API_KEY"
            />
          </FieldGroup>
          <FieldGroup label="默认模型接口" className="md:col-span-2">
            <Select
              value={form.defaultProviderProfileId}
              onChange={(event) => setForm({ ...form, defaultProviderProfileId: event.target.value })}
            >
              <option value="">未绑定</option>
              {providerOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup
            label="环境变量映射"
            hint="在这里维护执行配置需要的环境变量引用。"
            className="md:col-span-2"
          >
            <Textarea
              value={form.envJson}
              onChange={(event) => setForm({ ...form, envJson: event.target.value })}
              placeholder='{"AGENTWORLD_GLM_API_KEY":"ref:env:AGENTWORLD_GLM_API_KEY"}'
            />
          </FieldGroup>
          <FieldGroup
            label="附加配置"
            hint="保留给系统内置执行接口的额外参数。"
            className="md:col-span-2"
          >
            <Textarea
              value={form.configJson}
              onChange={(event) => setForm({ ...form, configJson: event.target.value })}
              placeholder='{"providerProfileAlias":"openai-default"}'
            />
          </FieldGroup>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <Button
            type="button"
            onClick={save}
            disabled={isSaving}
          >
            {isSaving ? "保存中" : "保存执行配置"}
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
        description="默认模型接口、执行参数、密钥引用与环境变量映射。"
        action={enabledControl}
      />
      <PanelBody>{content}</PanelBody>
    </Panel>
  );
}
