import { resolveBaseUrl } from "./openviking-common.mjs";

const baseUrl = resolveBaseUrl();
const uri = `viking://resources/agentworld/smoke/agentworld-${Date.now()}.md`;
const content = "# AgentWorld OpenViking Smoke\n\nReal OpenViking write and read path is healthy.";

async function request(path, init) {
  const headers = {
    "Content-Type": "application/json",
    ...(init?.headers ?? {}),
  };
  if (process.env.OPENVIKING_API_KEY) {
    headers.Authorization = `Bearer ${process.env.OPENVIKING_API_KEY}`;
  }
  if (process.env.OPENVIKING_ACCOUNT) {
    headers["X-OpenViking-Account"] = process.env.OPENVIKING_ACCOUNT;
  }
  if (process.env.OPENVIKING_USER) {
    headers["X-OpenViking-User"] = process.env.OPENVIKING_USER;
  }
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.status === "error") {
    throw new Error(body.error?.message ?? `${response.status} ${response.statusText}`);
  }
  return body.result ?? body;
}

const health = await request("/health");
await request("/api/v1/content/write", {
  method: "POST",
  body: JSON.stringify({ uri, content, mode: "create" }),
});
const readback = await request(`/api/v1/content/read?uri=${encodeURIComponent(uri)}`);
const tree = await request(`/api/v1/fs/tree?uri=${encodeURIComponent("viking://resources/agentworld")}`);

if (!String(readback).includes("Real OpenViking write and read path is healthy")) {
  throw new Error("OpenViking readback did not match the smoke content");
}

console.log(JSON.stringify({ ok: true, baseUrl, uri, health, tree }, null, 2));
