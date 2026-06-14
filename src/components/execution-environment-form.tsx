"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLanguageText } from "@/components/language-pack-provider";
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

export function ExecutionEnvironmentForm({
  environment,
  title,
  businessTeamOptions,
  embedded = false,
  onSaved,
}: ExecutionEnvironmentFormProps) {
  const router = useRouter();
  const text = useLanguageText();
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
      setMessage("ui.generated.cf09c995336");
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
      setMessage("ui.generated.c40525a7328");
      return;
    }

    setMessage("ui.generated.ccdfab96f75");
    onSaved?.();
    router.refresh();
  }

  const content = (
    <div className={embedded ? "space-y-4" : ""}>
        <div className="grid gap-3 md:grid-cols-2">
          <FieldGroup label="ui.generated.c6b20b8bfcd">
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="ui.generated.cb91f492acc" />
          </FieldGroup>
          <FieldGroup label="ui.generated.c26f30fd79b">
            <Select
              value={form.businessTeamId}
              onChange={(event) => setForm({ ...form, businessTeamId: event.target.value })}
            >
              <option value="">ui.generated.cc51fbedf93</option>
              {businessTeamOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="ui.generated.c7af676599a">
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
          <FieldGroup label="ui.generated.c92f4902e9d">
            <Input value={form.repositoryName} onChange={(event) => setForm({ ...form, repositoryName: event.target.value })} placeholder="repo-name" />
          </FieldGroup>
          <FieldGroup label="ui.generated.cdc900d83b2">
            <Input value={form.defaultBranch} onChange={(event) => setForm({ ...form, defaultBranch: event.target.value })} placeholder="main" />
          </FieldGroup>
          <FieldGroup label="ui.generated.c42dfc81f99">
            <Input value={form.workingDirectory} onChange={(event) => setForm({ ...form, workingDirectory: event.target.value })} placeholder="." />
          </FieldGroup>
          <FieldGroup label="ui.generated.c1eb6ef2856" className="md:col-span-2">
            <Input className="md:col-span-2" value={form.repositoryUrl} onChange={(event) => setForm({ ...form, repositoryUrl: event.target.value })} />
          </FieldGroup>
          <FieldGroup label="ui.generated.c8f6cc6defa">
            <Input value={form.executorRef} onChange={(event) => setForm({ ...form, executorRef: event.target.value })} />
          </FieldGroup>
          <FieldGroup label="ui.generated.cbcd76068cd">
            <Input value={form.privateKeyRef} onChange={(event) => setForm({ ...form, privateKeyRef: event.target.value })} placeholder="secret:repo_executor_key" />
          </FieldGroup>
          <FieldGroup label="ui.generated.c747b74cec9">
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
          <FieldGroup label="ui.generated.c62e951a692">
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
          <FieldGroup label="ui.generated.c5403cce910" className="md:col-span-2">
            <Textarea value={form.sandboxProfileJson} onChange={(event) => setForm({ ...form, sandboxProfileJson: event.target.value })} placeholder='{"isolation":"process"}' />
          </FieldGroup>
          <FieldGroup label="ui.generated.c08d227d44c" className="md:col-span-2">
            <Textarea value={form.memoryLayerRefsJson} onChange={(event) => setForm({ ...form, memoryLayerRefsJson: event.target.value })} placeholder='["agentworld://knowledge/teams/security/code-inspection/"]' />
          </FieldGroup>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <Button type="button" onClick={save} disabled={isSaving}>
            {isSaving ? "ui.generated.ca032e8fdda" : "ui.generated.c9da720eada"}
          </Button>
          {message ? <div className="text-xs text-[var(--ink-muted)]">{text(message, message)}</div> : null}
        </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <Panel>
      <PanelHeader title={title} description="ui.generated.caaa022121d" />
      <PanelBody>{content}</PanelBody>
    </Panel>
  );
}
