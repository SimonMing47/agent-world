export type EnterpriseAuthAdapter = {
  key: string;
  name: string;
  description: string;
  mode: "manual" | "redirect" | "assertion_bridge";
  isBuiltIn: boolean;
  capabilities: string[];
  status: "ready" | "extension_required";
};

const authAdapters: EnterpriseAuthAdapter[] = [
  {
    key: "oidc_generic",
    name: "Generic OIDC",
    description: "identityAccess.adapter.oidc.description",
    mode: "redirect",
    isBuiltIn: true,
    capabilities: ["authorization_code_flow", "claim_mapping", "userinfo_sync"],
    status: "extension_required",
  },
  {
    key: "assertion_bridge",
    name: "Assertion Bridge",
    description: "identityAccess.adapter.bridge.description",
    mode: "assertion_bridge",
    isBuiltIn: true,
    capabilities: ["normalized_identity_payload", "org_hierarchy_sync", "custom_signature_validation"],
    status: "extension_required",
  },
];

export function listAuthAdapterCatalog() {
  return authAdapters;
}

export function getAuthAdapter(key: string) {
  return authAdapters.find((adapter) => adapter.key === key) ?? null;
}
