"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ExecutionEnvironmentFormProps = {
  environment: {
    id: string;
    businessTeamId: string;
    name: string;
    repositoryProvider: string;
    repositoryName: string;
    repositoryUrl: string;
    defaultBranch: string;
    executorRef: string;
    privateKeyRef: string;
    workingDirectory: string;
    sandboxProfileJson: string;
    memoryLayerRefsJson: string;
    visibility: string;
    status: string;
  };
  title: string;
};

function normalizeJson(value: string, fallback: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return fallback;
  }
}

export function ExecutionEnvironmentForm({
  environment,
  title,
}: ExecutionEnvironmentFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: environment.id,
    businessTeamId: environment.businessTeamId,
    name: environment.name,
    repositoryProvider: environment.repositoryProvider,
    repositoryName: environment.repositoryName,
    repositoryUrl: environment.repositoryUrl,
    defaultBranch: environment.defaultBranch,
    executorRef: environment.executorRef,
    privateKeyRef: environment.privateKeyRef,
    workingDirectory: environment.workingDirectory,
    sandboxProfileJson: normalizeJson(environment.sandboxProfileJson, "{}"),
    memoryLayerRefsJson: normalizeJson(environment.memoryLayerRefsJson, "[]"),
    visibility: environment.visibility,
    status: environment.status,
  });

  async function save() {
    setIsSaving(true);
    setMessage(null);
    try {
      JSON.parse(form.sandboxProfileJson);
      JSON.parse(form.memoryLayerRefsJson);
    } catch {
      setIsSaving(false);
      setMessage("JSON 格式不正确");
      return;
    }

    const response = await fetch("/api/environments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: form.id || crypto.randomUUID(),
        businessTeamId: form.businessTeamId,
        name: form.name,
        repositoryProvider: form.repositoryProvider,
        repositoryName: form.repositoryName,
        repositoryUrl: form.repositoryUrl,
        defaultBranch: form.defaultBranch,
        executorRef: form.executorRef,
        privateKeyRef: form.privateKeyRef,
        workingDirectory: form.workingDirectory,
        sandboxProfile: JSON.parse(form.sandboxProfileJson),
        memoryLayerRefs: JSON.parse(form.memoryLayerRefsJson),
        visibility: form.visibility,
        status: form.status,
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
    <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="text-base font-semibold text-[var(--ink)]">{title}</div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <input className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="环境名称" />
        <input className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]" value={form.repositoryProvider} onChange={(event) => setForm({ ...form, repositoryProvider: event.target.value })} placeholder="代码仓类型" />
        <input className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]" value={form.repositoryName} onChange={(event) => setForm({ ...form, repositoryName: event.target.value })} placeholder="代码仓名称" />
        <input className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]" value={form.defaultBranch} onChange={(event) => setForm({ ...form, defaultBranch: event.target.value })} placeholder="默认分支" />
        <input className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)] md:col-span-2" value={form.repositoryUrl} onChange={(event) => setForm({ ...form, repositoryUrl: event.target.value })} placeholder="代码仓 URL" />
        <input className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]" value={form.executorRef} onChange={(event) => setForm({ ...form, executorRef: event.target.value })} placeholder="执行人引用" />
        <input className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]" value={form.privateKeyRef} onChange={(event) => setForm({ ...form, privateKeyRef: event.target.value })} placeholder="私钥引用" />
        <input className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]" value={form.workingDirectory} onChange={(event) => setForm({ ...form, workingDirectory: event.target.value })} placeholder="工作目录" />
        <input className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]" value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value })} placeholder="visibility" />
      </div>
      <textarea className="mt-2 min-h-24 w-full rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm leading-6 text-[var(--ink)]" value={form.sandboxProfileJson} onChange={(event) => setForm({ ...form, sandboxProfileJson: event.target.value })} placeholder='{"isolation":"process"}' />
      <textarea className="mt-2 min-h-24 w-full rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm leading-6 text-[var(--ink)]" value={form.memoryLayerRefsJson} onChange={(event) => setForm({ ...form, memoryLayerRefsJson: event.target.value })} placeholder='["viking://teams/security/code-review/"]' />
      <div className="mt-2 flex items-center justify-between gap-3">
        <button type="button" onClick={save} disabled={isSaving} className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm font-medium text-[var(--ink)] disabled:opacity-50">
          {isSaving ? "保存中" : "保存执行环境"}
        </button>
        {message ? <div className="text-xs text-[var(--ink-muted)]">{message}</div> : null}
      </div>
    </div>
  );
}
