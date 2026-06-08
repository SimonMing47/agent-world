import type { AgentCapabilityKey } from "@/lib/agent-capability-profile";
import v1ReferencePackJson from "../../public/agentworld-assets/hero-pack/v1/AgentWorld_Download_Pack_v1/legacy/AgentWorld_ReferenceLocked_PixelKit_v0_2/metadata/agentworld_reference_locked_traits.json";
import v2ImportConfigJson from "../../public/agentworld-assets/hero-pack/v2/agentworld_import_config.json";
import v2ManifestJson from "../../public/agentworld-assets/hero-pack/v2/metadata/agentworld_qpixel_manifest.json";
import v2GenerationRulesJson from "../../public/agentworld-assets/hero-pack/v2/metadata/agentworld_generation_rules.json";
import v2RolePresetsJson from "../../public/agentworld-assets/hero-pack/v2/metadata/agentworld_role_presets.json";
import v2RecipeExamplesJson from "../../public/agentworld-assets/hero-pack/v2/metadata/agentworld_recipe_examples.json";

export const agentWorldHeroPackIdV1 = "agentworld-hero-pack-v1" as const;
export const agentWorldHeroPackIdV2 = "agentworld-qpixel-chibi-kit-v2" as const;
export const agentWorldHeroPackId = agentWorldHeroPackIdV2;

export const agentWorldHeroPackBasePath = "/agentworld-assets/hero-pack/v2" as const;
export const agentWorldHeroPackBasePathLegacy =
  "/agentworld-assets/hero-pack/v1/AgentWorld_Download_Pack_v1" as const;
export const agentWorldHeroPackDownloadPathLegacy = "/agentworld-assets/hero-pack/v1/AgentWorld_Download_Pack_v1.zip" as const;

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
  "special_background",
  "base",
  "lower_body",
  "head_upper",
  "full_character",
] as const;

export type AgentWorldHeroPackId = typeof agentWorldHeroPackIdV1 | typeof agentWorldHeroPackIdV2;
export type AgentWorldHeroLayer = (typeof agentWorldHeroLayerIds)[number];
export type AgentWorldHeroTraits = Partial<Record<AgentWorldHeroLayer, string>>;

type RawV1Layer = {
  layer: string;
  z_index: number;
  description?: string;
  description_zh?: string;
};

type RawV1Trait = {
  trait_id: string;
  layer: string;
  display_name?: string;
  display_name_zh?: string;
  path: string;
};

type RawV1Role = {
  role_id: string;
  display_name?: string;
  display_name_zh?: string;
  preview_path: string;
  visual_recipe: Record<string, string>;
};

type RawV1Pack = {
  pack_id: string;
  display_name: string;
  canvas?: {
    width?: number;
    height?: number;
  };
  layers: RawV1Layer[];
  traits: RawV1Trait[];
  roles: RawV1Role[];
};

type RawV2Layer = {
  layer: string;
  z_index: number;
  usage?: string;
  description?: string;
};

type RawV2Trait = {
  trait_id: string;
  name?: string;
  category: string;
  layer: string;
  role_hint?: string;
  file: string;
  icon_256?: string;
  aligned_512?: string;
  is_example?: boolean;
};

type RawV2Manifest = {
  pack_name: string;
  version: string;
  layers: RawV2Layer[];
  traits: RawV2Trait[];
};

type RawV2ImportAssetDirs = {
  sheets?: string;
  elements?: string;
  icons_256?: string;
  aligned_512?: string;
};

type RawV2ImportEntryFiles = {
  [key: string]: string | undefined;
  import_config?: string;
  manifest?: string;
  role_presets?: string;
  rules?: string;
  recipes?: string;
};

type RawV2ImportConfig = {
  name: string;
  version: string;
  manifest: string;
  role_presets: string;
  generation_rules: string;
  recipe_examples: string;
  asset_dirs?: RawV2ImportAssetDirs;
  entry_files?: RawV2ImportEntryFiles;
};

type RawV2GenerationRules = {
  default_background?: string;
  special_background_rule?: string;
};

type RawV2RolePreset = {
  preferred: string[];
};

type RawV2Recipe = {
  agent_id: string;
  role: string;
  traits: string[];
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
  sourcePack: AgentWorldHeroPackId;
  roleHint?: string;
  isExampleOnly: boolean;
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

type HeroPackDefinition = {
  id: AgentWorldHeroPackId;
  name: string;
  version: string;
  canvas: {
    width: number;
    height: number;
  };
  importConfig: RawV2ImportConfig | null;
  layerSchema: Array<{
    layer: AgentWorldHeroLayer;
    zIndex: number;
    description: string;
  }>;
  layerOrder: AgentWorldHeroLayer[];
  assets: AgentWorldHeroAsset[];
  assetsById: Map<string, AgentWorldHeroAsset>;
  assetsByLayer: Partial<Record<AgentWorldHeroLayer, AgentWorldHeroAsset[]>>;
  rolePresetTraits: Map<string, string[]>;
  exampleAgents: AgentWorldHeroExampleAgent[];
  exampleAgentById: Map<string, AgentWorldHeroExampleAgent>;
  generationRules: {
    defaultBackground: string;
    specialRoleKeywords: string[];
  };
};

const v1ReferencePack = v1ReferencePackJson as RawV1Pack;
const v2ImportConfig = v2ImportConfigJson as RawV2ImportConfig;
const v2Manifest = v2ManifestJson as RawV2Manifest;
const v2GenerationRules = v2GenerationRulesJson as RawV2GenerationRules;
const v2RolePresets = v2RolePresetsJson as Record<string, RawV2RolePreset>;
const v2RecipeExamples = v2RecipeExamplesJson as RawV2Recipe[];

function resolveImportConfigPath(entryFiles: RawV2ImportEntryFiles | undefined, candidate: string, fallback?: string) {
  return ((entryFiles?.[candidate] as string | undefined) ?? fallback ?? "").trim();
}

const v2ResolvedImportConfig: RawV2ImportConfig = {
  ...v2ImportConfig,
  manifest: resolveImportConfigPath(v2ImportConfig.entry_files, "manifest", v2ImportConfig.manifest),
  role_presets: resolveImportConfigPath(v2ImportConfig.entry_files, "role_presets", v2ImportConfig.role_presets),
  generation_rules: resolveImportConfigPath(v2ImportConfig.entry_files, "rules", v2ImportConfig.generation_rules),
  recipe_examples: resolveImportConfigPath(v2ImportConfig.entry_files, "recipes", v2ImportConfig.recipe_examples),
};

export const agentWorldHeroPackV2Metadata = {
  configPath: `${agentWorldHeroPackBasePath}/agentworld_import_config.json`,
  manifestPath: `${agentWorldHeroPackBasePath}/${v2ResolvedImportConfig.manifest}`,
  rolePresetsPath: `${agentWorldHeroPackBasePath}/${v2ResolvedImportConfig.role_presets}`,
  generationRulesPath: `${agentWorldHeroPackBasePath}/${v2ResolvedImportConfig.generation_rules}`,
  recipeExamplesPath: `${agentWorldHeroPackBasePath}/${v2ResolvedImportConfig.recipe_examples}`,
  assetDirs: {
    aligned512: `${agentWorldHeroPackBasePath}/${v2ImportConfig.asset_dirs?.aligned_512 ?? "assets/aligned_512"}`,
  },
  packName: v2ImportConfig.name,
  packVersion: v2ImportConfig.version,
};

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickIndex(seed: number, length: number, offset = 0) {
  if (length <= 0) return 0;
  const mixed = (seed ^ (seed >>> 16) ^ Math.imul(offset + 1, 2246822519)) >>> 0;
  return mixed % length;
}

function pickByStableScore<T>(items: T[], seed: number, offset: number, getKey: (item: T) => string) {
  return items.reduce<T | undefined>((selected, item) => {
    if (!selected) return item;
    const itemScore = hashSeed(`${seed}:${offset}:${getKey(item)}`);
    const selectedScore = hashSeed(`${seed}:${offset}:${getKey(selected)}`);
    return itemScore > selectedScore ? item : selected;
  }, undefined);
}

function toDisplayName(...values: Array<string | null | undefined>) {
  return values.find((value) => value?.trim()) ?? "";
}

function toAssetUrl(basePath: string, relativePath: string) {
  return `${basePath}/${relativePath.replace(/^\/+/, "")}`;
}

function normalizeRoleText(value: string | null | undefined) {
  return (value ?? "").toLowerCase().trim().replace(/[\s_./-]+/g, " ");
}

function isAgentWorldHeroLayerValue(value: unknown): value is AgentWorldHeroLayer {
  return typeof value === "string" && (agentWorldHeroLayerIds as readonly string[]).includes(value);
}

function normalizeRoleTokens(value: string | null | undefined) {
  return normalizeRoleText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function roleTokenMatch(left: string | null | undefined, right: string | null | undefined) {
  const normalizedLeft = normalizeRoleText(left);
  const normalizedRight = normalizeRoleText(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;
  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) return true;

  const leftTokens = new Set(normalizeRoleTokens(left));
  const rightTokens = new Set(normalizeRoleTokens(right));
  for (const leftToken of leftTokens) {
    if (rightTokens.has(leftToken)) return true;
  }
  for (const leftToken of leftTokens) {
    for (const rightToken of rightTokens) {
      if (leftToken.includes(rightToken) || rightToken.includes(leftToken)) return true;
    }
  }

  return false;
}

function mapLayerName(layerName: string) {
  if (layerName === "background") return "special_background";
  if (layerName === "item") return "hand_item";
  if (layerName === "example_full") return "full_character";
  return layerName;
}

function normalizeLayer(layerName: string) {
  const mapped = mapLayerName(layerName);
  return isAgentWorldHeroLayerValue(mapped) ? mapped : null;
}

function variantFromTraitId(traitId: string, layer: AgentWorldHeroLayer) {
  return traitId.replace(new RegExp(`^${layer}[._]?`, "i"), "") || traitId;
}

function inferSpecialRoleKeywords() {
  const raw = normalizeRoleText(v2GenerationRules.special_background_rule || "");
  const inferred: string[] = [];
  if (raw.includes("leader")) inferred.push("leader");
  if (raw.includes("boss")) inferred.push("boss");
  if (raw.includes("archmage")) inferred.push("archmage");
  if (raw.includes("commander")) inferred.push("commander");
  if (raw.includes("cyber")) inferred.push("cyber");
  return inferred.length ? inferred : ["leader", "boss", "archmage", "commander", "cyber"];
}

const SPECIAL_ROLE_ALIASES: Record<string, string[]> = {
  leader: ["leader", "captain", "captain leader", "leader_leader", "leader-lord", "队长", "首领", "领导"],
  boss: ["boss", "boss_lair", "boss lair", "boss", "首脑", "指挥官", "头目"],
  archmage: ["archmage", "master mage", "arch mage", "大法师", "法师长"],
  commander: ["commander", "cyber commander", "cyber_leader", "cyber commander", "指挥官", "队长"],
  cyber: ["cyber", "cyberpunk", "赛博", "cyber commander"],
};

function normalizePackId(value: string | null | undefined): AgentWorldHeroPackId {
  return value === agentWorldHeroPackIdV1 || value === agentWorldHeroPackIdV2 ? value : agentWorldHeroPackId;
}

function mergeBuckets(order: AgentWorldHeroLayer[]) {
  return order.reduce(
    (acc, layer) => {
      acc[layer] = [];
      return acc;
    },
    {} as Partial<Record<AgentWorldHeroLayer, AgentWorldHeroAsset[]>>,
  );
}

function extractTraitsPreviewUrl(traits: AgentWorldHeroTraits, assetsById: Map<string, AgentWorldHeroAsset>) {
  return (
    Object.values(traits)
      .map((traitId) => assetsById.get(traitId)?.cropUrl)
      .find((value): value is string => Boolean(value)) ?? ""
  );
}

function normalizeHeroTraitsWithAssets(
  rawTraits: unknown,
  assetsById: Map<string, AgentWorldHeroAsset>,
  layerOrder: readonly AgentWorldHeroLayer[],
  includeUnknownLayers = false,
): AgentWorldHeroTraits {
  if (!rawTraits || typeof rawTraits !== "object" || Array.isArray(rawTraits)) return {};
  const traits: AgentWorldHeroTraits = {};

  for (const [layer, traitId] of Object.entries(rawTraits as Record<string, unknown>)) {
    if (!isAgentWorldHeroLayer(layer) || typeof traitId !== "string") continue;
    const trait = assetsById.get(traitId);
    if (!trait || trait.layer !== layer) continue;
    if (!includeUnknownLayers && !layerOrder.includes(layer)) continue;
    traits[layer] = trait.traitId;
  }

  return traits;
}

function buildV1Pack(): HeroPackDefinition {
  const basePath = `${agentWorldHeroPackBasePathLegacy}/legacy/AgentWorld_ReferenceLocked_PixelKit_v0_2` as const;
  const layerSchema = v1ReferencePack.layers
    .filter((layer) => isAgentWorldHeroLayer(layer.layer))
    .map((layer) => ({
      layer: layer.layer as AgentWorldHeroLayer,
      zIndex: layer.z_index,
      description: toDisplayName(layer.description_zh, layer.description, layer.layer),
    }))
    .sort((left, right) => left.zIndex - right.zIndex);

  const layerOrder = layerSchema.map((layer) => layer.layer);
  const assetsByLayer = mergeBuckets(layerOrder);
  const layerZIndex = new Map(layerSchema.map((item) => [item.layer, item.zIndex]));

  const assets = v1ReferencePack.traits
    .map((asset) => {
      const layer = normalizeLayer(asset.layer);
      if (!isAgentWorldHeroLayer(layer)) return null;
      const name = toDisplayName(asset.display_name_zh, asset.display_name, asset.trait_id);
      const sheetFile = asset.path;
      return {
        traitId: asset.trait_id,
        name,
        category: layer,
        variant: variantFromTraitId(asset.trait_id, layer),
        sheetFile,
        sheetUrl: toAssetUrl(basePath, sheetFile),
        cropFile: sheetFile,
        cropUrl: toAssetUrl(basePath, sheetFile),
        layer,
        zIndex: layerZIndex.get(layer) ?? 0,
        description: name,
        sourcePack: agentWorldHeroPackIdV1,
        isExampleOnly: false,
      } as AgentWorldHeroAsset;
    })
    .filter((item): item is AgentWorldHeroAsset => Boolean(item))
    .sort((left, right) => {
      if (left.zIndex !== right.zIndex) return left.zIndex - right.zIndex;
      return left.traitId.localeCompare(right.traitId);
    });

  assets.forEach((asset) => {
    assetsByLayer[asset.layer]?.push(asset);
  });

  const assetsById = new Map(assets.map((item) => [item.traitId, item]));
  const exampleAgents = v1ReferencePack.roles.map((role) => ({
    agentId: role.role_id,
    displayName: toDisplayName(role.display_name_zh, role.display_name, role.role_id),
    traits: normalizeHeroTraitsWithAssets(role.visual_recipe, assetsById, layerOrder),
    previewSrc: toAssetUrl(basePath, role.preview_path),
  }));

  return {
    id: agentWorldHeroPackIdV1,
    name: v1ReferencePack.display_name,
    version: v1ReferencePack.pack_id,
    canvas: {
      width: v1ReferencePack.canvas?.width ?? 256,
      height: v1ReferencePack.canvas?.height ?? 256,
    },
    importConfig: null,
    layerSchema,
    layerOrder,
    assets,
    assetsById,
    assetsByLayer,
    rolePresetTraits: new Map(),
    exampleAgents,
    exampleAgentById: new Map(exampleAgents.map((agent) => [agent.agentId, agent])),
    generationRules: {
      defaultBackground: "#070b16",
      specialRoleKeywords: ["leader", "boss", "archmage", "commander", "cyber"],
    },
  };
}

function buildV2Pack(): HeroPackDefinition {
  const layerSchema = v2Manifest.layers
    .map((layer) => {
      const normalizedLayer = normalizeLayer(layer.layer);
      return normalizedLayer
        ? {
            layer: normalizedLayer,
            zIndex: layer.z_index,
            description: toDisplayName(layer.description, layer.usage, layer.layer),
          }
        : null;
    })
    .filter((layer): layer is { layer: AgentWorldHeroLayer; zIndex: number; description: string } => Boolean(layer))
    .sort((left, right) => left.zIndex - right.zIndex);

  const layerOrder = layerSchema.map((layer) => layer.layer);
  const assetsByLayer = mergeBuckets(layerOrder);
  const layerZIndex = new Map(layerSchema.map((item) => [item.layer, item.zIndex]));

  const assets = v2Manifest.traits
    .map((trait) => {
      const layer = normalizeLayer(trait.layer);
      if (!isAgentWorldHeroLayer(layer)) return null;
      const file = trait.aligned_512 || trait.file;
      const name = toDisplayName(trait.name, trait.trait_id);
      return {
        traitId: trait.trait_id,
        name,
        category: trait.category,
        variant: variantFromTraitId(trait.trait_id, layer),
        sheetFile: trait.file,
        sheetUrl: toAssetUrl(agentWorldHeroPackBasePath, file),
        cropFile: file,
        cropUrl: toAssetUrl(agentWorldHeroPackBasePath, file),
        layer,
        zIndex: layerZIndex.get(layer) ?? 0,
        description: name,
        sourcePack: agentWorldHeroPackIdV2,
        roleHint: trait.role_hint,
        isExampleOnly: trait.is_example === true,
      } as AgentWorldHeroAsset;
    })
    .filter((item): item is AgentWorldHeroAsset => Boolean(item))
    .sort((left, right) => {
      if (left.zIndex !== right.zIndex) return left.zIndex - right.zIndex;
      return left.traitId.localeCompare(right.traitId);
    });

  assets.forEach((asset) => {
    assetsByLayer[asset.layer]?.push(asset);
  });

  const assetsById = new Map(assets.map((asset) => [asset.traitId, asset]));
  const rolePresetTraits = new Map<string, string[]>();
  for (const [role, preset] of Object.entries(v2RolePresets)) {
    rolePresetTraits.set(normalizeRoleText(role), preset.preferred || []);
  }

  const exampleFromFullCharacters = (assetsByLayer.full_character ?? []).map(
    (asset) =>
      ({
        agentId: toExampleAgentId(asset),
        displayName: asset.name,
        traits: {
          full_character: asset.traitId,
        },
        previewSrc: asset.cropUrl,
      }) as AgentWorldHeroExampleAgent,
  );

  const exampleFromRecipes = v2RecipeExamples
    .map((recipe) => {
      const traits: AgentWorldHeroTraits = {};
      recipe.traits.forEach((traitId) => {
        const trait = assetsById.get(traitId);
        if (trait) {
          traits[trait.layer] = traitId;
        }
      });
      return {
        agentId: recipe.agent_id,
        displayName: toDisplayName(recipe.role, recipe.agent_id),
        traits,
        previewSrc: extractTraitsPreviewUrl(traits, assetsById),
      } as AgentWorldHeroExampleAgent;
    })
    .filter((item) => Object.keys(item.traits).length > 0);

  const exampleFromPresets = Array.from(rolePresetTraits.entries())
    .map(([role, traits]) => {
      const normalized: AgentWorldHeroTraits = {};
      traits.forEach((traitId) => {
        const trait = assetsById.get(traitId);
        if (trait) normalized[trait.layer] = traitId;
      });
        if (Object.keys(normalized).length === 0) return null;
        return {
          agentId: role,
          displayName: role,
          traits: normalized,
          previewSrc: extractTraitsPreviewUrl(normalized, assetsById),
        } as AgentWorldHeroExampleAgent;
      })
    .filter((item): item is AgentWorldHeroExampleAgent => Boolean(item));

  const byId = new Map<string, AgentWorldHeroExampleAgent>();
  const examples: AgentWorldHeroExampleAgent[] = [];
  for (const item of [...exampleFromFullCharacters, ...exampleFromRecipes, ...exampleFromPresets]) {
    if (!byId.has(item.agentId)) {
      byId.set(item.agentId, item);
      examples.push(item);
    }
  }

  return {
    id: agentWorldHeroPackIdV2,
    name: v2ImportConfig.name,
    version: v2Manifest.version || v2ImportConfig.version,
    canvas: {
      width: 512,
      height: 512,
    },
    importConfig: v2ImportConfig,
    layerSchema,
    layerOrder,
    assets,
    assetsById,
    assetsByLayer,
    rolePresetTraits,
    exampleAgents: examples,
    exampleAgentById: new Map(examples.map((item) => [item.agentId, item])),
    generationRules: {
      defaultBackground: normalizeRoleText(v2GenerationRules.default_background) === "white" ? "#ffffff" : "#f8f8f8",
      specialRoleKeywords: inferSpecialRoleKeywords(),
    },
  };
}

const v1Pack = buildV1Pack();
const v2Pack = buildV2Pack();
const heroPacks: Record<AgentWorldHeroPackId, HeroPackDefinition> = {
  [agentWorldHeroPackIdV1]: v1Pack,
  [agentWorldHeroPackIdV2]: v2Pack,
};

export const agentWorldHeroCanvas = heroPacks[agentWorldHeroPackId].canvas;
export const agentWorldHeroLayerSchema = heroPacks[agentWorldHeroPackId].layerSchema;
export const agentWorldHeroLayerOrder = heroPacks[agentWorldHeroPackId].layerOrder;
export const agentWorldHeroAssets = heroPacks[agentWorldHeroPackId].assets;
export const agentWorldHeroExampleAgents = heroPacks[agentWorldHeroPackId].exampleAgents;
export const legacyV1ExampleAgents = heroPacks[agentWorldHeroPackIdV1].exampleAgents;

export function getAgentWorldHeroPackDefinition(assetPack?: string | null): HeroPackDefinition {
  return heroPacks[normalizePackId(assetPack)];
}

function pickPresetRoleId(pack: HeroPackDefinition, roleHint: string | null | undefined) {
  if (!roleHint) return null;
  const normalizedRoleHint = normalizeRoleText(roleHint);
  if (!normalizedRoleHint) return null;

  for (const role of pack.rolePresetTraits.keys()) {
    if (role === normalizedRoleHint || roleTokenMatch(role, normalizedRoleHint)) return role;
  }
  return null;
}

function pickRoleTraits(pack: HeroPackDefinition, roleHint: string | null | undefined) {
  const traits: AgentWorldHeroTraits = {};
  const presetId = pickPresetRoleId(pack, roleHint);
  if (!presetId) return traits;

  pack.rolePresetTraits.get(presetId)?.forEach((traitId) => {
    const trait = pack.assetsById.get(traitId);
    if (trait) {
      traits[trait.layer] = trait.traitId;
    }
  });

  return traits;
}

function isSpecialRole(roleHint: string | null | undefined, keywords: readonly string[]) {
  if (!roleHint) return false;
  for (const keyword of keywords) {
    const aliases = SPECIAL_ROLE_ALIASES[keyword] ?? [keyword];
    if (aliases.some((alias) => roleTokenMatch(alias, roleHint))) {
      return true;
    }
  }
  return false;
}

function pickSpecialBackground(
  pack: HeroPackDefinition,
  roleHint: string | null | undefined,
): string | null {
  if (!isSpecialRole(roleHint, pack.generationRules.specialRoleKeywords)) return null;
  const backgrounds = pack.assetsByLayer.special_background ?? [];
  if (backgrounds.length === 0) return null;
  const matchedByHint = backgrounds.find((asset) => roleTokenMatch(asset.roleHint, roleHint));
  return matchedByHint?.traitId ?? backgrounds[0]?.traitId ?? null;
}

function pickTrait(pack: HeroPackDefinition, layer: AgentWorldHeroLayer, seed: number, offset: number) {
  const candidates = (pack.assetsByLayer[layer] ?? []).filter((asset) => !asset.isExampleOnly);
  if (candidates.length === 0) return undefined;
  return pickByStableScore(candidates, seed, offset, (asset) => asset.traitId)?.traitId;
}

function toExampleAgentId(asset: AgentWorldHeroAsset) {
  const normalized = normalizeExampleAgentId(asset.roleHint || asset.variant || asset.traitId);
  return normalized || asset.traitId;
}

function normalizeExampleAgentId(value: string | null | undefined) {
  return normalizeRoleText(value).replace(/\s+/g, "_");
}

function getFullCharacterCandidates(pack: HeroPackDefinition, includeExamples = false) {
  return (pack.assetsByLayer.full_character ?? []).filter((asset) => includeExamples || !asset.isExampleOnly);
}

function findFullCharacterTraitByRole(
  pack: HeroPackDefinition,
  roleHint: string | null | undefined,
  includeExamples = true,
) {
  if (!roleHint) return undefined;
  return getFullCharacterCandidates(pack, includeExamples).find(
    (asset) =>
      roleTokenMatch(asset.roleHint, roleHint) ||
      roleTokenMatch(asset.variant, roleHint) ||
      roleTokenMatch(asset.name, roleHint),
  )?.traitId;
}

function pickFullCharacterTrait(
  pack: HeroPackDefinition,
  seed: number,
  roleHint: string | null | undefined,
  offset = 0,
  includeExamples = false,
) {
  const candidates = getFullCharacterCandidates(pack, includeExamples);
  if (candidates.length === 0) return undefined;

  const matched = findFullCharacterTraitByRole(pack, roleHint, includeExamples);
  if (matched) return matched;

  return pickByStableScore(candidates, seed, offset, (asset) => asset.traitId)?.traitId;
}

function pickFullCharacterTraitFromIds(pack: HeroPackDefinition, ids: readonly string[], seed: number, offset = 0) {
  const traits = ids
    .map((id) => pack.exampleAgentById.get(normalizeExampleAgentId(id))?.traits.full_character)
    .map((traitId) => (traitId ? pack.assetsById.get(traitId) : undefined))
    .filter((asset): asset is AgentWorldHeroAsset => Boolean(asset));
  if (traits.length === 0) return undefined;
  return pickByStableScore(traits, seed, offset, (asset) => asset.traitId)?.traitId;
}

function pickFullCharacterTraitByRoleAlias(
  pack: HeroPackDefinition,
  roleHint: string | null | undefined,
) {
  const normalized = normalizeRoleText(roleHint);
  if (!normalized) return undefined;

  const aliasGroups: Array<{ keywords: string[]; ids: string[] }> = [
    {
      keywords: ["architecture", "architect", "架构"],
      ids: ["mage", "engineer_mage", "young_wizard", "druid_rogue"],
    },
    {
      keywords: ["implementation", "implement", "developer", "coding", "code", "研发", "实现", "开发"],
      ids: ["engineer", "cyber_alchemist", "cyber", "engineer_mage"],
    },
    {
      keywords: ["security", "secure", "safety", "sec", "guard", "安全", "风控"],
      ids: ["monk", "cyber", "red_monk_leader", "captain_leader"],
    },
    {
      keywords: ["leader", "lead", "captain", "commander", "负责人", "队长", "指挥"],
      ids: ["captain_leader", "royal_leader", "red_monk_leader", "ranger"],
    },
    {
      keywords: ["memory", "knowledge", "context", "知识", "记忆", "上下文"],
      ids: ["druid", "druid_rogue", "monk", "hybrid_ranger_staff"],
    },
    {
      keywords: ["review", "audit", "qa", "test", "评审", "审查", "测试"],
      ids: ["mage", "young_wizard", "engineer_mage", "cyber_alchemist"],
    },
  ];

  const matchedGroup = aliasGroups.find((group) => group.keywords.some((keyword) => normalized.includes(keyword)));
  if (!matchedGroup) return undefined;
  return matchedGroup.ids
    .map((id) => pack.exampleAgentById.get(normalizeExampleAgentId(id))?.traits.full_character)
    .find((traitId) => Boolean(traitId));
}

export function isAgentWorldHeroLayer(value: unknown): value is AgentWorldHeroLayer {
  return isAgentWorldHeroLayerValue(value);
}

export function getAgentWorldHeroAsset(traitId: string | null | undefined, assetPack?: string | null) {
  if (!traitId) return null;
  return getAgentWorldHeroPackDefinition(assetPack).assetsById.get(traitId) ?? null;
}

export function getAgentWorldHeroCropUrl(traitId: string | null | undefined, assetPack?: string | null) {
  return getAgentWorldHeroAsset(traitId, assetPack)?.cropUrl ?? null;
}

export function getAgentWorldHeroAssetsByLayer(layer: AgentWorldHeroLayer, assetPack?: string | null) {
  return getAgentWorldHeroPackDefinition(assetPack).assetsByLayer[layer] ?? [];
}

export function getAgentWorldHeroDefaultBackground(assetPack?: string | null) {
  return getAgentWorldHeroPackDefinition(assetPack).generationRules.defaultBackground;
}

export function getAgentWorldHeroLayerOrder(assetPack?: string | null) {
  return getAgentWorldHeroPackDefinition(assetPack).layerOrder;
}

export function getAgentWorldHeroLayerSchema(assetPack?: string | null) {
  return getAgentWorldHeroPackDefinition(assetPack).layerSchema;
}

export function getAgentWorldHeroExampleAgents(assetPack?: string | null) {
  return getAgentWorldHeroPackDefinition(assetPack).exampleAgents;
}

export function normalizeAgentWorldHeroTraits(
  rawTraits: unknown,
  options: { packId?: string | null; includeUnknownLayers?: boolean } = {},
): AgentWorldHeroTraits {
  const pack = getAgentWorldHeroPackDefinition(options.packId ?? agentWorldHeroPackId);
  return normalizeHeroTraitsWithAssets(rawTraits, pack.assetsById, pack.layerOrder, options.includeUnknownLayers);
}

export function resolveAgentWorldHeroTraits({
  seed = "agentworld-hero",
  configuredTraits,
  capabilityKey,
  exampleAgentId,
  roleHint,
  assetPack,
}: {
  seed?: string;
  configuredTraits?: AgentWorldHeroTraits | null;
  capabilityKey?: AgentCapabilityKey | null;
  exampleAgentId?: string | null;
  roleHint?: string | null;
  assetPack?: string | null;
}): AgentWorldHeroTraits {
  const pack = getAgentWorldHeroPackDefinition(assetPack);
  const seedHash = hashSeed(seed || "agentworld-hero");
  const configured = normalizeAgentWorldHeroTraits(configuredTraits, { packId: pack.id });
  const roleTraits = pickRoleTraits(pack, roleHint);
  const specialBackground = pickSpecialBackground(pack, roleHint);

  const exampleAgentsByCapability: Record<AgentCapabilityKey, string[]> = {
    permission: ["ranger", "captain_leader", "leader", "oracle_diplomat"],
    toolUse: ["engineer", "mechanic_engineer", "navigator_pilot"],
    safety: ["captain_leader", "monk", "guardian_warrior", "explorer_scout", "leader"],
    coding: ["cyber", "mechanic_engineer", "engineer"],
    review: ["mage", "scholar_archivist", "oracle_diplomat"],
    memory: ["druid", "monk", "oracle_diplomat"],
    collaboration: ["pirate", "merchant_coordinator", "bard_narrator", "healer_support"],
  };
  const fullCharactersByCapability: Record<AgentCapabilityKey, string[]> = {
    permission: ["ranger", "captain_leader", "royal_leader", "red_monk_leader", "monk", "pirate_monk"],
    toolUse: ["engineer", "engineer_mage", "cyber_alchemist", "cyber", "ranger", "druid_rogue", "pirate_monk", "young_wizard"],
    safety: ["captain_leader", "monk", "red_monk_leader", "pirate_monk", "cyber", "ranger"],
    coding: ["cyber", "cyber_alchemist", "engineer", "engineer_mage", "young_wizard", "ranger"],
    review: ["mage", "young_wizard", "engineer_mage", "cyber_alchemist", "druid_rogue", "royal_leader"],
    memory: ["druid", "druid_rogue", "monk", "hybrid_ranger_staff", "young_wizard", "red_monk_leader"],
    collaboration: ["pirate", "pirate_monk", "ranger", "druid_rogue", "captain_leader", "hybrid_ranger_staff"],
  };

  const preferredExamples = (() => {
    if (exampleAgentId) {
      const fromExplicit = pack.exampleAgentById.get(exampleAgentId);
      if (fromExplicit) return fromExplicit;
    }
    const candidates = capabilityKey
      ? exampleAgentsByCapability[capabilityKey]
          .map((id) => pack.exampleAgentById.get(id))
          .filter((item): item is AgentWorldHeroExampleAgent => Boolean(item))
      : [];
    if (candidates.length > 0) return candidates[pickIndex(seedHash, candidates.length, 11)] ?? null;
    if (pack.exampleAgents.length === 0) return null;
    return pack.exampleAgents[pickIndex(seedHash, pack.exampleAgents.length, 13)] ?? null;
  })();

  if (pack.id === agentWorldHeroPackIdV2) {
    const configuredFullCharacter = configured.full_character
      ? pack.assetsById.get(configured.full_character)?.traitId
      : undefined;
    const explicitExampleFullCharacter = exampleAgentId ? preferredExamples?.traits.full_character : undefined;
    const roleMatchedFullCharacter = findFullCharacterTraitByRole(pack, roleHint, true);
    const roleAliasFullCharacter = pickFullCharacterTraitByRoleAlias(pack, roleHint);
    const capabilityFullCharacter = capabilityKey
      ? pickFullCharacterTraitFromIds(pack, fullCharactersByCapability[capabilityKey], seedHash, 23)
      : undefined;
    const fullCharacter =
      configuredFullCharacter ??
      explicitExampleFullCharacter ??
      roleMatchedFullCharacter ??
      roleAliasFullCharacter ??
      capabilityFullCharacter ??
      pickFullCharacterTrait(pack, seedHash, roleHint, 17, true);

    return fullCharacter
      ? {
          full_character: fullCharacter,
        }
      : {};
  }

  const traits: AgentWorldHeroTraits = {};
  pack.layerOrder.forEach((layer, index) => {
    if (pack.id === agentWorldHeroPackIdV2 && layer === "special_background") {
      traits[layer] = configured[layer] ?? roleTraits[layer] ?? specialBackground ?? undefined;
      return;
    }

    traits[layer] =
      configured[layer] ??
      preferredExamples?.traits[layer] ??
      roleTraits[layer] ??
      pickTrait(pack, layer, seedHash, index * 29);
  });

  return traits;
}

export function resolveAgentWorldHeroLayers(input: {
  seed?: string;
  configuredTraits?: AgentWorldHeroTraits | null;
  capabilityKey?: AgentCapabilityKey | null;
  exampleAgentId?: string | null;
  roleHint?: string | null;
  assetPack?: string | null;
}): AgentWorldHeroResolvedLayer[] {
  const resolved = resolveAgentWorldHeroTraits(input);
  const pack = getAgentWorldHeroPackDefinition(input.assetPack);
  return pack.layerOrder
    .map((layer) => {
      const asset = getAgentWorldHeroAsset(resolved[layer], pack.id);
      if (!asset) return null;
      return {
        ...asset,
        src: asset.cropUrl,
      };
    })
    .filter((asset): asset is AgentWorldHeroResolvedLayer => Boolean(asset));
}
