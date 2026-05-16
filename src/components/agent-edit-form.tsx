"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Textarea } from "@/components/ui/textarea";

type AgentEditFormProps = {
  agent: {
    id: string;
    name: string;
    role: string;
    personaPrompt: string;
    model: string;
    toolBindingsJson: string;
    memoryScope: string;
    status: string;
  };
};

function parseTools(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String).join(", ") : "";
  } catch {
    return "";
  }
}

export function AgentEditForm({ agent }: AgentEditFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: agent.name,
    role: agent.role,
    personaPrompt: agent.personaPrompt,
    model: agent.model,
    toolBindings: parseTools(agent.toolBindingsJson),
    memoryScope: agent.memoryScope,
    status: agent.status,
  });

  async function save() {
    setIsSaving(true);
    setMessage(null);
    const response = await fetch(`/api/agents/${agent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        toolBindings: form.toolBindings
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
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
    <Panel className="mt-4">
      <PanelHeader title="编辑 Agent 定义" description="角色、模型、工具集和记忆范围直接落库更新。" />
      <PanelBody>
        <div className="grid gap-3 md:grid-cols-2">
          <FieldGroup label="角色">
            <Input
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value })}
              aria-label="Agent role"
            />
          </FieldGroup>
          <FieldGroup label="模型">
            <Input
              value={form.model}
              onChange={(event) => setForm({ ...form, model: event.target.value })}
              aria-label="Agent model"
            />
          </FieldGroup>
          <FieldGroup label="工具集">
            <Input
              value={form.toolBindings}
              onChange={(event) => setForm({ ...form, toolBindings: event.target.value })}
              aria-label="Agent tools"
            />
          </FieldGroup>
          <FieldGroup label="记忆范围">
            <Input
              value={form.memoryScope}
              onChange={(event) => setForm({ ...form, memoryScope: event.target.value })}
              aria-label="Agent memory scope"
            />
          </FieldGroup>
          <FieldGroup label="功能说明" className="md:col-span-2">
            <Textarea
              className="min-h-24"
              value={form.personaPrompt}
              onChange={(event) => setForm({ ...form, personaPrompt: event.target.value })}
              aria-label="Agent persona prompt"
            />
          </FieldGroup>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <Button type="button" onClick={save} disabled={isSaving}>
            {isSaving ? "保存中" : "保存 Agent 定义"}
          </Button>
          {message ? <div className="text-xs text-[var(--ink-muted)]">{message}</div> : null}
        </div>
      </PanelBody>
    </Panel>
  );
}
