"use client";

import Image from "next/image";
import type { AgentCapabilityKey, AgentCapabilityProfile } from "@/lib/agent-capability-profile";
import { getAgentCapabilityWeapon } from "@/lib/agent-capability-profile";
import {
  agentWorldHeroExampleAgents,
  agentWorldHeroLayerOrder,
  agentWorldHeroPackId,
  getAgentWorldHeroAssetsByLayer,
  resolveAgentWorldHeroLayers,
  resolveAgentWorldHeroTraits,
  type AgentWorldHeroLayer,
  type AgentWorldHeroResolvedLayer,
  type AgentWorldHeroTraits,
} from "@/lib/agentworld-hero-assets";
import {
  accentOptions,
  backgroundOptions,
  defaultPixelAgentAvatarConfig,
  hairOptions,
  skinOptions,
  suitOptions,
  weaponKeyOptions,
  type PixelAgentAvatarConfig,
} from "@/lib/pixel-agent-avatar";
import { cn } from "@/lib/utils";
import { useLanguageText } from "@/components/language-pack-provider";
import { FieldGroup } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";

type PixelAgentAvatarProps = {
  config: PixelAgentAvatarConfig;
  capabilityProfile?: AgentCapabilityProfile;
  seed?: string;
  roleSlot?: number;
  size?: "sm" | "md" | "lg" | "team";
  className?: string;
};

const sizeClass: Record<NonNullable<PixelAgentAvatarProps["size"]>, string> = {
  sm: "h-16 w-16",
  md: "h-28 w-28",
  team: "h-36 w-36",
  lg: "h-40 w-40",
};

const labelByOption: Record<string, string> = {
  auto: "agent.avatar.generation.auto",
  permission: "agent.capability.permission.label",
  toolUse: "agent.capability.toolUse.label",
  safety: "agent.capability.safety.label",
  coding: "agent.capability.coding.label",
  review: "agent.capability.review.label",
  memory: "agent.capability.memory.label",
  collaboration: "agent.capability.collaboration.label",
};

function avatar(config: PixelAgentAvatarConfig) {
  return { ...defaultPixelAgentAvatarConfig(), ...config };
}

function seedFromColor(value: string) {
  let seed = 0;
  for (let index = 0; index < value.length; index += 1) {
    seed = (seed * 33 + value.charCodeAt(index)) >>> 0;
  }
  return seed;
}

function normalizeColorOption(value: string, options: string[]) {
  const matched = options.find((option) => option.toLowerCase() === value.toLowerCase());
  if (matched) return matched;
  return options[seedFromColor(value) % options.length] ?? value;
}

function remasterAvatarPalette(value: PixelAgentAvatarConfig): PixelAgentAvatarConfig {
  return {
    ...value,
    skin: normalizeColorOption(value.skin, skinOptions),
    hair: normalizeColorOption(value.hair, hairOptions),
    suit: normalizeColorOption(value.suit, suitOptions),
    accent: normalizeColorOption(value.accent, accentOptions),
    background: normalizeColorOption(value.background, backgroundOptions),
  };
}

function deriveExpression(
  config: PixelAgentAvatarConfig,
  capabilityProfile?: AgentCapabilityProfile,
): Pick<PixelAgentAvatarConfig, "eyeStyle" | "mouthStyle"> {
  if (!capabilityProfile) return { eyeStyle: config.eyeStyle, mouthStyle: config.mouthStyle };

  const dominant = getAgentCapabilityWeapon(capabilityProfile).capability;
  if (dominant.key === "coding" || dominant.key === "toolUse" || dominant.key === "review") {
    return { eyeStyle: dominant.value >= 76 ? "spark" : "focus", mouthStyle: "line" };
  }
  if (dominant.key === "safety" || dominant.key === "permission") {
    return { eyeStyle: "focus", mouthStyle: "line" };
  }
  if (dominant.key === "memory") {
    return { eyeStyle: "focus", mouthStyle: "dot" };
  }
  return { eyeStyle: "focus", mouthStyle: "smile" };
}

const capabilityAvatarLooks: Record<
  AgentCapabilityKey,
  Partial<Pick<PixelAgentAvatarConfig, "hairStyle" | "outfitStyle" | "accessory">>
> = {
  permission: { hairStyle: "side", outfitStyle: "robe", accessory: "badge" },
  toolUse: { hairStyle: "visor", outfitStyle: "jacket", accessory: "headset" },
  safety: { hairStyle: "crest", outfitStyle: "armor", accessory: "badge" },
  coding: { hairStyle: "side", outfitStyle: "jacket", accessory: "headset" },
  review: { hairStyle: "side", outfitStyle: "robe", accessory: "glasses" },
  memory: { hairStyle: "cap", outfitStyle: "robe", accessory: "glasses" },
  collaboration: { hairStyle: "cap", outfitStyle: "hoodie", accessory: "badge" },
};

function deriveVisualAvatar(
  config: PixelAgentAvatarConfig,
  capabilityProfile?: AgentCapabilityProfile,
): PixelAgentAvatarConfig {
  if (!capabilityProfile) return { ...config, ...deriveExpression(config) };

  const dominant = getAgentCapabilityWeapon(capabilityProfile).capability;
  const autoLook = config.weaponKey === "auto" ? capabilityAvatarLooks[dominant.key] : {};
  return {
    ...config,
    ...autoLook,
    ...deriveExpression(config, capabilityProfile),
  };
}

function Px({
  x,
  y,
  w,
  h,
  fill,
  opacity,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  opacity?: number;
}) {
  return <rect x={x} y={y} width={w} height={h} fill={fill} opacity={opacity} />;
}

function StepPath({
  points,
  fill,
  opacity,
}: {
  points: Array<[number, number]>;
  fill: string;
  opacity?: number;
}) {
  return <polygon points={points.map(([x, y]) => `${x},${y}`).join(" ")} fill={fill} opacity={opacity} />;
}

function PixelWeapon({
  value,
  weaponKey,
}: {
  value: PixelAgentAvatarConfig;
  weaponKey?: AgentCapabilityKey;
}) {
  if (!weaponKey) return null;
  if (weaponKey === "permission") {
    return (
      <g>
        <Px x={102} y={31} w={5} h={87} fill="#0f172a" />
        <Px x={104} y={34} w={2} h={80} fill={value.accent} />
        <Px x={96} y={23} w={17} h={5} fill="#0f172a" />
        <Px x={93} y={28} w={23} h={10} fill="#0f172a" />
        <Px x={97} y={25} w={15} h={15} fill={value.accent} />
        <Px x={101} y={28} w={7} h={7} fill="#ffffff" opacity={0.68} />
        <Px x={98} y={40} w={12} h={4} fill="#0f172a" />
      </g>
    );
  }
  if (weaponKey === "toolUse") {
    return (
      <g>
        <Px x={101} y={47} w={5} h={70} fill="#0f172a" />
        <Px x={103} y={49} w={2} h={66} fill="#94a3b8" />
        <Px x={92} y={34} w={23} h={5} fill="#0f172a" />
        <Px x={96} y={39} w={15} h={8} fill="#0f172a" />
        <Px x={98} y={40} w={11} h={6} fill="#cbd5e1" />
        <Px x={98} y={114} w={12} h={8} fill="#0f172a" />
        <Px x={100} y={115} w={8} h={5} fill={value.accent} />
      </g>
    );
  }
  if (weaponKey === "safety") {
    return (
      <g>
        <StepPath points={[[96, 61], [121, 61], [121, 86], [117, 94], [108, 99], [100, 94], [96, 86]]} fill="#0f172a" />
        <StepPath points={[[100, 66], [117, 66], [117, 84], [114, 90], [108, 94], [103, 90], [100, 84]]} fill={value.accent} />
        <Px x={104} y={70} w={9} h={16} fill="#ffffff" opacity={0.32} />
        <Px x={108} y={66} w={3} h={27} fill="#0f172a" opacity={0.32} />
      </g>
    );
  }
  if (weaponKey === "coding") {
    return (
      <g>
        <Px x={103} y={29} w={6} h={77} fill="#0f172a" />
        <Px x={105} y={31} w={2} h={72} fill="#f8fafc" />
        <Px x={103} y={39} w={2} h={52} fill={value.accent} opacity={0.78} />
        <Px x={99} y={106} w={14} h={6} fill="#0f172a" />
        <Px x={101} y={107} w={10} h={3} fill={value.accent} />
        <Px x={103} y={112} w={6} h={11} fill="#0f172a" />
      </g>
    );
  }
  if (weaponKey === "review") {
    return (
      <g>
        <Px x={98} y={45} w={22} h={22} fill="#0f172a" />
        <Px x={102} y={49} w={14} h={14} fill="#ffffff" />
        <Px x={105} y={52} w={8} h={8} fill={value.accent} opacity={0.34} />
        <Px x={116} y={66} w={5} h={5} fill="#0f172a" />
        <Px x={121} y={71} w={4} h={4} fill="#0f172a" />
        <Px x={113} y={50} w={3} h={3} fill="#ffffff" opacity={0.65} />
      </g>
    );
  }
  if (weaponKey === "memory") {
    return (
      <g>
        <Px x={98} y={55} w={20} h={39} fill="#0f172a" />
        <Px x={101} y={58} w={14} h={33} fill="#ffffff" />
        <Px x={103} y={64} w={10} h={2} fill={value.accent} />
        <Px x={103} y={73} w={10} h={2} fill={value.accent} />
        <Px x={103} y={82} w={8} h={2} fill={value.accent} />
        <Px x={112} y={58} w={3} h={33} fill="#e2e8f0" />
      </g>
    );
  }
  return (
    <g>
      <Px x={103} y={34} w={5} h={82} fill="#0f172a" />
      <Px x={108} y={39} w={18} h={25} fill="#0f172a" />
      <Px x={108} y={43} w={13} h={16} fill={value.accent} />
      <Px x={108} y={64} w={18} h={4} fill="#0f172a" />
    </g>
  );
}

function PixelBody({ value }: { value: PixelAgentAvatarConfig }) {
  const outline = "#120f12";
  const deep = "#1a1518";
  const suitShadow = "#2b1514";
  const boot = "#2a1d17";
  const metal = "#f7c85f";
  return (
    <g>
      <Px x={41} y={119} w={19} h={24} fill={outline} />
      <Px x={72} y={119} w={19} h={24} fill={outline} />
      <Px x={46} y={119} w={12} h={21} fill={value.suit} />
      <Px x={75} y={119} w={12} h={21} fill={value.suit} />
      <Px x={47} y={130} w={9} h={8} fill={suitShadow} opacity={0.45} />
      <Px x={76} y={130} w={9} h={8} fill={suitShadow} opacity={0.45} />
      <Px x={44} y={141} w={22} h={6} fill={outline} />
      <Px x={68} y={141} w={23} h={6} fill={outline} />
      <Px x={39} y={146} w={30} h={7} fill={boot} />
      <Px x={68} y={146} w={31} h={7} fill={boot} />
      <Px x={48} y={145} w={13} h={3} fill="#f6d365" opacity={0.3} />
      <Px x={77} y={145} w={14} h={3} fill="#f6d365" opacity={0.3} />

      <StepPath points={[[29, 78], [43, 78], [47, 88], [43, 116], [38, 121], [29, 121], [24, 113], [24, 90]]} fill={outline} />
      <StepPath points={[[88, 78], [102, 78], [108, 90], [108, 113], [103, 121], [94, 121], [89, 116], [85, 88]]} fill={outline} />
      <Px x={33} y={85} w={8} h={28} fill={value.suit} />
      <Px x={93} y={85} w={8} h={28} fill={value.suit} />
      <Px x={32} y={110} w={10} h={8} fill={value.skin} />
      <Px x={93} y={110} w={10} h={8} fill={value.skin} />
      <Px x={26} y={91} w={4} h={17} fill="#000000" opacity={0.3} />
      <Px x={103} y={92} w={3} h={17} fill="#ffffff" opacity={0.1} />

      <Px x={55} y={70} w={24} h={14} fill={outline} />
      <Px x={59} y={69} w={16} h={14} fill={value.skin} />
      <StepPath points={[[38, 78], [94, 78], [102, 88], [98, 122], [88, 132], [48, 132], [38, 122], [34, 88]]} fill={outline} />
      <StepPath points={[[43, 82], [89, 82], [96, 91], [92, 118], [84, 126], [52, 126], [44, 118], [40, 91]]} fill={value.suit} />
      <Px x={43} y={92} w={5} h={24} fill="#000000" opacity={0.26} />
      <Px x={86} y={91} w={5} h={23} fill="#ffffff" opacity={0.12} />
      <Px x={51} y={84} w={31} h={4} fill="#ffffff" opacity={0.2} />
      <Px x={61} y={83} w={9} h={44} fill={value.accent} />
      <Px x={64} y={86} w={3} h={36} fill="#fff7d6" opacity={0.34} />
      <Px x={55} y={104} w={24} h={7} fill={outline} />
      <Px x={58} y={105} w={18} h={4} fill={metal} />
      <Px x={64} y={103} w={8} h={9} fill={outline} />
      <Px x={66} y={105} w={4} h={5} fill={value.accent} />
      {value.outfitStyle === "robe" ? (
        <>
          <StepPath points={[[39, 99], [95, 99], [91, 138], [84, 144], [49, 144], [42, 138]]} fill={outline} />
          <StepPath points={[[45, 101], [89, 101], [86, 134], [80, 139], [53, 139], [48, 134]]} fill={value.suit} />
          <Px x={62} y={84} w={9} h={55} fill={value.accent} />
          <Px x={49} y={121} w={36} h={5} fill={metal} opacity={0.72} />
          <Px x={52} y={134} w={33} h={3} fill="#000000" opacity={0.25} />
        </>
      ) : null}
      {value.outfitStyle === "armor" ? (
        <>
          <Px x={44} y={82} w={45} h={13} fill={deep} />
          <Px x={48} y={98} w={37} h={18} fill="#4b5563" />
          <Px x={56} y={91} w={22} h={22} fill={outline} />
          <Px x={60} y={95} w={14} h={14} fill={value.accent} />
          <Px x={63} y={98} w={7} h={5} fill="#ffffff" opacity={0.42} />
          <Px x={50} y={113} w={35} h={4} fill={metal} />
          <Px x={53} y={86} w={29} h={2} fill="#ffffff" opacity={0.24} />
        </>
      ) : null}
      {value.outfitStyle === "hoodie" ? (
        <>
          <StepPath points={[[45, 77], [88, 77], [94, 88], [83, 95], [51, 95], [39, 88]]} fill={outline} />
          <StepPath points={[[49, 80], [84, 80], [89, 88], [80, 92], [53, 92], [44, 88]]} fill={value.hair} />
          <Px x={57} y={91} w={4} h={26} fill={metal} />
          <Px x={73} y={91} w={4} h={26} fill={metal} />
          <Px x={50} y={117} w={35} h={3} fill="#ffffff" opacity={0.18} />
        </>
      ) : null}
      {value.outfitStyle === "jacket" ? (
        <>
          <Px x={45} y={83} w={15} h={33} fill={value.accent} />
          <Px x={74} y={83} w={14} h={33} fill={value.accent} />
          <Px x={60} y={83} w={14} h={33} fill={value.suit} />
          <Px x={66} y={86} w={3} h={27} fill="#fff7d6" opacity={0.42} />
          <Px x={50} y={90} w={8} h={2} fill={metal} />
          <Px x={78} y={90} w={7} h={2} fill={metal} />
          <Px x={46} y={116} w={42} h={3} fill="#000000" opacity={0.24} />
        </>
      ) : null}
    </g>
  );
}

function PixelHair({ value }: { value: PixelAgentAvatarConfig }) {
  const outline = "#120f12";
  const brim = "#2a1112";
  const badge = "#f7c85f";
  if (value.hairStyle === "side") {
    return (
      <g>
        <StepPath points={[[38, 25], [87, 25], [99, 34], [100, 47], [93, 52], [82, 47], [50, 47], [38, 54], [33, 43], [34, 33]]} fill={outline} />
        <StepPath points={[[42, 28], [84, 28], [95, 36], [95, 45], [88, 48], [79, 43], [51, 43], [41, 50], [38, 42], [38, 35]]} fill={value.hair} />
        <Px x={39} y={49} w={9} h={22} fill={outline} />
        <Px x={42} y={49} w={6} h={18} fill={value.hair} />
        <Px x={87} y={49} w={9} h={21} fill={outline} />
        <Px x={87} y={49} w={6} h={18} fill={value.hair} />
        <Px x={50} y={31} w={28} h={2} fill="#ffffff" opacity={0.18} />
        <Px x={74} y={38} w={16} h={4} fill="#000000" opacity={0.3} />
      </g>
    );
  }
  if (value.hairStyle === "crest") {
    return (
      <g>
        <StepPath points={[[57, 13], [70, 13], [74, 30], [86, 21], [94, 28], [92, 39], [100, 41], [99, 51], [89, 55], [45, 55], [34, 49], [36, 38], [47, 31]]} fill={outline} />
        <StepPath points={[[61, 17], [67, 17], [70, 34], [82, 26], [88, 31], [85, 39], [94, 43], [92, 49], [84, 51], [48, 51], [40, 47], [42, 39], [50, 34]]} fill={value.hair} />
        <Px x={41} y={51} w={12} h={19} fill={value.hair} />
        <Px x={84} y={51} w={10} h={18} fill={value.hair} />
        <Px x={61} y={19} w={4} h={10} fill="#ffffff" opacity={0.18} />
        <Px x={76} y={30} w={8} h={3} fill="#ffffff" opacity={0.14} />
      </g>
    );
  }
  if (value.hairStyle === "visor") {
    return (
      <g>
        <StepPath points={[[39, 24], [90, 24], [99, 33], [97, 45], [86, 48], [48, 48], [37, 43]]} fill={outline} />
        <StepPath points={[[43, 28], [87, 28], [94, 35], [91, 41], [84, 44], [50, 44], [41, 40]]} fill={value.hair} />
        <Px x={33} y={42} w={67} h={12} fill={outline} />
        <Px x={38} y={45} w={58} h={5} fill={value.accent} />
        <Px x={51} y={46} w={31} h={2} fill="#ffffff" opacity={0.72} />
        <Px x={41} y={53} w={11} h={17} fill={value.hair} />
        <Px x={85} y={53} w={9} h={16} fill={value.hair} />
        <Px x={92} y={45} w={4} h={5} fill="#ffffff" opacity={0.28} />
      </g>
    );
  }
  return (
    <g>
      <StepPath points={[[40, 20], [88, 20], [100, 31], [101, 43], [94, 49], [43, 49], [35, 44], [35, 32]]} fill={outline} />
      <StepPath points={[[44, 24], [85, 24], [96, 33], [96, 41], [89, 45], [47, 45], [39, 41], [39, 34]]} fill={value.hair} />
      <Px x={35} y={43} w={67} h={12} fill={outline} />
      <Px x={42} y={44} w={52} h={6} fill={brim} />
      <Px x={53} y={48} w={38} h={5} fill={outline} />
      <Px x={57} y={27} w={18} h={15} fill={outline} />
      <StepPath points={[[61, 29], [72, 29], [75, 35], [68, 41], [58, 35]]} fill={badge} />
      <Px x={65} y={30} w={4} h={7} fill="#fff7d6" />
      <Px x={44} y={50} w={10} h={20} fill={value.hair} />
      <Px x={85} y={50} w={9} h={19} fill={value.hair} />
      <Px x={52} y={27} w={25} h={3} fill="#ffffff" opacity={0.17} />
    </g>
  );
}

function PixelFace({ value }: { value: PixelAgentAvatarConfig }) {
  const outline = "#17110f";
  const deep = "#100d0d";
  const cheek = "#b4533f";
  const eyeFill = value.eyeStyle === "spark" ? value.accent : "#16110f";
  return (
    <g>
      <Px x={35} y={48} w={8} h={14} fill={deep} />
      <Px x={92} y={48} w={8} h={14} fill={deep} />
      <Px x={38} y={51} w={5} h={9} fill={value.skin} />
      <Px x={92} y={51} w={5} h={9} fill={value.skin} />
      <StepPath points={[[47, 33], [86, 33], [95, 42], [95, 65], [88, 74], [78, 80], [55, 80], [44, 74], [38, 65], [38, 42]]} fill={deep} />
      <StepPath points={[[50, 37], [83, 37], [90, 44], [90, 63], [84, 70], [76, 75], [57, 75], [50, 70], [44, 63], [44, 44]]} fill={value.skin} />
      <Px x={45} y={46} w={5} h={18} fill="#000000" opacity={0.1} />
      <Px x={83} y={46} w={5} h={18} fill="#ffffff" opacity={0.12} />
      <Px x={50} y={52} w={13} h={10} fill={outline} />
      <Px x={73} y={52} w={13} h={10} fill={outline} />
      <Px x={53} y={54} w={7} h={6} fill={eyeFill} />
      <Px x={76} y={54} w={7} h={6} fill={eyeFill} />
      <Px x={56} y={54} w={2} h={2} fill="#fff7d6" />
      <Px x={79} y={54} w={2} h={2} fill="#fff7d6" />
      <Px x={49} y={64} w={38} h={2} fill="#8d3b2d" opacity={0.12} />
      <Px x={49} y={62} w={7} h={3} fill={cheek} opacity={0.22} />
      <Px x={80} y={62} w={7} h={3} fill={cheek} opacity={0.22} />
      {value.eyeStyle === "calm" ? (
        <>
          <Px x={50} y={50} w={12} h={2} fill={outline} />
          <Px x={73} y={50} w={12} h={2} fill={outline} />
        </>
      ) : null}
      {value.eyeStyle === "spark" ? (
        <>
          <Px x={89} y={43} w={3} h={3} fill={value.accent} />
          <Px x={93} y={47} w={3} h={3} fill={value.accent} />
          <Px x={85} y={47} w={3} h={3} fill={value.accent} />
        </>
      ) : null}
      {value.mouthStyle === "smile" ? (
        <>
          <Px x={59} y={66} w={5} h={2} fill="#7f1d1d" />
          <Px x={64} y={68} w={11} h={2} fill="#7f1d1d" />
          <Px x={75} y={66} w={5} h={2} fill="#7f1d1d" />
        </>
      ) : value.mouthStyle === "dot" ? (
        <Px x={65} y={67} w={6} h={3} fill="#7f1d1d" />
      ) : (
        <Px x={58} y={67} w={20} h={3} fill="#7f1d1d" />
      )}
    </g>
  );
}

function PixelAccessory({ value }: { value: PixelAgentAvatarConfig }) {
  if (value.accessory === "glasses") {
    return (
      <g>
        <Px x={48} y={51} w={17} h={2} fill="#120f12" />
        <Px x={48} y={61} w={17} h={2} fill="#120f12" />
        <Px x={48} y={51} w={2} h={12} fill="#120f12" />
        <Px x={63} y={51} w={2} h={12} fill="#120f12" />
        <Px x={71} y={51} w={17} h={2} fill="#120f12" />
        <Px x={71} y={61} w={17} h={2} fill="#120f12" />
        <Px x={71} y={51} w={2} h={12} fill="#120f12" />
        <Px x={86} y={51} w={2} h={12} fill="#120f12" />
        <Px x={65} y={56} w={6} h={2} fill="#120f12" />
        <Px x={52} y={54} w={7} h={4} fill="#ffffff" opacity={0.18} />
        <Px x={75} y={54} w={7} h={4} fill="#ffffff" opacity={0.18} />
      </g>
    );
  }
  if (value.accessory === "headset") {
    return (
      <g>
        <Px x={38} y={48} w={5} h={21} fill="#120f12" />
        <Px x={91} y={48} w={5} h={21} fill="#120f12" />
        <Px x={41} y={40} w={5} h={8} fill="#120f12" />
        <Px x={88} y={40} w={5} h={8} fill="#120f12" />
        <Px x={93} y={69} w={14} h={3} fill={value.accent} />
        <Px x={104} y={65} w={3} h={7} fill="#120f12" />
        <Px x={40} y={53} w={3} h={9} fill="#ffffff" opacity={0.16} />
      </g>
    );
  }
  if (value.accessory === "badge") {
    return (
      <g>
        <Px x={78} y={86} w={10} h={11} fill="#120f12" />
        <Px x={80} y={88} w={6} h={6} fill={value.accent} />
        <Px x={82} y={94} w={3} h={2} fill="#ffffff" opacity={0.72} />
      </g>
    );
  }
  return null;
}

function AgentWorldHeroPackAvatar({
  layers,
  size,
  className,
}: {
  layers: AgentWorldHeroResolvedLayer[];
  size: NonNullable<PixelAgentAvatarProps["size"]>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[8px] border border-[#2f3748] bg-[#070b16] shadow-sm ring-1 ring-black/40",
        sizeClass[size],
        className,
      )}
      aria-label="Agent avatar"
    >
      <div className="absolute inset-0 bg-[#070b16]" />
      {layers.map((layer) => (
        <Image
          key={layer.traitId}
          src={layer.src}
          alt=""
          fill
          sizes={
            size === "sm"
              ? "64px"
              : size === "md"
                ? "112px"
                : size === "team"
                  ? "144px"
                  : "160px"
          }
          draggable={false}
          unoptimized
          className="select-none object-contain"
          style={{ imageRendering: "pixelated", zIndex: layer.zIndex }}
        />
      ))}
    </div>
  );
}

export function PixelAgentAvatar({
  config,
  capabilityProfile,
  seed = "agent",
  roleSlot,
  size = "md",
  className,
}: PixelAgentAvatarProps) {
  const value = remasterAvatarPalette(avatar(config));
  const visual = deriveVisualAvatar(value, capabilityProfile);
  const dominant = capabilityProfile ? getAgentCapabilityWeapon(capabilityProfile) : null;
  const weaponKey: AgentCapabilityKey | undefined =
    value.weaponKey === "auto" ? dominant?.capability.key : value.weaponKey;
  const capabilityKey = weaponKey ?? null;
  const heroLayers =
    visual.assetPack === agentWorldHeroPackId
      ? resolveAgentWorldHeroLayers({
          seed: JSON.stringify({ seed, roleSlot, visual, capabilityKey }),
          configuredTraits: visual.assetTraits,
          capabilityKey,
      })
      : [];

  if (heroLayers.length > 0) {
    return <AgentWorldHeroPackAvatar layers={heroLayers} size={size} className={className} />;
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[8px] border border-[#2f3748] bg-[#070b16] shadow-sm ring-1 ring-black/40",
        sizeClass[size],
        className,
      )}
      aria-label="Agent avatar"
    >
      <svg
        viewBox="0 0 128 160"
        className="h-full w-full"
        aria-hidden="true"
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
      >
        <Px x={0} y={0} w={128} h={160} fill={visual.background} />
        <Px x={0} y={116} w={128} h={44} fill="#111827" opacity={0.82} />
        <Px x={0} y={126} w={128} h={34} fill="#1f2937" opacity={0.62} />
        <Px x={7} y={132} w={26} h={7} fill="#334155" opacity={0.8} />
        <Px x={34} y={137} w={31} h={6} fill="#475569" opacity={0.62} />
        <Px x={73} y={133} w={24} h={7} fill="#334155" opacity={0.75} />
        <Px x={98} y={140} w={22} h={6} fill="#475569" opacity={0.52} />
        <Px x={13} y={44} w={5} h={69} fill="#100d0d" />
        <Px x={11} y={38} w={9} h={7} fill="#5b2a13" />
        <Px x={9} y={30} w={13} h={9} fill="#f97316" />
        <Px x={12} y={24} w={7} h={7} fill="#fbbf24" />
        <Px x={14} y={18} w={3} h={6} fill="#fff7d6" />
        <Px x={6} y={33} w={3} h={4} fill="#fbbf24" opacity={0.8} />
        <Px x={24} y={28} w={2} h={2} fill="#fbbf24" opacity={0.7} />
        <Px x={26} y={20} w={2} h={2} fill="#fbbf24" opacity={0.42} />
        <Px x={111} y={53} w={4} h={2} fill="#fbbf24" opacity={0.38} />
        <Px x={109} y={18} w={4} h={4} fill="#ffffff" opacity={0.12} />
        <Px x={96} y={29} w={10} h={2} fill="#ffffff" opacity={0.1} />
        <Px x={27} y={150} w={78} h={7} fill="#05070d" opacity={0.6} />
        <Px x={40} y={146} w={49} h={4} fill="#000000" opacity={0.22} />
        <PixelWeapon value={visual} weaponKey={weaponKey} />
        <g transform="translate(-4 -7) scale(1.08)">
          <PixelBody value={visual} />
          <PixelFace value={visual} />
          <PixelHair value={visual} />
          <PixelAccessory value={visual} />
        </g>
      </svg>
    </div>
  );
}

type PixelAgentAvatarEditorProps = {
  value: PixelAgentAvatarConfig;
  capabilityProfile?: AgentCapabilityProfile;
  seed?: string;
  onChange: (value: PixelAgentAvatarConfig) => void;
};

export function PixelAgentAvatarEditor({
  value,
  capabilityProfile,
  seed = "agent",
  onChange,
}: PixelAgentAvatarEditorProps) {
  const text = useLanguageText();
  const current = remasterAvatarPalette(avatar(value));
  const capabilityKey =
    current.weaponKey === "auto" && capabilityProfile
      ? getAgentCapabilityWeapon(capabilityProfile).capability.key
      : current.weaponKey === "auto"
        ? null
        : current.weaponKey;
  const currentAssetTraits = resolveAgentWorldHeroTraits({
    seed: JSON.stringify({ current, capabilityKey, seed }),
    configuredTraits: current.assetTraits,
    capabilityKey,
  });
  const selectedExampleAgent =
    agentWorldHeroExampleAgents.find((agent) =>
      agentWorldHeroLayerOrder.every((layer) => currentAssetTraits[layer] === agent.traits[layer]),
    ) ?? null;

  function updateGeneration(nextValue: PixelAgentAvatarConfig["weaponKey"]) {
    onChange({
      ...current,
      assetPack: agentWorldHeroPackId,
      assetTraits: undefined,
      weaponKey: nextValue,
    });
  }

  function updateExampleAgent(agentId: string) {
    const exampleAgent = agentWorldHeroExampleAgents.find((agent) => agent.agentId === agentId);
    onChange({
      ...current,
      assetPack: agentWorldHeroPackId,
      assetTraits: exampleAgent?.traits,
    });
  }

  function updateAssetTrait(layer: AgentWorldHeroLayer, traitId: string) {
    const nextTraits: AgentWorldHeroTraits = {
      ...currentAssetTraits,
      [layer]: traitId,
    };
    onChange({
      ...current,
      assetPack: agentWorldHeroPackId,
      assetTraits: nextTraits,
    });
  }

  function assetTraitControl(layer: AgentWorldHeroLayer) {
    const assets = getAgentWorldHeroAssetsByLayer(layer);
    return (
      <FieldGroup key={layer} label={layer}>
        <Select value={currentAssetTraits[layer] ?? ""} onChange={(event) => updateAssetTrait(layer, event.target.value)}>
          {assets.map((asset) => (
            <option key={asset.traitId} value={asset.traitId}>
              {asset.name}
            </option>
          ))}
        </Select>
      </FieldGroup>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
      <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--line)] bg-white/60 p-5">
        <PixelAgentAvatar config={current} capabilityProfile={capabilityProfile} seed={seed} size="lg" />
        <button
          type="button"
          className="mt-4 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--ink)] shadow-sm transition hover:bg-[var(--surface-muted)]"
          onClick={() => onChange({ ...defaultPixelAgentAvatarConfig(`${seed}-${Date.now()}`), assetPack: agentWorldHeroPackId })}
        >
          agent.avatar.regenerate
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <FieldGroup label="agent.avatar.generation.bias">
          <Select
            value={current.weaponKey}
            onChange={(event) => updateGeneration(event.target.value as PixelAgentAvatarConfig["weaponKey"])}
          >
            {weaponKeyOptions.map((option) => (
              <option key={option} value={option}>
                {text(labelByOption[option] ?? option)}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label="agent.avatar.exampleComposition">
          <Select value={selectedExampleAgent?.agentId ?? ""} onChange={(event) => updateExampleAgent(event.target.value)}>
            <option value="">agent.avatar.automaticComposition</option>
            {agentWorldHeroExampleAgents.map((agent) => (
              <option key={agent.agentId} value={agent.agentId}>
                {agent.displayName}
              </option>
            ))}
          </Select>
        </FieldGroup>
        {agentWorldHeroLayerOrder.map(assetTraitControl)}
      </div>
    </div>
  );
}
