export type NormalizedEnterpriseIdentity = {
  externalUserId: string;
  email: string;
  name: string;
  employeeNo?: string;
  title?: string;
  avatarUrl?: string;
  isSystemAdmin?: boolean;
  primaryBusinessTeamId?: string | null;
  businessTeamIds: string[];
  attributes?: Record<string, unknown>;
};

export type EnterpriseAuthAdapter = {
  key: string;
  name: string;
  description: string;
  mode: "manual" | "redirect" | "assertion_bridge";
  isBuiltIn: boolean;
  capabilities: string[];
  status: "ready" | "extension_required";
  normalizeDevelopmentPayload?: (input: {
    email: string;
    name: string;
    employeeNo?: string;
    title?: string;
    avatarUrl?: string;
    isSystemAdmin?: boolean;
    primaryBusinessTeamId?: string | null;
    businessTeamIds?: string[];
  }) => NormalizedEnterpriseIdentity;
};

const authAdapters: EnterpriseAuthAdapter[] = [
  {
    key: "development_stub",
    name: "Development Preview",
    description: "identityAccess.adapter.development.description",
    mode: "manual",
    isBuiltIn: true,
    capabilities: ["manual_profile_capture", "team_mapping", "system_admin_bootstrap"],
    status: "ready",
    normalizeDevelopmentPayload: (input) => ({
      externalUserId: input.email.trim().toLowerCase(),
      email: input.email.trim().toLowerCase(),
      name: input.name.trim(),
      employeeNo: input.employeeNo?.trim(),
      title: input.title?.trim(),
      avatarUrl: input.avatarUrl?.trim(),
      isSystemAdmin: Boolean(input.isSystemAdmin),
      primaryBusinessTeamId: input.primaryBusinessTeamId ?? null,
      businessTeamIds: input.businessTeamIds ?? [],
      attributes: {
        source: "development_stub",
      },
    }),
  },
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
