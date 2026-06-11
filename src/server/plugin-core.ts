import { uiText } from "@/lib/language-pack";
export type PluginCapability =
  | "auth_adapter"
  | "auth_sso"
  | "provider_adapter"
  | "provider"
  | "tool"
  | "skill"
  | "knowledge_source"
  | "notify_email"
  | "notify_im"
  | "notification_channel"
  | "code_repo"
  | "repository_connector"
  | "webhook_parser"
  | "trigger"
  | "workflow_block"
  | "output_publisher"
  | "dashboard_metric"
  | "task_blueprint"
  | "environment_template"
  | "settings_panel"
  | "navigation_item"
  | "page_panel"
  | "codebase_engine"
  | "secret_provider";

export type PluginLifecycle = "declared" | "configured" | "healthy" | "degraded";

export type PluginManifest = {
  id: string;
  name: string;
  version: string;
  capability: PluginCapability;
  lifecycle: PluginLifecycle;
  mountPoint: string;
  configSchema: string;
  requiredSecretRefs: string[];
  permissions: string[];
  healthCheck: string;
  extensionOnly: true;
};

export type PluginExtensionPoint = {
  id: string;
  name: string;
  accepts: PluginCapability[];
  contributionKinds: string[];
  host: "server" | "client" | "both";
  activationEvents: string[];
  implementationContract: string;
  noCoreChangeRule: string;
};

function extensionPoint(input: {
  id: string;
  key: string;
  accepts: PluginCapability[];
  contributionKinds: string[];
  host: PluginExtensionPoint["host"];
  activationEvents: string[];
}): PluginExtensionPoint {
  return {
    id: input.id,
    name: uiText(`plugins.extension.${input.key}.name`),
    accepts: input.accepts,
    contributionKinds: input.contributionKinds,
    host: input.host,
    activationEvents: input.activationEvents,
    implementationContract: uiText(`plugins.extension.${input.key}.contract`),
    noCoreChangeRule: uiText(`plugins.extension.${input.key}.noCoreChange`),
  };
}

export function listPluginExtensionPoints(): PluginExtensionPoint[] {
  return [
    extensionPoint({
      id: "identity-auth",
      key: "identityAuth",
      accepts: ["auth_adapter", "auth_sso"],
      contributionKinds: ["authAdapters"],
      host: "server",
      activationEvents: ["onSignInStart", "onSignInCallback"],
    }),
    extensionPoint({
      id: "provider-runtime",
      key: "providerRuntime",
      accepts: ["provider_adapter", "provider"],
      contributionKinds: ["providerAdapters"],
      host: "server",
      activationEvents: ["onProviderInvoke", "onProviderHealthCheck"],
    }),
    extensionPoint({
      id: "tool-skill-registry",
      key: "toolSkillRegistry",
      accepts: ["tool", "skill"],
      contributionKinds: ["toolBundles", "skills"],
      host: "server",
      activationEvents: ["onTaskNode", "onSkillLoad"],
    }),
    extensionPoint({
      id: "knowledge-source",
      key: "knowledgeSource",
      accepts: ["knowledge_source", "skill"],
      contributionKinds: ["knowledgeSources", "skills"],
      host: "server",
      activationEvents: ["onKnowledgeImport", "onKnowledgeRetrieve"],
    }),
    extensionPoint({
      id: "repository-platform",
      key: "repositoryPlatform",
      accepts: ["code_repo", "repository_connector", "webhook_parser", "output_publisher"],
      contributionKinds: ["repositoryConnectors", "webhookParsers", "outputPublishers", "toolBundles"],
      host: "server",
      activationEvents: ["onWebhookReceived", "onTaskNode", "onOutputPublish"],
    }),
    extensionPoint({
      id: "codebase-engine",
      key: "codebaseEngine",
      accepts: ["codebase_engine", "code_repo"],
      contributionKinds: ["codebaseEngines"],
      host: "server",
      activationEvents: ["onCodebaseIndex", "onCodebaseQuery"],
    }),
    extensionPoint({
      id: "notification-channel",
      key: "notificationChannel",
      accepts: ["notify_email", "notify_im", "notification_channel", "output_publisher"],
      contributionKinds: ["notificationChannels", "outputPublishers"],
      host: "server",
      activationEvents: ["onOutputPublish", "onNotificationSend"],
    }),
    extensionPoint({
      id: "execution-environment",
      key: "executionEnvironment",
      accepts: ["environment_template", "code_repo"],
      contributionKinds: ["environmentTemplates"],
      host: "server",
      activationEvents: ["onEnvironmentPrepare", "onEnvironmentCleanup"],
    }),
    extensionPoint({
      id: "task-trigger",
      key: "taskTrigger",
      accepts: ["trigger", "webhook_parser"],
      contributionKinds: ["webhookParsers"],
      host: "server",
      activationEvents: ["onWebhookReceived", "onScheduleTick"],
    }),
    extensionPoint({
      id: "workflow-block",
      key: "workflowBlock",
      accepts: ["workflow_block", "tool", "output_publisher"],
      contributionKinds: ["workflowBlocks", "toolBundles", "outputPublishers"],
      host: "server",
      activationEvents: ["onTaskNode"],
    }),
    extensionPoint({
      id: "output-publisher",
      key: "outputPublisher",
      accepts: ["output_publisher", "notify_email", "notify_im", "code_repo"],
      contributionKinds: ["outputPublishers"],
      host: "server",
      activationEvents: ["onOutputPublish"],
    }),
    extensionPoint({
      id: "dashboard-metric",
      key: "dashboardMetric",
      accepts: ["dashboard_metric"],
      contributionKinds: ["dashboardWidgets"],
      host: "client",
      activationEvents: ["onDashboardRender"],
    }),
    extensionPoint({
      id: "ui-navigation",
      key: "uiNavigation",
      accepts: ["navigation_item", "settings_panel", "page_panel"],
      contributionKinds: ["navigationItems", "settingsPanels"],
      host: "client",
      activationEvents: ["onNavigationResolve", "onPluginPageRender"],
    }),
    extensionPoint({
      id: "task-blueprint",
      key: "taskBlueprint",
      accepts: ["task_blueprint", "workflow_block"],
      contributionKinds: ["taskBlueprints", "workflowBlocks"],
      host: "both",
      activationEvents: ["onBlueprintImport", "onTaskCreate"],
    }),
    extensionPoint({
      id: "task-run-panel",
      key: "taskRunPanel",
      accepts: ["page_panel", "dashboard_metric"],
      contributionKinds: ["taskRunPanels"],
      host: "client",
      activationEvents: ["onTaskRunDetailRender"],
    }),
    extensionPoint({
      id: "agent-detail-tab",
      key: "agentDetailTab",
      accepts: ["page_panel", "skill"],
      contributionKinds: ["agentDetailTabs"],
      host: "client",
      activationEvents: ["onAgentDetailRender"],
    }),
    extensionPoint({
      id: "secret-provider",
      key: "secretProvider",
      accepts: ["secret_provider"],
      contributionKinds: ["secretProviders"],
      host: "server",
      activationEvents: ["onSecretResolve", "onHealthCheck"],
    }),
  ];
}

export function getPluginSecurityModel() {
  return {
    extensionOnly: true,
    secretPolicy: uiText("ui.generated.cea435969ec"),
    permissionModel: uiText("ui.generated.c12ee563fb1"),
    lifecycle: uiText("ui.generated.c1e91b92d21"),
    openSourceBoundary: uiText("ui.generated.c7b6c5278b3"),
  };
}
