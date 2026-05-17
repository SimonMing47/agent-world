"use client";

import { useMemo, useState } from "react";
import { PencilLine, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
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
};

type AgentTeamOption = {
  id: string;
  businessTeamId: string;
  name: string;
};

type KnowledgeSpaceValue = {
  id: string;
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
  businessTeams,
  agentTeams,
  space,
  triggerLabel,
}: {
  businessTeams: BusinessTeamOption[];
  agentTeams: AgentTeamOption[];
  space?: KnowledgeSpaceValue;
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const isEdit = Boolean(space?.id);
  const initialBusinessTeamId =
    space?.businessTeamId ??
    agentTeams.find((team) => team.id === space?.agentTeamId)?.businessTeamId ??
    businessTeams[0]?.id ??
    "";
  const [spaceType, setSpaceType] = useState(space?.spaceType ?? "team");
  const [businessTeamId, setBusinessTeamId] = useState(initialBusinessTeamId);
  const availableAgentTeams = useMemo(
    () => agentTeams.filter((team) => !businessTeamId || team.businessTeamId === businessTeamId),
    [agentTeams, businessTeamId],
  );

  async function submit(formData: FormData) {
    setPending(true);
    try {
      const response = await fetch("/api/knowledge/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_space",
          id: space?.id,
          name: String(formData.get("name") ?? ""),
          slug: String(formData.get("slug") ?? ""),
          spaceType,
          businessTeamId: spaceType === "global" ? null : businessTeamId || null,
          agentTeamId: spaceType === "agent_team" ? String(formData.get("agentTeamId") ?? "") || null : null,
          projectKey: spaceType === "project" ? String(formData.get("projectKey") ?? "") || null : null,
          description: String(formData.get("description") ?? ""),
          visibility: String(formData.get("visibility") ?? "team"),
          status: String(formData.get("status") ?? "active"),
          retentionPolicyJson: String(formData.get("retentionPolicyJson") ?? "{}"),
        }),
      });
      if (!response.ok) throw new Error("save failed");
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={isEdit ? "secondary" : "primary"} size={isEdit ? "sm" : "md"}>
          {isEdit ? <PencilLine className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {triggerLabel ?? (isEdit ? "编辑" : "新增知识空间")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑知识空间" : "新增知识空间"}</DialogTitle>
          <DialogDescription>
            为业务团队、项目或 AgentTeam 创建 OpenViking URI 空间，并自动写入访问绑定。
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form action={submit} className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FieldGroup label="名称">
                <Input name="name" required defaultValue={space?.name} placeholder="例如：支付项目安全知识" />
              </FieldGroup>
              <FieldGroup label="标识">
                <Input name="slug" defaultValue={space?.slug} placeholder="payment-security" />
              </FieldGroup>
              <FieldGroup label="空间类型">
                <Select value={spaceType} onChange={(event) => setSpaceType(event.target.value)}>
                  <option value="global">全局</option>
                  <option value="team">团队</option>
                  <option value="project">项目</option>
                  <option value="agent_team">AgentTeam</option>
                </Select>
              </FieldGroup>
              <FieldGroup label="业务团队">
                <Select value={businessTeamId} onChange={(event) => setBusinessTeamId(event.target.value)}>
                  {businessTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </Select>
              </FieldGroup>
              <FieldGroup label="AgentTeam">
                <Select name="agentTeamId" disabled={spaceType !== "agent_team"} defaultValue={space?.agentTeamId ?? ""}>
                  <option value="">不绑定</option>
                  {availableAgentTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </Select>
              </FieldGroup>
              <FieldGroup label="项目 Key">
                <Input name="projectKey" disabled={spaceType !== "project"} defaultValue={space?.projectKey ?? ""} placeholder="group/project" />
              </FieldGroup>
              <FieldGroup label="可见性">
                <Select name="visibility" defaultValue={space?.visibility ?? (spaceType === "global" ? "global" : "team")}>
                  <option value="global">全局可见</option>
                  <option value="team">团队可见</option>
                  <option value="private">私有</option>
                </Select>
              </FieldGroup>
              <FieldGroup label="状态">
                <Select name="status" defaultValue={space?.status ?? "active"}>
                  <option value="active">启用</option>
                  <option value="paused">停用</option>
                  <option value="archived">归档</option>
                </Select>
              </FieldGroup>
            </div>
            <FieldGroup label="描述">
              <Textarea
                name="description"
                rows={4}
                defaultValue={space?.description}
                placeholder="说明这个空间保存哪些规范、历史经验、项目上下文或 Skill。"
              />
            </FieldGroup>
            <FieldGroup label="保留策略 JSON">
              <Textarea
                name="retentionPolicyJson"
                rows={4}
                defaultValue={space?.retentionPolicyJson ?? '{ "keepDays": 365 }'}
                placeholder='{ "keepDays": 365 }'
              />
            </FieldGroup>
            <div className="flex justify-end gap-2">
              <Button type="button" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? "保存中" : "保存"}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
