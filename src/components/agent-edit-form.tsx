"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
    <div className="mt-3 rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-3">
      <div className="grid gap-2 md:grid-cols-2">
        <input
          className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]"
          value={form.role}
          onChange={(event) => setForm({ ...form, role: event.target.value })}
          aria-label="Agent role"
        />
        <input
          className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]"
          value={form.model}
          onChange={(event) => setForm({ ...form, model: event.target.value })}
          aria-label="Agent model"
        />
        <input
          className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]"
          value={form.toolBindings}
          onChange={(event) => setForm({ ...form, toolBindings: event.target.value })}
          aria-label="Agent tools"
        />
        <input
          className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]"
          value={form.memoryScope}
          onChange={(event) => setForm({ ...form, memoryScope: event.target.value })}
          aria-label="Agent memory scope"
        />
      </div>
      <textarea
        className="mt-2 min-h-24 w-full rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm leading-6 text-[var(--ink)]"
        value={form.personaPrompt}
        onChange={(event) => setForm({ ...form, personaPrompt: event.target.value })}
        aria-label="Agent persona prompt"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isSaving}
          className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm font-medium text-[var(--ink)] disabled:opacity-50"
        >
          {isSaving ? "保存中" : "保存 Agent 定义"}
        </button>
        {message ? <div className="text-xs text-[var(--ink-muted)]">{message}</div> : null}
      </div>
    </div>
  );
}
