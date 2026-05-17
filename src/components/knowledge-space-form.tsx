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
          {triggerLabel ?? (isEdit ? "ui.generated.ca7f814c0a4" : "ui.generated.ce8ee721172")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "ui.generated.cf0358f24e2" : "ui.generated.ce8ee721172"}</DialogTitle>
          <DialogDescription>
            ui.generated.c5a59ef27cc
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form action={submit} className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FieldGroup label="ui.generated.c1be7ae4fc2">
                <Input name="name" required defaultValue={space?.name} placeholder="ui.generated.cb96b5b40e4" />
              </FieldGroup>
              <FieldGroup label="ui.generated.c3537d5ef90">
                <Input name="slug" defaultValue={space?.slug} placeholder="payment-security" />
              </FieldGroup>
              <FieldGroup label="ui.generated.cf0346e5ccd">
                <Select value={spaceType} onChange={(event) => setSpaceType(event.target.value)}>
                  <option value="global">ui.generated.ca5644f4bbf</option>
                  <option value="team">ui.generated.c21d7042ff0</option>
                  <option value="project">ui.generated.c22336e6b89</option>
                  <option value="agent_team">ui.generated.c70f970c1fc</option>
                </Select>
              </FieldGroup>
              <FieldGroup label="ui.generated.c2b90028ff3">
                <Select value={businessTeamId} onChange={(event) => setBusinessTeamId(event.target.value)}>
                  {businessTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </Select>
              </FieldGroup>
              <FieldGroup label="ui.generated.c70f970c1fc">
                <Select name="agentTeamId" disabled={spaceType !== "agent_team"} defaultValue={space?.agentTeamId ?? ""}>
                  <option value="">ui.generated.c9a0ee40403</option>
                  {availableAgentTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </Select>
              </FieldGroup>
              <FieldGroup label="ui.generated.cc7e9d69ec3">
                <Input name="projectKey" disabled={spaceType !== "project"} defaultValue={space?.projectKey ?? ""} placeholder="group/project" />
              </FieldGroup>
              <FieldGroup label="ui.generated.c747b74cec9">
                <Select name="visibility" defaultValue={space?.visibility ?? (spaceType === "global" ? "global" : "team")}>
                  <option value="global">ui.generated.cdab54dd8bb</option>
                  <option value="team">ui.generated.c2fb77afec8</option>
                  <option value="private">ui.generated.c6858674b88</option>
                </Select>
              </FieldGroup>
              <FieldGroup label="ui.generated.c62e951a692">
                <Select name="status" defaultValue={space?.status ?? "active"}>
                  <option value="active">ui.generated.cd4e9ca3dd4</option>
                  <option value="paused">ui.generated.cd989e55188</option>
                  <option value="archived">ui.generated.cddfde75bec</option>
                </Select>
              </FieldGroup>
            </div>
            <FieldGroup label="ui.generated.c412f54dc38">
              <Textarea
                name="description"
                rows={4}
                defaultValue={space?.description}
                placeholder="ui.generated.c1bb4774122"
              />
            </FieldGroup>
            <FieldGroup label="ui.generated.c912c81fea0">
              <Textarea
                name="retentionPolicyJson"
                rows={4}
                defaultValue={space?.retentionPolicyJson ?? '{ "keepDays": 365 }'}
                placeholder='{ "keepDays": 365 }'
              />
            </FieldGroup>
            <div className="flex justify-end gap-2">
              <Button type="button" onClick={() => setOpen(false)}>
                ui.generated.c4d0b4688c7
              </Button>
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? "ui.generated.ca032e8fdda" : "ui.generated.cfadf24dbc5"}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
