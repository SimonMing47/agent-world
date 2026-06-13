import { listImportedPluginContributions } from "@/server/extension-core";
import {
  listExecutablePluginContributions,
  type AuthAdapterProtocol,
  type ExecutablePluginContribution,
} from "@/server/plugin-sdk-core";

export type EnterpriseAuthAdapter = {
  key: string;
  name: string;
  description: string;
  mode: "manual" | "redirect" | "assertion_bridge";
  protocol: AuthAdapterProtocol;
  isBuiltIn: boolean;
  pluginId?: string;
  configSchema?: Record<string, unknown>;
  source: "builtin" | "plugin" | "executable";
  capabilities: string[];
  status: "ready" | "extension_required";
};

const authAdapters: EnterpriseAuthAdapter[] = [
  {
    key: "oidc_generic",
    name: "Generic OIDC",
    description: "identityAccess.adapter.oidc.description",
    mode: "redirect",
    protocol: "oidc",
    isBuiltIn: true,
    source: "builtin",
    capabilities: ["authorization_code_flow", "claim_mapping", "userinfo_sync"],
    status: "ready",
  },
  {
    key: "assertion_bridge",
    name: "Assertion Bridge",
    description: "identityAccess.adapter.bridge.description",
    mode: "assertion_bridge",
    protocol: "assertion_bridge",
    isBuiltIn: true,
    source: "builtin",
    capabilities: ["normalized_identity_payload", "org_hierarchy_sync", "custom_signature_validation"],
    status: "extension_required",
  },
];

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function normalizeMode(value: unknown): EnterpriseAuthAdapter["mode"] {
  return value === "assertion_bridge" || value === "manual" || value === "redirect" ? value : "redirect";
}

function normalizeProtocol(value: unknown): AuthAdapterProtocol {
  return value === "assertion_bridge" || value === "external_redirect" || value === "oidc" ? value : "oidc";
}

function normalizePluginAuthAdapter(row: ReturnType<typeof listImportedPluginContributions>[number]) {
  const contribution = row.contribution;
  const key = readString(contribution.id, row.contributionId);
  const label = readString(contribution.name, readString(contribution.label, readString(contribution.labelKey, key)));
  const schema = contribution.configSchema;
  return {
    key,
    name: label,
    description: readString(contribution.description, readString(contribution.descriptionKey, "identityAccess.adapter.plugin.description")),
    mode: normalizeMode(contribution.mode),
    protocol: normalizeProtocol(contribution.protocol),
    isBuiltIn: false,
    pluginId: row.pluginId,
    source: "plugin" as const,
    configSchema: schema && typeof schema === "object" && !Array.isArray(schema) ? schema as Record<string, unknown> : {},
    capabilities: readStringArray(contribution.capabilities),
    status: row.lifecycle === "disabled" ? "extension_required" as const : "ready" as const,
  };
}

export function listAuthAdapterCatalog() {
  const adapters = [...authAdapters];
  const seen = new Set(adapters.map((adapter) => adapter.key));

  for (const row of listImportedPluginContributions("authAdapter")) {
    const adapter = normalizePluginAuthAdapter(row);
    if (seen.has(adapter.key)) continue;
    seen.add(adapter.key);
    adapters.push(adapter);
  }

  for (const record of listExecutablePluginContributions("authAdapter") as ExecutablePluginContribution<"authAdapter">[]) {
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    adapters.push({
      key: record.id,
      name: record.id,
      description: "identityAccess.adapter.plugin.description",
      mode: record.contribution.mode === "assertion_bridge" ? "assertion_bridge" : "redirect",
      protocol: record.contribution.protocol ?? "oidc",
      isBuiltIn: false,
      pluginId: record.pluginId,
      source: "executable",
      capabilities: record.contribution.capabilities ?? [],
      status: "ready",
    });
  }

  return adapters;
}

export function getAuthAdapter(key: string) {
  return listAuthAdapterCatalog().find((adapter) => adapter.key === key) ?? null;
}
