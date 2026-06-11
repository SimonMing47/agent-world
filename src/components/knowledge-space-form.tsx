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
import { isCodebaseKnowledgeCategory, type KnowledgeCategory } from "@/lib/knowledge-categories";

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
  knowledgeCategory: KnowledgeCategory;
  repositoryName: string;
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
  const [knowledgeCategory, setKnowledgeCategory] = useState(space?.knowledgeCategory ?? "domain");
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
          knowledgeCategory,
          repositoryName: isCodebaseKnowledgeCategory(knowledgeCategory)
            ? String(formData.get("repositoryName") ?? "").trim() || undefined
            : undefined,
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
      if (!response.ok || result.ok === false) throw new Error(result.error ?? text("knowledge.spaceForm.errors.saveFailed"));
      setOpen(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : text("knowledge.spaceForm.errors.saveFailed"));
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
              <FieldGroup label={text("common.fields.name")}>
                <Input name="name" required defaultValue={space?.name} placeholder={text("common.placeholders.name")} />
              </FieldGroup>
              <FieldGroup label="Slug">
                <Input name="slug" defaultValue={space?.slug} placeholder="slug" />
              </FieldGroup>
              <FieldGroup label={text("terminology.tenantSpace")}>
                <Select value={tenantSpaceId} onChange={(event) => setTenantSpaceId(event.target.value)}>
                  <option value="">{text("common.select.placeholder")}</option>
                  {tenantSpaces.map((spaceOption) => (
                    <option key={spaceOption.id} value={spaceOption.id}>
                      {spaceOption.name}
                    </option>
                  ))}
                </Select>
              </FieldGroup>
              <FieldGroup label={text("knowledge.fields.spaceType")}>
                <Select value={spaceType} onChange={(event) => setSpaceType(event.target.value)}>
                  <option value="global">{text("common.knowledgeType.global")}</option>
                  <option value="team">{text("common.knowledgeType.team")}</option>
                  <option value="project">{text("common.knowledgeType.project")}</option>
                  <option value="agent_team">{text("common.knowledgeType.agentTeam")}</option>
                </Select>
              </FieldGroup>
                <FieldGroup label={text("knowledge.category.label")}>
                  <Select
                    value={knowledgeCategory}
                    onChange={(event) => setKnowledgeCategory(event.target.value as KnowledgeCategory)}
                  >
                  <option value="global">{text("knowledge.category.global")}</option>
                  <option value="domain">{text("knowledge.category.domain")}</option>
                  <option value="codebase">{text("knowledge.category.codebase")}</option>
                </Select>
              </FieldGroup>
              <FieldGroup label={text("knowledge.repositoryName")}>
                <Input
                  name="repositoryName"
                  defaultValue={space?.repositoryName ?? ""}
                  disabled={!isCodebaseKnowledgeCategory(knowledgeCategory)}
                  placeholder={text("knowledge.repositoryName.placeholder")}
                />
              </FieldGroup>
              <FieldGroup label={text("terminology.businessTeam")}>
                <Select value={businessTeamId} onChange={(event) => setBusinessTeamId(event.target.value)}>
                  <option value="">{text("common.select.placeholder")}</option>
                  {businessTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </Select>
              </FieldGroup>
              <FieldGroup label={text("terminology.agentTeam")}>
                <Select name="agentTeamId" disabled={spaceType !== "agent_team"} defaultValue={space?.agentTeamId ?? ""}>
                  <option value="">{text("common.select.none")}</option>
                  {availableAgentTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </Select>
              </FieldGroup>
              <FieldGroup label={text("knowledge.fields.projectKey")}>
                <Input name="projectKey" disabled={spaceType !== "project"} defaultValue={space?.projectKey ?? ""} placeholder={text("knowledge.fields.projectKey")} />
              </FieldGroup>
              <FieldGroup label={text("common.fields.visibility")}>
                <Select name="visibility" defaultValue={space?.visibility ?? (spaceType === "global" ? "global" : "team")}>
                  <option value="global">{text("labels.visibility.global")}</option>
                  <option value="team">{text("labels.visibility.team")}</option>
                  <option value="private">{text("labels.visibility.private")}</option>
                </Select>
              </FieldGroup>
              <FieldGroup label={text("common.fields.status")}>
                <Select name="status" defaultValue={space?.status ?? "active"}>
                  <option value="active">{text("labels.status.active")}</option>
                  <option value="paused">{text("labels.status.paused")}</option>
                  <option value="archived">{text("labels.status.archived")}</option>
                </Select>
              </FieldGroup>
            </div>
            <FieldGroup label={text("common.fields.description")}>
              <Textarea
                name="description"
                rows={4}
                defaultValue={space?.description}
                placeholder={text("common.placeholders.description")}
              />
            </FieldGroup>
            <FieldGroup label={text("knowledge.fields.retentionPolicy")}>
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
                  <div className="font-semibold">{text("knowledge.spaceForm.errors.saveFailed")}</div>
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
