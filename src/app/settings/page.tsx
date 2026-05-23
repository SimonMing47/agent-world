import Link from "next/link";
import { DevelopmentAccessSettingsForm } from "@/components/development-access-settings-form";
import { LanguagePackSettingsForm } from "@/components/language-pack-settings-form";
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
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { SummaryStrip } from "@/components/ui/summary-strip";
import { translateWithPack } from "@/lib/language-pack";
import { getDevelopmentAccessSettings } from "@/server/auth-core";
import { getActiveLanguagePack } from "@/server/language-pack-store";
import { getSettingsSnapshot } from "@/server/queries";

const systemEntries = [
  {
    name: "developmentAccess.settings.title",
    href: "#development-access",
    group: "ui.generated.c918a0a7cf1",
    scope: "developmentAccess.scope.label",
    description: "developmentAccess.settings.description",
  },
  {
    name: "ui.common.resources.languagePack",
    href: "#language-pack",
    group: "ui.generated.c918a0a7cf1",
    scope: "ui.generated.c71d6a654d0",
    description: "ui.generated.c8f35d729e3",
  },
  {
    name: "ui.common.resources.providerProfile",
    href: "/runtimes",
    group: "ui.generated.cfad8b39e99",
    scope: "ui.generated.cbc56f948bb",
    description: "ui.generated.c2319d41387",
  },
  {
    name: "Skill",
    href: "/skills",
    group: "ui.generated.cfad8b39e99",
    scope: "ui.generated.c51d7485af0",
    description: "ui.generated.c3301e76b0f",
  },
  {
    name: "MCP",
    href: "/mcp",
    group: "ui.generated.cfad8b39e99",
    scope: "ui.generated.c04935ddca3",
    description: "ui.generated.cc16692125c",
  },
  {
    name: "Connector",
    href: "/connectors",
    group: "ui.generated.cfad8b39e99",
    scope: "ui.generated.c25b04ef9ba",
    description: "ui.generated.cff9cc38dbc",
  },
  {
    name: "Codebase",
    href: "/codebases",
    group: "ui.generated.cfad8b39e99",
    scope: "ui.generated.ca650a73ddc",
    description: "ui.generated.c9d67f38216",
  },
  {
    name: "ui.common.resources.knowledgeSpace",
    href: "/knowledge",
    group: "ui.generated.cfad8b39e99",
    scope: "OpenViking",
    description: "ui.generated.c35200d5ff0",
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

export default function SettingsPage() {
  const languagePack = getActiveLanguagePack();
  const t = (key: string, fallback?: string, params?: Record<string, string | number>) =>
    translateWithPack(languagePack, key, fallback, params);
  const snapshot = getSettingsSnapshot();
  const developmentAccessSetting = getDevelopmentAccessSettings();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ui.generated.c3c71dca8a0"
        title="ui.generated.c3c71dca8a0"
        description="ui.generated.cb2d089ae22"
        badges={[
          { label: `${snapshot.providers.length} ${t("ui.common.count.modelServices", "个模型服务")}`, variant: "accent" },
          { label: `${snapshot.environments.length} ${t("ui.common.count.environments", "个执行环境")}`, variant: "neutral" },
        ]}
      />

      <SummaryStrip
        items={[
          { label: "ui.generated.cbc56f948bb", value: snapshot.providers.length, detail: "ui.generated.c3ecb393f86" },
          { label: "ui.generated.c059d73c843", value: snapshot.environments.length, detail: "ui.generated.cfcdc5822f5" },
          { label: "Webhook", value: snapshot.webhooks.length, detail: "ui.generated.c3ba8e6fc8e" },
          { label: "ui.generated.c971c6e5190", value: snapshot.taskBlueprints.length, detail: "ui.generated.c26f30fd79b" },
        ]}
      />

      <Panel id="development-access">
        <PanelHeader
          eyebrow="developmentAccess.scope.label"
          title="developmentAccess.settings.title"
          description="developmentAccess.settings.description"
        />
        <PanelBody>
          <DevelopmentAccessSettingsForm setting={developmentAccessSetting} />
        </PanelBody>
      </Panel>

      <Panel id="language-pack">
        <PanelHeader
          eyebrow="ui.generated.c918a0a7cf1"
          title="ui.generated.ce13af2e292"
          description="ui.generated.c2ef0fab9c9"
        />
        <PanelBody>
          <LanguagePackSettingsForm setting={snapshot.languagePackSetting} />
        </PanelBody>
      </Panel>

      {systemEntryGroups.map((group) => (
        <Panel key={group}>
          <PanelHeader
            eyebrow="ui.generated.cf84ec364a6"
            title={group}
            description={group === "ui.generated.cfad8b39e99" ? "ui.generated.c328dd8d617" : "ui.generated.c8109a3b527"}
          />
          <PanelBody className="p-0">
            <DataTable>
              <DataTableHeader>
                <DataTableRow className="hover:bg-transparent">
                  <DataTableHead>{t("ui.generated.cc1bebd4ab3", "配置项")}</DataTableHead>
                  <DataTableHead>{t("ui.generated.c785b52eb97", "作用域")}</DataTableHead>
                  <DataTableHead>{t("ui.generated.c26670dda42", "说明")}</DataTableHead>
                  <DataTableHead align="right">{t("ui.generated.cf3ea6d345e", "操作")}</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {systemEntries.filter((entry) => entry.group === group).map((entry) => (
                  <DataTableRow key={entry.href}>
                    <DataTableCell className="font-semibold text-[var(--ink)]">{entry.name}</DataTableCell>
                    <DataTableCell>{entry.scope}</DataTableCell>
                    <DataTableCell>{entry.description}</DataTableCell>
                    <DataTableCell align="right">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={entry.href}>{t("ui.generated.c65fc81e161", "打开")}</Link>
                      </Button>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </PanelBody>
        </Panel>
      ))}
    </div>
  );
}
