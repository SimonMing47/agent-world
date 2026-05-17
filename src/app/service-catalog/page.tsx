import { Eye, PencilLine, Plus } from "lucide-react";
import { ServiceCatalogForm } from "@/components/admin-forms";
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
import { translateRecruitmentMode } from "@/lib/presentation";
import { formatPercent } from "@/lib/utils";
import { listAgentTeams, listServiceCatalogListings } from "@/server/queries";

function parseTags(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseResume(value: string) {
  try {
    return JSON.parse(value) as { successRate?: number; avgLatencyMs?: number; avgCostUsd?: number };
  } catch {
    return {};
  }
}

export default function ServiceCatalogPage() {
  const listings = listServiceCatalogListings();
  const agentTeams = listAgentTeams();
  const agentTeamOptions = agentTeams.map((team) => ({ id: team.id, name: team.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ui.generated.cab63588ee3"
        title="ui.generated.cab63588ee3"
        description="ui.generated.c7ca438661e"
        badges={[{ label: <>{listings.length} ui.common.count.catalogRecords</>, variant: "accent" }]}
      />

      <Panel>
        <PanelHeader
          eyebrow="ui.generated.c41e5243e2d"
          title="ui.generated.cab63588ee3"
          description="ui.generated.cec26938704"
          action={
            <Dialog>
              <DialogTrigger asChild><Button size="sm" variant="secondary"><Plus className="h-4 w-4" />ui.generated.cb8f0e2c5f3</Button></DialogTrigger>
              <DialogContent className="w-[min(94vw,820px)]">
                <DialogHeader><DialogTitle>ui.generated.caf01eae3e6</DialogTitle><DialogDescription>ui.generated.c171f1a2d76</DialogDescription></DialogHeader>
                <DialogBody>
                  <ServiceCatalogForm
                    agentTeams={agentTeamOptions}
                    listing={{
                      id: "",
                      teamId: agentTeams[0]?.id ?? "",
                      resumeJson: JSON.stringify({ successRate: 0.95, avgLatencyMs: 60000, avgCostUsd: 1 }, null, 2),
                      recruitmentMode: "request",
                      tagsJson: "[]",
                      status: "active",
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
                <DataTableHead>ui.generated.c70f970c1fc</DataTableHead>
                <DataTableHead>ui.generated.c9fe9e5c5bd</DataTableHead>
                <DataTableHead>ui.generated.cdf9dc72f2d</DataTableHead>
                <DataTableHead>ui.generated.c397236acf6</DataTableHead>
                <DataTableHead>ui.generated.cae0a7afece</DataTableHead>
                <DataTableHead>ui.generated.c62e951a692</DataTableHead>
                <DataTableHead align="right">ui.generated.cf3ea6d345e</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {listings.map((listing) => {
                const team = agentTeams.find((item) => item.id === listing.teamId);
                const resume = parseResume(listing.resumeJson);
                const tags = parseTags(listing.tagsJson);
                return (
                  <DataTableRow key={listing.id}>
                    <DataTableCell>
                      <div className="font-semibold text-[var(--ink)]">{team?.name ?? listing.teamId}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{listing.id}</div>
                    </DataTableCell>
                    <DataTableCell>{translateRecruitmentMode(listing.recruitmentMode)}</DataTableCell>
                    <DataTableCell>{formatPercent(resume.successRate ?? 0)}</DataTableCell>
                    <DataTableCell>{Math.round((resume.avgLatencyMs ?? 0) / 1000)}s</DataTableCell>
                    <DataTableCell>{tags.join(", ") || "ui.generated.c86f9195e25"}</DataTableCell>
                    <DataTableCell><Badge variant={listing.status === "active" ? "success" : "neutral"}>{listing.status}</Badge></DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><Eye className="h-4 w-4" />ui.generated.cf7acefd2d4</Button></DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>{team?.name ?? listing.teamId}</DialogTitle><DialogDescription>ui.generated.c683dfcb178</DialogDescription></DialogHeader>
                            <DialogBody><DefinitionList items={[{ label: "ui.generated.c3f46f7e4d5", value: listing.id }, { label: "ui.generated.c107b8b6db2", value: listing.resumeJson }, { label: "ui.generated.cae0a7afece", value: tags.join(", ") || "ui.generated.c72077749f7" }]} /></DialogBody>
                          </DialogContent>
                        </Dialog>
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><PencilLine className="h-4 w-4" />ui.generated.ca7f814c0a4</Button></DialogTrigger>
                          <DialogContent className="w-[min(94vw,820px)]">
                            <DialogHeader><DialogTitle>ui.generated.cbaada53331</DialogTitle><DialogDescription>{team?.name ?? listing.teamId}</DialogDescription></DialogHeader>
                            <DialogBody><ServiceCatalogForm agentTeams={agentTeamOptions} listing={listing} /></DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton endpoint="/api/service-catalog" id={listing.id} confirmKey="ui.common.confirm.deleteGeneric" confirmParams={{ resource: "ui.common.resources.serviceCatalogEntry" }} />
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
