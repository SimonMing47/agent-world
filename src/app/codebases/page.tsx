import { Eye, KeyRound, PencilLine, Plus } from "lucide-react";
import { CodebaseForm, CodebaseTokenForm } from "@/components/admin-forms";
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
import { SummaryStrip } from "@/components/ui/summary-strip";
import { filterBusinessTeamsForAuthContext, getRequestAuthContext } from "@/server/auth-core";
import { listCodebaseOperatorTokens, listCodebases } from "@/server/governance-core";
import { listBusinessTeams } from "@/server/queries";

function parsePermissions(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export default async function CodebasesPage() {
  const authContext = await getRequestAuthContext();
  const businessTeams = filterBusinessTeamsForAuthContext(listBusinessTeams(), authContext);
  const visibleBusinessTeamIds = new Set(businessTeams.map((team) => team.id));
  const codebases = listCodebases().filter((codebase) => visibleBusinessTeamIds.has(codebase.businessTeamId));
  const visibleCodebaseIds = new Set(codebases.map((codebase) => codebase.id));
  const tokens = listCodebaseOperatorTokens().filter((token) => visibleCodebaseIds.has(token.codebaseId));
  const teamOptions = businessTeams.map((team) => ({ id: team.id, name: team.name }));
  const codebaseOptions = codebases.map((codebase) => ({ id: codebase.id, name: codebase.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ui.common.resources.codebase"
        title="nav.codebases.label"
        description="nav.codebases.description"
        badges={[
          { label: <>{codebases.length} ui.common.count.codebases</>, variant: "accent" },
          { label: <>{tokens.length} ui.common.count.operatorTokens</>, variant: "neutral" },
        ]}
      />

      <SummaryStrip
        items={[
          { label: "ui.generated.c6aa9ff908e", value: codebases.length, detail: "ui.generated.ce7d7e6fb44" },
          { label: "ui.generated.ceb6a4c1fc5", value: tokens.length, detail: "ui.generated.c304f9507d7" },
          { label: "ui.generated.ceb737abfde", value: new Set(codebases.map((item) => item.provider)).size, detail: "ui.generated.ced3a8ff513" },
          { label: "ui.generated.c18841769e8", value: codebases.filter((item) => item.status === "active").length, detail: "ui.generated.c420e2e48b1" },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="ui.common.resources.codebase"
          title="ui.common.resources.codebase"
          description="nav.codebases.description"
          action={
            <div className="flex gap-2">
              <Dialog>
                <DialogTrigger asChild><Button size="sm" variant="secondary"><Plus className="h-4 w-4" />ui.generated.cb9ce6e9e28</Button></DialogTrigger>
                <DialogContent className="w-[min(94vw,860px)]">
                  <DialogHeader><DialogTitle>ui.generated.cb9ce6e9e28</DialogTitle><DialogDescription>ui.generated.c2885f37214</DialogDescription></DialogHeader>
                  <DialogBody>
                    <CodebaseForm
                      businessTeams={teamOptions}
	                      codebase={{
	                        id: "",
	                        businessTeamId: "",
	                        name: "",
	                        provider: "",
	                        repositoryUrl: "",
	                        defaultBranch: "",
	                        visibility: "team",
                        description: "",
                        status: "active",
                      }}
                    />
                  </DialogBody>
                </DialogContent>
              </Dialog>
              <Dialog>
                <DialogTrigger asChild><Button size="sm" variant="ghost"><KeyRound className="h-4 w-4" />ui.generated.cacba33e6e9</Button></DialogTrigger>
                <DialogContent className="w-[min(94vw,760px)]">
                  <DialogHeader><DialogTitle>ui.generated.c9e88be3a04</DialogTitle><DialogDescription>ui.generated.c3fe1856f77</DialogDescription></DialogHeader>
                  <DialogBody>
                    <CodebaseTokenForm
                      codebases={codebaseOptions}
	                      token={{
	                        id: "",
	                        codebaseId: "",
	                        operatorName: "",
	                        tokenRef: "",
	                        role: "",
                        permissionJson: "[]",
                        status: "active",
                      }}
                    />
                  </DialogBody>
                </DialogContent>
              </Dialog>
            </div>
          }
        />
        <PanelBody className="p-0">
          <DataTable>
            <DataTableHeader>
              <DataTableRow className="hover:bg-transparent">
                <DataTableHead>Codebase</DataTableHead>
                <DataTableHead>ui.generated.c53d4919c45</DataTableHead>
                <DataTableHead>ui.generated.c7875541d2a</DataTableHead>
                <DataTableHead>ui.generated.cffb50d3878</DataTableHead>
                <DataTableHead>ui.generated.c62e951a692</DataTableHead>
                <DataTableHead align="right">ui.generated.cf3ea6d345e</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {codebases.map((codebase) => {
                const team = businessTeams.find((item) => item.id === codebase.businessTeamId);
                const codebaseTokens = tokens.filter((token) => token.codebaseId === codebase.id);
                return (
                  <DataTableRow key={codebase.id}>
                    <DataTableCell className="min-w-[280px]">
                      <div className="font-semibold text-[var(--ink)]">{codebase.name}</div>
                      <div className="mt-1 break-all text-xs text-[var(--ink-muted)]">{codebase.repositoryUrl}</div>
                    </DataTableCell>
                    <DataTableCell>{team?.name ?? "ui.generated.c718c1c03d6"}</DataTableCell>
                    <DataTableCell>{codebase.provider} / {codebase.defaultBranch}</DataTableCell>
                    <DataTableCell>{codebaseTokens.length}</DataTableCell>
                    <DataTableCell><Badge variant={codebase.status === "active" ? "success" : "neutral"}>{codebase.status}</Badge></DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><Eye className="h-4 w-4" />ui.generated.cf7acefd2d4</Button></DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>{codebase.name}</DialogTitle><DialogDescription>ui.generated.ce30ec19b62</DialogDescription></DialogHeader>
                            <DialogBody className="space-y-5">
                              <DefinitionList
                                items={[
                                  { label: "ID", value: codebase.id },
                                  { label: "ui.generated.c21d7042ff0", value: team?.name ?? "ui.generated.c718c1c03d6" },
                                  { label: "ui.generated.ce4b9d69486", value: codebase.provider },
                                  { label: "ui.generated.c67d2d7970f", value: codebase.repositoryUrl },
                                  { label: "ui.generated.cdc900d83b2", value: codebase.defaultBranch },
                                  { label: "ui.generated.c747b74cec9", value: codebase.visibility },
                                  { label: "ui.generated.c412f54dc38", value: codebase.description || "ui.generated.c72077749f7" },
                                ]}
                              />
                              <DataTable>
                                <DataTableHeader><DataTableRow><DataTableHead>ui.generated.cffb50d3878</DataTableHead><DataTableHead>ui.generated.c6b26695e4d</DataTableHead><DataTableHead>ui.generated.c560165a6d7</DataTableHead><DataTableHead align="right">ui.generated.cf3ea6d345e</DataTableHead></DataTableRow></DataTableHeader>
                                <DataTableBody>
                                  {codebaseTokens.map((token) => (
                                    <DataTableRow key={token.id}>
                                      <DataTableCell>{token.operatorName}</DataTableCell>
                                      <DataTableCell>{token.role}</DataTableCell>
                                      <DataTableCell>{parsePermissions(token.permissionJson).join(", ")}</DataTableCell>
                                      <DataTableCell align="right">
                                        <div className="flex justify-end gap-2">
                                          <Dialog>
                                            <DialogTrigger asChild><Button size="sm" variant="ghost"><PencilLine className="h-4 w-4" />ui.generated.ca7f814c0a4</Button></DialogTrigger>
                                            <DialogContent className="w-[min(94vw,760px)]">
                                              <DialogHeader><DialogTitle>ui.generated.c30f0f85786</DialogTitle><DialogDescription>{token.operatorName}</DialogDescription></DialogHeader>
                                              <DialogBody><CodebaseTokenForm codebases={codebaseOptions} token={token} /></DialogBody>
                                            </DialogContent>
                                          </Dialog>
                                          <DeleteResourceButton endpoint="/api/codebases" id={token.id} body={{ entity: "token" }} confirmParams={{ resource: "ui.common.resources.operatorToken", name: token.operatorName }} />
                                        </div>
                                      </DataTableCell>
                                    </DataTableRow>
                                  ))}
                                </DataTableBody>
                              </DataTable>
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><PencilLine className="h-4 w-4" />ui.generated.ca7f814c0a4</Button></DialogTrigger>
                          <DialogContent className="w-[min(94vw,860px)]">
                            <DialogHeader><DialogTitle>ui.generated.cf29f4e82c3</DialogTitle><DialogDescription>{codebase.name}</DialogDescription></DialogHeader>
                            <DialogBody><CodebaseForm businessTeams={teamOptions} codebase={codebase} /></DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton endpoint="/api/codebases" id={codebase.id} confirmParams={{ resource: "ui.common.resources.codebase", name: codebase.name }} />
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
