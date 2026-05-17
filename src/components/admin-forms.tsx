"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

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
        {isSaving ? "保存中" : label}
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
  if (!response.ok || result.ok === false) throw new Error(result.error ?? "保存失败");
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
      setMessage("已保存");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
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
      setMessage("已生成优化建议");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "优化失败");
    } finally {
      setIsOptimizing(false);
    }
  }

  async function sync() {
    if (!form.id) {
      setMessage("请先保存 Skill");
      return;
    }
    setIsSaving(true);
    setMessage(null);
    try {
      await submitJson("/api/skills/sync", { skillId: form.id });
      setMessage("已同步到 OpenViking");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "同步失败");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="Skill 名称">
          <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </FieldGroup>
        <FieldGroup label="归属团队">
          <Select
            value={form.ownerBusinessTeamId}
            onChange={(event) => setForm({ ...form, ownerBusinessTeamId: event.target.value })}
          >
            <option value="">全局</option>
            {businessTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label="知识层">
          <Input value={form.layer} onChange={(event) => setForm({ ...form, layer: event.target.value })} />
        </FieldGroup>
        <FieldGroup label="可见性">
          <Select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value })}>
            <option value="private">个人</option>
            <option value="team">团队</option>
            <option value="global">全局</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="描述" className="md:col-span-2">
          <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </FieldGroup>
        <FieldGroup label="标签" hint="每行一个标签，运行时可以按标签选择 Skill。">
          <Textarea value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} />
        </FieldGroup>
        <FieldGroup label="启用状态">
          <label className="flex h-10 items-center gap-2 text-sm text-[var(--ink-muted)]">
            <input
              type="checkbox"
              checked={form.isEnabled}
              onChange={(event) => setForm({ ...form, isEnabled: event.target.checked })}
            />
            运行时可用
          </label>
        </FieldGroup>
        <FieldGroup label="Skill 内容" className="md:col-span-2">
          <Textarea
            className="min-h-40"
            value={form.promptMd}
            onChange={(event) => setForm({ ...form, promptMd: event.target.value })}
          />
        </FieldGroup>
        <FieldGroup label="结构化启发式" className="md:col-span-2">
          <Textarea value={form.heuristicsJson} onChange={(event) => setForm({ ...form, heuristicsJson: event.target.value })} />
        </FieldGroup>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={save} disabled={isSaving}>
            {isSaving ? "保存中" : "保存 Skill"}
          </Button>
          <Button type="button" variant="secondary" onClick={optimize} disabled={isOptimizing}>
            {isOptimizing ? "优化中" : "优化润色"}
          </Button>
          <Button type="button" variant="ghost" onClick={sync} disabled={isSaving}>
            同步 OpenViking
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
      setMessage("已保存");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="名称"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FieldGroup>
        <FieldGroup label="归属团队">
          <Select value={form.businessTeamId} onChange={(event) => setForm({ ...form, businessTeamId: event.target.value })}>
            <option value="">全局</option>
            {businessTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </Select>
        </FieldGroup>
        <FieldGroup label="传输方式">
          <Select value={form.transport} onChange={(event) => setForm({ ...form, transport: event.target.value })}>
            <option value="stdio">stdio</option>
            <option value="http">HTTP</option>
            <option value="sse">SSE</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="状态">
          <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="active">启用</option>
            <option value="disabled">停用</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="命令" className="md:col-span-2"><Input value={form.command} onChange={(event) => setForm({ ...form, command: event.target.value })} /></FieldGroup>
        <FieldGroup label="URL" className="md:col-span-2"><Input value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} /></FieldGroup>
        <FieldGroup label="鉴权引用"><Input value={form.authRef} onChange={(event) => setForm({ ...form, authRef: event.target.value })} /></FieldGroup>
        <FieldGroup label="工具白名单"><Textarea value={form.tools} onChange={(event) => setForm({ ...form, tools: event.target.value })} /></FieldGroup>
      </div>
      <FormActions label="保存 MCP" isSaving={isSaving} message={message} onSave={save} />
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
      setMessage("已保存");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="名称"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FieldGroup>
        <FieldGroup label="归属团队">
          <Select value={form.businessTeamId} onChange={(event) => setForm({ ...form, businessTeamId: event.target.value })}>
            <option value="">全局</option>
            {businessTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </Select>
        </FieldGroup>
        <FieldGroup label="类型">
          <Select value={form.connectorType} onChange={(event) => setForm({ ...form, connectorType: event.target.value })}>
            <option value="im">IM</option>
            <option value="email">邮件</option>
            <option value="web_push">Web Push</option>
            <option value="webhook">Webhook</option>
            <option value="custom">自定义</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="供应商"><Input value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })} /></FieldGroup>
        <FieldGroup label="Endpoint" className="md:col-span-2"><Input value={form.endpoint} onChange={(event) => setForm({ ...form, endpoint: event.target.value })} /></FieldGroup>
        <FieldGroup label="Secret 引用"><Input value={form.secretRef} onChange={(event) => setForm({ ...form, secretRef: event.target.value })} /></FieldGroup>
        <FieldGroup label="状态">
          <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="active">启用</option>
            <option value="disabled">停用</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="能力" className="md:col-span-2"><Textarea value={form.capabilities} onChange={(event) => setForm({ ...form, capabilities: event.target.value })} /></FieldGroup>
      </div>
      <FormActions label="保存 Connector" isSaving={isSaving} message={message} onSave={save} />
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
      setMessage("已保存");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="仓库名称"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FieldGroup>
        <FieldGroup label="归属团队">
          <Select value={form.businessTeamId} onChange={(event) => setForm({ ...form, businessTeamId: event.target.value })}>
            {businessTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </Select>
        </FieldGroup>
        <FieldGroup label="代码平台"><Input value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })} /></FieldGroup>
        <FieldGroup label="默认分支"><Input value={form.defaultBranch} onChange={(event) => setForm({ ...form, defaultBranch: event.target.value })} /></FieldGroup>
        <FieldGroup label="可见性">
          <Select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value })}>
            <option value="private">私有</option>
            <option value="team">团队</option>
            <option value="global">全局</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="状态">
          <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="active">启用</option>
            <option value="disabled">停用</option>
            <option value="archived">归档</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="仓库地址" className="md:col-span-2"><Input value={form.repositoryUrl} onChange={(event) => setForm({ ...form, repositoryUrl: event.target.value })} /></FieldGroup>
        <FieldGroup label="描述" className="md:col-span-2"><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></FieldGroup>
      </div>
      <FormActions label="保存 Codebase" isSaving={isSaving} message={message} onSave={save} />
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
      setMessage("已保存");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="代码仓">
          <Select value={form.codebaseId} onChange={(event) => setForm({ ...form, codebaseId: event.target.value })}>
            {codebases.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
        </FieldGroup>
        <FieldGroup label="操作者"><Input value={form.operatorName} onChange={(event) => setForm({ ...form, operatorName: event.target.value })} /></FieldGroup>
        <FieldGroup label="角色"><Input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} /></FieldGroup>
        <FieldGroup label="Token 引用"><Input value={form.tokenRef} onChange={(event) => setForm({ ...form, tokenRef: event.target.value })} /></FieldGroup>
        <FieldGroup label="状态">
          <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="active">启用</option>
            <option value="disabled">停用</option>
            <option value="expired">过期</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="权限" className="md:col-span-2"><Textarea value={form.permissions} onChange={(event) => setForm({ ...form, permissions: event.target.value })} /></FieldGroup>
      </div>
      <FormActions label="保存操作者 Token" isSaving={isSaving} message={message} onSave={save} />
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
      setMessage("已保存");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="姓名"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FieldGroup>
        <FieldGroup label="工号"><Input value={form.employeeNo} onChange={(event) => setForm({ ...form, employeeNo: event.target.value })} /></FieldGroup>
        <FieldGroup label="邮箱"><Input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></FieldGroup>
        <FieldGroup label="归属团队">
          <Select value={form.businessTeamId} onChange={(event) => setForm({ ...form, businessTeamId: event.target.value })}>
            {businessTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </Select>
        </FieldGroup>
        <FieldGroup label="角色"><Input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} /></FieldGroup>
        <FieldGroup label="岗位"><Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></FieldGroup>
        <FieldGroup label="状态">
          <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="active">在职/启用</option>
            <option value="inactive">停用</option>
            <option value="pending">待确认</option>
          </Select>
        </FieldGroup>
      </div>
      <FormActions label="保存成员" isSaving={isSaving} message={message} onSave={save} />
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
  const [businessTeamId, setBusinessTeamId] = useState(businessTeams[0]?.id ?? "");
  const [rows, setRows] = useState("工号\t姓名\t邮箱\t角色\t岗位");
  async function save() {
    setIsSaving(true);
    setMessage(null);
    try {
      await submitJson("/api/team-members", { mode: "import", tenantSpaceId, businessTeamId, rows });
      setMessage("已导入");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "导入失败");
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <div className="space-y-4">
      <FieldGroup label="归属团队">
        <Select value={businessTeamId} onChange={(event) => setBusinessTeamId(event.target.value)}>
          {businessTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
        </Select>
      </FieldGroup>
      <FieldGroup label="Excel 内容" hint="从 Excel 复制工号、姓名、邮箱、角色、岗位五列后粘贴。">
        <Textarea className="min-h-48" value={rows} onChange={(event) => setRows(event.target.value)} />
      </FieldGroup>
      <FormActions label="导入成员" isSaving={isSaving} message={message} onSave={save} />
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
      setMessage("已保存");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="业务团队"><Select value={form.businessTeamId} onChange={(event) => setForm({ ...form, businessTeamId: event.target.value })}>{businessTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select></FieldGroup>
        <FieldGroup label="成员"><Select value={form.memberId} onChange={(event) => setForm({ ...form, memberId: event.target.value })}><option value="">团队角色</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</Select></FieldGroup>
        <FieldGroup label="主体类型">
          <Select value={form.principalType} onChange={(event) => setForm({ ...form, principalType: event.target.value })}>
            <option value="member">成员</option>
            <option value="role">角色</option>
            <option value="team">团队</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="角色 Key"><Input value={form.roleKey} onChange={(event) => setForm({ ...form, roleKey: event.target.value })} /></FieldGroup>
        <FieldGroup label="资源类型"><Input value={form.resourceType} onChange={(event) => setForm({ ...form, resourceType: event.target.value })} /></FieldGroup>
        <FieldGroup label="资源范围"><Input value={form.resourceScope} onChange={(event) => setForm({ ...form, resourceScope: event.target.value })} /></FieldGroup>
        <FieldGroup label="效果"><Select value={form.effect} onChange={(event) => setForm({ ...form, effect: event.target.value })}><option value="allow">允许</option><option value="deny">拒绝</option><option value="ask">需审批</option></Select></FieldGroup>
        <FieldGroup label="状态">
          <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="active">启用</option>
            <option value="disabled">停用</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="动作" className="md:col-span-2"><Textarea value={form.actions} onChange={(event) => setForm({ ...form, actions: event.target.value })} /></FieldGroup>
      </div>
      <FormActions label="保存权限" isSaving={isSaving} message={message} onSave={save} />
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
      setMessage("已保存");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="业务团队"><Select value={form.businessTeamId} onChange={(event) => setForm({ ...form, businessTeamId: event.target.value })}>{businessTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select></FieldGroup>
        <FieldGroup label="成员"><Select value={form.memberId} onChange={(event) => setForm({ ...form, memberId: event.target.value })}><option value="">团队级资产</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</Select></FieldGroup>
        <FieldGroup label="资产类型"><Select value={form.assetType} onChange={(event) => setForm({ ...form, assetType: event.target.value })}><option value="skill">Skill</option><option value="knowledge_space">知识库</option><option value="codebase">Codebase</option><option value="connector">Connector</option><option value="agent_team">Agent Team</option></Select></FieldGroup>
        <FieldGroup label="资产 ID"><Input value={form.assetId} onChange={(event) => setForm({ ...form, assetId: event.target.value })} /></FieldGroup>
        <FieldGroup label="状态">
          <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="active">启用</option>
            <option value="disabled">停用</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="资产名称" className="md:col-span-2"><Input value={form.assetName} onChange={(event) => setForm({ ...form, assetName: event.target.value })} /></FieldGroup>
        <FieldGroup label="权限 JSON" className="md:col-span-2"><Textarea value={form.permissionJson} onChange={(event) => setForm({ ...form, permissionJson: event.target.value })} /></FieldGroup>
      </div>
      <FormActions label="保存资产授权" isSaving={isSaving} message={message} onSave={save} />
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
      setMessage("已保存");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="租户名称"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FieldGroup>
        <FieldGroup label="Slug"><Input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} /></FieldGroup>
        <FieldGroup label="Owner"><Input value={form.ownerUserId} onChange={(event) => setForm({ ...form, ownerUserId: event.target.value })} /></FieldGroup>
        <FieldGroup label="状态"><Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="active">启用</option><option value="disabled">停用</option></Select></FieldGroup>
        <FieldGroup label="默认执行策略" className="md:col-span-2">
          <Select value={form.defaultExecutionPolicyId} onChange={(event) => setForm({ ...form, defaultExecutionPolicyId: event.target.value })}>
            <option value="">不绑定</option>
            {executionPolicies.map((policy) => <option key={policy.id} value={policy.id}>{policy.name}</option>)}
          </Select>
        </FieldGroup>
        <FieldGroup label="配额 JSON"><Textarea value={form.quotaLimitJson} onChange={(event) => setForm({ ...form, quotaLimitJson: event.target.value })} /></FieldGroup>
        <FieldGroup label="模型白名单 JSON"><Textarea value={form.modelWhitelistJson} onChange={(event) => setForm({ ...form, modelWhitelistJson: event.target.value })} /></FieldGroup>
        <FieldGroup label="全局 Guardrails JSON" className="md:col-span-2"><Textarea value={form.globalGuardrailsJson} onChange={(event) => setForm({ ...form, globalGuardrailsJson: event.target.value })} /></FieldGroup>
      </div>
      <FormActions label="保存租户空间" isSaving={isSaving} message={message} onSave={save} />
    </div>
  );
}

export function BusinessTeamForm({
  team,
  tenantSpaces,
}: {
  team: {
    id: string;
    tenantSpaceId: string;
    slug: string;
    name: string;
    ownerUserId: string;
    status: string;
    balance: number;
    creditLimit: number;
    privateToolRefsJson: string;
    privateMemoryNamespace: string;
    policyJson: string;
  };
  tenantSpaces: Option[];
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    ...team,
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
      setMessage("已保存");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="团队名称"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FieldGroup>
        <FieldGroup label="Slug"><Input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} /></FieldGroup>
        <FieldGroup label="租户空间"><Select value={form.tenantSpaceId} onChange={(event) => setForm({ ...form, tenantSpaceId: event.target.value })}>{tenantSpaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}</Select></FieldGroup>
        <FieldGroup label="Owner"><Input value={form.ownerUserId} onChange={(event) => setForm({ ...form, ownerUserId: event.target.value })} /></FieldGroup>
        <FieldGroup label="状态">
          <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="active">启用</option>
            <option value="disabled">停用</option>
            <option value="archived">归档</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="余额"><Input value={form.balance} onChange={(event) => setForm({ ...form, balance: event.target.value })} /></FieldGroup>
        <FieldGroup label="信用额度"><Input value={form.creditLimit} onChange={(event) => setForm({ ...form, creditLimit: event.target.value })} /></FieldGroup>
        <FieldGroup label="私有记忆命名空间" className="md:col-span-2"><Input value={form.privateMemoryNamespace} onChange={(event) => setForm({ ...form, privateMemoryNamespace: event.target.value })} /></FieldGroup>
        <FieldGroup label="私有工具引用 JSON"><Textarea value={form.privateToolRefsJson} onChange={(event) => setForm({ ...form, privateToolRefsJson: event.target.value })} /></FieldGroup>
        <FieldGroup label="团队策略 JSON"><Textarea value={form.policyJson} onChange={(event) => setForm({ ...form, policyJson: event.target.value })} /></FieldGroup>
      </div>
      <FormActions label="保存业务团队" isSaving={isSaving} message={message} onSave={save} />
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
      setMessage("已保存");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="策略名称"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FieldGroup>
        <FieldGroup label="租户空间"><Select value={form.tenantSpaceId} onChange={(event) => setForm({ ...form, tenantSpaceId: event.target.value })}><option value="">全局</option>{tenantSpaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}</Select></FieldGroup>
        <FieldGroup label="业务团队"><Select value={form.businessTeamId} onChange={(event) => setForm({ ...form, businessTeamId: event.target.value })}><option value="">不限定</option>{businessTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select></FieldGroup>
        <FieldGroup label="Agent Team"><Select value={form.teamId} onChange={(event) => setForm({ ...form, teamId: event.target.value })}><option value="">不限定</option>{agentTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select></FieldGroup>
        <FieldGroup label="系统约束说明" className="md:col-span-2"><Textarea value={form.systemInstruction} onChange={(event) => setForm({ ...form, systemInstruction: event.target.value })} /></FieldGroup>
        <FieldGroup label="工具策略 JSON"><Textarea value={form.toolPolicyJson} onChange={(event) => setForm({ ...form, toolPolicyJson: event.target.value })} /></FieldGroup>
        <FieldGroup label="审批策略 JSON"><Textarea value={form.approvalPolicyJson} onChange={(event) => setForm({ ...form, approvalPolicyJson: event.target.value })} /></FieldGroup>
        <FieldGroup label="预算策略 JSON"><Textarea value={form.budgetPolicyJson} onChange={(event) => setForm({ ...form, budgetPolicyJson: event.target.value })} /></FieldGroup>
        <FieldGroup label="输出策略 JSON"><Textarea value={form.outputPolicyJson} onChange={(event) => setForm({ ...form, outputPolicyJson: event.target.value })} /></FieldGroup>
        <FieldGroup label="安全策略 JSON" className="md:col-span-2"><Textarea value={form.securityPolicyJson} onChange={(event) => setForm({ ...form, securityPolicyJson: event.target.value })} /></FieldGroup>
      </div>
      <FormActions label="保存执行策略" isSaving={isSaving} message={message} onSave={save} />
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
      setMessage("已保存");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="Agent Team"><Select value={form.teamId} onChange={(event) => setForm({ ...form, teamId: event.target.value })}>{agentTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select></FieldGroup>
        <FieldGroup label="招募模式"><Select value={form.recruitmentMode} onChange={(event) => setForm({ ...form, recruitmentMode: event.target.value })}><option value="manual">手动授权</option><option value="request">申请使用</option><option value="open">开放使用</option></Select></FieldGroup>
        <FieldGroup label="状态"><Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="active">启用</option><option value="disabled">停用</option></Select></FieldGroup>
        <FieldGroup label="标签"><Textarea value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} /></FieldGroup>
        <FieldGroup label="服务履历 JSON" className="md:col-span-2"><Textarea value={form.resumeJson} onChange={(event) => setForm({ ...form, resumeJson: event.target.value })} /></FieldGroup>
      </div>
      <FormActions label="保存服务目录" isSaving={isSaving} message={message} onSave={save} />
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
      setMessage("已保存");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="服务 Agent Team"><Select value={form.providerTeamId} onChange={(event) => setForm({ ...form, providerTeamId: event.target.value })}>{agentTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select></FieldGroup>
        <FieldGroup label="消费业务团队"><Select value={form.consumerBusinessTeamId} onChange={(event) => setForm({ ...form, consumerBusinessTeamId: event.target.value })}>{businessTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select></FieldGroup>
        <FieldGroup label="服务账号引用"><Input value={form.serviceAccountRef} onChange={(event) => setForm({ ...form, serviceAccountRef: event.target.value })} /></FieldGroup>
        <FieldGroup label="状态"><Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="active">启用</option><option value="disabled">停用</option></Select></FieldGroup>
        <FieldGroup label="定价 JSON"><Textarea value={form.pricingModelJson} onChange={(event) => setForm({ ...form, pricingModelJson: event.target.value })} /></FieldGroup>
        <FieldGroup label="SLA JSON"><Textarea value={form.slaJson} onChange={(event) => setForm({ ...form, slaJson: event.target.value })} /></FieldGroup>
        <FieldGroup label="访问范围 JSON" className="md:col-span-2"><Textarea value={form.accessScopeJson} onChange={(event) => setForm({ ...form, accessScopeJson: event.target.value })} /></FieldGroup>
      </div>
      <FormActions label="保存跨团队授权" isSaving={isSaving} message={message} onSave={save} />
    </div>
  );
}
