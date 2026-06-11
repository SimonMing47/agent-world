import { randomUUID } from "node:crypto";
import {
  execute,
  queryAll,
  queryOne,
  type AgentTeam,
  type ExecutionEnvironment,
  type KnowledgeLayer,
  type KnowledgeSpace,
  type KnowledgeSpaceBinding,
  type TaskBlueprint,
  type TaskRun,
} from "@/server/db";
import {
  getKnowledgeEngineHealth,
  getKnowledgeEngineTree,
  searchKnowledgeEntries,
} from "@/server/knowledge-engine";
import { uiText } from "@/lib/language-pack";
import { normalizeKnowledgeCategory, normalizeKnowledgeCategories } from "@/lib/knowledge-categories";
import { normalizeKnowledgeUri, replaceLegacyKnowledgeUriText } from "@/lib/knowledge-uri";

type JsonRecord = Record<string, unknown>;

function nowIso() {
  return new Date().toISOString();
}

function parseRecord(value: string | null | undefined): JsonRecord {
  try {
    const parsed = JSON.parse(value ?? "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as JsonRecord)
      : {};
  } catch {
    return {};
  }
}

function parseStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function parseCommaSeparatedArray(value: unknown) {
  if (!value) return [];
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return Array.isArray(value)
    ? value.flatMap((item) => (typeof item === "string" ? item.split(",") : []))
      .map((item) => item.trim())
      .filter(Boolean)
    : [];
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5/._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "default";
}

function normalizeSpaceSlug(inputSlug: string | null | undefined, fallbackName: string) {
  return slugify(inputSlug?.trim() || fallbackName);
}

function findKnowledgeSpaceBySlug(slug: string) {
  return queryOne<{ id: string }>("SELECT id FROM knowledge_spaces WHERE slug = ?", slug);
}

function availableKnowledgeSpaceSlug(baseSlug: string, currentId?: string) {
  let slug = baseSlug;
  let index = 2;
  while (true) {
    const existing = findKnowledgeSpaceBySlug(slug);
    if (!existing || existing.id === currentId) return slug;
    slug = `${baseSlug}-${index}`;
    index += 1;
  }
}

function resolveKnowledgeSpaceSlug(input: { id?: string; slug?: string | null; name: string }) {
  const explicitSlug = input.slug?.trim();
  const baseSlug = normalizeSpaceSlug(explicitSlug, input.name);
  if (!explicitSlug) return availableKnowledgeSpaceSlug(baseSlug, input.id);

  const existing = findKnowledgeSpaceBySlug(baseSlug);
  if (existing && existing.id !== input.id) {
    throw new Error(
      uiText(
        "ui.server.knowledge.spaceDuplicateSlug",
        "Knowledge space slug already exists. Choose another slug.",
      ),
    );
  }
  return baseSlug;
}

function dedupeByUri<T extends { vikingUri: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const normalizedUri = normalizeKnowledgeUri(item.vikingUri);
    if (seen.has(normalizedUri)) return false;
    seen.add(normalizedUri);
    return true;
  });
}

function normalizeKnowledgeSpaceRecord<T extends KnowledgeSpace>(space: T): T {
  return {
    ...space,
    knowledgeCategory: normalizeKnowledgeCategory(space.knowledgeCategory),
    vikingUri: normalizeKnowledgeUri(space.vikingUri),
    retentionPolicyJson: replaceLegacyKnowledgeUriText(space.retentionPolicyJson),
  };
}

function normalizeKnowledgeLayerRecord<T extends KnowledgeLayer>(layer: T): T {
  return {
    ...layer,
    vikingUri: normalizeKnowledgeUri(layer.vikingUri),
    parentUri: layer.parentUri ? normalizeKnowledgeUri(layer.parentUri) : null,
    retentionPolicyJson: replaceLegacyKnowledgeUriText(layer.retentionPolicyJson),
  };
}

function buildSpaceUri(args: {
  spaceType: string;
  businessTeamSlug?: string | null;
  agentTeamSlug?: string | null;
  projectKey?: string | null;
  slug: string;
}) {
  const teamSlug = slugify(args.businessTeamSlug ?? "global");
  const projectKey = args.projectKey ? slugify(args.projectKey) : null;
  if (args.spaceType === "agent_team") {
    return `agentworld://knowledge/agent/teams/${teamSlug}/agent-teams/${slugify(args.agentTeamSlug ?? args.slug)}`;
  }
  if (args.spaceType === "project") {
    return `agentworld://knowledge/resources/teams/${teamSlug}/projects/${projectKey ?? slugify(args.slug)}`;
  }
  if (args.spaceType === "team") {
    return `agentworld://knowledge/resources/teams/${teamSlug}/${slugify(args.slug)}`;
  }
  return `agentworld://knowledge/resources/global/${slugify(args.slug)}`;
}

export function listKnowledgeSpaces() {
  return queryAll<KnowledgeSpace>(
    "SELECT * FROM knowledge_spaces WHERE status <> 'deleted' ORDER BY CASE space_type WHEN 'global' THEN 0 WHEN 'team' THEN 1 WHEN 'project' THEN 2 WHEN 'agent_team' THEN 3 ELSE 9 END, name ASC",
  ).map(normalizeKnowledgeSpaceRecord);
}

export function listKnowledgeSpaceBindings() {
  return queryAll<KnowledgeSpaceBinding>(
    "SELECT * FROM knowledge_space_bindings ORDER BY load_order ASC, created_at ASC",
  );
}

export function createKnowledgeSpace(input: {
  tenantSpaceId?: string | null;
  name: string;
  slug?: string;
  spaceType: "global" | "team" | "project" | "agent_team";
  businessTeamId?: string | null;
  agentTeamId?: string | null;
  projectKey?: string | null;
  knowledgeCategory?: unknown;
  repositoryName?: string;
  description?: string;
  visibility?: "global" | "team" | "private";
  retentionPolicy?: JsonRecord;
  bindToAgentTeam?: boolean;
}) {
  const now = nowIso();
  const id = randomUUID();

  const businessTeam = input.businessTeamId
    ? queryOne<{ id: string; slug: string; tenantSpaceId: string }>(
        "SELECT id, slug, tenant_space_id FROM business_teams WHERE id = ?",
        input.businessTeamId,
      )
    : null;
  const agentTeam = input.agentTeamId
    ? queryOne<{ id: string; slug: string; businessTeamId: string }>(
        "SELECT id, slug, business_team_id FROM agent_teams WHERE id = ?",
        input.agentTeamId,
      )
    : null;
  const ownerBusinessTeamId = input.businessTeamId ?? agentTeam?.businessTeamId ?? null;
  const resolvedBusinessTeam = ownerBusinessTeamId
    ? businessTeam ??
      queryOne<{ id: string; slug: string; tenantSpaceId: string }>(
        "SELECT id, slug, tenant_space_id FROM business_teams WHERE id = ?",
        ownerBusinessTeamId,
      )
    : null;
  const tenantSpaceId = input.tenantSpaceId || resolvedBusinessTeam?.tenantSpaceId || "";
  if (!tenantSpaceId) throw new Error(uiText("ui.generated.c0eb3cd990d"));
  const slug = resolveKnowledgeSpaceSlug({ slug: input.slug, name: input.name });
  const knowledgeCategory = normalizeKnowledgeCategory(input.knowledgeCategory);
  const vikingUri = buildSpaceUri({
    spaceType: input.spaceType,
    businessTeamSlug: resolvedBusinessTeam?.slug,
    agentTeamSlug: agentTeam?.slug,
    projectKey: input.projectKey,
    slug,
  });

  execute(
    "INSERT INTO knowledge_spaces (id, tenant_space_id, business_team_id, agent_team_id, project_key, knowledge_category, repository_name, slug, name, space_type, viking_uri, description, visibility, status, retention_policy_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    tenantSpaceId,
    ownerBusinessTeamId,
    input.agentTeamId ?? null,
    input.projectKey ? slugify(input.projectKey) : null,
    knowledgeCategory,
    input.repositoryName?.trim() || null,
    slug,
    input.name,
    input.spaceType,
    vikingUri,
    input.description ?? "",
    input.visibility ?? (input.spaceType === "global" ? "global" : "team"),
    "active",
    JSON.stringify(input.retentionPolicy ?? {}),
    now,
    now,
  );

  if (ownerBusinessTeamId) {
    bindKnowledgeSpace({
      knowledgeSpaceId: id,
      targetType: "business_team",
      targetId: ownerBusinessTeamId,
      accessLevel: "write",
      loadOrder: 20,
    });
  }

  if (input.bindToAgentTeam && input.agentTeamId) {
    bindKnowledgeSpace({
      knowledgeSpaceId: id,
      targetType: "agent_team",
      targetId: input.agentTeamId,
      accessLevel: "read",
      loadOrder: 10,
    });
  }

  const created = queryOne<KnowledgeSpace>("SELECT * FROM knowledge_spaces WHERE id = ?", id);
  return created ? normalizeKnowledgeSpaceRecord(created) : null;
}

export function upsertKnowledgeSpace(input: {
  id?: string;
  tenantSpaceId?: string | null;
  name: string;
  slug?: string;
  spaceType: "global" | "team" | "project" | "agent_team";
  businessTeamId?: string | null;
  agentTeamId?: string | null;
  projectKey?: string | null;
  knowledgeCategory?: unknown;
  repositoryName?: string;
  description?: string;
  visibility?: "global" | "team" | "private";
  status?: string;
  retentionPolicyJson?: string;
}) {
  if (!input.id) return createKnowledgeSpace(input);

  const current = queryOne<KnowledgeSpace>("SELECT * FROM knowledge_spaces WHERE id = ?", input.id);
  if (!current) return createKnowledgeSpace(input);

  const businessTeam = input.businessTeamId
    ? queryOne<{ id: string; slug: string; tenantSpaceId: string }>(
        "SELECT id, slug, tenant_space_id FROM business_teams WHERE id = ?",
        input.businessTeamId,
      )
    : null;
  const agentTeam = input.agentTeamId
    ? queryOne<{ id: string; slug: string; businessTeamId: string }>(
        "SELECT id, slug, business_team_id FROM agent_teams WHERE id = ?",
        input.agentTeamId,
      )
    : null;
  const ownerBusinessTeamId = input.businessTeamId ?? agentTeam?.businessTeamId ?? null;
  const resolvedBusinessTeam = ownerBusinessTeamId
    ? businessTeam ??
      queryOne<{ id: string; slug: string; tenantSpaceId: string }>(
        "SELECT id, slug, tenant_space_id FROM business_teams WHERE id = ?",
        ownerBusinessTeamId,
      )
    : null;
  const tenantSpaceId = input.tenantSpaceId || resolvedBusinessTeam?.tenantSpaceId || current.tenantSpaceId || "";
  if (!tenantSpaceId) throw new Error(uiText("ui.generated.c0eb3cd990d"));
  const slug = resolveKnowledgeSpaceSlug({ id: input.id, slug: input.slug, name: input.name });
  const knowledgeCategory = normalizeKnowledgeCategory(input.knowledgeCategory);
  const vikingUri = buildSpaceUri({
    spaceType: input.spaceType,
    businessTeamSlug: resolvedBusinessTeam?.slug,
    agentTeamSlug: agentTeam?.slug,
    projectKey: input.projectKey,
    slug,
  });

  execute(
    "UPDATE knowledge_spaces SET tenant_space_id = ?, business_team_id = ?, agent_team_id = ?, project_key = ?, knowledge_category = ?, repository_name = ?, slug = ?, name = ?, space_type = ?, viking_uri = ?, description = ?, visibility = ?, status = ?, retention_policy_json = ?, updated_at = ? WHERE id = ?",
    tenantSpaceId,
    ownerBusinessTeamId,
    input.agentTeamId ?? null,
    input.projectKey ? slugify(input.projectKey) : null,
    knowledgeCategory,
    input.repositoryName?.trim() || null,
    slug,
    input.name,
    input.spaceType,
    vikingUri,
    input.description ?? "",
    input.visibility ?? (input.spaceType === "global" ? "global" : "team"),
    input.status ?? current.status,
    input.retentionPolicyJson ?? current.retentionPolicyJson,
    nowIso(),
    input.id,
  );
  const updated = queryOne<KnowledgeSpace>("SELECT * FROM knowledge_spaces WHERE id = ?", input.id);
  return updated ? normalizeKnowledgeSpaceRecord(updated) : null;
}

export function deleteKnowledgeSpace(id: string) {
  execute("UPDATE knowledge_spaces SET status = 'deleted', updated_at = ? WHERE id = ?", nowIso(), id);
  execute("DELETE FROM knowledge_space_bindings WHERE knowledge_space_id = ?", id);
}

export function bindKnowledgeSpace(input: {
  knowledgeSpaceId: string;
  targetType: "business_team" | "agent_team" | "task_blueprint" | "agent_definition" | "project";
  targetId: string;
  accessLevel: "read" | "write" | "archive";
  loadOrder?: number;
}) {
  const id = `${input.knowledgeSpaceId}:${input.targetType}:${input.targetId}:${input.accessLevel}`;
  execute(
    "INSERT OR IGNORE INTO knowledge_space_bindings (id, knowledge_space_id, target_type, target_id, access_level, load_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    id,
    input.knowledgeSpaceId,
    input.targetType,
    input.targetId,
    input.accessLevel,
    input.loadOrder ?? 50,
    nowIso(),
  );
  return queryOne<KnowledgeSpaceBinding>("SELECT * FROM knowledge_space_bindings WHERE id = ?", id);
}

function layerUrisFromEnvironment(environment: ExecutionEnvironment | null) {
  if (!environment) return [];
  let parsedLayerRefs: unknown = [];
  try {
    parsedLayerRefs = JSON.parse(environment.memoryLayerRefsJson || "[]");
  } catch {
    parsedLayerRefs = [];
  }
  const layerKeys = parseStringArray(parsedLayerRefs);
  if (layerKeys.length === 0) return [];
  const layers = queryAll<KnowledgeLayer>(
    `SELECT * FROM knowledge_layers WHERE layer_key IN (${layerKeys.map(() => "?").join(",")}) AND is_enabled = 1`,
    ...layerKeys,
  );
  return layers.map(normalizeKnowledgeLayerRecord).map((layer) => ({
    source: "environment_layer",
    name: layer.name,
    vikingUri: layer.vikingUri,
    accessLevel: "read",
    loadOrder: layer.loadOrder,
  }));
}

function directRefsFromMemoryPolicy(blueprint: TaskBlueprint) {
  const policy = parseRecord(blueprint.memoryPolicyJson);
  const requiredSpaces = parseStringArray(policy.requiredSpaces).map((uri, index) => ({
    source: "blueprint_required",
    name: normalizeKnowledgeUri(uri),
    vikingUri: normalizeKnowledgeUri(uri),
    accessLevel: "read",
    loadOrder: 100 + index,
  }));
  const skillSpaces = parseStringArray(policy.skillSpaces).map((uri, index) => ({
    source: "blueprint_skill",
    name: normalizeKnowledgeUri(uri),
    vikingUri: normalizeKnowledgeUri(uri),
    accessLevel: "read",
    loadOrder: 140 + index,
  }));
  const archiveOutputTo = parseStringArray(policy.archiveOutputTo).map((uri, index) => ({
    source: "blueprint_archive",
    name: normalizeKnowledgeUri(uri),
    vikingUri: normalizeKnowledgeUri(uri),
    accessLevel: "archive",
    loadOrder: 180 + index,
  }));

  return { requiredSpaces, skillSpaces, archiveOutputTo, rawPolicy: policy };
}

function spacesForTeam(args: {
  team: AgentTeam;
  blueprint: TaskBlueprint;
  inputPayload: JsonRecord;
}) {
  const bindings = listKnowledgeSpaceBindings();
  const allSpaces = listKnowledgeSpaces().filter((space) => space.status === "active");
  const projectKey = slugify(String(args.inputPayload.repo_id ?? args.inputPayload.project_key ?? args.inputPayload.repository ?? ""));
  const boundSpaceIds = new Set(
    bindings
      .filter(
        (binding) =>
          (binding.targetType === "agent_team" && binding.targetId === args.team.id) ||
          (binding.targetType === "business_team" && binding.targetId === args.team.businessTeamId) ||
          (binding.targetType === "task_blueprint" && binding.targetId === args.blueprint.id) ||
          (binding.targetType === "project" && projectKey && slugify(binding.targetId) === projectKey),
      )
      .map((binding) => binding.knowledgeSpaceId),
  );

  return allSpaces
    .filter(
      (space) =>
        space.spaceType === "global" ||
        space.businessTeamId === args.team.businessTeamId ||
        space.agentTeamId === args.team.id ||
        (space.projectKey && projectKey && slugify(space.projectKey) === projectKey) ||
        boundSpaceIds.has(space.id),
    )
    .map((space) => {
      const binding = bindings.find((candidate) => candidate.knowledgeSpaceId === space.id && boundSpaceIds.has(space.id));
      return {
        id: space.id,
        source: space.spaceType,
        name: space.name,
        spaceType: space.spaceType,
        vikingUri: space.vikingUri,
        accessLevel: binding?.accessLevel ?? (space.businessTeamId === args.team.businessTeamId ? "write" : "read"),
        loadOrder: binding?.loadOrder ?? (space.spaceType === "global" ? 0 : space.spaceType === "agent_team" ? 10 : 40),
      };
    });
}

export function resolveTaskKnowledgeContext(args: {
  blueprint: TaskBlueprint;
  team: AgentTeam;
  environment: ExecutionEnvironment | null;
  inputPayload: JsonRecord;
}) {
  const spaces = spacesForTeam({
    team: args.team,
    blueprint: args.blueprint,
    inputPayload: args.inputPayload,
  });
  const environmentRefs = layerUrisFromEnvironment(args.environment);
  const policyRefs = directRefsFromMemoryPolicy(args.blueprint);
  const loadRefs = dedupeByUri(
    [...spaces, ...environmentRefs, ...policyRefs.requiredSpaces, ...policyRefs.skillSpaces]
      .filter((ref) => ref.accessLevel !== "archive")
      .sort((left, right) => left.loadOrder - right.loadOrder),
  );
  const archiveRefs = dedupeByUri(
    [...spaces.filter((space) => space.accessLevel === "archive" || space.accessLevel === "write"), ...policyRefs.archiveOutputTo]
      .sort((left, right) => left.loadOrder - right.loadOrder),
  );

  return {
    policy: policyRefs.rawPolicy,
    spaces,
    loadRefs,
    archiveRefs,
    resolution: {
      teamId: args.team.id,
      businessTeamId: args.team.businessTeamId,
      blueprintId: args.blueprint.id,
      environmentId: args.environment?.id ?? null,
      projectKey: args.inputPayload.repo_id ?? args.inputPayload.project_key ?? null,
      resolvedAt: nowIso(),
    },
  };
}

export async function buildTaskRunKnowledgeRetrieval(
  taskRun: TaskRun,
  options: {
    query?: string;
    knowledgeSpaceIds?: string[];
    scopeUris?: string[];
    knowledgeCategories?: string[];
    repositoryNames?: string[];
    levels?: Array<"L0" | "L1" | "L2">;
    limit?: number;
    includeOutboundUris?: boolean;
  } = {},
) {
  const snapshot = taskRun.environmentSnapshotId
    ? queryOne<{ snapshotJson: string }>("SELECT snapshot_json FROM environment_snapshots WHERE id = ?", taskRun.environmentSnapshotId)
    : null;
  const payload = parseRecord(snapshot?.snapshotJson);
  const knowledgeContext = parseRecord(JSON.stringify(payload.knowledgeContext ?? {}));
  const queryFromInput = typeof options.query === "string" ? options.query.trim() : "";
  const queryFromPayload = typeof payload.query === "string" ? payload.query.trim() : "";
  const query = queryFromInput || queryFromPayload;
  const loadRefs = parseStringArray(
    Array.isArray(knowledgeContext.loadRefs)
      ? (knowledgeContext.loadRefs as Array<{ vikingUri?: string }>).map((ref) => ref.vikingUri).filter(Boolean)
      : [],
  );
  const scopeUris = [...new Set([...loadRefs, ...parseStringArray(options.scopeUris)])];
  const knowledgeSpaceIds = [...new Set((options.knowledgeSpaceIds ?? []).map((id) => id.trim()).filter(Boolean))];
  const knowledgeCategories = normalizeKnowledgeCategories(options.knowledgeCategories);
  const repositoryNames = [...new Set(parseCommaSeparatedArray(options.repositoryNames))];
  const health = await getKnowledgeEngineHealth();
  const refs = [];

  for (const uri of loadRefs.slice(0, 6)) {
    if (!health.ok) {
      refs.push({ uri, status: "degraded", entries: 0 });
      continue;
    }
    const tree = await getKnowledgeEngineTree(uri, 2).catch(() => []);
    refs.push({ uri, status: "loaded", entries: tree.length });
  }

  const searchable = query
    ? searchKnowledgeEntries({
        query,
        scopeUris,
        knowledgeSpaceIds,
        knowledgeCategories,
        repositoryNames,
        levels: options.levels,
        limit: options.limit,
        includeOutboundUris: options.includeOutboundUris,
      })
    : null;

  const searchResult = searchable
    ? {
        query: searchable.query,
        totalEntries: searchable.totalEntries,
        totalCandidates: searchable.totalCandidates,
        hits: searchable.hits,
      }
    : null;

  return {
    health: {
      ok: health.ok,
      baseUrl: health.baseUrl,
      error: health.error,
    },
    refs,
    totalRefs: loadRefs.length,
    degraded: !health.ok,
    query: query || null,
    search: searchResult,
  };
}
