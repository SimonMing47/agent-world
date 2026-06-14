import { getRequestAuthContext } from "@/server/auth-core";

export async function resolveRequestActor(request: Request, fallback = "console") {
  const authContext = await getRequestAuthContext(request);
  const user = authContext?.user;
  const actor =
    user?.email?.trim() ||
    user?.name?.trim() ||
    user?.id?.trim() ||
    fallback;

  return {
    actor,
    authContext,
  };
}
