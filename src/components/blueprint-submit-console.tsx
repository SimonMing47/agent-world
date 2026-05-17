"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Textarea } from "@/components/ui/textarea";

export function BlueprintSubmitConsole({
  blueprintId,
  initialPayload,
}: {
  blueprintId: string;
  initialPayload: Record<string, unknown>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payloadText, setPayloadText] = useState(JSON.stringify(initialPayload, null, 2));
  const router = useRouter();

  async function submit() {
    setIsSubmitting(true);
    setError(null);
    let inputPayload: Record<string, unknown>;
    try {
      inputPayload = JSON.parse(payloadText) as Record<string, unknown>;
    } catch {
      setIsSubmitting(false);
      setError("ui.generated.c187ddd0847");
      return;
    }
    const response = await fetch(`/api/task-blueprints/${blueprintId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestedBy: "console",
        inputPayload,
      }),
    });
    const result = (await response.json()) as {
      ok?: boolean;
      taskRun?: { id?: string };
      error?: string;
    };
    setIsSubmitting(false);

    if (!response.ok || !result.taskRun?.id) {
      setError(result.error ?? "ui.generated.c8b01382baa");
      return;
    }

    router.push(`/task-runs/${result.taskRun.id}`);
    router.refresh();
  }

  return (
    <Panel>
      <PanelHeader
        eyebrow="ui.generated.cd8ceb61834"
        title="ui.generated.c6a708012d7"
        description="ui.generated.c816f52d4dd"
        action={
          <Button type="button" onClick={submit} disabled={isSubmitting} variant="primary">
            {isSubmitting ? "ui.generated.c4cc708dce4" : "ui.generated.cc25be47f3b"}
          </Button>
        }
      />
      <PanelBody>
        <Textarea
          className="min-h-40"
          value={payloadText}
          onChange={(event) => setPayloadText(event.target.value)}
        />
        {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
      </PanelBody>
    </Panel>
  );
}
