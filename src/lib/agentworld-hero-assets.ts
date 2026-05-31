import type { AgentCapabilityKey } from "@/lib/agent-capability-profile";
import referenceLockedTraitsJson from "../../public/agentworld-assets/hero-pack/v1/AgentWorld_Download_Pack_v1/legacy/AgentWorld_ReferenceLocked_PixelKit_v0_2/metadata/agentworld_reference_locked_traits.json";

export const agentWorldHeroPackId = "agentworld-hero-pack-v1" as const;
export const agentWorldHeroPackBasePath = "/agentworld-assets/hero-pack/v1/AgentWorld_Download_Pack_v1" as const;
export const agentWorldHeroPackDownloadPath =
  "/agentworld-assets/hero-pack/v1/AgentWorld_Download_Pack_v1.zip" as const;

const agentWorldHeroReferenceLockedBasePath =
  `${agentWorldHeroPackBasePath}/legacy/AgentWorld_ReferenceLocked_PixelKit_v0_2` as const;

export type AgentWorldHeroPackId = typeof agentWorldHeroPackId;

export const agentWorldHeroLayerIds = [
  "ground",
  "side_prop",
  "aura",
  "hair",
  "shoes",
  "outfit",
  "face",
  "headgear",
  "detail",
  "hand_item",
] as const;

export type AgentWorldHeroLayer = (typeof agentWorldHeroLayerIds)[number];
export type AgentWorldHeroTraits = Partial<Record<AgentWorldHeroLayer, string>>;

type RawReferenceLayer = {
  layer: string;
  z_index: number;
  description?: string;
  description_zh?: string;
};

type RawReferenceTrait = {
  trait_id: string;
  layer: string;
  display_name?: string;
  display_name_zh?: string;
  path: string;
  rarity?: string;
  tags?: string[];
  role_affinity?: string[];
  source?: string;
};

type RawReferenceRole = {
  role_id: string;
  display_name?: string;
  display_name_zh?: string;
  preview_path: string;
  visual_recipe: Record<string, string>;
  generation_note?: string;
};

type RawReferenceLockedTraits = {
  pack_id: string;
  display_name: string;
  canvas?: {
    width?: number;
    height?: number;
  };
  layers: RawReferenceLayer[];
  traits: RawReferenceTrait[];
  roles: RawReferenceRole[];
};

export type AgentWorldHeroAsset = {
  traitId: string;
  name: string;
  category: string;
  variant: string;
  sheetFile: string;
  sheetUrl: string;
  cropFile: string;
  cropUrl: string;
  layer: AgentWorldHeroLayer;
  zIndex: number;
  description: string;
};

export type AgentWorldHeroResolvedLayer = AgentWorldHeroAsset & {
  src: string;
};

export type AgentWorldHeroExampleAgent = {
  agentId: string;
  displayName: string;
  traits: AgentWorldHeroTraits;
  previewSrc: string;
};

const rawReferencePack = referenceLockedTraitsJson as RawReferenceLockedTraits;

export const agentWorldHeroCanvas = {
  width: rawReferencePack.canvas?.width ?? 256,
  height: rawReferencePack.canvas?.height ?? 256,
};

function isAgentWorldHeroLayer(value: unknown): value is AgentWorldHeroLayer {
  return typeof value === "string" && (agentWorldHeroLayerIds as readonly string[]).includes(value);
}

function toReferenceAssetUrl(path: string) {
  return `${agentWorldHeroReferenceLockedBasePath}/${path.replace(/^\/+/, "")}`;
}

function displayName(...values: Array<string | null | undefined>) {
  return values.find((value) => value?.trim()) ?? "";
}

function variantFromTraitId(layer: AgentWorldHeroLayer, traitId: string) {
  return traitId.replace(new RegExp(`^${layer}[_\\.]?`), "");
}

export const agentWorldHeroLayerSchema = rawReferencePack.layers
  .filter((layer) => isAgentWorldHeroLayer(layer.layer))
  .sort((left, right) => left.z_index - right.z_index)
  .map((layer) => ({
    layer: layer.layer as AgentWorldHeroLayer,
    zIndex: layer.z_index,
    description: displayName(layer.description_zh, layer.description, layer.layer),
  }));

export const agentWorldHeroLayerOrder = agentWorldHeroLayerSchema.map((layer) => layer.layer);

const layerZIndex = new Map(agentWorldHeroLayerSchema.map((layer) => [layer.layer, layer.zIndex]));

export const agentWorldHeroAssets: AgentWorldHeroAsset[] = rawReferencePack.traits
  .filter((asset) => isAgentWorldHeroLayer(asset.layer))
  .map((asset) => {
    const layer = asset.layer as AgentWorldHeroLayer;
    return {
      traitId: asset.trait_id,
      name: displayName(asset.display_name_zh, asset.display_name, asset.trait_id),
      category: layer,
      variant: variantFromTraitId(layer, asset.trait_id),
      sheetFile: "",
      sheetUrl: "",
      cropFile: asset.path,
      cropUrl: toReferenceAssetUrl(asset.path),
      layer,
      zIndex: layerZIndex.get(layer) ?? 0,
      description: displayName(asset.display_name_zh, asset.display_name, asset.trait_id),
    };
  })
  .sort((left, right) => left.zIndex - right.zIndex || left.traitId.localeCompare(right.traitId));

const assetByTraitId = new Map(agentWorldHeroAssets.map((asset) => [asset.traitId, asset]));

const assetsByLayer = agentWorldHeroLayerOrder.reduce(
  (grouped, layer) => ({
    ...grouped,
    [layer]: agentWorldHeroAssets.filter((asset) => asset.layer === layer),
  }),
  {} as Record<AgentWorldHeroLayer, AgentWorldHeroAsset[]>,
);

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function validTraitForLayer(layer: AgentWorldHeroLayer, traitId: string | undefined) {
  const asset = traitId ? assetByTraitId.get(traitId) : null;
  return asset?.layer === layer ? asset.traitId : null;
}

function pickTrait(layer: AgentWorldHeroLayer, seed: number, offset: number) {
  const candidates = assetsByLayer[layer];
  if (candidates.length === 0) return undefined;
  return candidates[(seed + offset) % candidates.length]?.traitId;
}

export function getAgentWorldHeroAsset(traitId: string | null | undefined) {
  return traitId ? assetByTraitId.get(traitId) ?? null : null;
}

export function getAgentWorldHeroCropUrl(traitId: string | null | undefined) {
  return getAgentWorldHeroAsset(traitId)?.cropUrl ?? null;
}

export function getAgentWorldHeroAssetsByLayer(layer: AgentWorldHeroLayer) {
  return assetsByLayer[layer] ?? [];
}

export function normalizeAgentWorldHeroTraits(rawTraits: unknown): AgentWorldHeroTraits {
  if (!rawTraits || typeof rawTraits !== "object" || Array.isArray(rawTraits)) return {};

  const traits: AgentWorldHeroTraits = {};
  for (const [layer, traitId] of Object.entries(rawTraits as Record<string, unknown>)) {
    if (!isAgentWorldHeroLayer(layer) || typeof traitId !== "string") continue;
    const validTrait = validTraitForLayer(layer, traitId);
    if (validTrait) traits[layer] = validTrait;
  }
  return traits;
}

export const agentWorldHeroExampleAgents: AgentWorldHeroExampleAgent[] = rawReferencePack.roles.map((agent) => ({
  agentId: agent.role_id,
  displayName: displayName(agent.display_name_zh, agent.display_name, agent.role_id),
  traits: normalizeAgentWorldHeroTraits(agent.visual_recipe),
  previewSrc: toReferenceAssetUrl(agent.preview_path),
}));

const exampleAgentById = new Map(agentWorldHeroExampleAgents.map((agent) => [agent.agentId, agent]));

const exampleAgentsByCapability: Record<AgentCapabilityKey, string[]> = {
  permission: ["guardian_warrior", "oracle_diplomat"],
  toolUse: ["mechanic_engineer", "navigator_pilot"],
  safety: ["guardian_warrior", "explorer_scout"],
  coding: ["cyber_hacker", "mechanic_engineer"],
  review: ["scholar_archivist", "oracle_diplomat"],
  memory: ["oracle_diplomat", "scholar_archivist"],
  collaboration: ["merchant_coordinator", "bard_narrator", "healer_support"],
};

function pickExampleAgent(seedHash: number, capabilityKey?: AgentCapabilityKey | null, exampleAgentId?: string | null) {
  const configuredExample = exampleAgentId ? exampleAgentById.get(exampleAgentId) : null;
  if (configuredExample) return configuredExample;

  const capabilityExamples = capabilityKey
    ? exampleAgentsByCapability[capabilityKey].map((agentId) => exampleAgentById.get(agentId)).filter(Boolean)
    : [];
  if (capabilityExamples.length > 0) {
    return capabilityExamples[seedHash % capabilityExamples.length] ?? null;
  }

  if (agentWorldHeroExampleAgents.length === 0) return null;
  return agentWorldHeroExampleAgents[seedHash % agentWorldHeroExampleAgents.length] ?? null;
}

export function resolveAgentWorldHeroTraits({
  seed = "agentworld-hero",
  configuredTraits,
  capabilityKey,
  exampleAgentId,
}: {
  seed?: string;
  configuredTraits?: AgentWorldHeroTraits | null;
  capabilityKey?: AgentCapabilityKey | null;
  exampleAgentId?: string | null;
}): AgentWorldHeroTraits {
  const seedHash = hashSeed(seed || "agentworld-hero");
  const configured = normalizeAgentWorldHeroTraits(configuredTraits);
  const baseExample = pickExampleAgent(seedHash, capabilityKey, exampleAgentId);
  const traits: AgentWorldHeroTraits = {};

  agentWorldHeroLayerOrder.forEach((layer, index) => {
    traits[layer] = configured[layer] ?? baseExample?.traits[layer] ?? pickTrait(layer, seedHash, index * 29);
  });

  return traits;
}

export function resolveAgentWorldHeroLayers(input: {
  seed?: string;
  configuredTraits?: AgentWorldHeroTraits | null;
  capabilityKey?: AgentCapabilityKey | null;
  exampleAgentId?: string | null;
}): AgentWorldHeroResolvedLayer[] {
  const traits = resolveAgentWorldHeroTraits(input);
  return agentWorldHeroLayerOrder
    .map((layer) => {
      const asset = getAgentWorldHeroAsset(traits[layer]);
      return asset ? { ...asset, src: asset.cropUrl } : null;
    })
    .filter((asset): asset is AgentWorldHeroResolvedLayer => Boolean(asset));
}
