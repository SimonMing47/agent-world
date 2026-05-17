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
      setError("输入 JSON 格式不正确。");
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
      setError(result.error ?? "任务蓝图提交失败。");
      return;
    }

    router.push(`/task-runs/${result.taskRun.id}`);
    router.refresh();
  }

  return (
    <Panel>
      <PanelHeader
        eyebrow="运行控制台"
        title="从任务蓝图创建运行实例"
        description="输入本次运行的 payload，直接提交到任务平台内核。"
        action={
          <Button type="button" onClick={submit} disabled={isSubmitting} variant="primary">
            {isSubmitting ? "提交中" : "创建运行"}
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
