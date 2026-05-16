export type PluginCapability =
  | "provider"
  | "tool"
  | "skill"
  | "notify_email"
  | "notify_im"
  | "code_repo";

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
  contract: string;
  noCoreChangeRule: string;
};

export function listBuiltinPluginManifests(): PluginManifest[] {
  return [
    {
      id: "builtin.provider.opencode",
      name: "OpenCode Provider",
      version: "1.0.0",
      capability: "provider",
      lifecycle: "configured",
      mountPoint: "provider-runtime",
      configSchema: "{ baseUrl, apiKey, defaultModel }",
      requiredSecretRefs: ["env:OPENCODE_API_KEY", "env:OPENAI_API_KEY"],
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
  ];
}

export function listPluginExtensionPoints(): PluginExtensionPoint[] {
  return [
    {
      id: "provider-runtime",
      name: "Provider 执行扩展点",
      accepts: ["provider"],
      contract: "实现 invoke/discover/health 三个能力，主干只读取清单与健康结果。",
      noCoreChangeRule: "新增 claude code、openclaw 或其他 CLI Provider 时只新增插件目录和配置。",
    },
    {
      id: "tool-skill-registry",
      name: "工具与 Skill 扩展点",
      accepts: ["tool", "skill"],
      contract: "声明工具权限、输入 schema、输出 schema、审计级别，并交由 Harness 决策。",
      noCoreChangeRule: "工具实现独立挂载，主干只消费 tool id、权限和审计事件。",
    },
    {
      id: "notification-channel",
      name: "通知通道扩展点",
      accepts: ["notify_email", "notify_im"],
      contract: "实现 send/test/health；任务结果只依赖通用通知接口。",
      noCoreChangeRule: "邮件、IM、企业内部系统都作为外部插件声明，不把 SDK 写进主干。",
    },
    {
      id: "execution-environment",
      name: "代码仓与环境扩展点",
      accepts: ["code_repo"],
      contract: "实现 clone/readDiff/comment/cleanup；凭据统一走 secret ref。",
      noCoreChangeRule: "代码平台差异留在插件内，主干只保存仓库、执行人、路径和私钥引用。",
    },
  ];
}

export function getPluginSecurityModel() {
  return {
    extensionOnly: true,
    secretPolicy: "主干只保存 secret ref，不保存明文 key。",
    permissionModel: "插件权限与 Harness 工具权限对齐，执行前统一做 allow/deny/approval 判断。",
    openSourceBoundary: "开源主干提供协议和默认清单，企业内 IM/邮件/代码仓实现可闭源外挂。",
  };
}
