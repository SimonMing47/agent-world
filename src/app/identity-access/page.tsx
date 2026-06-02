import { redirect } from "next/navigation";
import { IdentityAccessConsole } from "@/components/identity-access-console";
import { PageHeader } from "@/components/page-header";
import { getIdentityAccessSettings, getRequestAuthContext, listAccessRequests, listAccessWhitelistRules, listAuthAdapterCatalog, listAuthProviderConfigs, listIdentityUsers } from "@/server/auth-core";
import { listImportedPluginManifests } from "@/server/extension-core";
import { listBusinessTeams } from "@/server/queries";

export default async function IdentityAccessPage() {
  const authContext = await getRequestAuthContext();
  if (!authContext) {
    redirect("/signin?next=/identity-access");
  }
  if (authContext.user.isSystemAdmin !== 1) {
    redirect("/overview");
  }

  const adapters = listAuthAdapterCatalog().map((adapter) => ({
    key: adapter.key,
    name: adapter.name,
    description: adapter.description,
    mode: adapter.mode,
    status: adapter.status,
  }));
  const providers = listAuthProviderConfigs();
  const ssoPlugins = listImportedPluginManifests()
    .filter((plugin) => plugin.capability === "auth_sso")
    .map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      mountPoint: plugin.mountPoint,
      lifecycle: plugin.lifecycle,
    }));
  const settings = getIdentityAccessSettings();
  const teams = listBusinessTeams()
    .filter((team) => team.status !== "deleted")
    .map((team) => ({ id: team.id, name: team.name }));
  const whitelistRules = listAccessWhitelistRules();
  const users = listIdentityUsers();
  const accessRequests = listAccessRequests();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="identityAccess.page.eyebrow"
        title="identityAccess.page.title"
        description="identityAccess.page.description"
        badges={[
          { label: <>{providers.length} identityAccess.page.badges.providers</>, variant: "accent" },
          { label: <>{whitelistRules.filter((rule) => rule.status === "active").length} identityAccess.page.badges.whitelist</>, variant: "neutral" },
        ]}
      />

      <IdentityAccessConsole
        adapters={adapters}
        providers={providers}
        ssoPlugins={ssoPlugins}
        settings={settings}
        teams={teams}
        whitelistRules={whitelistRules}
        users={users}
        accessRequests={accessRequests}
      />
    </div>
  );
}
