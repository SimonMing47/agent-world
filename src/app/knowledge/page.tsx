import { BookOpen, Database, Eye, Layers3, RefreshCcw } from "lucide-react";
import { DeleteResourceButton } from "@/components/delete-resource-button";
import { KnowledgeEntryForm } from "@/components/knowledge-entry-form";
import { KnowledgeSpaceForm } from "@/components/knowledge-space-form";
import { PageHeader } from "@/components/page-header";
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
import { listKnowledgeSpaceBindings, listKnowledgeSpaces } from "@/server/knowledge-core";
import { getKnowledgeManagementSnapshot } from "@/server/openviking-core";
import { listAgentTeams, listBusinessTeams, listTenantSpaces } from "@/server/queries";

function syncStatusLabel(status: string) {
  if (status.startsWith("remote_")) return "ui.generated.c90c4dd94ff";
  if (status === "local_shadow") return "ui.generated.c76fb7df6ca";
  if (status === "remote_failed_local_shadow") return "ui.generated.c0a16be860e";
  return "ui.generated.c59a9eb4e65";
}

function typeLabel(type: string) {
  const labels: Record<string, string> = {
    global: "ui.common.knowledgeType.global",
    team: "ui.common.knowledgeType.team",
    project: "ui.common.knowledgeType.project",
    agent_team: "ui.common.knowledgeType.agentTeam",
  };
  return labels[type] ?? type;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    active: "labels.status.active",
    paused: "labels.status.paused",
    archived: "labels.status.archived",
  };
  return labels[status] ?? status;
}

export default async function KnowledgePage() {
  const [snapshot, spaces, bindings, tenantSpaces, businessTeams, agentTeams] = await Promise.all([
    getKnowledgeManagementSnapshot(),
    Promise.resolve(listKnowledgeSpaces()),
    Promise.resolve(listKnowledgeSpaceBindings()),
    Promise.resolve(listTenantSpaces()),
    Promise.resolve(listBusinessTeams()),
    Promise.resolve(listAgentTeams()),
  ]);
  const bindingCountBySpace = new Map<string, number>();
  bindings.forEach((binding) => {
    bindingCountBySpace.set(binding.knowledgeSpaceId, (bindingCountBySpace.get(binding.knowledgeSpaceId) ?? 0) + 1);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ui.generated.c1dda51f9e3"
        title="ui.generated.c55187c9a79"
        description="ui.generated.c002f982018"
        badges={[
          { label: snapshot.health.ok ? "ui.generated.c2fb717af8a" : "ui.generated.c7ee98bc9ac", variant: snapshot.health.ok ? "success" : "warning" },
          { label: <>{spaces.length} ui.common.count.knowledgeSpaces</>, variant: "accent" },
        ]}
        action={
          <KnowledgeSpaceForm
            tenantSpaces={tenantSpaces.map((space) => ({ id: space.id, name: space.name }))}
            businessTeams={businessTeams.map((team) => ({ id: team.id, name: team.name, tenantSpaceId: team.tenantSpaceId }))}
            agentTeams={agentTeams.map((team) => ({ id: team.id, businessTeamId: team.businessTeamId, name: team.name }))}
          />
        }
      />

      <Panel>
        <PanelBody className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <BookOpen className="h-4 w-4" />
              OpenViking
            </div>
            <div className="mt-2 text-sm text-[var(--ink-muted)]">Base URL: {snapshot.health.baseUrl}</div>
            <div className="mt-1 text-sm text-[var(--ink-muted)]">ui.generated.c3790e079bc {snapshot.process.status}</div>
            <div className="mt-1 text-sm text-[var(--ink-muted)]">ui.generated.cf4e22993c4 {snapshot.health.error ?? "healthy"}</div>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <Layers3 className="h-4 w-4" />
              ui.generated.c7d405cc6a6
            </div>
            <div className="mt-2 text-3xl font-semibold text-[var(--ink)]">{spaces.length}</div>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <Database className="h-4 w-4" />
              ui.generated.c8cacb5b9c6
            </div>
            <div className="mt-2 text-3xl font-semibold text-[var(--ink)]">{snapshot.entries.length}</div>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <RefreshCcw className="h-4 w-4" />
              ui.generated.cdf3feabe70
            </div>
            <div className="mt-2 text-3xl font-semibold text-[var(--ink)]">{snapshot.tree.length}</div>
            <div className="mt-1 text-sm text-[var(--ink-muted)]">ui.generated.c8cd084f41b</div>
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          eyebrow="ui.generated.c7d405cc6a6"
          title="ui.generated.ce3ed1093be"
          description="ui.generated.c5a21e9a932"
        />
        <DataTable>
          <DataTableHeader>
            <DataTableRow>
              <DataTableHead>ui.generated.c1be7ae4fc2</DataTableHead>
              <DataTableHead>ui.generated.ce4e46c7235</DataTableHead>
              <DataTableHead>ui.generated.c747b74cec9</DataTableHead>
              <DataTableHead>ui.generated.c62e951a692</DataTableHead>
              <DataTableHead>ui.generated.c6aed7c48be</DataTableHead>
              <DataTableHead>OpenViking URI</DataTableHead>
              <DataTableHead>ui.generated.cf3ea6d345e</DataTableHead>
            </DataTableRow>
          </DataTableHeader>
          <DataTableBody>
            {spaces.map((space) => (
              <DataTableRow key={space.id}>
                <DataTableCell className="min-w-56">
                  <div className="font-semibold text-[var(--ink)]">{space.name}</div>
                  <div className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">{space.description}</div>
                </DataTableCell>
                <DataTableCell>{typeLabel(space.spaceType)}</DataTableCell>
                <DataTableCell>{space.visibility}</DataTableCell>
                <DataTableCell>{statusLabel(space.status)}</DataTableCell>
                <DataTableCell>{bindingCountBySpace.get(space.id) ?? 0}</DataTableCell>
                <DataTableCell className="max-w-[520px] break-all font-mono text-xs">{space.vikingUri}</DataTableCell>
                <DataTableCell>
                  <div className="flex flex-wrap gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Eye className="h-4 w-4" />
                          ui.generated.c4f55ee1e68
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="w-[min(92vw,920px)]">
                        <DialogHeader>
                          <DialogTitle>{space.name}</DialogTitle>
                          <DialogDescription>ui.generated.cf310de54cd</DialogDescription>
                        </DialogHeader>
                        <DialogBody>
                          <DefinitionList
                            columnsClassName="sm:grid-cols-2"
                            items={[
                              { label: "ID", value: space.id },
                              { label: "ui.generated.c3537d5ef90", value: space.slug },
                              { label: "ui.generated.ce4e46c7235", value: typeLabel(space.spaceType) },
                              { label: "ui.generated.c62e951a692", value: statusLabel(space.status) },
                              { label: "ui.generated.c2b90028ff3", value: space.businessTeamId ?? "ui.generated.c3bf179d8d0" },
                              { label: "ui.generated.c70f970c1fc", value: space.agentTeamId ?? "ui.generated.c3bf179d8d0" },
                              { label: "ui.generated.cc7e9d69ec3", value: space.projectKey ?? "ui.generated.c3bf179d8d0" },
                              { label: "ui.generated.c747b74cec9", value: space.visibility },
                              { label: "OpenViking URI", value: <span className="break-all font-mono text-xs">{space.vikingUri}</span> },
                              {
                                label: "ui.generated.c85f64b078a",
                                value: <pre className="whitespace-pre-wrap break-all font-mono text-xs">{space.retentionPolicyJson}</pre>,
                              },
                              { label: "ui.generated.c412f54dc38", value: space.description || "ui.generated.c287a1d1034" },
                              { label: "ui.generated.c093dea88c9", value: space.updatedAt },
                            ]}
                          />
                        </DialogBody>
                      </DialogContent>
                    </Dialog>
                    <KnowledgeSpaceForm
                      tenantSpaces={tenantSpaces.map((tenantSpace) => ({ id: tenantSpace.id, name: tenantSpace.name }))}
                      businessTeams={businessTeams.map((team) => ({ id: team.id, name: team.name, tenantSpaceId: team.tenantSpaceId }))}
                      agentTeams={agentTeams.map((team) => ({ id: team.id, businessTeamId: team.businessTeamId, name: team.name }))}
                      space={space}
                      triggerLabel="ui.generated.ca7f814c0a4"
                    />
                    <DeleteResourceButton
                      endpoint="/api/knowledge/spaces"
                      id={space.id}
                      confirmParams={{ resource: "ui.common.resources.knowledgeSpace", name: space.name }}
                    />
                  </div>
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      </Panel>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel>
          <PanelHeader
            eyebrow="ui.generated.ce4646dec8a"
            title="ui.generated.c58f961e5b0"
            description="ui.generated.cb4a0357968"
          />
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Skill</DataTableHead>
                <DataTableHead>ui.generated.c7895e237ab</DataTableHead>
                <DataTableHead>ui.generated.c62e951a692</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {snapshot.skills.map((skill) => (
                <DataTableRow key={skill.id}>
                  <DataTableCell>
                    <div className="font-semibold text-[var(--ink)]">{skill.name}</div>
                    <div className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">{skill.description}</div>
                  </DataTableCell>
                  <DataTableCell>{skill.layer}</DataTableCell>
                  <DataTableCell>{skill.isEnabled ? "ui.generated.cd4e9ca3dd4" : "ui.generated.cd989e55188"}</DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="ui.generated.c181a01d0ff"
            title="ui.generated.cc564c51011"
            description="ui.generated.c4e810ba2c6"
            action={
              <KnowledgeEntryForm
                spaces={spaces.map((space) => ({ id: space.id, name: space.name }))}
                triggerLabel="ui.generated.c1880d5bbcc"
              />
            }
          />
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>ui.generated.c4e5f90ffeb</DataTableHead>
                <DataTableHead>ui.generated.ce88ab5ba61</DataTableHead>
                <DataTableHead>URI</DataTableHead>
                <DataTableHead>ui.generated.cf3ea6d345e</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {snapshot.entries.map((entry) => (
                <DataTableRow key={entry.id}>
                  <DataTableCell>
                    <div className="font-semibold text-[var(--ink)]">{entry.title}</div>
                    <div className="mt-1 text-xs text-[var(--ink-muted)]">{entry.sourceType}</div>
                  </DataTableCell>
                  <DataTableCell>{syncStatusLabel(entry.syncStatus)}</DataTableCell>
                  <DataTableCell className="max-w-[360px] break-all font-mono text-xs">{entry.vikingUri}</DataTableCell>
                  <DataTableCell>
                    <div className="flex flex-wrap gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="ghost">
                            <Eye className="h-4 w-4" />
                            ui.generated.cf7acefd2d4
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="w-[min(96vw,980px)]">
                          <DialogHeader>
                            <DialogTitle>{entry.title}</DialogTitle>
                            <DialogDescription>ui.generated.cc2bf8ea701</DialogDescription>
                          </DialogHeader>
                          <DialogBody className="space-y-5">
                            <DefinitionList
                              columnsClassName="sm:grid-cols-2"
                              items={[
                                { label: "ID", value: entry.id },
                                { label: "ui.generated.c7d405cc6a6", value: entry.knowledgeSpaceId ?? "ui.generated.c055d4cbe55" },
                                { label: "ui.generated.c7895e237ab", value: entry.layer },
                                { label: "Scope", value: entry.scopeKey },
                                { label: "ui.generated.cc63f79e636", value: entry.sourceType },
                                { label: "ui.generated.ce88ab5ba61", value: syncStatusLabel(entry.syncStatus) },
                                { label: "OpenViking URI", value: <span className="break-all font-mono text-xs">{entry.vikingUri}</span> },
                                {
                                  label: "ui.generated.cdb9e375556",
                                  value: <pre className="whitespace-pre-wrap break-all font-mono text-xs">{entry.metadataJson}</pre>,
                                },
                              ]}
                            />
                            <pre className="max-h-[420px] overflow-auto rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4 text-xs leading-5 text-[var(--ink-muted)]">
                              {entry.contentMd}
                            </pre>
                          </DialogBody>
                        </DialogContent>
                      </Dialog>
                      <KnowledgeEntryForm
                        spaces={spaces.map((space) => ({ id: space.id, name: space.name }))}
                        entry={entry}
                        triggerLabel="ui.generated.ca7f814c0a4"
                      />
                      <DeleteResourceButton
                        endpoint="/api/knowledge/entries"
                        id={entry.id}
                        confirmParams={{ resource: "ui.common.resources.knowledgeEntry", name: entry.title }}
                      />
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </Panel>
      </section>
    </div>
  );
}
