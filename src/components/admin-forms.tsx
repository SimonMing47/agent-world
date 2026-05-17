"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { uiText } from "@/lib/language-pack";

type Option = { id: string; name: string };

function normalizeJson(value: string, fallback: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return fallback;
  }
}

function linesToJson(value: string) {
  return JSON.stringify(
    value
      .split(/\n|,|，/)
      .map((item) => item.trim())
      .filter(Boolean),
    null,
    2,
  );
}

function jsonToLines(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String).join("\n") : "";
  } catch {
    return "";
  }
}

function FormActions({
  label,
  isSaving,
  message,
  onSave,
}: {
  label: string;
  isSaving: boolean;
  message: string | null;
  onSave: () => void;
}) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <Button type="button" onClick={onSave} disabled={isSaving}>
        {isSaving ? "ui.generated.ca032e8fdda" : label}
      </Button>
      {message ? <div className="text-xs text-[var(--ink-muted)]">{message}</div> : null}
    </div>
  );
}

async function submitJson(endpoint: string, body: unknown) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!response.ok || result.ok === false) throw new Error(result.error ?? "ui.generated.c40525a7328");
  return result;
}

export function SkillForm({
  skill,
  businessTeams,
}: {
  skill: {
    id: string;
    ownerBusinessTeamId: string | null;
    name: string;
    layer: string;
    description: string;
    tagsJson: string;
    visibility: string;
    promptMd: string;
    heuristicsJson: string;
    isEnabled: number;
  };
  businessTeams: Option[];
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: skill.id,
    ownerBusinessTeamId: skill.ownerBusinessTeamId ?? "",
    name: skill.name,
    layer: skill.layer,
    description: skill.description,
    tags: jsonToLines(skill.tagsJson),
    visibility: skill.visibility || "team",
    promptMd: skill.promptMd,
    heuristicsJson: normalizeJson(skill.heuristicsJson, "{}"),
    isEnabled: skill.isEnabled === 1,
  });

  async function save() {
    setIsSaving(true);
    setMessage(null);
    try {
      JSON.parse(form.heuristicsJson);
      await submitJson("/api/skills", {
        ...form,
        id: form.id || crypto.randomUUID(),
        ownerBusinessTeamId: form.ownerBusinessTeamId || null,
        tags: form.tags.split(/\n|,|，/).map((item) => item.trim()).filter(Boolean),
        isEnabled: form.isEnabled ? 1 : 0,
      });
      setMessage("ui.generated.ccdfab96f75");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ui.generated.c40525a7328");
    } finally {
      setIsSaving(false);
    }
  }

  async function optimize() {
    setIsOptimizing(true);
    setMessage(null);
    try {
      const response = await submitJson("/api/skills/optimize", {
        skill: {
          ...form,
          ownerBusinessTeamId: form.ownerBusinessTeamId || null,
          tags: form.tags.split(/\n|,|，/).map((item) => item.trim()).filter(Boolean),
        },
      });
      const suggestion = (response as { result?: { suggestion?: Partial<typeof form> & { tags?: string[]; notes?: string[] } } })
        .result?.suggestion;
      if (suggestion) {
        setForm({
          ...form,
          name: suggestion.name ?? form.name,
          description: suggestion.description ?? form.description,
          promptMd: suggestion.promptMd ?? form.promptMd,
          tags: Array.isArray(suggestion.tags) ? suggestion.tags.join("\n") : form.tags,
          heuristicsJson: suggestion.heuristicsJson ?? form.heuristicsJson,
        });
      }
      setMessage("ui.generated.ccbbffcf693");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ui.generated.cd7578f63b2");
    } finally {
      setIsOptimizing(false);
    }
  }

  async function sync() {
    if (!form.id) {
      setMessage("ui.generated.c7715e3536b");
      return;
    }
    setIsSaving(true);
    setMessage(null);
    try {
      await submitJson("/api/skills/sync", { skillId: form.id });
      setMessage("ui.generated.cfd6a496394");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ui.generated.ca8f14c99a0");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="ui.generated.c1984544cf8">
          <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </FieldGroup>
        <FieldGroup label="ui.generated.c53d4919c45">
          <Select
            value={form.ownerBusinessTeamId}
            onChange={(event) => setForm({ ...form, ownerBusinessTeamId: event.target.value })}
          >
            <option value="">ui.generated.ca5644f4bbf</option>
            {businessTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label="ui.generated.c986ff01617">
          <Input value={form.layer} onChange={(event) => setForm({ ...form, layer: event.target.value })} />
        </FieldGroup>
        <FieldGroup label="ui.generated.c747b74cec9">
          <Select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value })}>
            <option value="private">ui.generated.c2d7c0c32a3</option>
            <option value="team">ui.generated.c21d7042ff0</option>
            <option value="global">ui.generated.ca5644f4bbf</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="ui.generated.c412f54dc38" className="md:col-span-2">
          <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </FieldGroup>
        <FieldGroup label="ui.generated.cae0a7afece" hint="ui.generated.c2f80fdc2c6">
          <Textarea value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} />
        </FieldGroup>
        <FieldGroup label="ui.generated.c5691b3791b">
          <label className="flex h-10 items-center gap-2 text-sm text-[var(--ink-muted)]">
            <input
              type="checkbox"
              checked={form.isEnabled}
              onChange={(event) => setForm({ ...form, isEnabled: event.target.checked })}
            />
            ui.generated.c0e122f82e5
          </label>
        </FieldGroup>
        <FieldGroup label="ui.generated.c7a70cc4e2d" className="md:col-span-2">
          <Textarea
            className="min-h-40"
            value={form.promptMd}
            onChange={(event) => setForm({ ...form, promptMd: event.target.value })}
          />
        </FieldGroup>
        <FieldGroup label="ui.generated.c3b4e3017cb" className="md:col-span-2">
          <Textarea value={form.heuristicsJson} onChange={(event) => setForm({ ...form, heuristicsJson: event.target.value })} />
        </FieldGroup>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={save} disabled={isSaving}>
            {isSaving ? "ui.generated.ca032e8fdda" : "ui.generated.c45707941fb"}
          </Button>
          <Button type="button" variant="secondary" onClick={optimize} disabled={isOptimizing}>
            {isOptimizing ? "ui.generated.c074e1e7d25" : "ui.generated.c351a1bc3e3"}
          </Button>
          <Button type="button" variant="ghost" onClick={sync} disabled={isSaving}>
            ui.generated.cee34092def
          </Button>
        </div>
        {message ? <div className="text-xs text-[var(--ink-muted)]">{message}</div> : null}
      </div>
    </div>
  );
}

export function McpServerForm({
  server,
  businessTeams,
}: {
  server: {
    id: string;
    businessTeamId: string | null;
    name: string;
    transport: string;
    command: string;
    url: string;
    authRef: string;
    toolAllowlistJson: string;
    status: string;
  };
  businessTeams: Option[];
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    ...server,
    businessTeamId: server.businessTeamId ?? "",
    tools: jsonToLines(server.toolAllowlistJson),
  });
  async function save() {
    setIsSaving(true);
    setMessage(null);
    try {
      await submitJson("/api/mcp-servers", {
        ...form,
        id: form.id || crypto.randomUUID(),
        businessTeamId: form.businessTeamId || null,
        toolAllowlistJson: linesToJson(form.tools),
      });
      setMessage("ui.generated.ccdfab96f75");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ui.generated.c40525a7328");
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="ui.generated.c1be7ae4fc2"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c53d4919c45">
          <Select value={form.businessTeamId} onChange={(event) => setForm({ ...form, businessTeamId: event.target.value })}>
            <option value="">ui.generated.ca5644f4bbf</option>
            {businessTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </Select>
        </FieldGroup>
        <FieldGroup label="ui.generated.ce659fd134c">
          <Select value={form.transport} onChange={(event) => setForm({ ...form, transport: event.target.value })}>
            <option value="stdio">stdio</option>
            <option value="http">HTTP</option>
            <option value="sse">SSE</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="ui.generated.c62e951a692">
          <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="active">ui.generated.cd4e9ca3dd4</option>
            <option value="disabled">ui.generated.cd989e55188</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="ui.generated.cb114b91547" className="md:col-span-2"><Input value={form.command} onChange={(event) => setForm({ ...form, command: event.target.value })} /></FieldGroup>
        <FieldGroup label="URL" className="md:col-span-2"><Input value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c944d3e201b"><Input value={form.authRef} onChange={(event) => setForm({ ...form, authRef: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c36efe9a19f"><Textarea value={form.tools} onChange={(event) => setForm({ ...form, tools: event.target.value })} /></FieldGroup>
      </div>
      <FormActions label="ui.generated.cbc054c1b83" isSaving={isSaving} message={message} onSave={save} />
    </div>
  );
}

export function ConnectorForm({
  connector,
  businessTeams,
}: {
  connector: {
    id: string;
    businessTeamId: string | null;
    name: string;
    connectorType: string;
    provider: string;
    endpoint: string;
    secretRef: string;
    capabilitiesJson: string;
    status: string;
  };
  businessTeams: Option[];
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({ ...connector, businessTeamId: connector.businessTeamId ?? "", capabilities: jsonToLines(connector.capabilitiesJson) });
  async function save() {
    setIsSaving(true);
    setMessage(null);
    try {
      await submitJson("/api/connectors", {
        ...form,
        id: form.id || crypto.randomUUID(),
        businessTeamId: form.businessTeamId || null,
        capabilitiesJson: linesToJson(form.capabilities),
      });
      setMessage("ui.generated.ccdfab96f75");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ui.generated.c40525a7328");
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="ui.generated.c1be7ae4fc2"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c53d4919c45">
          <Select value={form.businessTeamId} onChange={(event) => setForm({ ...form, businessTeamId: event.target.value })}>
            <option value="">ui.generated.ca5644f4bbf</option>
            {businessTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </Select>
        </FieldGroup>
        <FieldGroup label="ui.generated.ce4e46c7235">
          <Select value={form.connectorType} onChange={(event) => setForm({ ...form, connectorType: event.target.value })}>
            <option value="im">IM</option>
            <option value="email">ui.generated.c1c8e464184</option>
            <option value="web_push">Web Push</option>
            <option value="webhook">Webhook</option>
            <option value="custom">ui.generated.cc493338e8c</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="ui.generated.c703c9eb0f0"><Input value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })} /></FieldGroup>
        <FieldGroup label="Endpoint" className="md:col-span-2"><Input value={form.endpoint} onChange={(event) => setForm({ ...form, endpoint: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c439768fdec"><Input value={form.secretRef} onChange={(event) => setForm({ ...form, secretRef: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c62e951a692">
          <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="active">ui.generated.cd4e9ca3dd4</option>
            <option value="disabled">ui.generated.cd989e55188</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="ui.generated.ceb9d53ce7f" className="md:col-span-2"><Textarea value={form.capabilities} onChange={(event) => setForm({ ...form, capabilities: event.target.value })} /></FieldGroup>
      </div>
      <FormActions label="ui.generated.ccb93c134bb" isSaving={isSaving} message={message} onSave={save} />
    </div>
  );
}

export function CodebaseForm({
  codebase,
  businessTeams,
}: {
  codebase: {
    id: string;
    businessTeamId: string;
    name: string;
    provider: string;
    repositoryUrl: string;
    defaultBranch: string;
    visibility: string;
    description: string;
    status: string;
  };
  businessTeams: Option[];
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState(codebase);
  async function save() {
    setIsSaving(true);
    setMessage(null);
    try {
      await submitJson("/api/codebases", { ...form, id: form.id || crypto.randomUUID() });
      setMessage("ui.generated.ccdfab96f75");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ui.generated.c40525a7328");
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="ui.generated.c6f55a5a54c"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FieldGroup>
	        <FieldGroup label="ui.generated.c53d4919c45">
	          <Select value={form.businessTeamId} onChange={(event) => setForm({ ...form, businessTeamId: event.target.value })}>
	            <option value="">ui.generated.ca5644f4bbf</option>
	            {businessTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
	          </Select>
	        </FieldGroup>
        <FieldGroup label="ui.generated.ceb737abfde"><Input value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.cdc900d83b2"><Input value={form.defaultBranch} onChange={(event) => setForm({ ...form, defaultBranch: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c747b74cec9">
          <Select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value })}>
            <option value="private">ui.generated.c6858674b88</option>
            <option value="team">ui.generated.c21d7042ff0</option>
            <option value="global">ui.generated.ca5644f4bbf</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="ui.generated.c62e951a692">
          <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="active">ui.generated.cd4e9ca3dd4</option>
            <option value="disabled">ui.generated.cd989e55188</option>
            <option value="archived">ui.generated.cddfde75bec</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="ui.generated.c6b470c4670" className="md:col-span-2"><Input value={form.repositoryUrl} onChange={(event) => setForm({ ...form, repositoryUrl: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c412f54dc38" className="md:col-span-2"><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></FieldGroup>
      </div>
      <FormActions label="ui.generated.c3cb3ecb4a4" isSaving={isSaving} message={message} onSave={save} />
    </div>
  );
}

export function CodebaseTokenForm({
  token,
  codebases,
}: {
  token: {
    id: string;
    codebaseId: string;
    operatorName: string;
    tokenRef: string;
    role: string;
    permissionJson: string;
    status: string;
  };
  codebases: Option[];
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({ ...token, permissions: jsonToLines(token.permissionJson) });
  async function save() {
    setIsSaving(true);
    setMessage(null);
    try {
      await submitJson("/api/codebases", {
        ...form,
        entity: "token",
        id: form.id || crypto.randomUUID(),
        permissionJson: linesToJson(form.permissions),
      });
      setMessage("ui.generated.ccdfab96f75");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ui.generated.c40525a7328");
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="ui.generated.c6aa9ff908e">
          <Select value={form.codebaseId} onChange={(event) => setForm({ ...form, codebaseId: event.target.value })}>
            {codebases.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
        </FieldGroup>
        <FieldGroup label="ui.generated.cffb50d3878"><Input value={form.operatorName} onChange={(event) => setForm({ ...form, operatorName: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c6b26695e4d"><Input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c090926193c"><Input value={form.tokenRef} onChange={(event) => setForm({ ...form, tokenRef: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c62e951a692">
          <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="active">ui.generated.cd4e9ca3dd4</option>
            <option value="disabled">ui.generated.cd989e55188</option>
            <option value="expired">ui.generated.c7cf7bfff3c</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="ui.generated.c560165a6d7" className="md:col-span-2"><Textarea value={form.permissions} onChange={(event) => setForm({ ...form, permissions: event.target.value })} /></FieldGroup>
      </div>
      <FormActions label="ui.generated.c6bd4e6602d" isSaving={isSaving} message={message} onSave={save} />
    </div>
  );
}

export function TeamMemberForm({
  member,
  tenantSpaceId,
  businessTeams,
}: {
  member: {
    id: string;
    businessTeamId: string;
    employeeNo: string;
    name: string;
    email: string;
    role: string;
    title: string;
    status: string;
  };
  tenantSpaceId: string;
  businessTeams: Option[];
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState(member);
  async function save() {
    setIsSaving(true);
    setMessage(null);
    try {
      await submitJson("/api/team-members", { ...form, id: form.id || crypto.randomUUID(), tenantSpaceId });
      setMessage("ui.generated.ccdfab96f75");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ui.generated.c40525a7328");
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="ui.generated.cbe4c2616b1"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c29f4c9b495"><Input value={form.employeeNo} onChange={(event) => setForm({ ...form, employeeNo: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c9ed627bcf6"><Input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c53d4919c45">
          <Select value={form.businessTeamId} onChange={(event) => setForm({ ...form, businessTeamId: event.target.value })}>
            {businessTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </Select>
        </FieldGroup>
        <FieldGroup label="ui.generated.c6b26695e4d"><Input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.cf0f3e908c2"><Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c62e951a692">
          <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="active">ui.generated.c88381ac4ff</option>
            <option value="inactive">ui.generated.cd989e55188</option>
            <option value="pending">ui.generated.c27b5842c97</option>
          </Select>
        </FieldGroup>
      </div>
      <FormActions label="ui.generated.cea5fba9051" isSaving={isSaving} message={message} onSave={save} />
    </div>
  );
}

export function TeamMemberImportForm({
  tenantSpaceId,
  businessTeams,
}: {
  tenantSpaceId: string;
  businessTeams: Option[];
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [businessTeamId, setBusinessTeamId] = useState("");
  const [rows, setRows] = useState(uiText("ui.common.excelMemberImportHeader"));
  async function save() {
    setIsSaving(true);
    setMessage(null);
    try {
      await submitJson("/api/team-members", { mode: "import", tenantSpaceId, businessTeamId, rows });
      setMessage("ui.generated.c5c5b7cfb12");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ui.generated.ca01a8d5393");
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <div className="space-y-4">
      <FieldGroup label="ui.generated.c53d4919c45">
	        <Select value={businessTeamId} onChange={(event) => setBusinessTeamId(event.target.value)}>
	          <option value="">ui.generated.ca5644f4bbf</option>
	          {businessTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
	        </Select>
      </FieldGroup>
      <FieldGroup label="ui.generated.c7671abe767" hint="ui.generated.c26c89f0fd8">
        <Textarea className="min-h-48" value={rows} onChange={(event) => setRows(event.target.value)} />
      </FieldGroup>
      <FormActions label="ui.generated.c7ae9acb5ad" isSaving={isSaving} message={message} onSave={save} />
    </div>
  );
}

export function PermissionGrantForm({
  grant,
  businessTeams,
  members,
}: {
  grant: {
    id: string;
    businessTeamId: string;
    memberId: string | null;
    principalType: string;
    roleKey: string;
    resourceType: string;
    resourceScope: string;
    actionsJson: string;
    effect: string;
    status: string;
  };
  businessTeams: Option[];
  members: Option[];
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({ ...grant, memberId: grant.memberId ?? "", actions: jsonToLines(grant.actionsJson) });
  async function save() {
    setIsSaving(true);
    setMessage(null);
    try {
      await submitJson("/api/team-permissions", {
        ...form,
        id: form.id || crypto.randomUUID(),
        memberId: form.memberId || null,
        actionsJson: linesToJson(form.actions),
      });
      setMessage("ui.generated.ccdfab96f75");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ui.generated.c40525a7328");
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="ui.generated.c2b90028ff3"><Select value={form.businessTeamId} onChange={(event) => setForm({ ...form, businessTeamId: event.target.value })}>{businessTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select></FieldGroup>
        <FieldGroup label="ui.generated.cc1ee9f0190"><Select value={form.memberId} onChange={(event) => setForm({ ...form, memberId: event.target.value })}><option value="">ui.generated.cf39bcb6746</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</Select></FieldGroup>
        <FieldGroup label="ui.generated.c32e32cd3d0">
          <Select value={form.principalType} onChange={(event) => setForm({ ...form, principalType: event.target.value })}>
            <option value="member">ui.generated.cc1ee9f0190</option>
            <option value="role">ui.generated.c6b26695e4d</option>
            <option value="team">ui.generated.c21d7042ff0</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="ui.generated.c1e9c8e9515"><Input value={form.roleKey} onChange={(event) => setForm({ ...form, roleKey: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.cc6464f4f4d"><Input value={form.resourceType} onChange={(event) => setForm({ ...form, resourceType: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c160e006ae4"><Input value={form.resourceScope} onChange={(event) => setForm({ ...form, resourceScope: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c151ddd4f1f"><Select value={form.effect} onChange={(event) => setForm({ ...form, effect: event.target.value })}><option value="allow">ui.generated.c4c0c0aed67</option><option value="deny">ui.generated.c03e210a66d</option><option value="ask">ui.generated.cd00dc39af5</option></Select></FieldGroup>
        <FieldGroup label="ui.generated.c62e951a692">
          <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="active">ui.generated.cd4e9ca3dd4</option>
            <option value="disabled">ui.generated.cd989e55188</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="ui.generated.cd9d9827827" className="md:col-span-2"><Textarea value={form.actions} onChange={(event) => setForm({ ...form, actions: event.target.value })} /></FieldGroup>
      </div>
      <FormActions label="ui.generated.cd5355d17be" isSaving={isSaving} message={message} onSave={save} />
    </div>
  );
}

export function AssetGrantForm({
  grant,
  businessTeams,
  members,
}: {
  grant: {
    id: string;
    businessTeamId: string;
    memberId: string | null;
    assetType: string;
    assetId: string;
    assetName: string;
    permissionJson: string;
    status: string;
  };
  businessTeams: Option[];
  members: Option[];
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({ ...grant, memberId: grant.memberId ?? "", permissionJson: normalizeJson(grant.permissionJson, "{}") });
  async function save() {
    setIsSaving(true);
    setMessage(null);
    try {
      JSON.parse(form.permissionJson);
      await submitJson("/api/team-assets", { ...form, id: form.id || crypto.randomUUID(), memberId: form.memberId || null });
      setMessage("ui.generated.ccdfab96f75");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ui.generated.c40525a7328");
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="ui.generated.c2b90028ff3"><Select value={form.businessTeamId} onChange={(event) => setForm({ ...form, businessTeamId: event.target.value })}>{businessTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select></FieldGroup>
        <FieldGroup label="ui.generated.cc1ee9f0190"><Select value={form.memberId} onChange={(event) => setForm({ ...form, memberId: event.target.value })}><option value="">ui.generated.c697e6f3e85</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</Select></FieldGroup>
        <FieldGroup label="ui.generated.c74e3df5bd8"><Select value={form.assetType} onChange={(event) => setForm({ ...form, assetType: event.target.value })}><option value="skill">Skill</option><option value="knowledge_space">ui.generated.c1dda51f9e3</option><option value="codebase">Codebase</option><option value="connector">Connector</option><option value="agent_team">ui.generated.c70f970c1fc</option></Select></FieldGroup>
        <FieldGroup label="ui.generated.c9e5ee1cb24"><Input value={form.assetId} onChange={(event) => setForm({ ...form, assetId: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c62e951a692">
          <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="active">ui.generated.cd4e9ca3dd4</option>
            <option value="disabled">ui.generated.cd989e55188</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="ui.generated.cf016adbb92" className="md:col-span-2"><Input value={form.assetName} onChange={(event) => setForm({ ...form, assetName: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.cf2417f0eb3" className="md:col-span-2"><Textarea value={form.permissionJson} onChange={(event) => setForm({ ...form, permissionJson: event.target.value })} /></FieldGroup>
      </div>
      <FormActions label="ui.generated.cd51168e3f6" isSaving={isSaving} message={message} onSave={save} />
    </div>
  );
}

export function TenantSpaceForm({
  tenantSpace,
  executionPolicies,
}: {
  tenantSpace: {
    id: string;
    slug: string;
    name: string;
    ownerUserId: string;
    status: string;
    quotaLimitJson: string;
    modelWhitelistJson: string;
    globalGuardrailsJson: string;
    defaultExecutionPolicyId: string | null;
  };
  executionPolicies: Option[];
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    ...tenantSpace,
    defaultExecutionPolicyId: tenantSpace.defaultExecutionPolicyId ?? "",
    quotaLimitJson: normalizeJson(tenantSpace.quotaLimitJson, "{}"),
    modelWhitelistJson: normalizeJson(tenantSpace.modelWhitelistJson, "[]"),
    globalGuardrailsJson: normalizeJson(tenantSpace.globalGuardrailsJson, "{}"),
  });
  async function save() {
    setIsSaving(true);
    setMessage(null);
    try {
      JSON.parse(form.quotaLimitJson);
      JSON.parse(form.modelWhitelistJson);
      JSON.parse(form.globalGuardrailsJson);
      await submitJson("/api/tenant-spaces", {
        ...form,
        id: form.id || crypto.randomUUID(),
        defaultExecutionPolicyId: form.defaultExecutionPolicyId || null,
      });
      setMessage("ui.generated.ccdfab96f75");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ui.generated.c40525a7328");
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="ui.generated.c42a8d2274f"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FieldGroup>
        <FieldGroup label="Slug"><Input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} /></FieldGroup>
        <FieldGroup label="Owner"><Input value={form.ownerUserId} onChange={(event) => setForm({ ...form, ownerUserId: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c62e951a692"><Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="active">ui.generated.cd4e9ca3dd4</option><option value="disabled">ui.generated.cd989e55188</option></Select></FieldGroup>
        <FieldGroup label="ui.generated.c4364c1156f" className="md:col-span-2">
          <Select value={form.defaultExecutionPolicyId} onChange={(event) => setForm({ ...form, defaultExecutionPolicyId: event.target.value })}>
            <option value="">ui.generated.c9a0ee40403</option>
            {executionPolicies.map((policy) => <option key={policy.id} value={policy.id}>{policy.name}</option>)}
          </Select>
        </FieldGroup>
        <FieldGroup label="ui.generated.cda59cca989"><Textarea value={form.quotaLimitJson} onChange={(event) => setForm({ ...form, quotaLimitJson: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c2526b70376"><Textarea value={form.modelWhitelistJson} onChange={(event) => setForm({ ...form, modelWhitelistJson: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c8b349a38f6" className="md:col-span-2"><Textarea value={form.globalGuardrailsJson} onChange={(event) => setForm({ ...form, globalGuardrailsJson: event.target.value })} /></FieldGroup>
      </div>
      <FormActions label="ui.generated.c8f995d2817" isSaving={isSaving} message={message} onSave={save} />
    </div>
  );
}

export function BusinessTeamForm({
  team,
  tenantSpaces,
  businessTeams = [],
}: {
  team: {
    id: string;
    tenantSpaceId: string;
    parentBusinessTeamId?: string | null;
    slug: string;
    name: string;
    description?: string;
    ownerUserId: string;
    status: string;
    balance: number;
    creditLimit: number;
    privateToolRefsJson: string;
    privateMemoryNamespace: string;
    policyJson: string;
  };
  tenantSpaces: Option[];
  businessTeams?: Option[];
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    ...team,
    parentBusinessTeamId: team.parentBusinessTeamId ?? "",
    description: team.description ?? "",
    balance: String(team.balance ?? 0),
    creditLimit: String(team.creditLimit ?? 0),
    privateToolRefsJson: normalizeJson(team.privateToolRefsJson, "[]"),
    policyJson: normalizeJson(team.policyJson, "{}"),
  });
  async function save() {
    setIsSaving(true);
    setMessage(null);
    try {
      JSON.parse(form.privateToolRefsJson);
      JSON.parse(form.policyJson);
      await submitJson("/api/business-teams", {
        ...form,
        id: form.id || crypto.randomUUID(),
        balance: Number(form.balance || 0),
        creditLimit: Number(form.creditLimit || 0),
      });
      setMessage("ui.generated.ccdfab96f75");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ui.generated.c40525a7328");
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="ui.generated.cb2629c388f"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FieldGroup>
        <FieldGroup label="Slug"><Input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} /></FieldGroup>
	        <FieldGroup label="ui.generated.c3db35d2741"><Select value={form.tenantSpaceId} onChange={(event) => setForm({ ...form, tenantSpaceId: event.target.value })}><option value="">ui.generated.ca5644f4bbf</option>{tenantSpaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}</Select></FieldGroup>
        <FieldGroup label="ui.generated.c8febffdb94">
          <Select value={form.parentBusinessTeamId} onChange={(event) => setForm({ ...form, parentBusinessTeamId: event.target.value })}>
            <option value="">ui.generated.c7c6b663c4c</option>
            {businessTeams
              .filter((item) => item.id !== form.id)
              .map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
        </FieldGroup>
        <FieldGroup label="Owner"><Input value={form.ownerUserId} onChange={(event) => setForm({ ...form, ownerUserId: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c62e951a692">
          <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="active">ui.generated.cd4e9ca3dd4</option>
            <option value="disabled">ui.generated.cd989e55188</option>
            <option value="archived">ui.generated.cddfde75bec</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="ui.generated.c51cc55073e"><Input value={form.balance} onChange={(event) => setForm({ ...form, balance: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c2a09e27c43"><Input value={form.creditLimit} onChange={(event) => setForm({ ...form, creditLimit: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c0ed5cf4445" className="md:col-span-2"><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c93c1a133c7" className="md:col-span-2"><Input value={form.privateMemoryNamespace} onChange={(event) => setForm({ ...form, privateMemoryNamespace: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c1a867ec313"><Textarea value={form.privateToolRefsJson} onChange={(event) => setForm({ ...form, privateToolRefsJson: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c6ac41ead86"><Textarea value={form.policyJson} onChange={(event) => setForm({ ...form, policyJson: event.target.value })} /></FieldGroup>
      </div>
      <FormActions label="ui.generated.cf94598e5b8" isSaving={isSaving} message={message} onSave={save} />
    </div>
  );
}

export function ExecutionPolicyForm({
  policy,
  tenantSpaces,
  businessTeams,
  agentTeams,
}: {
  policy: {
    id: string;
    tenantSpaceId: string | null;
    businessTeamId: string | null;
    teamId: string | null;
    name: string;
    systemInstruction: string;
    toolPolicyJson: string;
    approvalPolicyJson: string;
    budgetPolicyJson: string;
    outputPolicyJson: string;
    securityPolicyJson: string;
  };
  tenantSpaces: Option[];
  businessTeams: Option[];
  agentTeams: Option[];
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    ...policy,
    tenantSpaceId: policy.tenantSpaceId ?? "",
    businessTeamId: policy.businessTeamId ?? "",
    teamId: policy.teamId ?? "",
    toolPolicyJson: normalizeJson(policy.toolPolicyJson, "{}"),
    approvalPolicyJson: normalizeJson(policy.approvalPolicyJson, "{}"),
    budgetPolicyJson: normalizeJson(policy.budgetPolicyJson, "{}"),
    outputPolicyJson: normalizeJson(policy.outputPolicyJson, "{}"),
    securityPolicyJson: normalizeJson(policy.securityPolicyJson, "{}"),
  });
  async function save() {
    setIsSaving(true);
    setMessage(null);
    try {
      JSON.parse(form.toolPolicyJson);
      JSON.parse(form.approvalPolicyJson);
      JSON.parse(form.budgetPolicyJson);
      JSON.parse(form.outputPolicyJson);
      JSON.parse(form.securityPolicyJson);
      await submitJson("/api/execution-policies", {
        ...form,
        id: form.id || crypto.randomUUID(),
        tenantSpaceId: form.tenantSpaceId || null,
        businessTeamId: form.businessTeamId || null,
        teamId: form.teamId || null,
      });
      setMessage("ui.generated.ccdfab96f75");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ui.generated.c40525a7328");
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="ui.generated.c235f7a86bb"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c3db35d2741"><Select value={form.tenantSpaceId} onChange={(event) => setForm({ ...form, tenantSpaceId: event.target.value })}><option value="">ui.generated.ca5644f4bbf</option>{tenantSpaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}</Select></FieldGroup>
        <FieldGroup label="ui.generated.c2b90028ff3"><Select value={form.businessTeamId} onChange={(event) => setForm({ ...form, businessTeamId: event.target.value })}><option value="">ui.generated.c59ec80dbec</option>{businessTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select></FieldGroup>
        <FieldGroup label="ui.generated.c70f970c1fc"><Select value={form.teamId} onChange={(event) => setForm({ ...form, teamId: event.target.value })}><option value="">ui.generated.c59ec80dbec</option>{agentTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select></FieldGroup>
        <FieldGroup label="ui.generated.c082e8e9ef2" className="md:col-span-2"><Textarea value={form.systemInstruction} onChange={(event) => setForm({ ...form, systemInstruction: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.cc171d26b81"><Textarea value={form.toolPolicyJson} onChange={(event) => setForm({ ...form, toolPolicyJson: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.ca577223370"><Textarea value={form.approvalPolicyJson} onChange={(event) => setForm({ ...form, approvalPolicyJson: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c2e057b5aaa"><Textarea value={form.budgetPolicyJson} onChange={(event) => setForm({ ...form, budgetPolicyJson: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c7dff341b42"><Textarea value={form.outputPolicyJson} onChange={(event) => setForm({ ...form, outputPolicyJson: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c68323b6052" className="md:col-span-2"><Textarea value={form.securityPolicyJson} onChange={(event) => setForm({ ...form, securityPolicyJson: event.target.value })} /></FieldGroup>
      </div>
      <FormActions label="ui.generated.c11d036fd81" isSaving={isSaving} message={message} onSave={save} />
    </div>
  );
}

export function ServiceCatalogForm({
  listing,
  agentTeams,
}: {
  listing: {
    id: string;
    teamId: string;
    resumeJson: string;
    recruitmentMode: string;
    tagsJson: string;
    status: string;
  };
  agentTeams: Option[];
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({ ...listing, resumeJson: normalizeJson(listing.resumeJson, "{}"), tags: jsonToLines(listing.tagsJson) });
  async function save() {
    setIsSaving(true);
    setMessage(null);
    try {
      JSON.parse(form.resumeJson);
      await submitJson("/api/service-catalog", {
        ...form,
        id: form.id || crypto.randomUUID(),
        tagsJson: linesToJson(form.tags),
      });
      setMessage("ui.generated.ccdfab96f75");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ui.generated.c40525a7328");
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="ui.generated.c70f970c1fc"><Select value={form.teamId} onChange={(event) => setForm({ ...form, teamId: event.target.value })}>{agentTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select></FieldGroup>
        <FieldGroup label="ui.generated.c9fe9e5c5bd"><Select value={form.recruitmentMode} onChange={(event) => setForm({ ...form, recruitmentMode: event.target.value })}><option value="manual">ui.generated.c34fd164246</option><option value="request">ui.generated.c85d8f44eb6</option><option value="open">ui.generated.c9b2526d552</option></Select></FieldGroup>
        <FieldGroup label="ui.generated.c62e951a692"><Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="active">ui.generated.cd4e9ca3dd4</option><option value="disabled">ui.generated.cd989e55188</option></Select></FieldGroup>
        <FieldGroup label="ui.generated.cae0a7afece"><Textarea value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c0efe839cad" className="md:col-span-2"><Textarea value={form.resumeJson} onChange={(event) => setForm({ ...form, resumeJson: event.target.value })} /></FieldGroup>
      </div>
      <FormActions label="ui.generated.cf1ec27e499" isSaving={isSaving} message={message} onSave={save} />
    </div>
  );
}

export function AccessGrantForm({
  grant,
  agentTeams,
  businessTeams,
}: {
  grant: {
    id: string;
    providerTeamId: string;
    consumerBusinessTeamId: string;
    pricingModelJson: string;
    slaJson: string;
    accessScopeJson: string;
    serviceAccountRef: string;
    status: string;
  };
  agentTeams: Option[];
  businessTeams: Option[];
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    ...grant,
    pricingModelJson: normalizeJson(grant.pricingModelJson, "{}"),
    slaJson: normalizeJson(grant.slaJson, "{}"),
    accessScopeJson: normalizeJson(grant.accessScopeJson, "{}"),
  });
  async function save() {
    setIsSaving(true);
    setMessage(null);
    try {
      JSON.parse(form.pricingModelJson);
      JSON.parse(form.slaJson);
      JSON.parse(form.accessScopeJson);
      await submitJson("/api/access-grants", { ...form, id: form.id || crypto.randomUUID() });
      setMessage("ui.generated.ccdfab96f75");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ui.generated.c40525a7328");
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="ui.generated.c64067bdcac"><Select value={form.providerTeamId} onChange={(event) => setForm({ ...form, providerTeamId: event.target.value })}>{agentTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select></FieldGroup>
        <FieldGroup label="ui.generated.c968fef31e7"><Select value={form.consumerBusinessTeamId} onChange={(event) => setForm({ ...form, consumerBusinessTeamId: event.target.value })}>{businessTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select></FieldGroup>
        <FieldGroup label="ui.generated.c88b8078075"><Input value={form.serviceAccountRef} onChange={(event) => setForm({ ...form, serviceAccountRef: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.c62e951a692"><Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="active">ui.generated.cd4e9ca3dd4</option><option value="disabled">ui.generated.cd989e55188</option></Select></FieldGroup>
        <FieldGroup label="ui.generated.c101c7957bb"><Textarea value={form.pricingModelJson} onChange={(event) => setForm({ ...form, pricingModelJson: event.target.value })} /></FieldGroup>
        <FieldGroup label="SLA JSON"><Textarea value={form.slaJson} onChange={(event) => setForm({ ...form, slaJson: event.target.value })} /></FieldGroup>
        <FieldGroup label="ui.generated.cdd5fc1f5fa" className="md:col-span-2"><Textarea value={form.accessScopeJson} onChange={(event) => setForm({ ...form, accessScopeJson: event.target.value })} /></FieldGroup>
      </div>
      <FormActions label="ui.generated.cb4a9067dc0" isSaving={isSaving} message={message} onSave={save} />
    </div>
  );
}
