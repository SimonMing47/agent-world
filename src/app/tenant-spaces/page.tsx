import { Eye, PencilLine, Plus } from "lucide-react";
import { TenantSpaceForm } from "@/components/admin-forms";
import { DeleteResourceButton } from "@/components/delete-resource-button";
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
import { DefinitionList } from "@/components/ui/definition-list";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { listBusinessTeams, listExecutionPolicies, listTenantSpaces } from "@/server/queries";

export default function TenantSpacesPage() {
  const tenantSpaces = listTenantSpaces();
  const businessTeams = listBusinessTeams();
  const executionPolicies = listExecutionPolicies();
  const policyOptions = executionPolicies.map((policy) => ({ id: policy.id, name: policy.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ui.generated.c3db35d2741"
        title="ui.generated.c3db35d2741"
        description="ui.generated.c20aad74d91"
        badges={[{ label: <>{tenantSpaces.length} ui.common.count.tenantSpaces</>, variant: "accent" }]}
      />

      <Panel>
        <PanelHeader
          eyebrow="ui.generated.c41e5243e2d"
          title="ui.generated.c876e95aa2c"
          description="ui.generated.cbd9a3fbb56"
          action={
            <Dialog>
              <DialogTrigger asChild><Button size="sm" variant="secondary"><Plus className="h-4 w-4" />ui.generated.ceed541bc43</Button></DialogTrigger>
              <DialogContent className="w-[min(94vw,900px)]">
                <DialogHeader><DialogTitle>ui.generated.c228c87ecd3</DialogTitle><DialogDescription>ui.generated.c004f7c0cda</DialogDescription></DialogHeader>
                <DialogBody>
                  <TenantSpaceForm
                    executionPolicies={policyOptions}
	                    tenantSpace={{
	                      id: "",
	                      slug: "",
	                      name: "",
	                      ownerUserId: "",
	                      status: "active",
	                      quotaLimitJson: "{}",
                      modelWhitelistJson: "[]",
                      globalGuardrailsJson: "{}",
                      defaultExecutionPolicyId: null,
                    }}
                  />
                </DialogBody>
              </DialogContent>
            </Dialog>
          }
        />
        <PanelBody className="p-0">
          <DataTable>
            <DataTableHeader>
              <DataTableRow className="hover:bg-transparent">
                <DataTableHead>ui.generated.ccc04fa896e</DataTableHead>
                <DataTableHead>ui.generated.c2b90028ff3</DataTableHead>
                <DataTableHead>ui.generated.c42dbbbccc8</DataTableHead>
                <DataTableHead>Owner</DataTableHead>
                <DataTableHead>ui.generated.c62e951a692</DataTableHead>
                <DataTableHead align="right">ui.generated.cf3ea6d345e</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {tenantSpaces.map((tenantSpace) => {
                const teamCount = businessTeams.filter((team) => team.tenantSpaceId === tenantSpace.id).length;
                const policy = executionPolicies.find((item) => item.id === tenantSpace.defaultExecutionPolicyId);
                return (
                  <DataTableRow key={tenantSpace.id}>
                    <DataTableCell>
                      <div className="font-semibold text-[var(--ink)]">{tenantSpace.name}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{tenantSpace.slug}</div>
                    </DataTableCell>
                    <DataTableCell>{teamCount}</DataTableCell>
                    <DataTableCell>{policy?.name ?? "ui.generated.c3bf179d8d0"}</DataTableCell>
                    <DataTableCell>{tenantSpace.ownerUserId}</DataTableCell>
                    <DataTableCell><Badge variant={tenantSpace.status === "active" ? "success" : "neutral"}>{tenantSpace.status}</Badge></DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><Eye className="h-4 w-4" />ui.generated.cf7acefd2d4</Button></DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>{tenantSpace.name}</DialogTitle><DialogDescription>ui.generated.cf3cb68d9f5</DialogDescription></DialogHeader>
                            <DialogBody>
                              <DefinitionList
                                items={[
                                  { label: "ui.generated.cf1799641bb", value: tenantSpace.id },
                                  { label: "ui.generated.c560ab47a63", value: tenantSpace.quotaLimitJson },
                                  { label: "ui.generated.c2a36e7056a", value: tenantSpace.modelWhitelistJson },
                                  { label: "Guardrails", value: tenantSpace.globalGuardrailsJson },
                                ]}
                              />
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><PencilLine className="h-4 w-4" />ui.generated.ca7f814c0a4</Button></DialogTrigger>
                          <DialogContent className="w-[min(94vw,900px)]">
                            <DialogHeader><DialogTitle>ui.generated.c827a0e1301</DialogTitle><DialogDescription>{tenantSpace.name}</DialogDescription></DialogHeader>
                            <DialogBody><TenantSpaceForm executionPolicies={policyOptions} tenantSpace={tenantSpace} /></DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton endpoint="/api/tenant-spaces" id={tenantSpace.id} confirmParams={{ resource: "ui.common.resources.tenantSpace", name: tenantSpace.name }} />
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
        </PanelBody>
      </Panel>
    </div>
  );
}
