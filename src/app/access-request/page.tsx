import { redirect } from "next/navigation";
import { AccessRequestForm } from "@/components/access-request-form";
import { getIdentityAccessSettings, getRequestAuthContext } from "@/server/auth-core";

export default async function AccessRequestPage({
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
  const settings = getIdentityAccessSettings();
  return (
    <main className="min-h-screen bg-[var(--canvas)] px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1320px]">
        <AccessRequestForm
          defaultName={authContext?.user.name ?? ""}
          defaultEmail={authContext?.user.email ?? ""}
          defaultBusinessTeamHint={authContext?.primaryBusinessTeam?.name ?? ""}
          adminContactEmail={settings.adminContactEmail}
        />
      </div>
    </main>
  );
}
