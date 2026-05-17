"use client";

import { ArrowDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type WorkflowBlockType = "agent" | "agent_team" | "script_hook" | "http_hook" | "notification";

export type WorkflowBlock = {
  id: string;
  type: WorkflowBlockType;
  title: string;
  agentId: string;
  agentTeamId: string;
  dependsOn: string[];
  instruction: string;
  tool: string;
  action: string;
  script: string;
  url: string;
  method: string;
  connectorType: string;
  publisherRef: string;
  payloadTemplate: string;
};

type AgentOption = {
  id: string;
  name: string;
  role: string;
  memberRole: string;
};

type AgentTeamOption = {
  id: string;
  name: string;
};

type Props = {
  blocks: WorkflowBlock[];
  onChange(blocks: WorkflowBlock[]): void;
  agents: AgentOption[];
  agentTeams: AgentTeamOption[];
};

const blockTypeLabels: Record<WorkflowBlockType, string> = {
  agent: "Agent 执行",
  agent_team: "Agent 团队执行",
  script_hook: "脚本 Hook",
  http_hook: "HTTP Hook",
  notification: "通知 Hook",
};

function nextBlockId(type: WorkflowBlockType, index: number) {
  return `${type}_${index + 1}`.replace(/[^a-zA-Z0-9_]+/g, "_");
}

function defaultTool(type: WorkflowBlockType) {
  if (type === "agent") return "agent.execute";
  if (type === "agent_team") return "agent_team.invoke";
  if (type === "script_hook") return "script.run";
  if (type === "http_hook") return "hook.http";
  return "connector.email";
}

function defaultAction(type: WorkflowBlockType) {
  if (type === "agent") return "execute";
  if (type === "agent_team") return "delegate";
  if (type === "script_hook") return "run_script";
  if (type === "http_hook") return "call_hook";
  return "notify";
}

function createBlock(type: WorkflowBlockType, index: number, agents: AgentOption[], teams: AgentTeamOption[]) {
  return {
    id: nextBlockId(type, index),
    type,
    title: blockTypeLabels[type],
    agentId: agents[0]?.id ?? "",
    agentTeamId: teams[0]?.id ?? "",
    dependsOn: index > 0 ? [nextBlockId("agent", index - 1)] : [],
    instruction: "",
    tool: defaultTool(type),
    action: defaultAction(type),
    script: "",
    url: "",
    method: "POST",
    connectorType: type === "notification" ? "email" : "",
    publisherRef: "",
    payloadTemplate: "{}",
  } satisfies WorkflowBlock;
}

function updateBlock(blocks: WorkflowBlock[], id: string, patch: Partial<WorkflowBlock>) {
  return blocks.map((block) => (block.id === id ? { ...block, ...patch } : block));
}

function renameBlock(blocks: WorkflowBlock[], oldId: string, nextId: string) {
  return blocks.map((block) =>
    block.id === oldId
      ? { ...block, id: nextId }
      : {
          ...block,
          dependsOn: block.dependsOn.map((dependency) => (dependency === oldId ? nextId : dependency)),
        },
  );
}

function removeBlock(blocks: WorkflowBlock[], id: string) {
  return blocks
    .filter((block) => block.id !== id)
    .map((block) => ({
      ...block,
      dependsOn: block.dependsOn.filter((dependency) => dependency !== id),
    }));
}

function dependencyOptions(blocks: WorkflowBlock[], currentId: string) {
  return blocks.filter((block) => block.id !== currentId);
}

function toggleDependency(block: WorkflowBlock, dependencyId: string) {
  return block.dependsOn.includes(dependencyId)
    ? block.dependsOn.filter((id) => id !== dependencyId)
    : [...block.dependsOn, dependencyId];
}

export function TaskWorkflowBlockEditor({ blocks, onChange, agents, agentTeams }: Props) {
  function addBlock(type: WorkflowBlockType) {
    const next = createBlock(type, blocks.length, agents, agentTeams);
    const previous = blocks.at(-1);
    onChange([
      ...blocks,
      {
        ...next,
        dependsOn: previous ? [previous.id] : [],
      },
    ]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["agent", "agent_team", "script_hook", "http_hook", "notification"] as const).map((type) => (
          <Button key={type} type="button" size="sm" variant="secondary" onClick={() => addBlock(type)}>
            <Plus className="h-4 w-4" />
            {blockTypeLabels[type]}
          </Button>
        ))}
      </div>

      {blocks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface-muted)] p-5 text-sm text-[var(--ink-muted)]">
          还没有编排块。至少添加一个 Agent、Agent 团队、脚本 Hook 或通知 Hook。
        </div>
      ) : (
        <div className="space-y-3">
          {blocks.map((block, index) => (
            <div key={block.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--ink)]">
                    {index + 1}. {block.title || blockTypeLabels[block.type]}
                  </div>
                  <div className="mt-1 text-xs text-[var(--ink-muted)]">
                    {blockTypeLabels[block.type]} · {block.id}
                  </div>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="删除编排块"
                  onClick={() => onChange(removeBlock(blocks, block.id))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <FieldGroup label="块 ID">
                  <Input
                    value={block.id}
                    onChange={(event) => onChange(renameBlock(blocks, block.id, event.target.value))}
                  />
                </FieldGroup>
                <FieldGroup label="块类型">
                  <Select
                    value={block.type}
                    onChange={(event) => {
                      const type = event.target.value as WorkflowBlockType;
                      onChange(
                        updateBlock(blocks, block.id, {
                          type,
                          title: block.title || blockTypeLabels[type],
                          tool: block.tool || defaultTool(type),
                          action: block.action || defaultAction(type),
                        }),
                      );
                    }}
                  >
                    {Object.entries(blockTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </FieldGroup>
                <FieldGroup label="显示名称">
                  <Input
                    value={block.title}
                    onChange={(event) => onChange(updateBlock(blocks, block.id, { title: event.target.value }))}
                  />
                </FieldGroup>
                <FieldGroup label="依赖块">
                  <div className="flex min-h-10 flex-wrap gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
                    {dependencyOptions(blocks, block.id).length === 0 ? (
                      <span className="text-xs text-[var(--ink-muted)]">无可选依赖</span>
                    ) : (
                      dependencyOptions(blocks, block.id).map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          className={`rounded-full border px-2 py-1 text-xs ${
                            block.dependsOn.includes(option.id)
                              ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                              : "border-[var(--line)] text-[var(--ink-muted)]"
                          }`}
                          onClick={() =>
                            onChange(updateBlock(blocks, block.id, { dependsOn: toggleDependency(block, option.id) }))
                          }
                        >
                          {option.title || option.id}
                        </button>
                      ))
                    )}
                  </div>
                </FieldGroup>

                {block.type === "agent" ? (
                  <FieldGroup label="执行 Agent">
                    <Select
                      value={block.agentId}
                      onChange={(event) => onChange(updateBlock(blocks, block.id, { agentId: event.target.value }))}
                    >
                      <option value="">选择 Agent</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name} · {agent.memberRole || agent.role}
                        </option>
                      ))}
                    </Select>
                  </FieldGroup>
                ) : null}

                {block.type === "agent_team" ? (
                  <FieldGroup label="目标 Agent 团队">
                    <Select
                      value={block.agentTeamId}
                      onChange={(event) => onChange(updateBlock(blocks, block.id, { agentTeamId: event.target.value }))}
                    >
                      <option value="">选择 Agent 团队</option>
                      {agentTeams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </Select>
                  </FieldGroup>
                ) : null}

                {block.type === "script_hook" ? (
                  <FieldGroup label="脚本命令" className="md:col-span-2">
                    <Textarea
                      className="min-h-24 font-mono text-xs"
                      value={block.script}
                      onChange={(event) => onChange(updateBlock(blocks, block.id, { script: event.target.value }))}
                      placeholder="pnpm test -- --runInBand"
                    />
                  </FieldGroup>
                ) : null}

                {block.type === "http_hook" ? (
                  <>
                    <FieldGroup label="HTTP 方法">
                      <Select
                        value={block.method}
                        onChange={(event) => onChange(updateBlock(blocks, block.id, { method: event.target.value }))}
                      >
                        {["POST", "PUT", "PATCH", "GET"].map((method) => (
                          <option key={method} value={method}>
                            {method}
                          </option>
                        ))}
                      </Select>
                    </FieldGroup>
                    <FieldGroup label="Hook URL">
                      <Input
                        value={block.url}
                        onChange={(event) => onChange(updateBlock(blocks, block.id, { url: event.target.value }))}
                        placeholder="https://example.com/webhook"
                      />
                    </FieldGroup>
                  </>
                ) : null}

                {block.type === "notification" ? (
                  <>
                    <FieldGroup label="Connector 类型">
                      <Select
                        value={block.connectorType}
                        onChange={(event) =>
                          onChange(updateBlock(blocks, block.id, { connectorType: event.target.value }))
                        }
                      >
                        {["email", "im", "web_push", "custom"].map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </Select>
                    </FieldGroup>
                    <FieldGroup label="发布器引用">
                      <Input
                        value={block.publisherRef}
                        onChange={(event) =>
                          onChange(updateBlock(blocks, block.id, { publisherRef: event.target.value }))
                        }
                        placeholder="builtin.email / official.codehub.publisher..."
                      />
                    </FieldGroup>
                  </>
                ) : null}

                <FieldGroup label="动作">
                  <Input
                    value={block.action}
                    onChange={(event) => onChange(updateBlock(blocks, block.id, { action: event.target.value }))}
                  />
                </FieldGroup>
                <FieldGroup label="工具 / Hook">
                  <Input
                    value={block.tool}
                    onChange={(event) => onChange(updateBlock(blocks, block.id, { tool: event.target.value }))}
                  />
                </FieldGroup>
                <FieldGroup label="块指令" className="md:col-span-2">
                  <Textarea
                    className="min-h-24"
                    value={block.instruction}
                    onChange={(event) => onChange(updateBlock(blocks, block.id, { instruction: event.target.value }))}
                    placeholder="说明这个块要处理的输入、输出和完成标准。"
                  />
                </FieldGroup>
                {block.type === "http_hook" || block.type === "notification" ? (
                  <FieldGroup label="Payload 模板" className="md:col-span-2">
                    <Textarea
                      className="min-h-24 font-mono text-xs"
                      value={block.payloadTemplate}
                      onChange={(event) =>
                        onChange(updateBlock(blocks, block.id, { payloadTemplate: event.target.value }))
                      }
                      placeholder='{"taskRunId":"${task_run_id}","summary":"${summary}"}'
                    />
                  </FieldGroup>
                ) : null}
              </div>

              {index < blocks.length - 1 ? (
                <div className="mt-3 flex justify-center text-[var(--ink-muted)]">
                  <ArrowDown className="h-4 w-4" />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
