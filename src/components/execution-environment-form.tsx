"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

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
  businessTeamOptions: Array<{ id: string; name: string }>;
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
  businessTeamOptions,
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
    <Panel>
      <PanelHeader title={title} description="代码仓、执行路径、私钥引用和记忆依赖。" />
      <PanelBody>
        <div className="grid gap-3 md:grid-cols-2">
          <FieldGroup label="执行环境名称">
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="安全扫描环境" />
          </FieldGroup>
          <FieldGroup label="归属业务团队">
            <Select
              value={form.businessTeamId}
              onChange={(event) => setForm({ ...form, businessTeamId: event.target.value })}
            >
              <option value="">选择业务团队</option>
              {businessTeamOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="代码仓类型">
            <Select
              value={form.repositoryProvider}
              onChange={(event) => setForm({ ...form, repositoryProvider: event.target.value })}
            >
              {["git", "github", "gitlab", "gerrit", "custom"].map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="代码仓名称">
            <Input value={form.repositoryName} onChange={(event) => setForm({ ...form, repositoryName: event.target.value })} placeholder="repo-name" />
          </FieldGroup>
          <FieldGroup label="默认分支">
            <Input value={form.defaultBranch} onChange={(event) => setForm({ ...form, defaultBranch: event.target.value })} placeholder="main" />
          </FieldGroup>
          <FieldGroup label="工作目录">
            <Input value={form.workingDirectory} onChange={(event) => setForm({ ...form, workingDirectory: event.target.value })} placeholder="." />
          </FieldGroup>
          <FieldGroup label="代码仓 URL" className="md:col-span-2">
            <Input className="md:col-span-2" value={form.repositoryUrl} onChange={(event) => setForm({ ...form, repositoryUrl: event.target.value })} placeholder="git@code.example.com:team/repo.git" />
          </FieldGroup>
          <FieldGroup label="执行人引用">
            <Input value={form.executorRef} onChange={(event) => setForm({ ...form, executorRef: event.target.value })} placeholder="repo-executor" />
          </FieldGroup>
          <FieldGroup label="私钥引用">
            <Input value={form.privateKeyRef} onChange={(event) => setForm({ ...form, privateKeyRef: event.target.value })} placeholder="secret:repo_executor_key" />
          </FieldGroup>
          <FieldGroup label="可见性">
            <Select
              value={form.visibility}
              onChange={(event) => setForm({ ...form, visibility: event.target.value })}
            >
              {["global", "team", "personal"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="状态">
            <Select
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
            >
              {["active", "paused", "disabled"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="沙箱配置" className="md:col-span-2">
            <Textarea value={form.sandboxProfileJson} onChange={(event) => setForm({ ...form, sandboxProfileJson: event.target.value })} placeholder='{"isolation":"process"}' />
          </FieldGroup>
          <FieldGroup label="记忆层引用" className="md:col-span-2">
            <Textarea value={form.memoryLayerRefsJson} onChange={(event) => setForm({ ...form, memoryLayerRefsJson: event.target.value })} placeholder='["viking://teams/security/code-review/"]' />
          </FieldGroup>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <Button type="button" onClick={save} disabled={isSaving}>
            {isSaving ? "保存中" : "保存执行环境"}
          </Button>
          {message ? <div className="text-xs text-[var(--ink-muted)]">{message}</div> : null}
        </div>
      </PanelBody>
    </Panel>
  );
}
