import { Eye, PencilLine, Plus } from "lucide-react";
import { DeleteResourceButton } from "@/components/delete-resource-button";
import { PageHeader } from "@/components/page-header";
import { ProviderProfileForm } from "@/components/provider-profile-form";
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
import { getSettingsSnapshot } from "@/server/queries";
import { getActiveLanguagePack } from "@/server/language-pack-store";

function parseModels(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function visibleConfig(value: string) {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return {
      contextWindow: parsed.contextWindow ?? "ui.generated.c63595e95b7",
      maxTokens: parsed.maxTokens ?? "ui.generated.c63595e95b7",
      reasoning: parsed.reasoning === false ? "ui.generated.c6c14bd7f6f" : "ui.generated.c256783b7d4",
      headers: parsed.headers && typeof parsed.headers === "object" ? Object.keys(parsed.headers).length : 0,
    };
  } catch {
    return { contextWindow: "ui.common.unconfigured", maxTokens: "ui.common.unconfigured", reasoning: "ui.common.unknown", headers: 0 };
  }
}

function EnabledBadge({ enabled }: { enabled: boolean | number }) {
  return <Badge variant={enabled ? "success" : "neutral"}>{enabled ? "ui.generated.cd4e9ca3dd4" : "ui.generated.cd989e55188"}</Badge>;
}

export default function AiProvidersPage() {
  const languagePack = getActiveLanguagePack();
  const t = (key: string, fallback?: string, params?: Record<string, string | number>) =>
    translateWithPack(languagePack, key, fallback, params);
  const snapshot = getSettingsSnapshot();
  const tenantSpaceOptions = snapshot.tenantSpaces.map((space) => ({ id: space.id, name: space.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ui.common.resources.providerProfile"
        title="ui.common.resources.providerProfile"
        description="nav.runtimes.description"
        badges={[
          { label: `${snapshot.providers.length} ${t("ui.common.count.interfaces")}`, variant: "accent" },
          { label: `${t("ui.common.enabled")} ${snapshot.providers.filter((provider) => provider.isEnabled).length}`, variant: "success" },
        ]}
      />

      <SummaryStrip
        items={[
          {
            label: "ui.generated.cbc56f948bb",
            value: snapshot.providers.length,
            detail: "ui.generated.cc75203f125",
          },
          {
            label: "ui.generated.c5259359017",
            value: snapshot.providers.filter((provider) => provider.isEnabled).length,
            detail: "ui.generated.c672435e94c",
          },
          {
            label: "ui.generated.c8c11ccde55",
            value: snapshot.providers.reduce((total, provider) => total + parseModels(provider.modelsJson).length, 0),
            detail: "ui.generated.c47b7783e98",
          },
          {
            label: "ui.generated.c2b90028ff3",
            value: snapshot.businessTeams.length,
            detail: "ui.generated.c242dd41d77",
          },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="ui.common.resources.providerProfile"
          title="ui.common.resources.providerProfile"
          description="nav.runtimes.description"
          action={
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary">
                  <Plus className="h-4 w-4" />
                  {t("ui.generated.ccaf3f1f123")}
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[min(94vw,860px)]">
                <DialogHeader>
                  <DialogTitle>{t("ui.generated.ccaf3f1f123")}</DialogTitle>
                  <DialogDescription>{t("ui.generated.cb112cd2d2f")}</DialogDescription>
                </DialogHeader>
                <DialogBody>
	                  <ProviderProfileForm
	                    embedded
	                    tenantSpaceOptions={tenantSpaceOptions}
	                    provider={{
	                      id: "",
	                      tenantSpaceId: "",
	                      name: "",
	                      baseUrl: "",
	                      apiStyle: "",
	                      defaultModel: "",
	                      modelsJson: "[]",
	                      apiKeyRef: "",
	                      configJson: "{}",
	                      isEnabled: 1,
	                    }}
                    title={t("ui.generated.ccaf3f1f123")}
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
                <DataTableHead>{t("ui.generated.cbc56f948bb")}</DataTableHead>
                <DataTableHead>{t("ui.generated.c269a00cd6b")}</DataTableHead>
                <DataTableHead>{t("ui.generated.cb5bff31cdd")}</DataTableHead>
                <DataTableHead>{t("ui.generated.cecde946b92")}</DataTableHead>
                <DataTableHead>{t("ui.generated.ceb9d53ce7f")}</DataTableHead>
                <DataTableHead>{t("ui.generated.c62e951a692")}</DataTableHead>
                <DataTableHead align="right">{t("ui.generated.cf3ea6d345e")}</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {snapshot.providers.map((provider) => {
                const models = parseModels(provider.modelsJson);
                const config = visibleConfig(provider.configJson);
                return (
                  <DataTableRow key={provider.id}>
                    <DataTableCell className="min-w-[260px]">
                      <div className="font-semibold text-[var(--ink)]">{provider.name}</div>
                      <div className="mt-1 break-all text-xs text-[var(--ink-muted)]">{provider.baseUrl}</div>
                    </DataTableCell>
                    <DataTableCell>{provider.apiStyle}</DataTableCell>
                    <DataTableCell>{provider.defaultModel}</DataTableCell>
                    <DataTableCell>{models.length}</DataTableCell>
                    <DataTableCell>
                      <div className="text-sm text-[var(--ink)]">{`${t("ui.generated.caa23f730d0")} ${t(String(config.reasoning), String(config.reasoning))}`}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">Headers {config.headers}</div>
                    </DataTableCell>
                    <DataTableCell>
                      <EnabledBadge enabled={provider.isEnabled} />
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
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{provider.name}</DialogTitle>
                              <DialogDescription>ui.generated.cc971194a05</DialogDescription>
                            </DialogHeader>
                            <DialogBody className="space-y-5">
                              <DefinitionList
                                items={[
                                  { label: "ui.generated.cde113b23ab", value: provider.id },
                                  { label: "ui.generated.c269a00cd6b", value: provider.apiStyle },
                                  { label: "Base URL", value: provider.baseUrl },
                                  { label: "ui.generated.cb5bff31cdd", value: provider.defaultModel },
                                  { label: "API Key", value: <SecretValue value={provider.apiKeyRef} /> },
                                  { label: "ui.generated.c9a1fbe0bb9", value: String(config.contextWindow) },
                                  { label: "ui.generated.ca21133348e", value: String(config.maxTokens) },
                                  { label: "ui.generated.c62e951a692", value: provider.isEnabled ? "ui.generated.cd4e9ca3dd4" : "ui.generated.cd989e55188" },
                                ]}
                              />
                              <div className="flex flex-wrap gap-2">
                                {models.map((model) => (
                                  <Badge key={model} variant="neutral">
                                    {model}
                                  </Badge>
                                ))}
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
                          <DialogContent className="w-[min(94vw,860px)]">
                            <DialogHeader>
                              <DialogTitle>ui.generated.c011ab1fecd</DialogTitle>
                              <DialogDescription>{provider.name}</DialogDescription>
                            </DialogHeader>
                            <DialogBody>
	                              <ProviderProfileForm
	                                embedded
	                                tenantSpaceOptions={tenantSpaceOptions}
	                                provider={provider}
	                                title={provider.name}
	                              />
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton endpoint="/api/provider-profiles" id={provider.id} confirmParams={{ resource: "ui.common.resources.providerProfile", name: provider.name }} />
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
