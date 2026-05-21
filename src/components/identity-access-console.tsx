"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, PencilLine, Plus, Shield, Users } from "lucide-react";
import { useLanguageText } from "@/components/language-pack-provider";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Option = { id: string; name: string };

type Adapter = {
  key: string;
  name: string;
  mode: string;
  status: string;
  description: string;
};

type Provider = {
  id: string;
  name: string;
  adapterKey: string;
  status: string;
  issuerUrl: string;
  authorizeUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  jwksUrl: string;
  clientId: string;
  clientSecretRef: string;
  scopesJson: string;
  mappingJson: string;
  configJson: string;
};

type WhitelistRule = {
  id: string;
  tenantSpaceId: string | null;
  businessTeamId: string;
  allowDescendants: number;
  note: string;
  status: string;
};

type IdentityUser = {
  id: string;
  name: string;
  email: string;
  title: string;
  isSystemAdmin: number;
  primaryBusinessTeamId: string | null;
  lastLoginAt: string;
};

type AccessRequest = {
  id: string;
  email: string;
  name: string;
  requestedBusinessTeamHint: string;
  requestNote: string;
  status: string;
  updatedAt: string;
};

async function submitJson(endpoint: string, method: "POST" | "PATCH" | "DELETE", body: unknown) {
  const response = await fetch(endpoint, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!response.ok || result.ok === false) {
    throw new Error(result.error || "identityAccess.common.submitFailed");
  }
  return result;
}

function SettingsForm({
  settings,
}: {
  settings: {
    adminContactEmail: string;
    requestMessage: string;
  };
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState(settings);

  async function save() {
    setIsSaving(true);
    setMessage(null);
    try {
      await submitJson("/api/identity-access/settings", "POST", form);
      setMessage("identityAccess.common.saved");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "identityAccess.common.saveFailed");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
      <FieldGroup label="identityAccess.settings.fields.adminContactEmail">
        <Input
          value={form.adminContactEmail}
          onChange={(event) => setForm({ ...form, adminContactEmail: event.target.value })}
        />
      </FieldGroup>
      <FieldGroup label="identityAccess.settings.fields.requestMessage">
        <Textarea
          value={form.requestMessage}
          onChange={(event) => setForm({ ...form, requestMessage: event.target.value })}
        />
      </FieldGroup>
      <div className="lg:col-span-2 flex items-center justify-between gap-3">
        <div className="text-sm text-[var(--ink-muted)]">
          {message ?? "identityAccess.settings.footerHint"}
        </div>
        <Button type="button" onClick={save} disabled={isSaving}>
          {isSaving ? "identityAccess.common.saving" : "identityAccess.settings.save"}
        </Button>
      </div>
    </div>
  );
}

function ProviderForm({
  adapters,
  provider,
}: {
  adapters: Adapter[];
  provider?: Provider;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: provider?.id ?? "",
    name: provider?.name ?? "",
    adapterKey: provider?.adapterKey ?? "development_stub",
    status: provider?.status ?? "active",
    issuerUrl: provider?.issuerUrl ?? "",
    authorizeUrl: provider?.authorizeUrl ?? "",
    tokenUrl: provider?.tokenUrl ?? "",
    userinfoUrl: provider?.userinfoUrl ?? "",
    jwksUrl: provider?.jwksUrl ?? "",
    clientId: provider?.clientId ?? "",
    clientSecretRef: provider?.clientSecretRef ?? "",
    scopesJson: provider?.scopesJson ?? JSON.stringify(["openid", "profile", "email"], null, 2),
    mappingJson:
      provider?.mappingJson ??
      JSON.stringify(
        {
          idClaim: "sub",
          nameClaim: "name",
          emailClaim: "email",
          employeeNoClaim: "employee_no",
          titleClaim: "title",
          avatarClaim: "picture",
          adminClaim: "is_admin",
          teamClaims: [],
        },
        null,
        2,
      ),
    configJson: provider?.configJson ?? "{}",
  });

  async function save() {
    setIsSaving(true);
    setMessage(null);
    try {
      JSON.parse(form.scopesJson);
      JSON.parse(form.mappingJson);
      JSON.parse(form.configJson);
      await submitJson("/api/auth/providers", "POST", {
        ...form,
        id: form.id || undefined,
      });
      setMessage("identityAccess.common.saved");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "identityAccess.common.saveFailed");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="identityAccess.providers.fields.name">
          <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </FieldGroup>
        <FieldGroup label="identityAccess.providers.fields.adapter">
          <Select value={form.adapterKey} onChange={(event) => setForm({ ...form, adapterKey: event.target.value })}>
            {adapters.map((adapter) => (
              <option key={adapter.key} value={adapter.key}>
                {adapter.name}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label="identityAccess.providers.fields.status">
          <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="active">active</option>
            <option value="paused">paused</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="Client ID">
          <Input value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })} />
        </FieldGroup>
        <FieldGroup label="Issuer URL">
          <Input value={form.issuerUrl} onChange={(event) => setForm({ ...form, issuerUrl: event.target.value })} />
        </FieldGroup>
        <FieldGroup label="Authorize URL">
          <Input value={form.authorizeUrl} onChange={(event) => setForm({ ...form, authorizeUrl: event.target.value })} />
        </FieldGroup>
        <FieldGroup label="Token URL">
          <Input value={form.tokenUrl} onChange={(event) => setForm({ ...form, tokenUrl: event.target.value })} />
        </FieldGroup>
        <FieldGroup label="Userinfo URL">
          <Input value={form.userinfoUrl} onChange={(event) => setForm({ ...form, userinfoUrl: event.target.value })} />
        </FieldGroup>
        <FieldGroup label="JWKS URL">
          <Input value={form.jwksUrl} onChange={(event) => setForm({ ...form, jwksUrl: event.target.value })} />
        </FieldGroup>
        <FieldGroup label="Client Secret Ref">
          <Input
            value={form.clientSecretRef}
            onChange={(event) => setForm({ ...form, clientSecretRef: event.target.value })}
          />
        </FieldGroup>
        <FieldGroup label="Scopes JSON" className="md:col-span-2">
          <Textarea value={form.scopesJson} onChange={(event) => setForm({ ...form, scopesJson: event.target.value })} />
        </FieldGroup>
        <FieldGroup label="Claim Mapping JSON" className="md:col-span-2">
          <Textarea value={form.mappingJson} onChange={(event) => setForm({ ...form, mappingJson: event.target.value })} />
        </FieldGroup>
        <FieldGroup label="identityAccess.providers.fields.extraConfig" className="md:col-span-2">
          <Textarea value={form.configJson} onChange={(event) => setForm({ ...form, configJson: event.target.value })} />
        </FieldGroup>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-[var(--ink-muted)]">
          {message ?? "identityAccess.providers.footerHint"}
        </div>
        <Button type="button" onClick={save} disabled={isSaving}>
          {isSaving ? "identityAccess.common.saving" : "identityAccess.providers.save"}
        </Button>
      </div>
    </div>
  );
}

function WhitelistForm({
  teams,
  rule,
}: {
  teams: Option[];
  rule?: WhitelistRule;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: rule?.id ?? "",
    businessTeamId: rule?.businessTeamId ?? "",
    allowDescendants: rule?.allowDescendants ?? 1,
    status: rule?.status ?? "active",
    note: rule?.note ?? "",
  });

  async function save() {
    setIsSaving(true);
    setMessage(null);
    try {
      await submitJson("/api/access-whitelist", "POST", form);
      setMessage("identityAccess.common.saved");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "identityAccess.common.saveFailed");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="identityAccess.whitelist.fields.team">
          <Select value={form.businessTeamId} onChange={(event) => setForm({ ...form, businessTeamId: event.target.value })}>
            <option value="">identityAccess.whitelist.teamPlaceholder</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label="identityAccess.providers.fields.status">
          <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="active">active</option>
            <option value="paused">paused</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="identityAccess.whitelist.fields.note" className="md:col-span-2">
          <Textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
        </FieldGroup>
      </div>
      <label className="flex items-center gap-3 rounded-2xl bg-[rgba(15,23,42,0.03)] px-4 py-3 text-sm text-[var(--ink-muted)] ring-1 ring-black/4">
        <input
          type="checkbox"
          checked={Boolean(form.allowDescendants)}
          onChange={(event) => setForm({ ...form, allowDescendants: event.target.checked ? 1 : 0 })}
        />
        identityAccess.whitelist.allowDescendants
      </label>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-[var(--ink-muted)]">{message ?? "identityAccess.whitelist.footerHint"}</div>
        <Button type="button" onClick={save} disabled={isSaving}>
          {isSaving ? "identityAccess.common.saving" : "identityAccess.whitelist.save"}
        </Button>
      </div>
    </div>
  );
}

function AccessRequestReview({
  request,
}: {
  request: AccessRequest;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    id: request.id,
    email: request.email,
    name: request.name,
    requestedBusinessTeamHint: request.requestedBusinessTeamHint,
    requestNote: request.requestNote,
    status: request.status,
  });

  async function save() {
    setIsSaving(true);
    try {
      await submitJson("/api/access-requests", "PATCH", form);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="identityAccess.request.fields.name">
          <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </FieldGroup>
        <FieldGroup label="identityAccess.request.fields.email">
          <Input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </FieldGroup>
        <FieldGroup label="identityAccess.requests.fields.teamHint" className="md:col-span-2">
          <Input
            value={form.requestedBusinessTeamHint}
            onChange={(event) => setForm({ ...form, requestedBusinessTeamHint: event.target.value })}
          />
        </FieldGroup>
        <FieldGroup label="identityAccess.requests.fields.note" className="md:col-span-2">
          <Textarea value={form.requestNote} onChange={(event) => setForm({ ...form, requestNote: event.target.value })} />
        </FieldGroup>
        <FieldGroup label="identityAccess.providers.fields.status">
          <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="open">open</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
          </Select>
        </FieldGroup>
      </div>
      <div className="flex justify-end">
        <Button type="button" onClick={save} disabled={isSaving}>
          {isSaving ? "identityAccess.common.saving" : "identityAccess.requests.save"}
        </Button>
      </div>
    </div>
  );
}

export function IdentityAccessConsole({
  adapters,
  providers,
  settings,
  teams,
  whitelistRules,
  users,
  accessRequests,
}: {
  adapters: Adapter[];
  providers: Provider[];
  settings: { adminContactEmail: string; requestMessage: string };
  teams: Option[];
  whitelistRules: WhitelistRule[];
  users: IdentityUser[];
  accessRequests: AccessRequest[];
}) {
  const router = useRouter();
  const text = useLanguageText();
  const teamsById = new Map(teams.map((team) => [team.id, team.name]));

  async function deleteProvider(id: string) {
    await submitJson("/api/auth/providers", "DELETE", { id });
    router.refresh();
  }

  async function deleteRule(id: string) {
    await submitJson("/api/access-whitelist", "DELETE", { id });
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 xl:grid-cols-4">
        {[
          { label: "identityAccess.summary.providers", value: providers.length },
          { label: "identityAccess.summary.whitelist", value: whitelistRules.filter((rule) => rule.status === "active").length },
          { label: "identityAccess.summary.identities", value: users.length },
          { label: "identityAccess.summary.requests", value: accessRequests.filter((request) => request.status === "open").length },
        ].map((item) => (
          <div key={item.label} className="rounded-[22px] bg-white px-5 py-5 shadow-[var(--shadow-soft)] ring-1 ring-black/4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-subtle)]">{item.label}</div>
            <div className="mt-3 text-[40px] font-light leading-none text-[var(--ink)]">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-[24px] bg-white p-6 shadow-[var(--shadow-soft)] ring-1 ring-black/4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-[var(--ink)]">identityAccess.settings.title</div>
            <div className="mt-1 text-sm leading-7 text-[var(--ink-muted)]">identityAccess.settings.description</div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-[rgba(29,78,216,0.08)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
            <Shield className="h-3.5 w-3.5" />
            Access Gate
          </span>
        </div>
        <div className="mt-6">
          <SettingsForm settings={settings} />
        </div>
      </div>

      <div className="rounded-[24px] bg-white p-6 shadow-[var(--shadow-soft)] ring-1 ring-black/4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-[var(--ink)]">identityAccess.providers.title</div>
            <div className="mt-1 text-sm leading-7 text-[var(--ink-muted)]">identityAccess.providers.description</div>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="secondary"><Plus className="h-4 w-4" />identityAccess.providers.add</Button>
            </DialogTrigger>
            <DialogContent className="w-[min(96vw,980px)]">
              <DialogHeader>
                <DialogTitle>identityAccess.providers.dialogTitle</DialogTitle>
                <DialogDescription>identityAccess.providers.dialogDescription</DialogDescription>
              </DialogHeader>
              <DialogBody>
                <ProviderForm adapters={adapters} />
              </DialogBody>
            </DialogContent>
          </Dialog>
        </div>
        <div className="mt-6 overflow-hidden rounded-[20px]">
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>identityAccess.providers.columns.name</DataTableHead>
                <DataTableHead>identityAccess.providers.columns.adapter</DataTableHead>
                <DataTableHead>identityAccess.providers.columns.status</DataTableHead>
                <DataTableHead>Client ID</DataTableHead>
                <DataTableHead align="right">identityAccess.common.actions</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {providers.map((provider) => {
                const adapter = adapters.find((item) => item.key === provider.adapterKey);
                return (
                  <DataTableRow key={provider.id}>
                    <DataTableCell className="font-semibold text-[var(--ink)]">{provider.name}</DataTableCell>
                    <DataTableCell>{adapter?.name ?? provider.adapterKey}</DataTableCell>
                    <DataTableCell>{provider.status}</DataTableCell>
                    <DataTableCell>{provider.clientId || text("identityAccess.common.notConfigured")}</DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost"><PencilLine className="h-4 w-4" />actions.edit</Button>
                          </DialogTrigger>
                          <DialogContent className="w-[min(96vw,980px)]">
                            <DialogHeader>
                              <DialogTitle>{provider.name}</DialogTitle>
                              <DialogDescription>{adapter?.description ?? provider.adapterKey}</DialogDescription>
                            </DialogHeader>
                            <DialogBody>
                              <ProviderForm adapters={adapters} provider={provider} />
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                        <Button size="sm" variant="ghost" onClick={() => deleteProvider(provider.id)}>actions.delete</Button>
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
        </div>
      </div>

      <div className="rounded-[24px] bg-white p-6 shadow-[var(--shadow-soft)] ring-1 ring-black/4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-[var(--ink)]">identityAccess.whitelist.title</div>
            <div className="mt-1 text-sm leading-7 text-[var(--ink-muted)]">identityAccess.whitelist.description</div>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="secondary"><Plus className="h-4 w-4" />identityAccess.whitelist.add</Button>
            </DialogTrigger>
            <DialogContent className="w-[min(94vw,760px)]">
              <DialogHeader>
                <DialogTitle>identityAccess.whitelist.dialogTitle</DialogTitle>
                <DialogDescription>identityAccess.whitelist.dialogDescription</DialogDescription>
              </DialogHeader>
              <DialogBody>
                <WhitelistForm teams={teams} />
              </DialogBody>
            </DialogContent>
          </Dialog>
        </div>
        <div className="mt-6 overflow-hidden rounded-[20px]">
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>identityAccess.whitelist.columns.team</DataTableHead>
                <DataTableHead>identityAccess.whitelist.columns.descendants</DataTableHead>
                <DataTableHead>identityAccess.providers.columns.status</DataTableHead>
                <DataTableHead>identityAccess.whitelist.columns.note</DataTableHead>
                <DataTableHead align="right">identityAccess.common.actions</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {whitelistRules.map((rule) => (
                <DataTableRow key={rule.id}>
                  <DataTableCell className="font-semibold text-[var(--ink)]">{teamsById.get(rule.businessTeamId) ?? rule.businessTeamId}</DataTableCell>
                  <DataTableCell>{rule.allowDescendants ? text("identityAccess.whitelist.descendantsAllowed") : text("identityAccess.whitelist.currentOnly")}</DataTableCell>
                  <DataTableCell>{rule.status}</DataTableCell>
                  <DataTableCell>{rule.note || "—"}</DataTableCell>
                  <DataTableCell align="right">
                    <div className="flex justify-end gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="ghost"><PencilLine className="h-4 w-4" />actions.edit</Button>
                        </DialogTrigger>
                        <DialogContent className="w-[min(94vw,760px)]">
                          <DialogHeader>
                            <DialogTitle>{teamsById.get(rule.businessTeamId) ?? rule.businessTeamId}</DialogTitle>
                            <DialogDescription>identityAccess.whitelist.editDescription</DialogDescription>
                          </DialogHeader>
                          <DialogBody>
                            <WhitelistForm teams={teams} rule={rule} />
                          </DialogBody>
                        </DialogContent>
                      </Dialog>
                      <Button size="sm" variant="ghost" onClick={() => deleteRule(rule.id)}>actions.delete</Button>
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[24px] bg-white p-6 shadow-[var(--shadow-soft)] ring-1 ring-black/4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-[var(--ink)]">identityAccess.identities.title</div>
              <div className="mt-1 text-sm leading-7 text-[var(--ink-muted)]">identityAccess.identities.description</div>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[rgba(15,23,42,0.05)] px-3 py-1 text-xs font-semibold text-[var(--ink-subtle)]">
              <Users className="h-3.5 w-3.5" />
              Identity
            </span>
          </div>
          <div className="mt-6 overflow-hidden rounded-[20px]">
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>identityAccess.identities.columns.user</DataTableHead>
                  <DataTableHead>identityAccess.identities.columns.primaryTeam</DataTableHead>
                  <DataTableHead>identityAccess.identities.columns.systemRole</DataTableHead>
                  <DataTableHead>identityAccess.identities.columns.lastLogin</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {users.map((user) => (
                  <DataTableRow key={user.id}>
                    <DataTableCell>
                      <div className="font-semibold text-[var(--ink)]">{user.name}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{user.email}</div>
                    </DataTableCell>
                    <DataTableCell>{user.primaryBusinessTeamId ? teamsById.get(user.primaryBusinessTeamId) ?? user.primaryBusinessTeamId : text("identityAccess.common.notConfigured")}</DataTableCell>
                    <DataTableCell>{user.isSystemAdmin ? "system_admin" : "member"}</DataTableCell>
                    <DataTableCell>{new Date(user.lastLoginAt).toLocaleString("zh-CN")}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </div>
        </div>

        <div className="rounded-[24px] bg-white p-6 shadow-[var(--shadow-soft)] ring-1 ring-black/4">
          <div className="text-lg font-semibold text-[var(--ink)]">identityAccess.requests.title</div>
          <div className="mt-1 text-sm leading-7 text-[var(--ink-muted)]">identityAccess.requests.description</div>
          <div className="mt-6 overflow-hidden rounded-[20px]">
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>identityAccess.requests.columns.user</DataTableHead>
                  <DataTableHead>identityAccess.requests.columns.teamHint</DataTableHead>
                  <DataTableHead>identityAccess.providers.columns.status</DataTableHead>
                  <DataTableHead align="right">identityAccess.common.actions</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {accessRequests.map((request) => (
                  <DataTableRow key={request.id}>
                    <DataTableCell>
                      <div className="font-semibold text-[var(--ink)]">{request.name}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{request.email}</div>
                    </DataTableCell>
                    <DataTableCell>{request.requestedBusinessTeamHint || text("identityAccess.common.notProvided")}</DataTableCell>
                    <DataTableCell>{request.status}</DataTableCell>
                    <DataTableCell align="right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="ghost"><Eye className="h-4 w-4" />actions.view</Button>
                        </DialogTrigger>
                        <DialogContent className="w-[min(94vw,760px)]">
                          <DialogHeader>
                            <DialogTitle>{request.name}</DialogTitle>
                            <DialogDescription>{request.email}</DialogDescription>
                          </DialogHeader>
                          <DialogBody>
                            <AccessRequestReview request={request} />
                          </DialogBody>
                        </DialogContent>
                      </Dialog>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </div>
        </div>
      </div>
    </div>
  );
}
