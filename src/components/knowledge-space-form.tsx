"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, PencilLine, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLanguageText } from "@/components/language-pack-provider";
import { Button } from "@/components/ui/button";
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

type BusinessTeamOption = {
  id: string;
  name: string;
  tenantSpaceId?: string;
};

type TenantSpaceOption = {
  id: string;
  name: string;
};

type AgentTeamOption = {
  id: string;
  businessTeamId: string;
  name: string;
};

type KnowledgeSpaceValue = {
  id: string;
  tenantSpaceId: string;
  businessTeamId: string | null;
  agentTeamId: string | null;
  projectKey: string | null;
  slug: string;
  name: string;
  spaceType: string;
  description: string;
  visibility: string;
  status: string;
  retentionPolicyJson: string;
};

export function KnowledgeSpaceForm({
  tenantSpaces,
  businessTeams,
  agentTeams,
  space,
  triggerLabel,
}: {
  tenantSpaces: TenantSpaceOption[];
  businessTeams: BusinessTeamOption[];
  agentTeams: AgentTeamOption[];
  space?: KnowledgeSpaceValue;
  triggerLabel?: string;
}) {
  const router = useRouter();
  const text = useLanguageText();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isEdit = Boolean(space?.id);
  const initialBusinessTeamId =
    space?.businessTeamId ??
    agentTeams.find((team) => team.id === space?.agentTeamId)?.businessTeamId ??
    "";
  const [spaceType, setSpaceType] = useState(space?.spaceType ?? "team");
  const [tenantSpaceId, setTenantSpaceId] = useState(space?.tenantSpaceId ?? "");
  const [businessTeamId, setBusinessTeamId] = useState(initialBusinessTeamId);
  const availableAgentTeams = useMemo(
    () => agentTeams.filter((team) => !businessTeamId || team.businessTeamId === businessTeamId),
    [agentTeams, businessTeamId],
  );

  async function submit(formData: FormData) {
    setPending(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/knowledge/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_space",
          id: space?.id,
          tenantSpaceId: tenantSpaceId || null,
          name: String(formData.get("name") ?? "").trim(),
          slug: String(formData.get("slug") ?? "").trim() || undefined,
          spaceType,
          businessTeamId: spaceType === "global" ? null : businessTeamId || null,
          agentTeamId: spaceType === "agent_team" ? String(formData.get("agentTeamId") ?? "") || null : null,
          projectKey: spaceType === "project" ? String(formData.get("projectKey") ?? "").trim() || null : null,
          description: String(formData.get("description") ?? ""),
          visibility: String(formData.get("visibility") ?? "team"),
          status: String(formData.get("status") ?? "active"),
          retentionPolicyJson: String(formData.get("retentionPolicyJson") ?? "").trim() || "{}",
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) throw new Error(result.error ?? "保存空间失败");
      setOpen(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "保存空间失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setErrorMessage(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant={isEdit ? "secondary" : "primary"} size={isEdit ? "sm" : "md"}>
          {isEdit ? <PencilLine className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {triggerLabel ?? (isEdit ? text("actions.edit") : text("actions.create"))}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? text("actions.edit") : text("actions.create")}</DialogTitle>
          <DialogDescription>{text("knowledge.page.description")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form action={submit} className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FieldGroup label={text("common.fields.name", "名称")}>
                <Input name="name" required defaultValue={space?.name} placeholder={text("common.placeholders.name", "输入名称")} />
              </FieldGroup>
              <FieldGroup label="Slug">
                <Input name="slug" defaultValue={space?.slug} placeholder="slug" />
              </FieldGroup>
              <FieldGroup label={text("terminology.tenantSpace")}>
                <Select value={tenantSpaceId} onChange={(event) => setTenantSpaceId(event.target.value)}>
                  <option value="">{text("common.select.placeholder", "请选择")}</option>
                  {tenantSpaces.map((spaceOption) => (
                    <option key={spaceOption.id} value={spaceOption.id}>
                      {spaceOption.name}
                    </option>
                  ))}
                </Select>
              </FieldGroup>
              <FieldGroup label={text("knowledge.fields.spaceType", "知识空间类型")}>
                <Select value={spaceType} onChange={(event) => setSpaceType(event.target.value)}>
                  <option value="global">{text("ui.common.knowledgeType.global", "全局")}</option>
                  <option value="team">{text("ui.common.knowledgeType.team", "团队")}</option>
                  <option value="project">{text("ui.common.knowledgeType.project", "项目")}</option>
                  <option value="agent_team">{text("ui.common.knowledgeType.agentTeam", "Agent 团队")}</option>
                </Select>
              </FieldGroup>
              <FieldGroup label={text("terminology.businessTeam")}>
                <Select value={businessTeamId} onChange={(event) => setBusinessTeamId(event.target.value)}>
                  <option value="">{text("common.select.placeholder", "请选择")}</option>
                  {businessTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </Select>
              </FieldGroup>
              <FieldGroup label={text("terminology.agentTeam")}>
                <Select name="agentTeamId" disabled={spaceType !== "agent_team"} defaultValue={space?.agentTeamId ?? ""}>
                  <option value="">{text("common.select.none", "不绑定")}</option>
                  {availableAgentTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </Select>
              </FieldGroup>
              <FieldGroup label={text("knowledge.fields.projectKey", "项目标识")}>
                <Input name="projectKey" disabled={spaceType !== "project"} defaultValue={space?.projectKey ?? ""} placeholder={text("knowledge.fields.projectKey", "项目标识")} />
              </FieldGroup>
              <FieldGroup label={text("common.fields.visibility", "可见性")}>
                <Select name="visibility" defaultValue={space?.visibility ?? (spaceType === "global" ? "global" : "team")}>
                  <option value="global">{text("labels.visibility.global")}</option>
                  <option value="team">{text("labels.visibility.team")}</option>
                  <option value="private">{text("labels.visibility.private")}</option>
                </Select>
              </FieldGroup>
              <FieldGroup label={text("common.fields.status", "状态")}>
                <Select name="status" defaultValue={space?.status ?? "active"}>
                  <option value="active">{text("labels.status.active")}</option>
                  <option value="paused">{text("labels.status.paused")}</option>
                  <option value="archived">{text("labels.status.archived")}</option>
                </Select>
              </FieldGroup>
            </div>
            <FieldGroup label={text("common.fields.description", "说明")}>
              <Textarea
                name="description"
                rows={4}
                defaultValue={space?.description}
                placeholder={text("common.placeholders.description", "补充用途、边界与约束")}
              />
            </FieldGroup>
            <FieldGroup label={text("knowledge.fields.retentionPolicy", "归档策略")}>
              <Textarea
                name="retentionPolicyJson"
                rows={4}
                defaultValue={space?.retentionPolicyJson ?? "{}"}
                placeholder="{}"
              />
            </FieldGroup>
            {errorMessage ? (
              <div
                className="flex items-start gap-3 rounded-2xl border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-sm text-[#9f1239]"
                role="alert"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <div className="font-semibold">保存空间失败</div>
                  <div className="mt-1 leading-6">{errorMessage}</div>
                </div>
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" onClick={() => setOpen(false)}>
                {text("actions.cancel")}
              </Button>
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? text("actions.saving") : text("actions.save")}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
