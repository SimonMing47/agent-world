export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const { ensureOpenVikingServerStarted } = await import("./server/openviking-process");
  await ensureOpenVikingServerStarted("next-instrumentation");
}
