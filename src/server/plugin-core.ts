export type PluginCapability =
  | "provider"
  | "tool"
  | "skill"
  | "notify_email"
  | "notify_im"
  | "code_repo";

export type PluginManifest = {
  id: string;
  name: string;
  version: string;
  capability: PluginCapability;
  configSchema: string;
  permissions: string[];
  healthCheck: string;
  extensionOnly: true;
};

export function listBuiltinPluginManifests(): PluginManifest[] {
  return [
    {
      id: "builtin.provider.opencode",
      name: "OpenCode Provider",
      version: "1.0.0",
      capability: "provider",
      configSchema: "{ baseUrl, apiKey, defaultModel }",
      permissions: ["provider:invoke", "runtime:discover"],
      healthCheck: "GET /api/runtimes/discover",
      extensionOnly: true,
    },
    {
      id: "builtin.notify.email",
      name: "Email Connector",
      version: "1.0.0",
      capability: "notify_email",
      configSchema: "{ smtpHost, smtpPort, from, authSecretRef }",
      permissions: ["notify:email:send"],
      healthCheck: "connector self-check",
      extensionOnly: true,
    },
    {
      id: "builtin.notify.im",
      name: "IM Connector",
      version: "1.0.0",
      capability: "notify_im",
      configSchema: "{ provider, webhookUrl, secretRef }",
      permissions: ["notify:im:send"],
      healthCheck: "connector self-check",
      extensionOnly: true,
    },
    {
      id: "builtin.repo.git",
      name: "Code Repository Connector",
      version: "1.0.0",
      capability: "code_repo",
      configSchema: "{ provider, privateKeyRef, cloneStrategy }",
      permissions: ["repo:read", "repo:mr:comment"],
      healthCheck: "connector self-check",
      extensionOnly: true,
    },
  ];
}
