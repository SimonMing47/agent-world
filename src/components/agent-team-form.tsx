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
      : [],
  );
  const [leaderMemberId, setLeaderMemberId] = useState<string | null>(
    props.team.leaderAgentId ?? null,
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
      setMessage("ui.generated.cc2302d1166");
      return;
    }

    if (!form.businessTeamId.trim()) {
      setIsSaving(false);
      setMessage("ui.generated.ca5569f6d6d");
      return;
    }

	    if (normalizedMembers.length === 0) {
	      setIsSaving(false);
	      setMessage("ui.generated.c18901ca49b");
	      return;
	    }

	    const selectedLeaderId = normalizedMembers.find((member) => member.id === leaderMemberId)?.id ?? null;
	    if (!selectedLeaderId) {
	      setIsSaving(false);
	      setMessage("ui.common.agentTeamLeaderRequired");
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
	        leaderAgentId: selectedLeaderId,
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
      setMessage(payload.error ?? "ui.generated.c40525a7328");
      return;
    }

    setMessage("ui.generated.c9c83c5e80e");
    props.onSaved?.();
    router.refresh();
  }

  const content = (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="ui.generated.cb2629c388f">
          <Input
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                name: event.target.value,
                slug: current.id ? current.slug : slugify(event.target.value),
              }))
            }
            placeholder="ui.generated.cc43cb4b09f"
          />
        </FieldGroup>
        <FieldGroup label="Slug">
          <Input
            value={form.slug}
            onChange={(event) => setForm({ ...form, slug: slugify(event.target.value) })}
            placeholder="security-inspection-team"
          />
        </FieldGroup>
        <FieldGroup label="ui.generated.c26f30fd79b">
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
        <FieldGroup label="ui.generated.c747b74cec9">
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
        <FieldGroup label="ui.generated.c3ac4454d68">
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
        <FieldGroup label="ui.generated.c16dc2c92c6">
          <Select
            value={form.teamStructure}
            onChange={(event) => setForm({ ...form, teamStructure: event.target.value })}
          >
            {["leader_worker", "collaborative", "inspector_publisher", "custom"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label="ui.generated.c0ed5cf4445" className="md:col-span-2">
          <Textarea
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="ui.generated.c58b2e958d3"
          />
        </FieldGroup>
        <FieldGroup label="ui.generated.c3d23524681" className="md:col-span-2">
          <Textarea
            className="min-h-32"
            value={form.orchestrationPrompt}
            onChange={(event) => setForm({ ...form, orchestrationPrompt: event.target.value })}
            placeholder="ui.generated.c2b17dea6f7"
          />
        </FieldGroup>
        <FieldGroup label="ui.generated.c6a361e464d" className="md:col-span-2">
          <Textarea
            value={form.teamObjective}
            onChange={(event) => setForm({ ...form, teamObjective: event.target.value })}
            placeholder="ui.generated.c1bcb95bf58"
          />
        </FieldGroup>
        <FieldGroup label="ui.generated.cbab38435a9">
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
        <FieldGroup label="ui.generated.c4aeeacc808">
          <Select
            value={form.conflictResolution}
            onChange={(event) => setForm({ ...form, conflictResolution: event.target.value })}
          >
            {["leader_decision", "majority_vote", "manual_check"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label="ui.generated.c815a1c560d">
          <Input
            value={form.splitStrategy}
            onChange={(event) => setForm({ ...form, splitStrategy: event.target.value })}
            placeholder="by_repository / by_diff_chunk / custom"
          />
        </FieldGroup>
        <FieldGroup label="ui.generated.cad9cc2683a">
          <Input
            type="number"
            min="1"
            value={form.maxConcurrency}
            onChange={(event) => setForm({ ...form, maxConcurrency: event.target.value })}
          />
        </FieldGroup>
        <FieldGroup label="ui.generated.c7960aded1f">
          <Input
            type="number"
            min="1"
            value={form.timeoutMinutes}
            onChange={(event) => setForm({ ...form, timeoutMinutes: event.target.value })}
          />
        </FieldGroup>
        <FieldGroup label="ui.generated.ceb47319da8">
          <Input
            type="number"
            min="1"
            max="100"
            value={form.successRateThreshold}
            onChange={(event) => setForm({ ...form, successRateThreshold: event.target.value })}
          />
        </FieldGroup>
        <FieldGroup label="ui.generated.c4364c1156f">
          <Select
            value={form.defaultExecutionPolicyId}
            onChange={(event) => setForm({ ...form, defaultExecutionPolicyId: event.target.value })}
          >
            <option value="">ui.generated.c8c577dc72c</option>
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
          eyebrow="ui.generated.c42594317da"
          title="ui.generated.c7de0251fdd"
          description="ui.generated.c96599fef77"
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
	                    agentDefinitionId: "",
	                    memberRole: "worker",
                    workInstruction: "",
                    position: current.length,
                    status: "active",
                  },
                ])
              }
            >
              <Plus className="h-4 w-4" />
              ui.generated.cb74c7e162f
            </Button>
          }
        />
        <PanelBody className="space-y-3">
          {members.map((member, index) => {
            const definition = props.agentDefinitionOptions.find((item) => item.id === member.agentDefinitionId);
            return (
              <div key={member.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <FieldGroup label="ui.generated.c2bca55a7ed">
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
                      <option value="">ui.generated.c382f4b5559</option>
                      {props.agentDefinitionOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </Select>
                  </FieldGroup>
                  <FieldGroup label="ui.generated.cf39bcb6746">
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
                  <FieldGroup label="ui.generated.c62e951a692">
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
                      ui.generated.cf62d42c955
                    </label>
                  </FieldGroup>
                  <FieldGroup label="ui.generated.cb7ceae901b" className="md:col-span-2 xl:col-span-3">
                    <Textarea
                      value={member.workInstruction}
                      onChange={(event) =>
                        setMembers((current) =>
                          current.map((item) =>
                            item.id === member.id ? { ...item, workInstruction: event.target.value } : item,
                          ),
                        )
                      }
                      placeholder="ui.generated.c88df8fed67"
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
                      ui.generated.c3755f56f2f
                    </Button>
                  </div>
                </div>
                <div className="mt-2 text-xs text-[var(--ink-muted)]">
                  ui.generated.c5ffa03ca83{index + 1} · {definition?.name ?? "ui.generated.c1a0b1e5949"} ui.generated.cc4d0e9b52b {definition?.role ?? "ui.generated.c47024abd2c"}
                </div>
              </div>
            );
          })}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          eyebrow="ui.generated.c39a22ecca5"
          title="ui.generated.c7d5be2f876"
          description="ui.generated.c72b0af85b2"
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
          {isSaving ? "ui.generated.ca032e8fdda" : "ui.generated.ceca82dbfa1"}
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
      <PanelHeader title={props.title} description="ui.generated.c0ffc404f02" />
      <PanelBody>{content}</PanelBody>
    </Panel>
  );
}
