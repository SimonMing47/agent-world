"use client";

import { SlidersHorizontal } from "lucide-react";
import {
  agentCapabilityDimensions,
  type AgentCapabilityKey,
  type AgentCapabilityProfile,
} from "@/lib/agent-capability-profile";
import { cn } from "@/lib/utils";

function polarPoint(center: number, radius: number, index: number, total: number, valueScale = 1) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total;
  const scaledRadius = radius * valueScale;
  return {
    x: center + Math.cos(angle) * scaledRadius,
    y: center + Math.sin(angle) * scaledRadius,
  };
}

function pointsToPath(points: Array<{ x: number; y: number }>) {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
}

function scoreValue(profile: AgentCapabilityProfile, key: AgentCapabilityKey) {
  return profile.scores.find((score) => score.key === key)?.value ?? 0;
}

export function AgentCapabilityRadar({
  profile,
  size = "md",
  className,
}: {
  profile: AgentCapabilityProfile;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const center = 100;
  const radius = size === "sm" ? 64 : 70;
  const dimensions = agentCapabilityDimensions;
  const outlinePoints = dimensions.map((_, index) => polarPoint(center, radius, index, dimensions.length));
  const valuePoints = dimensions.map((dimension, index) =>
    polarPoint(center, radius, index, dimensions.length, scoreValue(profile, dimension.key) / 100),
  );
  const labelRadius = size === "sm" ? 82 : 86;
  const viewBox = size === "sm" ? "0 0 200 200" : "-24 -18 248 236";

  return (
    <div
      className={cn(
        "relative aspect-square shrink-0",
        size === "sm" && "w-[86px]",
        size === "md" && "w-[180px]",
        size === "lg" && "w-[240px]",
        className,
      )}
    >
      <svg viewBox={viewBox} className="h-full w-full" aria-label="Agent 能力雷达图">
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <polygon
            key={scale}
            points={pointsToPath(dimensions.map((_, index) => polarPoint(center, radius, index, dimensions.length, scale)))}
            fill="none"
            stroke="rgba(15,23,42,0.12)"
            strokeWidth="1"
          />
        ))}
        {outlinePoints.map((point, index) => (
          <line
            key={dimensions[index].key}
            x1={center}
            y1={center}
            x2={point.x}
            y2={point.y}
            stroke="rgba(15,23,42,0.10)"
            strokeWidth="1"
          />
        ))}
        <polygon
          points={pointsToPath(valuePoints)}
          fill="rgba(9,199,232,0.22)"
          stroke="var(--accent-strong)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {valuePoints.map((point, index) => (
          <circle key={dimensions[index].key} cx={point.x} cy={point.y} r={size === "sm" ? 2.4 : 3.4} fill="var(--accent-strong)" />
        ))}
        {size !== "sm"
          ? dimensions.map((dimension, index) => {
              const labelPoint = polarPoint(center, labelRadius, index, dimensions.length);
              return (
                <text
                  key={dimension.key}
                  x={labelPoint.x}
                  y={labelPoint.y}
                  textAnchor={labelPoint.x < center - 4 ? "end" : labelPoint.x > center + 4 ? "start" : "middle"}
                  dominantBaseline="middle"
                  fill="var(--ink-muted)"
                  fontSize="10"
                  fontWeight="600"
                >
                  {dimension.label}
                </text>
              );
            })
          : null}
      </svg>
    </div>
  );
}

export function AgentCapabilityProfilePanel({ value }: { value: AgentCapabilityProfile }) {
  return (
    <div className="grid gap-5 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4 lg:grid-cols-[auto_1fr]">
      <div className="flex items-center justify-center">
        <AgentCapabilityRadar profile={value} size="lg" />
      </div>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--ink)]">
          <SlidersHorizontal className="h-4 w-4" />
          数据库能力画像
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {agentCapabilityDimensions.map((dimension) => (
            <div key={dimension.key} className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--ink-subtle)]">
                <span>{dimension.label}</span>
                <span className="font-mono text-[var(--ink)]">{scoreValue(value, dimension.key)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-[var(--accent-strong)]"
                  style={{ width: `${scoreValue(value, dimension.key)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        {value.rationale?.length ? (
          <div className="space-y-1 border-t border-[var(--line)] pt-3 text-xs leading-5 text-[var(--ink-muted)]">
            {value.rationale.map((item) => (
              <div key={item}>{item}</div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
