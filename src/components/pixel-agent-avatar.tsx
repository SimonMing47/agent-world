"use client";

import type { AgentCapabilityKey, AgentCapabilityProfile } from "@/lib/agent-capability-profile";
import { getAgentCapabilityWeapon } from "@/lib/agent-capability-profile";
import {
  accentOptions,
  accessoryOptions,
  backgroundOptions,
  defaultPixelAgentAvatarConfig,
  eyeStyleOptions,
  hairOptions,
  hairStyleOptions,
  mouthStyleOptions,
  outfitStyleOptions,
  skinOptions,
  suitOptions,
  weaponKeyOptions,
  type PixelAgentAvatarConfig,
} from "@/lib/pixel-agent-avatar";
import { cn } from "@/lib/utils";
import { FieldGroup } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";

type PixelAgentAvatarProps = {
  config: PixelAgentAvatarConfig;
  capabilityProfile?: AgentCapabilityProfile;
  size?: "sm" | "md" | "lg" | "team";
  className?: string;
};

const sizeClass: Record<NonNullable<PixelAgentAvatarProps["size"]>, string> = {
  sm: "h-16 w-12",
  md: "h-28 w-24",
  team: "h-36 w-32",
  lg: "h-40 w-32",
};

const labelByOption: Record<string, string> = {
  cap: "圆帽",
  side: "侧分",
  crest: "翘发",
  visor: "护目",
  jacket: "夹克",
  robe: "长袍",
  armor: "护甲",
  hoodie: "连帽",
  calm: "平静",
  focus: "专注",
  spark: "高光",
  line: "坚定",
  smile: "微笑",
  dot: "沉思",
  none: "无",
  glasses: "眼镜",
  headset: "耳机",
  badge: "徽章",
  auto: "自动",
};

function avatar(config: PixelAgentAvatarConfig) {
  return { ...defaultPixelAgentAvatarConfig(), ...config };
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
  const outline = "#263244";
  const deep = "#111827";
  const softShadow = "#000000";
  return (
    <g>
      <Px x={43} y={115} w={17} h={27} fill={deep} />
      <Px x={72} y={115} w={17} h={27} fill={deep} />
      <Px x={47} y={116} w={10} h={24} fill={value.suit} />
      <Px x={75} y={116} w={10} h={24} fill={value.suit} />
      <Px x={47} y={141} w={18} h={5} fill={deep} />
      <Px x={72} y={141} w={18} h={5} fill={deep} />
      <Px x={42} y={146} w={25} h={5} fill={deep} />
      <Px x={70} y={146} w={25} h={5} fill={deep} />
      <Px x={51} y={132} w={5} h={5} fill="#ffffff" opacity={0.18} />
      <Px x={79} y={132} w={5} h={5} fill="#ffffff" opacity={0.18} />

      <StepPath points={[[32, 79], [43, 79], [43, 110], [39, 114], [31, 114], [27, 108], [27, 88], [32, 88]]} fill={deep} />
      <StepPath points={[[94, 79], [105, 79], [105, 88], [110, 88], [110, 108], [106, 114], [98, 114], [94, 110]]} fill={deep} />
      <Px x={34} y={84} w={6} h={25} fill={value.skin} />
      <Px x={97} y={84} w={6} h={25} fill={value.skin} />
      <Px x={31} y={108} w={8} h={6} fill={value.skin} opacity={0.86} />
      <Px x={98} y={108} w={8} h={6} fill={value.skin} opacity={0.86} />

      <Px x={56} y={68} w={21} h={16} fill={outline} />
      <Px x={59} y={68} w={15} h={14} fill={value.skin} />
      <StepPath points={[[41, 78], [91, 78], [99, 88], [95, 122], [86, 129], [48, 129], [39, 122], [35, 88]]} fill={deep} />
      <StepPath points={[[45, 82], [87, 82], [94, 90], [90, 118], [82, 125], [52, 125], [44, 118], [40, 90]]} fill={value.suit} />
      <Px x={51} y={85} w={31} h={4} fill="#ffffff" opacity={0.2} />
      <Px x={41} y={92} w={4} h={23} fill={softShadow} opacity={0.12} />
      <Px x={86} y={92} w={4} h={23} fill="#ffffff" opacity={0.08} />
      <Px x={62} y={83} w={7} h={43} fill={value.accent} opacity={0.88} />
      <Px x={65} y={85} w={2} h={37} fill="#ffffff" opacity={0.28} />
      {value.outfitStyle === "robe" ? (
        <>
          <StepPath points={[[38, 101], [94, 101], [91, 137], [85, 142], [48, 142], [41, 137]]} fill={deep} />
          <StepPath points={[[43, 101], [89, 101], [86, 134], [80, 138], [52, 138], [46, 134]]} fill={value.suit} />
          <Px x={63} y={81} w={7} h={56} fill={value.accent} />
          <Px x={51} y={86} w={31} h={3} fill="#ffffff" opacity={0.3} />
          <Px x={47} y={121} w={40} h={4} fill={value.accent} opacity={0.64} />
          <Px x={47} y={134} w={39} h={3} fill={deep} opacity={0.18} />
        </>
      ) : null}
      {value.outfitStyle === "armor" ? (
        <>
          <Px x={45} y={81} w={42} h={13} fill={deep} />
          <Px x={49} y={98} w={35} h={18} fill={value.suit} />
          <Px x={57} y={92} w={20} h={20} fill={deep} />
          <Px x={61} y={96} w={12} h={12} fill={value.accent} />
          <Px x={64} y={99} w={6} h={5} fill="#ffffff" opacity={0.42} />
          <Px x={50} y={113} w={34} h={4} fill={value.accent} />
          <Px x={53} y={85} w={28} h={2} fill="#ffffff" opacity={0.24} />
        </>
      ) : null}
      {value.outfitStyle === "hoodie" ? (
        <>
          <StepPath points={[[46, 78], [87, 78], [92, 88], [83, 93], [51, 93], [41, 88]]} fill={value.hair} />
          <Px x={58} y={89} w={4} h={26} fill={value.accent} />
          <Px x={73} y={89} w={4} h={26} fill={value.accent} />
          <Px x={50} y={116} w={35} h={3} fill="#ffffff" opacity={0.18} />
        </>
      ) : null}
      {value.outfitStyle === "jacket" ? (
        <>
          <Px x={45} y={82} w={15} h={34} fill={value.accent} />
          <Px x={74} y={82} w={14} h={34} fill={value.accent} />
          <Px x={60} y={82} w={14} h={34} fill={value.suit} />
          <Px x={66} y={85} w={3} h={29} fill="#ffffff" opacity={0.34} />
          <Px x={50} y={89} w={8} h={2} fill="#ffffff" opacity={0.3} />
          <Px x={78} y={89} w={7} h={2} fill="#ffffff" opacity={0.3} />
          <Px x={46} y={115} w={42} h={3} fill={deep} opacity={0.18} />
        </>
      ) : null}
    </g>
  );
}

function PixelHair({ value }: { value: PixelAgentAvatarConfig }) {
  const outline = "#0f172a";
  if (value.hairStyle === "side") {
    return (
      <g>
        <StepPath points={[[39, 24], [86, 24], [98, 34], [99, 48], [91, 52], [82, 45], [47, 45], [36, 52], [34, 37]]} fill={outline} />
        <StepPath points={[[43, 27], [83, 27], [94, 35], [94, 45], [87, 48], [77, 40], [48, 42], [39, 49], [38, 38]]} fill={value.hair} />
        <Px x={37} y={49} w={10} h={22} fill={outline} />
        <Px x={40} y={49} w={7} h={19} fill={value.hair} />
        <Px x={87} y={49} w={10} h={21} fill={outline} />
        <Px x={87} y={49} w={7} h={18} fill={value.hair} />
        <Px x={50} y={31} w={29} h={2} fill="#ffffff" opacity={0.22} />
        <Px x={75} y={37} w={14} h={4} fill="#0f172a" opacity={0.24} />
      </g>
    );
  }
  if (value.hairStyle === "crest") {
    return (
      <g>
        <StepPath points={[[58, 13], [68, 13], [72, 31], [84, 22], [92, 28], [90, 39], [98, 40], [98, 50], [88, 54], [45, 54], [35, 49], [37, 38], [47, 31]]} fill={outline} />
        <StepPath points={[[61, 16], [67, 16], [69, 34], [82, 25], [88, 30], [84, 39], [93, 42], [92, 48], [84, 50], [47, 50], [40, 47], [42, 39], [50, 33]]} fill={value.hair} />
        <Px x={41} y={50} w={12} h={20} fill={value.hair} />
        <Px x={84} y={50} w={10} h={18} fill={value.hair} />
        <Px x={61} y={18} w={4} h={10} fill="#ffffff" opacity={0.18} />
        <Px x={76} y={29} w={8} h={3} fill="#ffffff" opacity={0.14} />
      </g>
    );
  }
  if (value.hairStyle === "visor") {
    return (
      <g>
        <StepPath points={[[39, 24], [90, 24], [98, 33], [96, 44], [86, 47], [48, 47], [37, 42]]} fill={outline} />
        <StepPath points={[[43, 27], [87, 27], [94, 34], [91, 41], [84, 43], [50, 43], [41, 39]]} fill={value.hair} />
        <Px x={34} y={42} w={66} h={11} fill={outline} />
        <Px x={38} y={45} w={58} h={5} fill={value.accent} />
        <Px x={51} y={46} w={31} h={2} fill="#ffffff" opacity={0.76} />
        <Px x={41} y={53} w={11} h={17} fill={value.hair} />
        <Px x={85} y={53} w={9} h={16} fill={value.hair} />
        <Px x={92} y={45} w={4} h={5} fill="#ffffff" opacity={0.28} />
      </g>
    );
  }
  return (
    <g>
      <StepPath points={[[40, 23], [87, 23], [98, 34], [99, 48], [91, 53], [44, 53], [35, 48], [35, 36]]} fill={outline} />
      <StepPath points={[[43, 27], [84, 27], [94, 35], [94, 45], [87, 49], [47, 49], [39, 45], [39, 37]]} fill={value.hair} />
      <Px x={39} y={50} w={14} h={20} fill={value.hair} />
      <Px x={54} y={47} w={13} h={10} fill={value.hair} />
      <Px x={70} y={47} w={12} h={10} fill={value.hair} />
      <Px x={84} y={50} w={12} h={19} fill={value.hair} />
      <Px x={51} y={31} w={27} h={3} fill="#ffffff" opacity={0.18} />
      <Px x={40} y={40} w={14} h={4} fill="#0f172a" opacity={0.18} />
    </g>
  );
}

function PixelFace({ value }: { value: PixelAgentAvatarConfig }) {
  const outline = "#263244";
  const deep = "#111827";
  const eyeFill = value.eyeStyle === "spark" ? value.accent : outline;
  return (
    <g>
      <Px x={35} y={49} w={7} h={13} fill={deep} />
      <Px x={92} y={49} w={7} h={13} fill={deep} />
      <Px x={37} y={51} w={4} h={9} fill={value.skin} />
      <Px x={93} y={51} w={4} h={9} fill={value.skin} />
      <StepPath points={[[47, 33], [86, 33], [94, 41], [94, 65], [88, 73], [78, 78], [55, 78], [44, 73], [39, 65], [39, 41]]} fill={deep} />
      <StepPath points={[[49, 37], [84, 37], [89, 43], [89, 64], [84, 70], [77, 74], [56, 74], [49, 70], [44, 64], [44, 43]]} fill={value.skin} />
      <Px x={46} y={45} w={4} h={20} fill="#000000" opacity={0.08} />
      <Px x={83} y={45} w={5} h={19} fill="#ffffff" opacity={0.1} />
      <Px x={49} y={52} w={14} h={10} fill={outline} />
      <Px x={72} y={52} w={14} h={10} fill={outline} />
      <Px x={52} y={54} w={8} h={6} fill={eyeFill} />
      <Px x={75} y={54} w={8} h={6} fill={eyeFill} />
      <Px x={55} y={54} w={3} h={2} fill="#ffffff" />
      <Px x={78} y={54} w={3} h={2} fill="#ffffff" />
      <Px x={49} y={63} w={37} h={2} fill="#8d3b2d" opacity={0.1} />
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
          <Px x={59} y={66} w={5} h={2} fill="#8d3b2d" />
          <Px x={64} y={68} w={11} h={2} fill="#8d3b2d" />
          <Px x={75} y={66} w={5} h={2} fill="#8d3b2d" />
        </>
      ) : value.mouthStyle === "dot" ? (
        <Px x={65} y={66} w={6} h={3} fill="#8d3b2d" />
      ) : (
        <Px x={58} y={67} w={20} h={3} fill="#8d3b2d" />
      )}
    </g>
  );
}

function PixelAccessory({ value }: { value: PixelAgentAvatarConfig }) {
  if (value.accessory === "glasses") {
    return (
      <g>
        <Px x={48} y={51} w={17} h={2} fill="#0f172a" />
        <Px x={48} y={61} w={17} h={2} fill="#0f172a" />
        <Px x={48} y={51} w={2} h={12} fill="#0f172a" />
        <Px x={63} y={51} w={2} h={12} fill="#0f172a" />
        <Px x={71} y={51} w={17} h={2} fill="#0f172a" />
        <Px x={71} y={61} w={17} h={2} fill="#0f172a" />
        <Px x={71} y={51} w={2} h={12} fill="#0f172a" />
        <Px x={86} y={51} w={2} h={12} fill="#0f172a" />
        <Px x={65} y={56} w={6} h={2} fill="#0f172a" />
      </g>
    );
  }
  if (value.accessory === "headset") {
    return (
      <g>
        <Px x={38} y={48} w={5} h={21} fill="#0f172a" />
        <Px x={91} y={48} w={5} h={21} fill="#0f172a" />
        <Px x={41} y={40} w={5} h={8} fill="#0f172a" />
        <Px x={88} y={40} w={5} h={8} fill="#0f172a" />
        <Px x={93} y={69} w={14} h={3} fill={value.accent} />
        <Px x={104} y={65} w={3} h={7} fill="#0f172a" />
      </g>
    );
  }
  if (value.accessory === "badge") {
    return (
      <g>
        <Px x={78} y={86} w={10} h={11} fill="#0f172a" />
        <Px x={80} y={88} w={6} h={6} fill={value.accent} />
        <Px x={82} y={94} w={3} h={2} fill="#ffffff" opacity={0.72} />
      </g>
    );
  }
  return null;
}

export function PixelAgentAvatar({
  config,
  capabilityProfile,
  size = "md",
  className,
}: PixelAgentAvatarProps) {
  const value = avatar(config);
  const visual = deriveVisualAvatar(value, capabilityProfile);
  const dominant = capabilityProfile ? getAgentCapabilityWeapon(capabilityProfile) : null;
  const weaponKey: AgentCapabilityKey | undefined =
    value.weaponKey === "auto" ? dominant?.capability.key : value.weaponKey;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[8px] border border-white/70 bg-white shadow-sm ring-1 ring-black/5",
        sizeClass[size],
        className,
      )}
      aria-label="Agent avatar"
    >
      <svg
        viewBox="0 0 128 160"
        className="h-full w-full"
        aria-hidden="true"
        shapeRendering="crispEdges"
      >
        <Px x={0} y={0} w={128} h={160} fill={visual.background} />
        <Px x={0} y={112} w={128} h={48} fill="#ffffff" opacity={0.18} />
        <Px x={10} y={12} w={18} h={4} fill="#ffffff" opacity={0.28} />
        <Px x={22} y={19} w={10} h={2} fill="#ffffff" opacity={0.22} />
        <Px x={106} y={17} w={7} h={7} fill="#ffffff" opacity={0.18} />
        <Px x={94} y={28} w={12} h={3} fill="#ffffff" opacity={0.14} />
        <Px x={31} y={149} w={70} h={6} fill="#0f172a" opacity={0.16} />
        <Px x={43} y={145} w={46} h={3} fill="#0f172a" opacity={0.08} />
        <PixelWeapon value={visual} weaponKey={weaponKey} />
        <PixelBody value={visual} />
        <PixelFace value={visual} />
        <PixelHair value={visual} />
        <PixelAccessory value={visual} />
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

function colorControl(
  label: string,
  value: string,
  options: string[],
  onChange: (value: string) => void,
) {
  return (
    <FieldGroup label={label}>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={cn(
              "h-7 w-7 rounded-full border border-white shadow-sm ring-1 ring-black/10",
              option.toLowerCase() === value.toLowerCase() && "ring-2 ring-[var(--accent)]",
            )}
            style={{ background: option }}
            onClick={() => onChange(option)}
            aria-label={`${label} ${option}`}
          />
        ))}
      </div>
    </FieldGroup>
  );
}

export function PixelAgentAvatarEditor({
  value,
  capabilityProfile,
  seed = "agent",
  onChange,
}: PixelAgentAvatarEditorProps) {
  const current = avatar(value);

  function update<K extends keyof PixelAgentAvatarConfig>(field: K, nextValue: PixelAgentAvatarConfig[K]) {
    onChange({ ...current, [field]: nextValue });
  }

  function selectControl<K extends keyof PixelAgentAvatarConfig>(
    label: string,
    field: K,
    options: PixelAgentAvatarConfig[K][],
  ) {
    return (
      <FieldGroup label={label}>
        <Select value={String(current[field])} onChange={(event) => update(field, event.target.value as PixelAgentAvatarConfig[K])}>
          {options.map((option) => (
            <option key={String(option)} value={String(option)}>
              {labelByOption[String(option)] ?? String(option)}
            </option>
          ))}
        </Select>
      </FieldGroup>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
      <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--line)] bg-white/60 p-5">
        <PixelAgentAvatar config={current} capabilityProfile={capabilityProfile} size="lg" />
        <button
          type="button"
          className="mt-4 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--ink)] shadow-sm transition hover:bg-[var(--surface-muted)]"
          onClick={() => onChange(defaultPixelAgentAvatarConfig(`${seed}-${Date.now()}`))}
        >
          重新生成
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {colorControl("肤色", current.skin, skinOptions, (nextValue) => update("skin", nextValue))}
        {colorControl("发色", current.hair, hairOptions, (nextValue) => update("hair", nextValue))}
        {colorControl("服装", current.suit, suitOptions, (nextValue) => update("suit", nextValue))}
        {colorControl("强调色", current.accent, accentOptions, (nextValue) => update("accent", nextValue))}
        {colorControl("背景", current.background, backgroundOptions, (nextValue) => update("background", nextValue))}
        {selectControl("发型", "hairStyle", hairStyleOptions)}
        {selectControl("服装款式", "outfitStyle", outfitStyleOptions)}
        {selectControl("眼神", "eyeStyle", eyeStyleOptions)}
        {selectControl("嘴型", "mouthStyle", mouthStyleOptions)}
        {selectControl("配件", "accessory", accessoryOptions)}
        {selectControl("武器", "weaponKey", weaponKeyOptions)}
      </div>
    </div>
  );
}
