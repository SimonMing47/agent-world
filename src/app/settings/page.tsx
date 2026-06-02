import Link from "next/link";
import { KnowledgeBaseSettingsForm } from "@/components/knowledge-base-settings-form";
import { LanguagePackSettingsForm } from "@/components/language-pack-settings-form";
import { PageHeader } from "@/components/page-header";
import {
  SettingsCollapsiblePanel,
  SettingsConfigLayout,
  type SettingsNavItem,
} from "@/components/settings-config-layout";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import { SummaryStrip } from "@/components/ui/summary-strip";
import { translateWithPack } from "@/lib/language-pack";
import { getKnowledgeBaseSettings, getOpenVikingModelDefaults } from "@/server/knowledge-base-settings";
import { getActiveLanguagePack } from "@/server/language-pack-store";
import { getSettingsSnapshot } from "@/server/queries";

const systemEntries = [
  {
    name: "ui.common.resources.languagePack",
    href: "#language-pack",
    group: "ui.generated.c918a0a7cf1",
    scope: "ui.generated.c71d6a654d0",
    description: "ui.generated.c8f35d729e3",
  },
  {
    name: "settings.knowledge.title",
    href: "#knowledge-base",
    group: "ui.generated.c918a0a7cf1",
    scope: "OpenViking",
    description: "settings.knowledge.description",
  },
  {
    name: "ui.common.resources.providerProfile",
    href: "/runtimes",
    group: "ui.generated.cfad8b39e99",
    scope: "ui.generated.cbc56f948bb",
    description: "nav.runtimes.description",
  },
  {
    name: "nav.skills.label",
    href: "/skills",
    group: "ui.generated.cfad8b39e99",
    scope: "ui.generated.c51d7485af0",
    description: "nav.skills.description",
  },
  {
    name: "nav.mcp.label",
    href: "/mcp",
    group: "ui.generated.cfad8b39e99",
    scope: "ui.generated.c04935ddca3",
    description: "nav.mcp.description",
  },
  {
    name: "nav.connectors.label",
    href: "/connectors",
    group: "ui.generated.cfad8b39e99",
    scope: "ui.generated.c25b04ef9ba",
    description: "nav.connectors.description",
  },
  {
    name: "nav.codebases.label",
    href: "/codebases",
    group: "ui.generated.cfad8b39e99",
    scope: "ui.generated.ca650a73ddc",
    description: "nav.codebases.description",
  },
  {
    name: "nav.knowledge.label",
    href: "/knowledge",
    group: "ui.generated.cfad8b39e99",
    scope: "OpenViking",
    description: "nav.knowledge.description",
  },
  {
    name: "identityAccess.page.title",
    href: "/identity-access",
    group: "ui.generated.cfad8b39e99",
    scope: "identityAccess.scope.label",
    description: "identityAccess.page.description",
  },
  {
    name: "ui.common.resources.runtimeBinding",
    href: "/runtime-bindings",
    group: "ui.generated.c2e03739792",
    scope: "ui.generated.c9aed77b291",
    description: "ui.generated.c686b86b156",
  },
  {
    name: "ui.common.resources.environment",
    href: "/environments",
    group: "ui.generated.c2e03739792",
    scope: "ui.generated.cfcdc5822f5",
    description: "ui.generated.ca4cd3470c9",
  },
  {
    name: "Webhook",
    href: "/webhooks",
    group: "ui.generated.c2e03739792",
    scope: "ui.generated.c3ba8e6fc8e",
    description: "ui.generated.cc9448416c2",
  },
  {
    name: "ui.common.resources.executionPolicy",
    href: "/execution-policies",
    group: "ui.generated.c2e03739792",
    scope: "ui.generated.c5c65475044",
    description: "ui.generated.ccb9d6e36ae",
  },
  {
    name: "ui.common.resources.tenantSpace",
    href: "/tenant-spaces",
    group: "ui.generated.c2e03739792",
    scope: "ui.generated.c6de3899374",
    description: "ui.generated.c97534db4ce",
  },
  {
    name: "ui.common.resources.serviceCatalogEntry",
    href: "/service-catalog",
    group: "ui.generated.c2e03739792",
    scope: "ui.generated.c3024908881",
    description: "ui.generated.c03071850af",
  },
  {
    name: "ui.common.resources.accessGrant",
    href: "/access-grants",
    group: "ui.generated.c2e03739792",
    scope: "ui.generated.c5e5e2bb0e4",
    description: "ui.generated.c75a71e8955",
  },
];

const systemEntryGroups = ["ui.generated.c918a0a7cf1", "ui.generated.cfad8b39e99", "ui.generated.c2e03739792"] as const;

const systemGroupPanels: Record<typeof systemEntryGroups[number], {
  id: string;
  title: string;
  description: string;
}> = {
	  "ui.generated.c918a0a7cf1": {
	    id: "general-settings",
	    title: "settings.groups.general.title",
	    description: "settings.groups.general.description",
	  },
	  "ui.generated.cfad8b39e99": {
	    id: "resource-settings",
	    title: "settings.groups.resources.title",
	    description: "settings.groups.resources.description",
	  },
	  "ui.generated.c2e03739792": {
	    id: "runtime-governance-settings",
	    title: "settings.groups.runtime.title",
	    description: "settings.groups.runtime.description",
	  },
};

const settingsNavItems: SettingsNavItem[] = [
	  {
	    id: "knowledge-base",
	    label: "settings.knowledge.title",
	    description: "settings.nav.knowledge.description",
	    meta: "OpenViking",
	  },
	  {
	    id: "language-pack",
	    label: "ui.common.resources.languagePack",
	    description: "settings.nav.language.description",
	    meta: "settings.meta.language",
	  },
	  {
	    id: "general-settings",
	    label: "settings.groups.general.title",
	    description: "settings.nav.general.description",
	  },
	  {
	    id: "resource-settings",
	    label: "settings.groups.resources.title",
	    description: "settings.nav.resource.description",
	  },
	  {
	    id: "runtime-governance-settings",
	    label: "settings.groups.runtime.title",
	    description: "settings.nav.runtime.description",
  },
];

export default function SettingsPage() {
  const languagePack = getActiveLanguagePack();
  const t = (key: string, fallback?: string, params?: Record<string, string | number>) =>
    translateWithPack(languagePack, key, fallback, params);
  const snapshot = getSettingsSnapshot();
  const knowledgeBaseSetting = getKnowledgeBaseSettings();
  const openVikingModelDefaults = getOpenVikingModelDefaults();
  const localizedSettingsNavItems = settingsNavItems.map((item) => ({
    ...item,
    label: t(item.label),
    description: item.description ? t(item.description) : undefined,
    meta: item.meta ? t(item.meta) : undefined,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("ui.generated.c3c71dca8a0")}
        title={t("ui.generated.c3c71dca8a0")}
        description={t("ui.generated.cb2d089ae22")}
        badges={[
          { label: `${snapshot.providers.length} ${t("ui.common.count.modelServices")}`, variant: "accent" },
          { label: `${snapshot.environments.length} ${t("ui.common.count.environments")}`, variant: "neutral" },
          { label: knowledgeBaseSetting.provider === "openviking" ? "OpenViking" : knowledgeBaseSetting.provider, variant: "neutral" },
        ]}
      />

      <SummaryStrip
        items={[
          { label: t("ui.generated.cbc56f948bb"), value: snapshot.providers.length, detail: t("ui.generated.c3ecb393f86") },
          { label: t("ui.generated.c059d73c843"), value: snapshot.environments.length, detail: t("ui.generated.cfcdc5822f5") },
          { label: "Webhook", value: snapshot.webhooks.length, detail: t("ui.generated.c3ba8e6fc8e") },
          { label: t("ui.generated.c971c6e5190"), value: snapshot.taskBlueprints.length, detail: t("ui.generated.c26f30fd79b") },
        ]}
      />

      <SettingsConfigLayout items={localizedSettingsNavItems}>
	        <SettingsCollapsiblePanel
	          id="knowledge-base"
	          eyebrow={t("settings.general.system")}
	          title={t("settings.knowledge.title")}
	          description={t("settings.knowledge.panelDescription")}
	          meta="OpenViking"
        >
          <KnowledgeBaseSettingsForm
            setting={knowledgeBaseSetting}
            modelDefaults={openVikingModelDefaults}
            providerOptions={snapshot.providers.map((provider) => ({
              id: provider.id,
              name: provider.name,
              apiStyle: provider.apiStyle,
              baseUrl: provider.baseUrl,
              defaultModel: provider.defaultModel,
              apiKeyRef: provider.apiKeyRef,
              configJson: provider.configJson,
              isEnabled: provider.isEnabled,
            }))}
          />
        </SettingsCollapsiblePanel>

        <SettingsCollapsiblePanel
          id="language-pack"
          eyebrow={t("ui.generated.c918a0a7cf1")}
	          title={t("ui.generated.ce13af2e292")}
	          description={t("ui.generated.c2ef0fab9c9")}
	          meta={t("settings.meta.language")}
        >
          <LanguagePackSettingsForm setting={snapshot.languagePackSetting} />
        </SettingsCollapsiblePanel>

        {systemEntryGroups.map((group) => {
          const panel = systemGroupPanels[group];

          return (
            <SettingsCollapsiblePanel
              key={group}
              id={panel.id}
              eyebrow={t("ui.generated.cf84ec364a6")}
              title={t(panel.title)}
              description={t(panel.description)}
              bodyClassName="p-0"
            >
              <DataTable>
                <DataTableHeader>
                  <DataTableRow className="hover:bg-transparent">
                    <DataTableHead>{t("ui.generated.cc1bebd4ab3")}</DataTableHead>
                    <DataTableHead>{t("ui.generated.c785b52eb97")}</DataTableHead>
                    <DataTableHead>{t("ui.generated.c26670dda42")}</DataTableHead>
                    <DataTableHead align="right">{t("ui.generated.cf3ea6d345e")}</DataTableHead>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {systemEntries.filter((entry) => entry.group === group).map((entry) => (
                    <DataTableRow key={entry.href}>
                      <DataTableCell className="font-semibold text-[var(--ink)]">{t(entry.name)}</DataTableCell>
                      <DataTableCell>{t(entry.scope)}</DataTableCell>
                      <DataTableCell>{t(entry.description)}</DataTableCell>
                      <DataTableCell align="right">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={entry.href}>{t("ui.generated.c65fc81e161")}</Link>
                        </Button>
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </SettingsCollapsiblePanel>
          );
        })}
      </SettingsConfigLayout>
    </div>
  );
}
