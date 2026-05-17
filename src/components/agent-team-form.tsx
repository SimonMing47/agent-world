"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type AgentTeamFormProps = {
  team: {
    id: string;
    businessTeamId: string;
    slug: string;
    name: string;
    description: string;
    leaderAgentId: string | null;
    workflowType: string;
    orchestrationPrompt: string;
    workflowDefinitionJson: string;
    inputSchemaJson: string;
    outputSchemaJson: string;
    maxConcurrency: number;
    timeoutMs: number;
    successRateThreshold: number;
    pricingModelJson: string;
    visibility: string;
    defaultExecutionPolicyId: string | null;
  };
  members: Array<{
    id: string;
    agentDefinitionId: string;
    memberRole: string;
    workInstruction: string;
    position: number;
    status: string;
  }>;
  shares: Array<{
    businessTeamId: string;
    accessLevel: string;
  }>;
  businessTeamOptions: Array<{ id: string; name: string }>;
  agentDefinitionOptions: Array<{ id: string; name: string; role: string }>;
  executionPolicyOptions: Array<{ id: string; name: string }>;
  embedded?: boolean;
  title: string;
  onSaved?: () => void;
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function parseJsonObject<T extends Record<string, unknown>>(value: string, fallback: T) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? ({ ...fallback, ...(parsed as T) } as T)
      : fallback;
  } catch {
    return fallback;
  }
}

function defaultWorkflowDefinition() {
  return {
    teamStructure: "leader_worker",
    teamObjective: "",
    aggregationMethod: "leader_summary",
    conflictResolution: "leader_decision",
    splitStrategy: "",
  };
}

export function AgentTeamForm(props: AgentTeamFormProps) {
  const router = useRouter();
  const parsedWorkflow = parseJsonObject(
    props.team.workflowDefinitionJson,
    defaultWorkflowDefinition(),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: props.team.id,
    businessTeamId: props.team.businessTeamId,
    slug: props.team.slug,
    name: props.team.name,
    description: props.team.description,
    visibility: props.team.visibility,
    workflowType: props.team.workflowType,
    orchestrationPrompt: props.team.orchestrationPrompt,
    teamStructure: String(parsedWorkflow.teamStructure ?? "leader_worker"),
    teamObjective: String(parsedWorkflow.teamObjective ?? ""),
    aggregationMethod: String(parsedWorkflow.aggregationMethod ?? "leader_summary"),
    conflictResolution: String(parsedWorkflow.conflictResolution ?? "leader_decision"),
    splitStrategy: String(parsedWorkflow.splitStrategy ?? ""),
    maxConcurrency: String(props.team.maxConcurrency),
    timeoutMinutes: String(Math.max(1, Math.round(props.team.timeoutMs / 60000))),
    successRateThreshold: String(Math.round(props.team.successRateThreshold * 100)),
    defaultExecutionPolicyId: props.team.defaultExecutionPolicyId ?? "",
  });
  const [members, setMembers] = useState(
    props.members.length
      ? props.members.slice().sort((left, right) => left.position - right.position)
      : [
          {
            id: crypto.randomUUID(),
            agentDefinitionId: props.agentDefinitionOptions[0]?.id ?? "",
            memberRole: "leader",
            workInstruction: "",
            position: 0,
            status: "active",
          },
        ],
  );
  const [leaderMemberId, setLeaderMemberId] = useState<string | null>(
    props.team.leaderAgentId ?? props.members[0]?.id ?? null,
  );
  const [shareMap, setShareMap] = useState<Record<string, string>>(
    Object.fromEntries(props.shares.map((share) => [share.businessTeamId, share.accessLevel])),
  );

  function buildWorkflowDefinitionJson() {
    return JSON.stringify(
      {
        strategy: form.workflowType,
        teamStructure: form.teamStructure,
        teamObjective: form.teamObjective,
        aggregationMethod: form.aggregationMethod,
        conflictResolution: form.conflictResolution,
        splitStrategy: form.splitStrategy,
      },
      null,
      2,
    );
  }

  async function save() {
    setIsSaving(true);
    setMessage(null);

    const normalizedMembers = members
      .filter((member) => member.agentDefinitionId.trim())
      .map((member, index) => ({
        ...member,
        id: member.id || crypto.randomUUID(),
        position: index,
        memberRole: member.memberRole.trim() || "member",
        workInstruction: member.workInstruction.trim(),
        status: member.status || "active",
      }));

    if (!form.name.trim()) {
      setIsSaving(false);
      setMessage("请先填写团队名称。");
      return;
    }

    if (!form.businessTeamId.trim()) {
      setIsSaving(false);
      setMessage("请先选择归属业务团队。");
      return;
    }

    if (normalizedMembers.length === 0) {
      setIsSaving(false);
      setMessage("至少需要选择一个 Agent 成员。");
      return;
    }

    const normalizedShares = Object.entries(shareMap)
      .filter(([businessTeamId]) => businessTeamId.trim() && businessTeamId !== form.businessTeamId)
      .map(([businessTeamId, accessLevel]) => ({
        businessTeamId,
        accessLevel,
      }));

    const response = await fetch("/api/agent-teams", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: form.id || crypto.randomUUID(),
        businessTeamId: form.businessTeamId,
        slug: form.slug || slugify(form.name) || `agent-team-${crypto.randomUUID().slice(0, 8)}`,
        name: form.name,
        description: form.description,
        leaderAgentId:
          normalizedMembers.find((member) => member.id === leaderMemberId)?.id ??
          normalizedMembers[0]?.id ??
          null,
        workflowType: form.workflowType,
        orchestrationPrompt: form.orchestrationPrompt,
        workflowDefinitionJson: buildWorkflowDefinitionJson(),
        inputSchemaJson: props.team.inputSchemaJson || JSON.stringify({ type: "object" }, null, 2),
        outputSchemaJson: props.team.outputSchemaJson || JSON.stringify({ type: "object" }, null, 2),
        maxConcurrency: Number(form.maxConcurrency || 1),
        timeoutMs: Number(form.timeoutMinutes || 20) * 60 * 1000,
        successRateThreshold: Number(form.successRateThreshold || 90) / 100,
        pricingModelJson: props.team.pricingModelJson || JSON.stringify({ baseUsd: 0, tokenMultiplier: 1 }, null, 2),
        visibility: form.visibility,
        defaultExecutionPolicyId: form.defaultExecutionPolicyId || null,
        members: normalizedMembers,
        shares: normalizedShares,
      }),
    });

    setIsSaving(false);
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setMessage(payload.error ?? "保存失败");
      return;
    }

    setMessage("已保存 Agent 团队");
    props.onSaved?.();
    router.refresh();
  }

  const content = (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="团队名称">
          <Input
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                name: event.target.value,
                slug: current.id ? current.slug : slugify(event.target.value),
              }))
            }
            placeholder="安全检视团队"
          />
        </FieldGroup>
        <FieldGroup label="Slug">
          <Input
            value={form.slug}
            onChange={(event) => setForm({ ...form, slug: slugify(event.target.value) })}
            placeholder="security-review-team"
          />
        </FieldGroup>
        <FieldGroup label="归属业务团队">
          <Select
            value={form.businessTeamId}
            onChange={(event) => setForm({ ...form, businessTeamId: event.target.value })}
          >
            {props.businessTeamOptions.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label="可见性">
          <Select
            value={form.visibility}
            onChange={(event) => setForm({ ...form, visibility: event.target.value })}
          >
            {["team", "global", "personal", "public"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label="工作流策略">
          <Select
            value={form.workflowType}
            onChange={(event) => setForm({ ...form, workflowType: event.target.value })}
          >
            {["single", "sequential", "parallel", "dag"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label="团队结构">
          <Select
            value={form.teamStructure}
            onChange={(event) => setForm({ ...form, teamStructure: event.target.value })}
          >
            {["leader_worker", "collaborative", "reviewer_publisher", "custom"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label="团队说明" className="md:col-span-2">
          <Textarea
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="这个 Agent 团队面向什么业务目标。"
          />
        </FieldGroup>
        <FieldGroup label="编排提示词" className="md:col-span-2">
          <Textarea
            className="min-h-32"
            value={form.orchestrationPrompt}
            onChange={(event) => setForm({ ...form, orchestrationPrompt: event.target.value })}
            placeholder="描述团队整体的协作原则、输出要求和工作边界。"
          />
        </FieldGroup>
        <FieldGroup label="团队目标" className="md:col-span-2">
          <Textarea
            value={form.teamObjective}
            onChange={(event) => setForm({ ...form, teamObjective: event.target.value })}
            placeholder="例如：对 MR 做分层代码检视，并输出可回写评论。"
          />
        </FieldGroup>
        <FieldGroup label="汇总方式">
          <Select
            value={form.aggregationMethod}
            onChange={(event) => setForm({ ...form, aggregationMethod: event.target.value })}
          >
            {["leader_summary", "deduplicate_rank_and_publish", "vote"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label="冲突处理">
          <Select
            value={form.conflictResolution}
            onChange={(event) => setForm({ ...form, conflictResolution: event.target.value })}
          >
            {["leader_decision", "majority_vote", "manual_review"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label="拆分策略">
          <Input
            value={form.splitStrategy}
            onChange={(event) => setForm({ ...form, splitStrategy: event.target.value })}
            placeholder="by_repository / by_diff_chunk / custom"
          />
        </FieldGroup>
        <FieldGroup label="并发数">
          <Input
            type="number"
            min="1"
            value={form.maxConcurrency}
            onChange={(event) => setForm({ ...form, maxConcurrency: event.target.value })}
          />
        </FieldGroup>
        <FieldGroup label="超时（分钟）">
          <Input
            type="number"
            min="1"
            value={form.timeoutMinutes}
            onChange={(event) => setForm({ ...form, timeoutMinutes: event.target.value })}
          />
        </FieldGroup>
        <FieldGroup label="成功率目标（%）">
          <Input
            type="number"
            min="1"
            max="100"
            value={form.successRateThreshold}
            onChange={(event) => setForm({ ...form, successRateThreshold: event.target.value })}
          />
        </FieldGroup>
        <FieldGroup label="默认执行策略">
          <Select
            value={form.defaultExecutionPolicyId}
            onChange={(event) => setForm({ ...form, defaultExecutionPolicyId: event.target.value })}
          >
            <option value="">未指定</option>
            {props.executionPolicyOptions.map((policy) => (
              <option key={policy.id} value={policy.id}>
                {policy.name}
              </option>
            ))}
          </Select>
        </FieldGroup>
      </div>

      <Panel>
        <PanelHeader
          eyebrow="成员配置"
          title="团队成员"
          description="从 Agent 定义目录中选成员，并设置工作职责与 Leader。"
          action={
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                setMembers((current) => [
                  ...current,
                  {
                    id: crypto.randomUUID(),
                    agentDefinitionId: props.agentDefinitionOptions[0]?.id ?? "",
                    memberRole: "worker",
                    workInstruction: "",
                    position: current.length,
                    status: "active",
                  },
                ])
              }
            >
              <Plus className="h-4 w-4" />
              新增成员
            </Button>
          }
        />
        <PanelBody className="space-y-3">
          {members.map((member, index) => {
            const definition = props.agentDefinitionOptions.find((item) => item.id === member.agentDefinitionId);
            return (
              <div key={member.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <FieldGroup label="Agent 定义">
                    <Select
                      value={member.agentDefinitionId}
                      onChange={(event) =>
                        setMembers((current) =>
                          current.map((item) =>
                            item.id === member.id
                              ? {
                                  ...item,
                                  agentDefinitionId: event.target.value,
                                  memberRole:
                                    item.memberRole || props.agentDefinitionOptions.find((opt) => opt.id === event.target.value)?.role || "worker",
                                }
                              : item,
                          ),
                        )
                      }
                    >
                      <option value="">请选择</option>
                      {props.agentDefinitionOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </Select>
                  </FieldGroup>
                  <FieldGroup label="团队角色">
                    <Input
                      value={member.memberRole}
                      onChange={(event) =>
                        setMembers((current) =>
                          current.map((item) =>
                            item.id === member.id ? { ...item, memberRole: event.target.value } : item,
                          ),
                        )
                      }
                      placeholder={definition?.role ?? "worker"}
                    />
                  </FieldGroup>
                  <FieldGroup label="状态">
                    <Select
                      value={member.status}
                      onChange={(event) =>
                        setMembers((current) =>
                          current.map((item) =>
                            item.id === member.id ? { ...item, status: event.target.value } : item,
                          ),
                        )
                      }
                    >
                      {["active", "disabled"].map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </Select>
                  </FieldGroup>
                  <FieldGroup label="Leader">
                    <label className="flex h-10 items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)]">
                      <input
                        type="radio"
                        name="team-leader"
                        checked={leaderMemberId === member.id}
                        onChange={() => setLeaderMemberId(member.id)}
                      />
                      设为 Leader
                    </label>
                  </FieldGroup>
                  <FieldGroup label="成员工作说明" className="md:col-span-2 xl:col-span-3">
                    <Textarea
                      value={member.workInstruction}
                      onChange={(event) =>
                        setMembers((current) =>
                          current.map((item) =>
                            item.id === member.id ? { ...item, workInstruction: event.target.value } : item,
                          ),
                        )
                      }
                      placeholder="描述这个 Agent 在团队中承担的具体职责和输出要求。"
                    />
                  </FieldGroup>
                  <div className="flex items-end justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setMembers((current) => current.filter((item) => item.id !== member.id))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                      删除
                    </Button>
                  </div>
                </div>
                <div className="mt-2 text-xs text-[var(--ink-muted)]">
                  顺序 #{index + 1} · {definition?.name ?? "未选择 Agent"} · 基础角色 {definition?.role ?? "未定义"}
                </div>
              </div>
            );
          })}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          eyebrow="共享范围"
          title="可见性与使用权限"
          description="把这个 Agent 团队共享给其他业务团队，并定义它们的访问级别。"
        />
        <PanelBody className="grid gap-3 md:grid-cols-2">
          {props.businessTeamOptions.map((team) => {
            const checked = Boolean(shareMap[team.id]);
            const disabled = team.id === form.businessTeamId;
            return (
              <div key={team.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
                <label className="flex items-center gap-2 text-sm font-medium text-[var(--ink)]">
                  <input
                    type="checkbox"
                    checked={disabled || checked}
                    disabled={disabled}
                    onChange={(event) =>
                      setShareMap((current) => {
                        const next = { ...current };
                        if (event.target.checked) next[team.id] = next[team.id] ?? "viewer";
                        else delete next[team.id];
                        return next;
                      })
                    }
                  />
                  {team.name}
                </label>
                <div className="mt-3">
                  <Select
                    value={disabled ? "owner" : shareMap[team.id] ?? "viewer"}
                    disabled={!disabled && !checked}
                    onChange={(event) =>
                      setShareMap((current) => ({
                        ...current,
                        [team.id]: event.target.value,
                      }))
                    }
                  >
                    {disabled ? <option value="owner">owner</option> : null}
                    {["viewer", "operator", "editor"].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            );
          })}
        </PanelBody>
      </Panel>

      <div className="flex items-center justify-between gap-3">
        <Button type="button" onClick={save} disabled={isSaving}>
          {isSaving ? "保存中" : "保存 Agent 团队"}
        </Button>
        {message ? <div className="text-xs text-[var(--ink-muted)]">{message}</div> : null}
      </div>
    </div>
  );

  if (props.embedded) {
    return content;
  }

  return (
    <Panel>
      <PanelHeader title={props.title} description="定义团队结构、工作流、成员分工和共享范围。" />
      <PanelBody>{content}</PanelBody>
    </Panel>
  );
}
