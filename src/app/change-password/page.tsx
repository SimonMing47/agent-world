import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/change-password-form";
import { getRequestAuthContext } from "@/server/auth-core";

export default async function ChangePasswordPage() {
  const authContext = await getRequestAuthContext();
  if (!authContext) {
    redirect("/signin");
  }
  if (!authContext.mustChangePassword) {
    redirect("/overview");
  }

  return (
    <main className="aw-intro">
      <div className="aw-intro__noise" />
      <div className="aw-intro__frame" />
      <div className="aw-auth-shell relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <ChangePasswordForm />
      </div>
    </main>
  );
}
