"use client";

import { PencilLine, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type FindingValue = {
  id: string;
  taskRunId: string;
  sourceAgent: string;
  category: string;
  severity: string;
  confidence: number;
  title: string;
  description: string;
  evidenceJson: string;
  recommendation: string;
  skillRefsJson: string;
  status: string;
  publicationJson: string;
};

type TaskRunOption = {
  id: string;
  label: string;
};

function normalizeJson(value: string, fallback: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return fallback;
  }
}

export function FindingForm({
  finding,
  taskRuns = [],
  triggerLabel,
}: {
  finding?: FindingValue;
  taskRuns?: TaskRunOption[];
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const isEdit = Boolean(finding?.id);
  const [form, setForm] = useState({
    id: finding?.id ?? "",
    taskRunId: finding?.taskRunId ?? taskRuns[0]?.id ?? "",
    sourceAgent: finding?.sourceAgent ?? "operator",
    category: finding?.category ?? "manual",
    severity: finding?.severity ?? "info",
    confidence: String(finding?.confidence ?? 1),
    title: finding?.title ?? "新增 Finding",
    description: finding?.description ?? "",
    evidenceJson: normalizeJson(finding?.evidenceJson ?? "{}", "{}"),
    recommendation: finding?.recommendation ?? "",
    skillRefsJson: normalizeJson(finding?.skillRefsJson ?? "[]", "[]"),
    status: finding?.status ?? "open",
    publicationJson: normalizeJson(finding?.publicationJson ?? '{"channels":[]}', '{"channels":[]}'),
  });

  async function save() {
    setIsSaving(true);
    setMessage(null);
    try {
      JSON.parse(form.evidenceJson);
      JSON.parse(form.skillRefsJson);
      JSON.parse(form.publicationJson);
      const response = await fetch("/api/findings", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          id: form.id || undefined,
          confidence: Number(form.confidence),
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) throw new Error(result.error ?? "保存 Finding 失败。");
      setOpen(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存 Finding 失败。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={isEdit ? "ghost" : "secondary"} size={isEdit ? "sm" : "md"}>
          {isEdit ? <PencilLine className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {triggerLabel ?? (isEdit ? "编辑" : "新增 Finding")}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[min(96vw,1040px)]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑 Finding" : "新增 Finding"}</DialogTitle>
          <DialogDescription>
            Finding 是任务运行的标准化问题输出，可用于误报治理、修复跟踪、报告发布和看板聚合。
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-4 md:grid-cols-2">
            <FieldGroup label="关联任务运行">
              {isEdit || taskRuns.length === 0 ? (
                <Input value={form.taskRunId} onChange={(event) => setForm({ ...form, taskRunId: event.target.value })} disabled={isEdit} />
              ) : (
                <Select value={form.taskRunId} onChange={(event) => setForm({ ...form, taskRunId: event.target.value })}>
                  {taskRuns.map((taskRun) => (
                    <option key={taskRun.id} value={taskRun.id}>
                      {taskRun.label}
                    </option>
                  ))}
                </Select>
              )}
            </FieldGroup>
            <FieldGroup label="来源 Agent">
              <Input value={form.sourceAgent} onChange={(event) => setForm({ ...form, sourceAgent: event.target.value })} />
            </FieldGroup>
            <FieldGroup label="标题" className="md:col-span-2">
              <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </FieldGroup>
            <FieldGroup label="类别">
              <Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
            </FieldGroup>
            <FieldGroup label="严重度">
              <Select value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value })}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="info">Info</option>
              </Select>
            </FieldGroup>
            <FieldGroup label="状态">
              <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option value="open">待处理</option>
                <option value="published">已发布</option>
                <option value="fixed">已修复</option>
                <option value="ignored">已忽略</option>
                <option value="false_positive">误报</option>
              </Select>
            </FieldGroup>
            <FieldGroup label="置信度">
              <Input value={form.confidence} onChange={(event) => setForm({ ...form, confidence: event.target.value })} />
            </FieldGroup>
            <FieldGroup label="描述" className="md:col-span-2">
              <Textarea
                className="min-h-28"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </FieldGroup>
            <FieldGroup label="修复建议" className="md:col-span-2">
              <Textarea
                className="min-h-24"
                value={form.recommendation}
                onChange={(event) => setForm({ ...form, recommendation: event.target.value })}
              />
            </FieldGroup>
            <FieldGroup label="证据 JSON" className="md:col-span-2">
              <Textarea
                className="min-h-28 font-mono"
                value={form.evidenceJson}
                onChange={(event) => setForm({ ...form, evidenceJson: event.target.value })}
              />
            </FieldGroup>
            <FieldGroup label="关联 Skill JSON">
              <Textarea
                className="min-h-24 font-mono"
                value={form.skillRefsJson}
                onChange={(event) => setForm({ ...form, skillRefsJson: event.target.value })}
              />
            </FieldGroup>
            <FieldGroup label="发布状态 JSON">
              <Textarea
                className="min-h-24 font-mono"
                value={form.publicationJson}
                onChange={(event) => setForm({ ...form, publicationJson: event.target.value })}
              />
            </FieldGroup>
          </div>
          <div className="mt-5 flex items-center justify-between gap-3">
            {message ? <div className="text-sm text-[var(--danger)]">{message}</div> : <div />}
            <div className="flex gap-2">
              <Button type="button" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button type="button" variant="primary" onClick={save} disabled={isSaving || !form.taskRunId || !form.title.trim()}>
                {isSaving ? "保存中" : "保存"}
              </Button>
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
