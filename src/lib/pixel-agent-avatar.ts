import type { AgentCapabilityKey } from "@/lib/agent-capability-profile";

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
};

export const skinOptions = ["#f2c7a5", "#c98f6d", "#8d5a43", "#f0d7bc", "#e7a889", "#6f4938"];
export const hairOptions = ["#151515", "#4b3428", "#8c4b25", "#d6dce8", "#5b5fc7", "#f59e0b"];
export const suitOptions = ["#182133", "#243b53", "#334155", "#f8fafc", "#6d5dfc", "#0f766e"];
export const accentOptions = ["#09c7e8", "#f59e0b", "#22c55e", "#ef4444", "#a78bfa", "#fb7185"];
export const backgroundOptions = ["#dff6fb", "#e8f3e8", "#f7edd2", "#ece7ff", "#fce7f3", "#e0f2fe"];
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

    return {
      ...fallback,
      ...parsed,
      hairStyle: hairStyle ?? fallback.hairStyle,
      outfitStyle: outfitStyle ?? fallback.outfitStyle,
      eyeStyle: eyeStyle ?? fallback.eyeStyle,
      mouthStyle: mouthStyle ?? fallback.mouthStyle,
      accessory: accessory ?? fallback.accessory,
      weaponKey: weaponKey ?? fallback.weaponKey,
    };
  } catch {
    return fallback;
  }
}
