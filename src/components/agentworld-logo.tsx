import { cn } from "@/lib/utils";

export function AgentWorldLogo({
  className,
  animated = false,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("agentworld-logo", animated && "agentworld-logo-animated", className)}
    >
      <svg viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M78.4 34.2C70.7 24.4 55.2 21.1 41.8 27.2C25 34.9 21.8 56.7 33.6 67.3C46.2 78.7 65.2 69.7 64.4 52.5C63.7 38.4 47.9 36.1 39.5 45.4C31.2 54.6 38.8 65.1 52 60.6C63.6 56.7 73.7 47.1 81.5 36.5"
          className="agentworld-logo__thread agentworld-logo__thread--primary"
        />
        <path
          d="M35.2 63.7C45.2 70.7 61.2 68.2 72.2 55.1"
          className="agentworld-logo__thread agentworld-logo__thread--bridge"
        />
        <path
          d="M38.7 31.3C50.8 25.1 63.3 26.3 70.7 34.7"
          className="agentworld-logo__thread agentworld-logo__thread--glint"
        />
        <path
          d="M24.2 70.5C42.6 82.1 67.6 74.6 80.2 52.8"
          className="agentworld-logo__thread agentworld-logo__thread--wake"
        />
      </svg>
    </div>
  );
}
