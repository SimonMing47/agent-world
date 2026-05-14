const baseUrl = (process.env.OPENVIKING_BASE_URL ?? "http://127.0.0.1:1933").replace(/\/+$/, "");
const uri = `viking://resources/agentworld/smoke/agentworld-${Date.now()}.md`;
const content = "# AgentWorld OpenViking Smoke\n\nReal OpenViking write and read path is healthy.";

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.status === "error") {
    throw new Error(body.error?.message ?? `${response.status} ${response.statusText}`);
  }
  return body.result ?? body;
}

const health = await request("/health");
await request("/api/v1/content/write", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ uri, content, mode: "create" }),
});
const readback = await request(`/api/v1/content/read?uri=${encodeURIComponent(uri)}`);

if (!String(readback).includes("Real OpenViking write and read path is healthy")) {
  throw new Error("OpenViking readback did not match the smoke content");
}

console.log(JSON.stringify({ ok: true, baseUrl, uri, health }, null, 2));

