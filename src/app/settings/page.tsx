import Link from "next/link";
import { DevelopmentAccessSettingsForm } from "@/components/development-access-settings-form";
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
import { getDevelopmentAccessSettings } from "@/server/auth-core";
import { getKnowledgeBaseSettings, getOpenVikingModelDefaults } from "@/server/knowledge-base-settings";
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
    name: "知识库配置",
    href: "#knowledge-base",
    group: "ui.generated.c918a0a7cf1",
    scope: "OpenViking",
    description: "配置默认知识库后端、OpenViking 连接、内容理解知识底座和检索索引参数。",
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

const systemGroupPanels: Record<typeof systemEntryGroups[number], {
  id: string;
  title: string;
  description: string;
}> = {
  "ui.generated.c918a0a7cf1": {
    id: "general-settings",
    title: "通用设置",
    description: "开发模式、语言包、知识库等系统级入口。",
  },
  "ui.generated.cfad8b39e99": {
    id: "resource-settings",
    title: "资源配置",
    description: "模型、Skill、MCP、连接器、Codebase 和知识库资源入口。",
  },
  "ui.generated.c2e03739792": {
    id: "runtime-governance-settings",
    title: "运行治理",
    description: "运行绑定、环境、Webhook、策略、租户和服务目录入口。",
  },
};

const settingsNavItems: SettingsNavItem[] = [
  {
    id: "knowledge-base",
    label: "知识库配置",
    description: "OpenViking 连接、启动、内容理解知识底座和检索索引参数。",
    meta: "OpenViking",
  },
  {
    id: "development-access",
    label: "developmentAccess.settings.title",
    description: "developmentAccess.settings.description",
    meta: "开发",
  },
  {
    id: "language-pack",
    label: "ui.common.resources.languagePack",
    description: "界面文字、术语和语言包覆盖。",
    meta: "语言",
  },
  {
    id: "general-settings",
    label: "通用设置",
    description: "系统常用配置入口。",
  },
  {
    id: "resource-settings",
    label: "资源配置",
    description: "模型服务和平台资源入口。",
  },
  {
    id: "runtime-governance-settings",
    label: "运行治理",
    description: "运行环境、Webhook 和治理策略。",
  },
];

export default function SettingsPage() {
  const languagePack = getActiveLanguagePack();
  const t = (key: string, fallback?: string, params?: Record<string, string | number>) =>
    translateWithPack(languagePack, key, fallback, params);
  const snapshot = getSettingsSnapshot();
  const developmentAccessSetting = getDevelopmentAccessSettings();
  const knowledgeBaseSetting = getKnowledgeBaseSettings();
  const openVikingModelDefaults = getOpenVikingModelDefaults();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ui.generated.c3c71dca8a0"
        title="ui.generated.c3c71dca8a0"
        description="ui.generated.cb2d089ae22"
        badges={[
          { label: `${snapshot.providers.length} ${t("ui.common.count.modelServices", "个模型服务")}`, variant: "accent" },
          { label: `${snapshot.environments.length} ${t("ui.common.count.environments", "个执行环境")}`, variant: "neutral" },
          { label: knowledgeBaseSetting.provider === "openviking" ? "OpenViking" : knowledgeBaseSetting.provider, variant: "neutral" },
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

      <SettingsConfigLayout items={settingsNavItems}>
        <SettingsCollapsiblePanel
          id="knowledge-base"
          eyebrow="系统配置"
          title="知识库配置"
          description="默认知识库为 OpenViking；这里统一管理知识读写、同步、本地进程启动、内容理解知识底座和检索索引配置。"
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
          id="development-access"
          eyebrow="developmentAccess.scope.label"
          title="developmentAccess.settings.title"
          description="developmentAccess.settings.description"
          meta="开发入口"
        >
          <DevelopmentAccessSettingsForm setting={developmentAccessSetting} />
        </SettingsCollapsiblePanel>

        <SettingsCollapsiblePanel
          id="language-pack"
          eyebrow="ui.generated.c918a0a7cf1"
          title="ui.generated.ce13af2e292"
          description="ui.generated.c2ef0fab9c9"
          meta="语言"
        >
          <LanguagePackSettingsForm setting={snapshot.languagePackSetting} />
        </SettingsCollapsiblePanel>

        {systemEntryGroups.map((group) => {
          const panel = systemGroupPanels[group];

          return (
            <SettingsCollapsiblePanel
              key={group}
              id={panel.id}
              eyebrow="ui.generated.cf84ec364a6"
              title={panel.title}
              description={panel.description}
              bodyClassName="p-0"
            >
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
            </SettingsCollapsiblePanel>
          );
        })}
      </SettingsConfigLayout>
    </div>
  );
}
