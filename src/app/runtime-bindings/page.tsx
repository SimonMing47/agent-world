import { Eye, PencilLine, Plus } from "lucide-react";
import { DeleteResourceButton } from "@/components/delete-resource-button";
import { PageHeader } from "@/components/page-header";
import { ProviderRuntimeBindingForm } from "@/components/provider-runtime-binding-form";
import { SecretValue } from "@/components/secret-field";
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
import { translateWithPack } from "@/lib/language-pack";
import { getActiveLanguagePack } from "@/server/language-pack-store";
import { getSettingsSnapshot } from "@/server/queries";

function parseConfig(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function stringField(value: unknown, fallback = "ui.common.unconfigured") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function eventContractLabel(value: unknown) {
  const text = stringField(value, "agent_event_v1");
  return text === "provider_event_v1" ? "agent_event_v1" : text;
}

function defaultBinding() {
  return {
    id: "",
    tenantSpaceId: "",
    businessTeamId: null,
    adapterDefinitionId: "",
    name: "",
    runtimeKind: "agentworld",
    baseUrl: "",
    command: "",
    workspaceRoot: "",
    defaultProviderProfileId: null,
    apiKeyRef: "",
    configJson: JSON.stringify(
      {
        defaultModel: "",
        approvalMode: "ask",
        eventContract: "agent_event_v1",
        env: {},
      },
      null,
      2,
    ),
    isEnabled: 1,
  };
}

export default function RuntimeBindingsPage() {
  const languagePack = getActiveLanguagePack();
  const t = (key: string, fallback?: string, params?: Record<string, string | number>) =>
    translateWithPack(languagePack, key, fallback, params);
  const snapshot = getSettingsSnapshot();
  const tenantSpaceOptions = snapshot.tenantSpaces.map((space) => ({ id: space.id, name: space.name }));
  const providerOptions = snapshot.providers.map((provider) => ({ id: provider.id, name: provider.name }));
  const adapterOptions = snapshot.providerAdapters.map((adapter) => ({ id: adapter.id, name: adapter.name }));
  const businessTeamOptions = snapshot.businessTeams.map((team) => ({ id: team.id, name: team.name }));
  const initialBinding = {
    ...defaultBinding(),
    tenantSpaceId: "",
    adapterDefinitionId: "",
    businessTeamId: null,
    defaultProviderProfileId: null,
    workspaceRoot: process.cwd(),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ui.generated.c8e175e7aa9"
        title="ui.generated.c94a82a5175"
        description="ui.generated.c88de2a0e95"
        badges={[
          { label: `${snapshot.providerRuntimeBindings.length} ${t("ui.common.count.runtimeBindings")}`, variant: "accent" },
          { label: `${t("ui.common.enabled")} ${snapshot.providerRuntimeBindings.filter((binding) => binding.isEnabled === 1).length}`, variant: "success" },
        ]}
      />

      <SummaryStrip
        items={[
          { label: "ui.generated.c8e175e7aa9", value: snapshot.providerRuntimeBindings.length, detail: "ui.generated.c3085c2ee04" },
          { label: "ui.generated.cd4e9ca3dd4", value: snapshot.providerRuntimeBindings.filter((item) => item.isEnabled === 1).length, detail: "ui.generated.c275a6c1da0" },
          { label: "ui.generated.cbc56f948bb", value: snapshot.providers.length, detail: "ui.generated.c1fce38c440" },
          { label: "ui.generated.cf08c028338", value: snapshot.providerRuntimeBindings.filter((item) => item.businessTeamId).length, detail: "ui.generated.ccbe2181e31" },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="ui.generated.cf69030e339"
          title="ui.generated.c547e66fd76"
          description="ui.generated.c10067c4263"
          action={
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary">
                  <Plus className="h-4 w-4" />
                  {t("ui.generated.c189e8fb772")}
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[min(96vw,980px)]">
                <DialogHeader>
                  <DialogTitle>{t("ui.generated.c189e8fb772")}</DialogTitle>
                  <DialogDescription>{t("ui.generated.cf3fd2c809a")}</DialogDescription>
                </DialogHeader>
                <DialogBody>
                  <ProviderRuntimeBindingForm
                    embedded
                    title={t("ui.generated.c189e8fb772")}
                    tenantSpaceOptions={tenantSpaceOptions}
                    providerOptions={providerOptions}
                    adapterOptions={adapterOptions}
                    businessTeamOptions={businessTeamOptions}
                    binding={initialBinding}
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
                <DataTableHead>{t("ui.generated.c8e175e7aa9")}</DataTableHead>
                <DataTableHead>{t("ui.generated.c26f30fd79b")}</DataTableHead>
                <DataTableHead>{t("ui.generated.cbff226d7bb")}</DataTableHead>
                <DataTableHead>{t("ui.generated.c86e118291e")}</DataTableHead>
                <DataTableHead>{t("ui.generated.c62e951a692")}</DataTableHead>
                <DataTableHead align="right">{t("ui.generated.cf3ea6d345e")}</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {snapshot.providerRuntimeBindings.map((binding) => {
                const businessTeam = snapshot.businessTeams.find((item) => item.id === binding.businessTeamId);
                const provider = snapshot.providers.find((item) => item.id === binding.defaultProviderProfileId);
                const config = parseConfig(binding.configJson);
                return (
                  <DataTableRow key={binding.id}>
                    <DataTableCell>
                      <div className="font-semibold text-[var(--ink)]">{binding.name}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{binding.id}</div>
                    </DataTableCell>
                    <DataTableCell>{businessTeam?.name ?? "ui.generated.ce0523a661c"}</DataTableCell>
                    <DataTableCell>
                      <div>{provider?.name ?? "ui.generated.c3bf179d8d0"}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{stringField(config.defaultModel, provider?.defaultModel ?? "ui.generated.c63595e95b7")}</div>
                    </DataTableCell>
                    <DataTableCell className="max-w-[280px] truncate">{binding.baseUrl || "ui.generated.c09ceea7644"}</DataTableCell>
                    <DataTableCell>
                      <Badge variant={binding.isEnabled === 1 ? "success" : "neutral"}>{binding.isEnabled === 1 ? "ui.generated.cd4e9ca3dd4" : "ui.generated.cd989e55188"}</Badge>
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
                          <DialogContent className="w-[min(96vw,920px)]">
                            <DialogHeader>
                              <DialogTitle>{binding.name}</DialogTitle>
                              <DialogDescription>ui.generated.c31cb42e527</DialogDescription>
                            </DialogHeader>
                            <DialogBody>
                              <DefinitionList
                                columnsClassName="sm:grid-cols-2"
                                items={[
                                  { label: "ID", value: binding.id },
                                  { label: "ui.generated.c3db35d2741", value: binding.tenantSpaceId },
                                  { label: "ui.generated.c2b90028ff3", value: businessTeam?.name ?? "ui.generated.ce0523a661c" },
                                  { label: "ui.generated.cbff226d7bb", value: provider?.name ?? "ui.generated.c3bf179d8d0" },
                                  { label: "ui.generated.cb5bff31cdd", value: stringField(config.defaultModel, provider?.defaultModel ?? "ui.generated.c63595e95b7") },
                                  { label: "API Key", value: <SecretValue value={binding.apiKeyRef || provider?.apiKeyRef || ""} /> },
                                  { label: "ui.generated.c1072712e57", value: stringField(config.approvalMode, "ask") },
                                  { label: "ui.generated.cc07c5b925e", value: eventContractLabel(config.eventContract) },
                                  { label: "ui.generated.c86e118291e", value: binding.baseUrl || "ui.generated.c09ceea7644" },
                                  { label: "ui.generated.c1ea645dd58", value: binding.command || "ui.generated.c09ceea7644" },
                                  { label: "ui.generated.c42dfc81f99", value: binding.workspaceRoot || "." },
                                  { label: "ui.generated.cc066260025", value: <pre className="whitespace-pre-wrap font-mono text-xs">{binding.configJson}</pre> },
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
                              <DialogTitle>ui.generated.ca14179b9ec</DialogTitle>
                              <DialogDescription>{binding.name}</DialogDescription>
                            </DialogHeader>
                            <DialogBody>
                              <ProviderRuntimeBindingForm
                                embedded
                                title="ui.generated.ca14179b9c6"
                                tenantSpaceOptions={tenantSpaceOptions}
                                providerOptions={providerOptions}
                                adapterOptions={adapterOptions}
                                businessTeamOptions={businessTeamOptions}
                                binding={binding}
                              />
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton
                          endpoint="/api/provider-runtime-bindings"
                          id={binding.id}
                          confirmParams={{ resource: "ui.common.resources.runtimeBinding", name: binding.name }}
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
