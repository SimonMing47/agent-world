import type { AgentCapabilityKey } from "@/lib/agent-capability-profile";
import {
  agentWorldHeroPackId,
  agentWorldHeroPackIdV1,
  agentWorldHeroPackIdV2,
  normalizeAgentWorldHeroTraits,
} from "@/lib/agentworld-hero-assets";
import type { AgentWorldHeroPackId, AgentWorldHeroTraits } from "@/lib/agentworld-hero-assets";

export type PixelAgentAvatarConfig = {
  skin: string;
  hair: string;
  suit: string;
  accent: string;
  background: string;
  hairStyle: "cap" | "side" | "crest" | "visor";
  outfitStyle: "jacket" | "robe" | "armor" | "hoodie";
  eyeStyle: "calm" | "focus" | "spark";
  mouthStyle: "line" | "smile" | "dot";
  accessory: "none" | "glasses" | "headset" | "badge";
  weaponKey: "auto" | AgentCapabilityKey;
  assetPack: AgentWorldHeroPackId;
  assetTraits?: AgentWorldHeroTraits;
  roleHint?: string;
};

export const skinOptions = ["#f3bf91", "#d99062", "#9b6042", "#f0cfa9", "#c57854", "#6f4938"];
export const hairOptions = ["#17100d", "#43281f", "#7f2d1f", "#6b1f1a", "#243044", "#b45309"];
export const suitOptions = ["#7f1d1d", "#92400e", "#1f3a5f", "#3f2a55", "#164e3d", "#334155"];
export const accentOptions = ["#fbbf24", "#f97316", "#ef4444", "#22c55e", "#38bdf8", "#a78bfa"];
export const backgroundOptions = ["#070b16", "#09111f", "#111827", "#18112a", "#10231f", "#17151d"];
export const hairStyleOptions: PixelAgentAvatarConfig["hairStyle"][] = ["cap", "side", "crest", "visor"];
export const outfitStyleOptions: PixelAgentAvatarConfig["outfitStyle"][] = ["jacket", "robe", "armor", "hoodie"];
export const eyeStyleOptions: PixelAgentAvatarConfig["eyeStyle"][] = ["calm", "focus", "spark"];
export const mouthStyleOptions: PixelAgentAvatarConfig["mouthStyle"][] = ["line", "smile", "dot"];
export const accessoryOptions: PixelAgentAvatarConfig["accessory"][] = ["none", "glasses", "headset", "badge"];
export const weaponKeyOptions: PixelAgentAvatarConfig["weaponKey"][] = [
  "auto",
  "permission",
  "toolUse",
  "safety",
  "coding",
  "review",
  "memory",
  "collaboration",
];

function hashSeed(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pick<T>(items: T[], seed: number, offset: number) {
  return items[(seed + offset) % items.length];
}

export function defaultPixelAgentAvatarConfig(seedValue = "agent"): PixelAgentAvatarConfig {
  const seed = hashSeed(seedValue || "agent");
  return {
    skin: pick(skinOptions, seed, 1),
    hair: pick(hairOptions, seed, 3),
    suit: pick(suitOptions, seed, 5),
    accent: pick(accentOptions, seed, 7),
    background: pick(backgroundOptions, seed, 11),
    hairStyle: pick(hairStyleOptions, seed, 13),
    outfitStyle: pick(outfitStyleOptions, seed, 15),
    eyeStyle: pick(eyeStyleOptions, seed, 17),
    mouthStyle: pick(mouthStyleOptions, seed, 19),
    accessory: pick(accessoryOptions, seed, 23),
    weaponKey: "auto",
    assetPack: agentWorldHeroPackId,
  };
}

export function parsePixelAgentAvatarConfig(raw: string | null | undefined, seedValue?: string): PixelAgentAvatarConfig {
  const fallback = defaultPixelAgentAvatarConfig(seedValue);
  if (!raw?.trim()) return fallback;

  try {
    const parsed = JSON.parse(raw) as Partial<PixelAgentAvatarConfig>;
    const hairStyle = hairStyleOptions.includes(parsed.hairStyle ?? "cap") ? parsed.hairStyle : fallback.hairStyle;
    const outfitStyle = outfitStyleOptions.includes(parsed.outfitStyle ?? "jacket") ? parsed.outfitStyle : fallback.outfitStyle;
    const eyeStyle = eyeStyleOptions.includes(parsed.eyeStyle ?? "calm") ? parsed.eyeStyle : fallback.eyeStyle;
    const mouthStyle = mouthStyleOptions.includes(parsed.mouthStyle ?? "line") ? parsed.mouthStyle : fallback.mouthStyle;
    const accessory = accessoryOptions.includes(parsed.accessory ?? "none") ? parsed.accessory : fallback.accessory;
    const weaponKey = weaponKeyOptions.includes(parsed.weaponKey ?? "auto") ? parsed.weaponKey : fallback.weaponKey;
    const assetPack =
      parsed.assetPack === agentWorldHeroPackIdV1 || parsed.assetPack === agentWorldHeroPackIdV2
        ? parsed.assetPack
        : fallback.assetPack;
    const assetTraits = normalizeAgentWorldHeroTraits(parsed.assetTraits);
    const roleHint =
      typeof parsed.roleHint === "string" && parsed.roleHint.trim() ? parsed.roleHint.trim() : fallback.roleHint;

    return {
      ...fallback,
      ...parsed,
      hairStyle: hairStyle ?? fallback.hairStyle,
      outfitStyle: outfitStyle ?? fallback.outfitStyle,
      eyeStyle: eyeStyle ?? fallback.eyeStyle,
      mouthStyle: mouthStyle ?? fallback.mouthStyle,
      accessory: accessory ?? fallback.accessory,
      weaponKey: weaponKey ?? fallback.weaponKey,
      assetPack,
      roleHint,
      assetTraits,
    };
  } catch {
    return fallback;
  }
}
