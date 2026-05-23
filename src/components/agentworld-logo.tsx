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
        <rect
          x="10"
          y="10"
          width="76"
          height="76"
          rx="24"
          className="agentworld-logo__frame"
          stroke="currentColor"
          strokeWidth="1.75"
          opacity="0.18"
        />
        <path
          d="M18 66L33 28L48 58L63 28L78 66"
          className="agentworld-logo__stroke agentworld-logo__stroke--one"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="6"
        />
        <path
          d="M39 47H57"
          className="agentworld-logo__stroke agentworld-logo__stroke--two"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="6"
        />
        <circle cx="70" cy="36" r="4" className="agentworld-logo__dot" fill="currentColor" />
      </svg>
    </div>
  );
}
