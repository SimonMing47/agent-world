import { redirect } from "next/navigation";
import { SignInEntry } from "@/components/sign-in-entry";
import { getRequestAuthContext, listAuthProviderConfigs } from "@/server/auth-core";

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const authContext = await getRequestAuthContext();
  const params = await searchParams;
  const next = params?.next || "/overview";
  if (authContext?.access.allowed) {
    redirect(next);
  }
  if (authContext && !authContext.access.allowed) {
    redirect(`/access-request?next=${encodeURIComponent(next)}`);
  }

  const providers = listAuthProviderConfigs()
    .filter((provider) => provider.adapterKey === "development_stub" && provider.status === "active")
    .map((provider) => ({
      id: provider.id,
      name: provider.name,
      adapterKey: provider.adapterKey,
    }));
  return (
    <main className="min-h-screen bg-[var(--canvas)] px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1320px]">
        <SignInEntry providers={providers} teams={[]} />
      </div>
    </main>
  );
}
