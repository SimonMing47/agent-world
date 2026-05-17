import { Eye, PencilLine, Plus } from "lucide-react";
import { DeleteResourceButton } from "@/components/delete-resource-button";
import { ExecutionEnvironmentForm } from "@/components/execution-environment-form";
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
import { listBusinessTeams, listExecutionEnvironments } from "@/server/queries";

function defaultEnvironment(businessTeamId: string) {
  return {
    id: "",
    businessTeamId,
    name: "",
    repositoryProvider: "git",
    repositoryName: "repository-name",
    repositoryUrl: "git@example.com:team/repository.git",
    defaultBranch: "main",
    executorRef: "repo-executor",
    privateKeyRef: "secret:repo_executor_key",
    workingDirectory: ".",
    sandboxProfileJson: "{}",
    memoryLayerRefsJson: "[]",
    visibility: "team",
    status: "active",
  };
}

export default function EnvironmentsPage() {
  const environments = listExecutionEnvironments();
  const businessTeams = listBusinessTeams();
  const businessTeamOptions = businessTeams.map((team) => ({ id: team.id, name: team.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ui.generated.c059d73c843"
        title="ui.generated.c78f16f104a"
        description="ui.generated.c4f49ffd119"
        badges={[
          { label: <>{environments.length} ui.common.count.environments</>, variant: "accent" },
          { label: <>ui.common.enabled {environments.filter((environment) => environment.status === "active").length}</>, variant: "success" },
        ]}
      />

      <SummaryStrip
        items={[
          { label: "ui.generated.c059d73c843", value: environments.length, detail: "ui.generated.cd4a9762202" },
          { label: "ui.generated.ceb737abfde", value: new Set(environments.map((item) => item.repositoryProvider)).size, detail: "ui.generated.ced3a8ff513" },
          { label: "ui.generated.cab3ddf8bc3", value: new Set(environments.map((item) => item.businessTeamId)).size, detail: "ui.generated.c6d71c1c189" },
          { label: "ui.generated.cd4e9ca3dd4", value: environments.filter((item) => item.status === "active").length, detail: "ui.generated.c50dcb9f196" },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="ui.generated.c41e5243e2d"
          title="ui.generated.ce83d3c873e"
          description="ui.generated.c5d0996ca77"
          action={
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary">
                  <Plus className="h-4 w-4" />
                  ui.generated.c839137597d
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[min(96vw,980px)]">
                <DialogHeader>
                  <DialogTitle>ui.generated.c8eb6887e31</DialogTitle>
                  <DialogDescription>ui.generated.c5491a77b28</DialogDescription>
                </DialogHeader>
                <DialogBody>
                  <ExecutionEnvironmentForm
                    embedded
                    title="ui.generated.c8eb6887e31"
                    businessTeamOptions={businessTeamOptions}
                    environment={defaultEnvironment(businessTeams[0]?.id ?? "")}
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
                <DataTableHead>ui.generated.caa3833ea2a</DataTableHead>
                <DataTableHead>ui.generated.c2b90028ff3</DataTableHead>
                <DataTableHead>ui.generated.c6aa9ff908e</DataTableHead>
                <DataTableHead>ui.generated.cd09d9c1c45</DataTableHead>
                <DataTableHead>ui.generated.c62e951a692</DataTableHead>
                <DataTableHead align="right">ui.generated.cf3ea6d345e</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {environments.map((environment) => {
                const team = businessTeams.find((item) => item.id === environment.businessTeamId);
                return (
                  <DataTableRow key={environment.id}>
                    <DataTableCell>
                      <div className="font-semibold text-[var(--ink)]">{environment.name}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{environment.id}</div>
                    </DataTableCell>
                    <DataTableCell>{team?.name ?? "ui.generated.c3bf179d8d0"}</DataTableCell>
                    <DataTableCell>
                      <div>{environment.repositoryProvider} · {environment.repositoryName}</div>
                      <div className="mt-1 max-w-[360px] truncate text-xs text-[var(--ink-muted)]">{environment.repositoryUrl}</div>
                    </DataTableCell>
                    <DataTableCell>
                      <div>{environment.executorRef}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{environment.workingDirectory}</div>
                    </DataTableCell>
                    <DataTableCell>
                      <Badge variant={environment.status === "active" ? "success" : "neutral"}>{environment.status}</Badge>
                    </DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <Eye className="h-4 w-4" />
                              ui.generated.cf7acefd2d4
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-[min(96vw,940px)]">
                            <DialogHeader>
                              <DialogTitle>{environment.name}</DialogTitle>
                              <DialogDescription>ui.generated.c26c7cd97dc</DialogDescription>
                            </DialogHeader>
                            <DialogBody>
                              <DefinitionList
                                columnsClassName="sm:grid-cols-2"
                                items={[
                                  { label: "ID", value: environment.id },
                                  { label: "ui.generated.c2b90028ff3", value: team?.name ?? "ui.generated.c3bf179d8d0" },
                                  { label: "ui.generated.ceb737abfde", value: environment.repositoryProvider },
                                  { label: "ui.generated.c6aa9ff908e", value: environment.repositoryName },
                                  { label: "ui.generated.c6b470c4670", value: environment.repositoryUrl },
                                  { label: "ui.generated.cdc900d83b2", value: environment.defaultBranch },
                                  { label: "ui.generated.c8f6cc6defa", value: environment.executorRef },
                                  { label: "ui.generated.cbcd76068cd", value: environment.privateKeyRef },
                                  { label: "ui.generated.c42dfc81f99", value: environment.workingDirectory },
                                  { label: "ui.generated.c747b74cec9", value: environment.visibility },
                                  { label: "ui.generated.c5403cce910", value: <pre className="whitespace-pre-wrap font-mono text-xs">{environment.sandboxProfileJson}</pre> },
                                  { label: "ui.generated.c658825a4b4", value: <pre className="whitespace-pre-wrap font-mono text-xs">{environment.memoryLayerRefsJson}</pre> },
                                ]}
                              />
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <PencilLine className="h-4 w-4" />
                              ui.generated.ca7f814c0a4
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-[min(96vw,980px)]">
                            <DialogHeader>
                              <DialogTitle>ui.generated.c8540fc5589</DialogTitle>
                              <DialogDescription>{environment.name}</DialogDescription>
                            </DialogHeader>
                            <DialogBody>
                              <ExecutionEnvironmentForm
                                embedded
                                title="ui.generated.c8540fc5589"
                                businessTeamOptions={businessTeamOptions}
                                environment={environment}
                              />
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton
                          endpoint="/api/environments"
                          id={environment.id}
                          confirmParams={{ resource: "ui.common.resources.environment", name: environment.name }}
                        />
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
