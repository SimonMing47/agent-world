import { Eye, PencilLine, Plus } from "lucide-react";
import { AgentDefinitionForm } from "@/components/agent-definition-form";
import { DeleteResourceButton } from "@/components/delete-resource-button";
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
import { Panel, PanelHeader } from "@/components/ui/panel";
import { SummaryStrip } from "@/components/ui/summary-strip";
import { formatDateTime } from "@/lib/utils";
import { translateStatus, translateVisibility } from "@/lib/presentation";
import {
  buildAgentHarnessExecutionProfile,
  buildDefaultAgentHarnessConfig,
  buildDefaultAgentPermissionPolicy,
} from "@/server/agent-harness-core";
import { canAccessBusinessTeam, filterBusinessTeamsForAuthContext, getRequestAuthContext } from "@/server/auth-core";
import {
  listAgentDefinitions,
  listAgentDefinitionShares,
  listBusinessTeams,
  listProviders,
  listProviderRuntimeBindings,
} from "@/server/queries";

function parseStringArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export default async function AgentsPage() {
  const authContext = await getRequestAuthContext();
  const businessTeams = filterBusinessTeamsForAuthContext(listBusinessTeams(), authContext);
  const visibleBusinessTeamIds = new Set(businessTeams.map((team) => team.id));
  const shares = listAgentDefinitionShares().filter((share) => visibleBusinessTeamIds.has(share.businessTeamId));
  const sharedDefinitionIds = new Set(shares.map((share) => share.agentDefinitionId));
  const definitions = listAgentDefinitions().filter((definition) =>
    definition.visibility === "global" ||
    sharedDefinitionIds.has(definition.id) ||
    canAccessBusinessTeam(authContext, definition.ownerBusinessTeamId, { allowGlobal: true }),
  );
  const providers = listProviders();
  const runtimeBindings = listProviderRuntimeBindings().filter((binding) =>
    canAccessBusinessTeam(authContext, binding.businessTeamId, { allowGlobal: true }),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ui.generated.c5491ae865b"
        title="ui.generated.cc7b4185dbe"
        description="ui.generated.c69802baf5e"
        badges={[
          { label: <>{definitions.length} ui.common.count.agents</>, variant: "accent" },
          { label: <>{definitions.filter((item) => item.validationStatus === "passed").length} ui.generated.c923a1cdedd</>, variant: "neutral" },
        ]}
      />

      <SummaryStrip
        items={[
          {
            label: "ui.generated.c92d308d6fe",
            value: definitions.filter((item) => item.visibility === "personal").length,
            detail: "ui.generated.c1b6e57c2cc",
          },
          {
            label: "ui.generated.ce995c6b170",
            value: definitions.filter((item) => item.visibility === "team").length,
            detail: <>{shares.length} ui.generated.c3e2aa4cf66</>,
          },
          {
            label: "ui.generated.cdab54dd8bb",
            value: definitions.filter((item) => item.visibility === "global").length,
            detail: "ui.generated.c98604e091a",
          },
          {
            label: "ui.generated.c5200201ff3",
            value: runtimeBindings.length,
            detail: <>{providers.length} ui.common.detail.modelServicesForOptimization</>,
          },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="ui.generated.c41e5243e2d"
          title="ui.generated.cc7b4185dbe"
          description="ui.generated.c4e9fe80cb6"
          action={
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary">
                  <Plus className="h-4 w-4" />
                  ui.generated.c8c79a89d5a
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[min(94vw,980px)]">
                <DialogHeader>
                  <DialogTitle>ui.generated.c8c79a89d5a</DialogTitle>
                  <DialogDescription>ui.generated.c1931bbfbde</DialogDescription>
                </DialogHeader>
                <DialogBody>
                  <AgentDefinitionForm
                    embedded
	                    definition={{
	                      id: "",
	                      tenantSpaceId: "",
	                      ownerBusinessTeamId: null,
	                      ownerUserId: "",
	                      sourceAgentId: null,
	                      slug: "",
	                      name: "",
	                      role: "",
	                      description: "",
	                      systemPrompt: "",
	                      model: "",
	                      defaultProviderProfileId: null,
	                      defaultRuntimeBindingId: null,
                      toolBindingsJson: JSON.stringify([], null, 2),
                      harnessConfigJson: JSON.stringify(buildDefaultAgentHarnessConfig(), null, 2),
                      permissionPolicyJson: JSON.stringify(buildDefaultAgentPermissionPolicy(), null, 2),
                      memoryScope: "private",
                      tagsJson: JSON.stringify([], null, 2),
                      visibility: "personal",
                      status: "draft",
                      validationStatus: "untested",
                      lastValidatedAt: null,
                      lastValidationSummary: null,
                    }}
                    shareBusinessTeamIds={[]}
                    title="ui.generated.c8c79a89d5a"
                    businessTeamOptions={businessTeams.map((team) => ({ id: team.id, name: team.name }))}
                    providerOptions={providers.map((provider) => ({
                      id: provider.id,
                      name: provider.name,
                      defaultModel: provider.defaultModel,
                    }))}
                    runtimeBindingOptions={runtimeBindings.map((binding) => ({
                      id: binding.id,
                      name: binding.name,
                      defaultProviderProfileId: binding.defaultProviderProfileId,
                    }))}
                  />
                </DialogBody>
              </DialogContent>
            </Dialog>
          }
        />
        <div className="overflow-hidden rounded-b-2xl">
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Agent</DataTableHead>
                <DataTableHead>ui.generated.c53d4919c45</DataTableHead>
                <DataTableHead>ui.generated.c9e4e906aa5</DataTableHead>
                <DataTableHead>ui.generated.c747b74cec9</DataTableHead>
                <DataTableHead>ui.generated.c80144e2e73</DataTableHead>
                <DataTableHead>ui.generated.c093dea88c9</DataTableHead>
                <DataTableHead align="right">ui.generated.cf3ea6d345e</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {definitions.map((definition) => {
                const ownerTeam = businessTeams.find((team) => team.id === definition.ownerBusinessTeamId);
                const provider = providers.find((item) => item.id === definition.defaultProviderProfileId);
                const definitionShares = shares.filter((share) => share.agentDefinitionId === definition.id);
                const harnessProfile = buildAgentHarnessExecutionProfile(definition);
                const sharedTeamNames = definitionShares
                  .map((share) => businessTeams.find((team) => team.id === share.businessTeamId)?.name)
                  .filter(Boolean)
                  .join(", ");

                return (
                  <DataTableRow key={definition.id}>
                    <DataTableCell className="min-w-[260px]">
                      <div className="font-medium text-[var(--ink)]">{definition.name}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{definition.role} · {translateStatus(definition.status)}</div>
                    </DataTableCell>
                    <DataTableCell>
                      <div>{ownerTeam?.name ?? "ui.generated.c8c577dc72c"}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">
                        {sharedTeamNames ? `ui.common.shareToPrefix ${sharedTeamNames}` : "ui.generated.c82170fe0dd"}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <div>{provider?.name ?? "ui.generated.c89b342a06a"}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{definition.model}</div>
                    </DataTableCell>
                    <DataTableCell>{translateVisibility(definition.visibility)}</DataTableCell>
                    <DataTableCell>
                      <div>{translateStatus(definition.validationStatus)}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">
                        {definition.lastValidatedAt ? formatDateTime(definition.lastValidatedAt) : "ui.generated.c088eff165e"}
                      </div>
                    </DataTableCell>
                    <DataTableCell>{formatDateTime(definition.updatedAt)}</DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex items-center justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <Eye className="h-4 w-4" />
                              ui.generated.cf7acefd2d4
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-[min(92vw,880px)]">
                            <DialogHeader>
                              <DialogTitle>{definition.name}</DialogTitle>
                              <DialogDescription>ui.generated.c953946d326</DialogDescription>
                            </DialogHeader>
                            <DialogBody className="space-y-5">
                              <DefinitionList
                                items={[
                                  { label: "ui.generated.c6b26695e4d", value: definition.role },
                                  { label: "ui.generated.c53d4919c45", value: ownerTeam?.name ?? "ui.generated.c8c577dc72c" },
                                  { label: "ui.generated.c747b74cec9", value: translateVisibility(definition.visibility) },
                                  { label: "ui.generated.c98fd0cbd9c", value: definition.model },
                                  { label: "ui.generated.cbc56f948bb", value: provider?.name ?? "ui.generated.c3bf179d8d0" },
                                  { label: "ui.generated.ce9ec85920b", value: translateStatus(definition.validationStatus) },
                                ]}
                              />
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-[var(--ink)]">ui.generated.ce5d671f7b9</div>
                                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 text-sm leading-6 text-[var(--ink)]">
                                  {definition.description || "ui.generated.c287a1d1034"}
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-[var(--ink)]">ui.generated.c1842230316</div>
                                <pre className="max-h-[280px] overflow-auto whitespace-pre-wrap rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4 text-xs leading-5 text-[var(--ink)]">
                                  {definition.systemPrompt}
                                </pre>
                              </div>
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-[var(--ink)]">ui.generated.c9b167bacc3</div>
                                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 text-sm leading-6 text-[var(--ink)]">
                                  ui.generated.cf15b273f4a {harnessProfile.approvalMode}
                                  <br />
                                  ui.generated.c2a4d7b8890 {harnessProfile.thinkingLevel}
                                  <br />
                                  ui.generated.cd914e78ca4 {harnessProfile.humanIntervention}
                                  <br />
                                  ui.generated.c297fff5fbc {harnessProfile.repositoryAccess}
                                  <br />
                                  ui.generated.c05cee285a8 {harnessProfile.memoryAccess}
                                  <br />
                                  ui.generated.c986fc1c379 {harnessProfile.secretAccess}
                                  <br />
                                  ui.generated.cbddd8368fb {harnessProfile.allowedToolNames.join(", ") || "ui.generated.c04b1918949"}
                                  <br />
                                  ui.generated.ce7244d9bb0 {harnessProfile.deniedToolNames.join(", ") || "ui.generated.c72077749f7"}
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-[var(--ink)]">ui.generated.cef6487371a</div>
                                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 text-sm leading-6 text-[var(--ink)]">
                                  ui.generated.cf7bb5ad4da {parseStringArray(definition.toolBindingsJson).join(", ") || "ui.generated.c63595e95b7"}
                                  <br />
                                  ui.generated.c0f1b4aa04e {parseStringArray(definition.tagsJson).join(", ") || "ui.generated.c63595e95b7"}
                                  <br />
                                  ui.generated.c1fc32e6a0b {sharedTeamNames || "ui.generated.c82170fe0dd"}
                                </div>
                              </div>
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
                          <DialogContent className="w-[min(94vw,980px)]">
                            <DialogHeader>
                              <DialogTitle>ui.generated.c9489407cf3</DialogTitle>
                              <DialogDescription>{definition.name}</DialogDescription>
                            </DialogHeader>
                            <DialogBody>
                              <AgentDefinitionForm
                                embedded
                                definition={definition}
                                shareBusinessTeamIds={definitionShares.map((share) => share.businessTeamId)}
                                title={definition.name}
                                businessTeamOptions={businessTeams.map((team) => ({ id: team.id, name: team.name }))}
                                providerOptions={providers.map((provider) => ({
                                  id: provider.id,
                                  name: provider.name,
                                  defaultModel: provider.defaultModel,
                                }))}
                                runtimeBindingOptions={runtimeBindings.map((binding) => ({
                                  id: binding.id,
                                  name: binding.name,
                                  defaultProviderProfileId: binding.defaultProviderProfileId,
                                }))}
                              />
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton endpoint="/api/agent-definitions" id={definition.id} confirmParams={{ resource: "ui.common.resources.agent", name: definition.name }} />
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
