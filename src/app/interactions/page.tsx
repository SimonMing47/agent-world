import Link from "next/link";
import { Eye, Plus } from "lucide-react";
import { DeleteResourceButton } from "@/components/delete-resource-button";
import { RuntimeSessionCreateForm } from "@/components/runtime-session-create-form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
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
import { Panel, PanelHeader } from "@/components/ui/panel";
import { SummaryStrip } from "@/components/ui/summary-strip";
import { translateSessionMode, translateStatus } from "@/lib/presentation";
import { formatDateTime } from "@/lib/utils";
import {
  listAgentDefinitions,
  listAgentTeams,
  listProviders,
  listProviderRuntimeBindings,
  listTenantSpaces,
  listBusinessTeams,
} from "@/server/queries";
import { listRuntimeSessions } from "@/server/runtime-session-core";

function statusVariant(status: string): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (status === "running") return "accent";
  if (status === "error") return "danger";
  if (status === "idle") return "neutral";
  return "success";
}

export default function RuntimeInteractionsPage() {
  const runtimeSessions = listRuntimeSessions();
  const runtimeBindings = listProviderRuntimeBindings();
  const providerProfiles = listProviders();
  const agentTeams = listAgentTeams();
  const agentDefinitions = listAgentDefinitions();
  const tenantSpaceId = listTenantSpaces()[0]?.id ?? "";
  const businessTeamId = listBusinessTeams()[0]?.id ?? "";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ui.generated.cd7d45d4eb7"
        title="ui.generated.cd7d45d4eb7"
        description="ui.generated.c923f90e11b"
        badges={[
          { label: <>{runtimeSessions.length} ui.common.count.sessions</>, variant: "accent" },
          { label: <>{providerProfiles.length} ui.common.count.modelServices</>, variant: "neutral" },
        ]}
      />

      <SummaryStrip
        items={[
          {
            label: "ui.generated.c4d72abd2e9",
            value: runtimeSessions.length,
            detail: <>{runtimeSessions.filter((session) => session.status === "running").length} ui.common.detail.running</>,
          },
          {
            label: "ui.generated.c6f6a995823",
            value: runtimeSessions.filter((session) => session.mode === "agent_team").length,
            detail: "ui.generated.c2f7aaafef2",
          },
          {
            label: "ui.generated.c8e175e7aa9",
            value: runtimeBindings.length,
            detail: <>{providerProfiles.length} ui.common.detail.modelServicesSelectable</>,
          },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="ui.generated.c592ea605ec"
          title="ui.generated.c4e71e7bdab"
          description="ui.generated.c6dc32bec15"
          action={
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary">
                  <Plus className="h-4 w-4" />
                  ui.generated.c3da224c43d
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[min(92vw,860px)]">
                <DialogHeader>
                  <DialogTitle>ui.generated.c200cb4b94a</DialogTitle>
                  <DialogDescription>ui.generated.cfb9ea35772</DialogDescription>
                </DialogHeader>
                <DialogBody>
                  <RuntimeSessionCreateForm
                    tenantSpaceId={tenantSpaceId}
                    businessTeamId={businessTeamId}
                    runtimeBindings={runtimeBindings}
                    providerProfiles={providerProfiles}
                    agentTeams={agentTeams.map((team) => ({ id: team.id, name: team.name }))}
                    agentDefinitions={agentDefinitions.map((definition) => ({
                      id: definition.id,
                      name: definition.name,
                      systemPrompt: definition.systemPrompt,
                      model: definition.model,
                      defaultProviderProfileId: definition.defaultProviderProfileId,
                      defaultRuntimeBindingId: definition.defaultRuntimeBindingId,
                      harnessConfigJson: definition.harnessConfigJson,
                      permissionPolicyJson: definition.permissionPolicyJson,
                    }))}
                  />
                </DialogBody>
              </DialogContent>
            </Dialog>
          }
        />
        <div className="overflow-hidden rounded-b-lg">
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>ui.generated.c836ffe0e10</DataTableHead>
                <DataTableHead>ui.generated.ced0eea8f20</DataTableHead>
                <DataTableHead>ui.generated.c8e175e7aa9</DataTableHead>
                <DataTableHead>ui.generated.c98fd0cbd9c</DataTableHead>
                <DataTableHead>ui.generated.c62e951a692</DataTableHead>
                <DataTableHead>ui.generated.c093dea88c9</DataTableHead>
                <DataTableHead align="right">ui.generated.cf3ea6d345e</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {runtimeSessions.map((session) => {
                const runtime = runtimeBindings.find((binding) => binding.id === session.runtimeBindingId);
                return (
                  <DataTableRow key={session.id}>
                    <DataTableCell className="min-w-[220px]">
                      <div className="font-medium text-[var(--ink)]">{session.title}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{session.id}</div>
                    </DataTableCell>
                    <DataTableCell>{translateSessionMode(session.mode)}</DataTableCell>
                    <DataTableCell>{runtime?.name ?? "ui.generated.c53215c3826"}</DataTableCell>
                    <DataTableCell>{session.model}</DataTableCell>
                    <DataTableCell>
                      <Badge variant={statusVariant(session.status)}>{translateStatus(session.status)}</Badge>
                    </DataTableCell>
                    <DataTableCell>{formatDateTime(session.updatedAt)}</DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/interactions/${session.id}`}>
                          <Button size="sm" variant="ghost">
                            <Eye className="h-4 w-4" />
                            ui.generated.c65fc81e161
                          </Button>
                        </Link>
                        <DeleteResourceButton
                          endpoint={`/api/runtime-sessions/${session.id}`}
                          id={session.id}
                          confirmParams={{ resource: "ui.common.resources.session", name: session.title }}
                        />
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
        </div>
      </Panel>
    </div>
  );
}
