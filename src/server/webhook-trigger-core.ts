import { timingSafeEqual } from "node:crypto";
import { type TaskBlueprint, type WebhookEndpoint } from "@/server/db";
import { resolveSecretRef, resolveWebhookParser } from "@/server/plugin-sdk-core";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPath(value: unknown, pathParts: string[]) {
  let current: unknown = value;
  for (const part of pathParts) {
    if (!isRecord(current)) return null;
    current = current[part];
  }

  return current;
}

function firstString(value: unknown, paths: string[][]) {
  for (const pathParts of paths) {
    const candidate = readPath(value, pathParts);
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (typeof candidate === "number") return String(candidate);
  }

  return null;
}

function parseRecord(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function validateWebhookSecret(webhook: WebhookEndpoint, request: Request) {
  if (!webhook.secretHint.startsWith("env:")) {
    return {
      ok: false,
      status: 401,
      error: `Webhook secret is not configured for ${webhook.pathKey}`,
    };
  }

  const envKey = webhook.secretHint.slice(4);
  const expected = process.env[envKey];
  if (!expected) {
    return {
      ok: false,
      status: 401,
      error: `Webhook secret is missing for ${webhook.pathKey}`,
    };
  }

  const provided =
    request.headers.get("x-agentworld-webhook-secret") ??
    request.headers.get("x-webhook-secret") ??
    request.headers.get("x-hook-secret");

  const providedBuffer = Buffer.from(provided ?? "");
  const expectedBuffer = Buffer.from(expected);
  const matches =
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer);

  if (!matches) {
    return {
      ok: false,
      status: 401,
      error: `Webhook secret mismatch for ${webhook.pathKey}`,
    };
  }

  return { ok: true };
}

export function matchWebhookBlueprints(pathKey: string, blueprints: TaskBlueprint[]) {
  return blueprints.filter((blueprint) => {
    const trigger = parseRecord(blueprint.triggerJson);
    return trigger.type === "webhook" && trigger.webhookPathKey === pathKey;
  });
}

export function buildWebhookTaskInput(pathKey: string, payload: unknown, request: Request) {
  const eventName =
    request.headers.get("x-gitlab-event") ??
    request.headers.get("x-github-event") ??
    firstString(payload, [["object_kind"], ["event_name"], ["event"]]) ??
    pathKey;
  const deliveryId =
    request.headers.get("x-github-delivery") ??
    request.headers.get("x-gitlab-event-uuid") ??
    request.headers.get("x-request-id") ??
    firstString(payload, [["delivery_id"], ["deliveryId"], ["hook", "id"], ["object_attributes", "id"]]);

  return {
    webhook_path_key: pathKey,
    delivery_id: deliveryId,
    event_name: eventName,
    received_at: new Date().toISOString(),
    repo_id:
      firstString(payload, [
        ["repository", "full_name"],
        ["project", "path_with_namespace"],
        ["repository", "name"],
        ["repo_id"],
      ]) ?? "unknown-repository",
    repo_url:
      firstString(payload, [
        ["repository", "clone_url"],
        ["repository", "ssh_url"],
        ["project", "git_http_url"],
        ["project", "http_url"],
      ]) ?? null,
    mr_id:
      firstString(payload, [
        ["pull_request", "number"],
        ["object_attributes", "iid"],
        ["mergeRequest", "iid"],
        ["mr_id"],
      ]) ?? null,
    mr_title:
      firstString(payload, [
        ["pull_request", "title"],
        ["object_attributes", "title"],
        ["mergeRequest", "title"],
        ["title"],
      ]) ?? null,
    diff_ref:
      firstString(payload, [
        ["pull_request", "head", "sha"],
        ["object_attributes", "last_commit", "id"],
        ["after"],
        ["commitSha"],
        ["diff_ref"],
      ]) ?? null,
    author:
      firstString(payload, [
        ["pull_request", "user", "login"],
        ["user", "username"],
        ["user", "name"],
        ["sender", "login"],
        ["author"],
      ]) ?? "webhook",
    target_branch:
      firstString(payload, [
        ["pull_request", "base", "ref"],
        ["object_attributes", "target_branch"],
        ["mergeRequest", "targetBranch"],
        ["target_branch"],
      ]) ?? null,
    source_branch:
      firstString(payload, [
        ["pull_request", "head", "ref"],
        ["object_attributes", "source_branch"],
        ["mergeRequest", "sourceBranch"],
        ["source_branch"],
      ]) ?? null,
    comment_api_url:
      firstString(payload, [
        ["agentworld", "commentApiUrl"],
        ["inspection", "commentApiUrl"],
        ["commentApiUrl"],
      ]) ?? null,
    raw_payload: payload,
  };
}

function parseBlueprintTrigger(blueprint: TaskBlueprint) {
  return parseRecord(blueprint.triggerJson);
}

export async function buildWebhookTaskInputForBlueprint(args: {
  pathKey: string;
  payload: unknown;
  request: Request;
  blueprint: TaskBlueprint;
}) {
  const trigger = parseBlueprintTrigger(args.blueprint);
  const parserRef =
    (typeof trigger.webhookParserRef === "string" ? trigger.webhookParserRef : null) ??
    (typeof trigger.connector === "string" ? trigger.connector : null);
  const parser = resolveWebhookParser(parserRef);

  if (!parser) {
    return buildWebhookTaskInput(args.pathKey, args.payload, args.request);
  }

  await parser.verify?.({
    request: args.request,
    payload: args.payload,
    configuration: trigger,
    resolveSecretRef: async (ref: string) => resolveSecretRef(ref),
  });

  const parsed = await parser.parse({
    pathKey: args.pathKey,
    request: args.request,
    payload: args.payload,
    configuration: trigger,
  });

  const idempotencyKey = parser.buildIdempotencyKey?.(parsed);
  return idempotencyKey ? { ...parsed, plugin_idempotency_key: idempotencyKey } : parsed;
}
