"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Option = { id: string; name: string };

type TaskBlueprintEditorProps = {
  blueprint: {
    id: string;
    name: string;
    category: string;
    visibility: string;
    ownerBusinessTeamId: string;
    teamId: string;
    environmentId: string | null;
    providerAdapterId: string;
    version: number;
    status: string;
    triggerJson: string;
    inputSchemaJson: string;
    environmentSelectorJson: string;
    agentTeamRunPlanJson: string;
    memoryPolicyJson: string;
    providerPolicyJson: string;
    permissionPolicyJson: string;
    resultSchemaJson: string;
    outputPolicyJson: string;
    dashboardPolicyJson: string;
    executionPolicyJson: string;
    archivePolicyJson: string;
  };
  options: {
    businessTeams: Option[];
    agentTeams: Option[];
    environments: Option[];
    providerAdapters: Option[];
  };
};

function normalizeJson(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function parseRecord(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function TaskBlueprintEditor({ blueprint, options }: TaskBlueprintEditorProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const trigger = parseRecord(blueprint.triggerJson);
  const triggerExtra = { ...trigger };
  delete triggerExtra.type;
  delete triggerExtra.connector;
  delete triggerExtra.event;
  delete triggerExtra.expression;
  delete triggerExtra.webhookPathKey;
  delete triggerExtra.idempotencyKey;

  const [form, setForm] = useState({
    name: blueprint.name,
    category: blueprint.category,
    visibility: blueprint.visibility,
    ownerBusinessTeamId: blueprint.ownerBusinessTeamId,
    teamId: blueprint.teamId,
    environmentId: blueprint.environmentId ?? "",
    providerAdapterId: blueprint.providerAdapterId,
    version: blueprint.version,
    status: blueprint.status,
    triggerType: typeof trigger.type === "string" ? trigger.type : "manual",
    triggerConnector: typeof trigger.connector === "string" ? trigger.connector : "",
    triggerEvent: typeof trigger.event === "string" ? trigger.event : "",
    triggerExpression: typeof trigger.expression === "string" ? trigger.expression : "",
    triggerWebhookPathKey:
      typeof trigger.webhookPathKey === "string" ? trigger.webhookPathKey : "",
    triggerIdempotencyKey:
      typeof trigger.idempotencyKey === "string" ? trigger.idempotencyKey : "",
    triggerExtraJson: JSON.stringify(triggerExtra, null, 2),
    inputSchemaJson: normalizeJson(blueprint.inputSchemaJson),
    environmentSelectorJson: normalizeJson(blueprint.environmentSelectorJson),
    agentTeamRunPlanJson: normalizeJson(blueprint.agentTeamRunPlanJson),
    memoryPolicyJson: normalizeJson(blueprint.memoryPolicyJson),
    providerPolicyJson: normalizeJson(blueprint.providerPolicyJson),
    permissionPolicyJson: normalizeJson(blueprint.permissionPolicyJson),
    resultSchemaJson: normalizeJson(blueprint.resultSchemaJson),
    outputPolicyJson: normalizeJson(blueprint.outputPolicyJson),
    dashboardPolicyJson: normalizeJson(blueprint.dashboardPolicyJson),
    executionPolicyJson: normalizeJson(blueprint.executionPolicyJson),
    archivePolicyJson: normalizeJson(blueprint.archivePolicyJson),
  });

  async function save() {
    setIsSaving(true);
    setMessage(null);
    const jsonFields = [
      "triggerExtraJson",
      "inputSchemaJson",
      "environmentSelectorJson",
      "agentTeamRunPlanJson",
      "memoryPolicyJson",
      "providerPolicyJson",
      "permissionPolicyJson",
      "resultSchemaJson",
      "outputPolicyJson",
      "dashboardPolicyJson",
      "executionPolicyJson",
      "archivePolicyJson",
    ] as const;

    try {
      jsonFields.forEach((field) => {
        JSON.parse(form[field]);
      });
    } catch {
      setIsSaving(false);
      setMessage("JSON 格式不正确");
      return;
    }

    const triggerJson = {
      ...parseRecord(form.triggerExtraJson),
      type: form.triggerType,
      connector: form.triggerConnector || undefined,
      event: form.triggerEvent || undefined,
      expression: form.triggerExpression || undefined,
      webhookPathKey: form.triggerWebhookPathKey || undefined,
      idempotencyKey: form.triggerIdempotencyKey || undefined,
    };

    const response = await fetch(`/api/task-blueprints/${blueprint.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: blueprint.id,
        name: form.name,
        category: form.category,
        visibility: form.visibility,
        ownerBusinessTeamId: form.ownerBusinessTeamId,
        teamId: form.teamId,
        environmentId: form.environmentId || null,
        providerAdapterId: form.providerAdapterId,
        version: Number(form.version),
        status: form.status,
        triggerJson: JSON.stringify(triggerJson, null, 2),
        inputSchemaJson: form.inputSchemaJson,
        environmentSelectorJson: form.environmentSelectorJson,
        agentTeamRunPlanJson: form.agentTeamRunPlanJson,
        memoryPolicyJson: form.memoryPolicyJson,
        providerPolicyJson: form.providerPolicyJson,
        permissionPolicyJson: form.permissionPolicyJson,
        resultSchemaJson: form.resultSchemaJson,
        outputPolicyJson: form.outputPolicyJson,
        dashboardPolicyJson: form.dashboardPolicyJson,
        executionPolicyJson: form.executionPolicyJson,
        archivePolicyJson: form.archivePolicyJson,
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

  const policySections: Array<[keyof typeof form, string]> = [
    ["inputSchemaJson", "输入 Schema"],
    ["environmentSelectorJson", "环境选择器"],
    ["agentTeamRunPlanJson", "团队编排"],
    ["memoryPolicyJson", "记忆策略"],
    ["providerPolicyJson", "Provider 策略"],
    ["permissionPolicyJson", "权限策略"],
    ["resultSchemaJson", "结果 Schema"],
    ["outputPolicyJson", "输出策略"],
    ["dashboardPolicyJson", "看板策略"],
    ["executionPolicyJson", "执行策略"],
    ["archivePolicyJson", "归档策略"],
  ];

  return (
    <Panel>
      <PanelHeader
        eyebrow="Editor"
        title="蓝图编辑"
        description="结构化编辑蓝图归属、触发器与策略 JSON。"
      />
      <PanelBody>

      <div className="grid gap-3 md:grid-cols-2">
        <Input
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="任务蓝图名称"
        />
        <Input
          value={form.category}
          onChange={(event) => setForm({ ...form, category: event.target.value })}
          placeholder="任务类别"
        />
        <Select
          value={form.ownerBusinessTeamId}
          onChange={(event) => setForm({ ...form, ownerBusinessTeamId: event.target.value })}
        >
          {options.businessTeams.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </Select>
        <Select
          value={form.teamId}
          onChange={(event) => setForm({ ...form, teamId: event.target.value })}
        >
          {options.agentTeams.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </Select>
        <Select
          value={form.visibility}
          onChange={(event) => setForm({ ...form, visibility: event.target.value })}
        >
          {["private", "team", "global"].map((value) => (
            <option key={value} value={value}>
              可见性 {value}
            </option>
          ))}
        </Select>
        <Select
          value={form.status}
          onChange={(event) => setForm({ ...form, status: event.target.value })}
        >
          {["draft", "active", "paused", "archived"].map((value) => (
            <option key={value} value={value}>
              状态 {value}
            </option>
          ))}
        </Select>
        <Select
          value={form.providerAdapterId}
          onChange={(event) => setForm({ ...form, providerAdapterId: event.target.value })}
        >
          {options.providerAdapters.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </Select>
        <Select
          value={form.environmentId}
          onChange={(event) => setForm({ ...form, environmentId: event.target.value })}
        >
          <option value="">未绑定环境</option>
          {options.environments.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </Select>
        <Input
          value={String(form.version)}
          onChange={(event) => setForm({ ...form, version: Number(event.target.value) || 1 })}
          placeholder="版本"
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Select
          value={form.triggerType}
          onChange={(event) => setForm({ ...form, triggerType: event.target.value })}
        >
          {["manual", "cron", "webhook", "access_grant"].map((value) => (
            <option key={value} value={value}>
              触发器 {value}
            </option>
          ))}
        </Select>
        <Input
          value={form.triggerConnector}
          onChange={(event) => setForm({ ...form, triggerConnector: event.target.value })}
          placeholder="连接器，例如 gitlab / github"
        />
        <Input
          value={form.triggerEvent}
          onChange={(event) => setForm({ ...form, triggerEvent: event.target.value })}
          placeholder="事件名，例如 merge_request.updated"
        />
        <Input
          value={form.triggerWebhookPathKey}
          onChange={(event) => setForm({ ...form, triggerWebhookPathKey: event.target.value })}
          placeholder="Webhook 路径标识"
        />
        <Input
          value={form.triggerExpression}
          onChange={(event) => setForm({ ...form, triggerExpression: event.target.value })}
          placeholder="Cron 表达式"
        />
        <Input
          value={form.triggerIdempotencyKey}
          onChange={(event) => setForm({ ...form, triggerIdempotencyKey: event.target.value })}
          placeholder="幂等键模板"
        />
      </div>

      <Textarea
        className="mt-3"
        value={form.triggerExtraJson}
        onChange={(event) => setForm({ ...form, triggerExtraJson: event.target.value })}
        placeholder="触发器额外字段 JSON"
      />

      {policySections.map(([field, label]) => (
        <Textarea
          key={field}
          className="mt-3 min-h-28"
          value={form[field] as string}
          onChange={(event) => setForm({ ...form, [field]: event.target.value })}
          placeholder={label}
        />
      ))}

      <div className="mt-3 flex items-center justify-between gap-3">
        <Button
          type="button"
          onClick={save}
          disabled={isSaving}
        >
          {isSaving ? "保存中" : "保存任务蓝图"}
        </Button>
        {message ? <div className="text-xs text-[var(--ink-muted)]">{message}</div> : null}
      </div>
      </PanelBody>
    </Panel>
  );
}
