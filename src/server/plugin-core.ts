import { uiText } from "@/lib/language-pack";
export type PluginCapability =
  | "provider"
  | "tool"
  | "skill"
  | "notify_email"
  | "notify_im"
  | "code_repo"
  | "trigger"
  | "output_publisher"
  | "dashboard_metric";

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
  implementationContract: string;
  noCoreChangeRule: string;
};

export function listBuiltinPluginManifests(): PluginManifest[] {
  return [
    {
      id: "builtin.provider.agentworld-runtime",
      name: uiText("ui.generated.c7d6c4d526b"),
      version: "1.0.0",
      capability: "provider",
      lifecycle: "configured",
      mountPoint: "provider-runtime",
      configSchema: "{ providerProfileId, defaultModel, executionMode }",
      requiredSecretRefs: ["env:AGENTWORLD_GLM_API_KEY", "env:OPENAI_API_KEY"],
      permissions: ["provider:invoke", "runtime:discover"],
      healthCheck: "GET /api/runtimes/discover",
      extensionOnly: true,
    },
    {
      id: "builtin.notify.email",
      name: "Email Connector",
      version: "1.0.0",
      capability: "notify_email",
      lifecycle: "declared",
      mountPoint: "notification-channel",
      configSchema: "{ smtpHost, smtpPort, from, authSecretRef }",
      requiredSecretRefs: ["secret:smtp-auth"],
      permissions: ["notify:email:send"],
      healthCheck: "connector self-check",
      extensionOnly: true,
    },
    {
      id: "builtin.notify.im",
      name: "IM Connector",
      version: "1.0.0",
      capability: "notify_im",
      lifecycle: "declared",
      mountPoint: "notification-channel",
      configSchema: "{ provider, webhookUrl, secretRef }",
      requiredSecretRefs: ["secret:im-webhook"],
      permissions: ["notify:im:send"],
      healthCheck: "connector self-check",
      extensionOnly: true,
    },
    {
      id: "builtin.repo.git",
      name: "Code Repository Connector",
      version: "1.0.0",
      capability: "code_repo",
      lifecycle: "declared",
      mountPoint: "execution-environment",
      configSchema: "{ provider, privateKeyRef, cloneStrategy, commentMode }",
      requiredSecretRefs: ["secret:repo-private-key", "env:CODE_PLATFORM_TOKEN"],
      permissions: ["repo:read", "repo:mr:comment"],
      healthCheck: "connector self-check",
      extensionOnly: true,
    },
    {
      id: "builtin.trigger.webhook",
      name: "Webhook Trigger",
      version: "1.0.0",
      capability: "trigger",
      lifecycle: "configured",
      mountPoint: "task-trigger",
      configSchema: "{ pathKey, signatureHeader, secretRef, inputNormalizerRef }",
      requiredSecretRefs: ["secret:webhook-signing-secret"],
      permissions: ["trigger:webhook:receive"],
      healthCheck: "GET /api/webhooks/{pathKey}",
      extensionOnly: true,
    },
    {
      id: "builtin.output.finding-dashboard",
      name: "Finding Dashboard Publisher",
      version: "1.0.0",
      capability: "output_publisher",
      lifecycle: "configured",
      mountPoint: "output-publisher",
      configSchema: "{ findingSchemaVersion, dashboardPolicy }",
      requiredSecretRefs: [],
      permissions: ["finding:write", "dashboard:publish"],
      healthCheck: "in-process",
      extensionOnly: true,
    },
  ];
}

export function listPluginExtensionPoints(): PluginExtensionPoint[] {
  return [
    {
      id: "provider-runtime",
      name: uiText("ui.generated.ccccb1f3b93"),
      accepts: ["provider"],
      implementationContract: uiText("ui.generated.c61ae8fc81d"),
      noCoreChangeRule: uiText("ui.generated.cb7b7f0ebb7"),
    },
    {
      id: "tool-skill-registry",
      name: uiText("ui.generated.ccd071c0275"),
      accepts: ["tool", "skill"],
      implementationContract: uiText("ui.generated.c171a42720d"),
      noCoreChangeRule: uiText("ui.generated.cb4c1bcf3f1"),
    },
    {
      id: "notification-channel",
      name: uiText("ui.generated.c8a70566169"),
      accepts: ["notify_email", "notify_im"],
      implementationContract: uiText("ui.generated.c7c1832d5ab"),
      noCoreChangeRule: uiText("ui.generated.cba28092b21"),
    },
    {
      id: "execution-environment",
      name: uiText("ui.generated.c876aed85e3"),
      accepts: ["code_repo"],
      implementationContract: uiText("ui.generated.cdc64063e0f"),
      noCoreChangeRule: uiText("ui.generated.c369f9ab399"),
    },
    {
      id: "task-trigger",
      name: uiText("ui.generated.ce9852dc24c"),
      accepts: ["trigger"],
      implementationContract: uiText("ui.generated.c19036d0068"),
      noCoreChangeRule: uiText("ui.generated.c0fe7faf90e"),
    },
    {
      id: "output-publisher",
      name: uiText("ui.generated.c392147014c"),
      accepts: ["output_publisher", "notify_email", "notify_im", "code_repo"],
      implementationContract: uiText("ui.generated.cc8a731496b"),
      noCoreChangeRule: uiText("ui.generated.c052f99a7b5"),
    },
    {
      id: "dashboard-metric",
      name: uiText("ui.generated.c2990573379"),
      accepts: ["dashboard_metric"],
      implementationContract: uiText("ui.generated.c5c84bfb8dc"),
      noCoreChangeRule: uiText("ui.generated.c87b3c77504"),
    },
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
