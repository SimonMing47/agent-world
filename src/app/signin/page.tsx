import { redirect } from "next/navigation";
import { SignInEntry } from "@/components/sign-in-entry";
import { getDevelopmentAccessSettings, getRequestAuthContext, listAuthProviderConfigs } from "@/server/auth-core";

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string; entry?: string }>;
}) {
  const authContext = await getRequestAuthContext();
  const developmentAccess = getDevelopmentAccessSettings();
  const params = await searchParams;
  const next = params?.next || "/overview";
  const entry = params?.entry || "";
  if (authContext?.access.allowed) {
    redirect(next);
  }
  if (authContext && !authContext.access.allowed) {
    redirect(`/access-request?next=${encodeURIComponent(next)}`);
  }
  if (entry !== "1") {
    redirect(`/?next=${encodeURIComponent(next)}`);
  }

  const providers = listAuthProviderConfigs()
    .filter((provider) => provider.adapterKey === "development_stub" && provider.status === "active")
    .map((provider) => ({
      id: provider.id,
      name: provider.name,
      adapterKey: provider.adapterKey,
    }));
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#06070b] px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.16),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(6,182,212,0.12),transparent_24%),radial-gradient(circle_at_bottom,rgba(37,99,235,0.1),transparent_32%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_18%,transparent_82%,rgba(255,255,255,0.02))]" />
      <div className="relative mx-auto max-w-[1320px]">
        <SignInEntry providers={providers} teams={[]} developmentAccess={developmentAccess} />
      </div>
    </main>
  );
}
