"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LegacyRouteRedirect({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const router = useRouter();

  useEffect(() => {
    router.replace(href);
  }, [href, router]);

  return (
    <div className="flex min-h-[320px] items-center justify-center">
      <Button asChild variant="secondary">
        <a href={href}>{label}</a>
      </Button>
    </div>
  );
}
