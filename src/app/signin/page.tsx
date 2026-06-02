import { redirect } from "next/navigation";
import { AgentWorldLogo } from "@/components/agentworld-logo";
import { SignInEntry } from "@/components/sign-in-entry";
import { ensureBootstrapLocalAdmin, getIdentityAccessSettings, getRequestAuthContext } from "@/server/auth-core";
import { listImportedPluginManifests } from "@/server/extension-core";

export const dynamic = "force-dynamic";

function normalizeNextPath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/overview";
  }
  const pathname = value.split("?")[0];
  if (pathname === "/signin" || pathname === "/change-password") {
    return "/overview";
  }
  return value;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<{ from?: string; next?: string }>;
}) {
  const authContext = await getRequestAuthContext();
  const params = await searchParams;
  const next = normalizeNextPath(params?.next);
  const fromWelcome = params?.from === "welcome";
  ensureBootstrapLocalAdmin();
  if (authContext) {
    if (authContext.mustChangePassword) {
      redirect(`/change-password?next=${encodeURIComponent(next)}`);
    }
    redirect(next);
  }
  const settings = getIdentityAccessSettings();
  const ssoPlugins = listImportedPluginManifests()
    .filter((plugin) => plugin.capability === "auth_sso")
    .map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      mountPoint: plugin.mountPoint,
    }));
  const selectedSsoPlugin =
    ssoPlugins.find((plugin) => plugin.id === settings.ssoPluginId) ?? ssoPlugins[0] ?? null;

  return (
    <main className={`aw-intro aw-auth-page ${fromWelcome ? "aw-auth-page--from-welcome" : ""}`}>
      <div className="aw-intro__noise" />
      <div className="aw-intro__frame" />
      <div className="aw-auth-backdrop-logo" aria-hidden="true">
        <AgentWorldLogo animated className="h-full w-full" />
      </div>
      <div className="aw-auth-shell relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <SignInEntry settings={settings} ssoPlugin={selectedSsoPlugin} />
      </div>
    </main>
  );
}
