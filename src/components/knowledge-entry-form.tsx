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

type KnowledgeSpaceOption = {
  id: string;
  name: string;
};

type KnowledgeEntryValue = {
  id: string;
  knowledgeSpaceId: string | null;
  layer: string;
  scopeKey: string;
  skillId: string | null;
  title: string;
  contentMd: string;
  metadataJson: string;
  sourceType: string;
};

export function KnowledgeEntryForm({
  spaces,
  entry,
  triggerLabel,
}: {
  spaces: KnowledgeSpaceOption[];
  entry?: KnowledgeEntryValue;
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const isEdit = Boolean(entry?.id);
  const [form, setForm] = useState({
    id: entry?.id ?? "",
    knowledgeSpaceId: entry?.knowledgeSpaceId ?? "",
    layer: entry?.layer ?? "manual",
    scopeKey: entry?.scopeKey ?? "manual",
    skillId: entry?.skillId ?? "",
    title: entry?.title ?? "新增知识条目",
    contentMd: entry?.contentMd ?? "# 新增知识条目\n\n",
    metadataJson: entry?.metadataJson ?? "{}",
    sourceType: entry?.sourceType ?? "manual",
  });

  async function save() {
    setPending(true);
    setMessage(null);
    try {
      JSON.parse(form.metadataJson);
      const response = await fetch("/api/knowledge/entries", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          id: form.id || undefined,
          knowledgeSpaceId: form.knowledgeSpaceId || null,
          skillId: form.skillId || null,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) throw new Error(result.error ?? "保存知识条目失败");
      setOpen(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存知识条目失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={isEdit ? "ghost" : "secondary"} size={isEdit ? "sm" : "md"}>
          {isEdit ? <PencilLine className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {triggerLabel ?? (isEdit ? "编辑" : "新增知识条目")}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[min(96vw,980px)]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑知识条目" : "新增知识条目"}</DialogTitle>
          <DialogDescription>
            知识条目会写入本地记录并同步到 OpenViking，供团队、项目和 Agent 团队在任务运行时检索。
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-4 md:grid-cols-2">
            <FieldGroup label="标题">
              <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </FieldGroup>
            <FieldGroup label="知识空间">
              <Select
                value={form.knowledgeSpaceId}
                onChange={(event) => setForm({ ...form, knowledgeSpaceId: event.target.value })}
              >
                <option value="">按知识层自动归档</option>
                {spaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))}
              </Select>
            </FieldGroup>
            <FieldGroup label="知识层">
              <Input value={form.layer} onChange={(event) => setForm({ ...form, layer: event.target.value })} />
            </FieldGroup>
            <FieldGroup label="Scope Key">
              <Input value={form.scopeKey} onChange={(event) => setForm({ ...form, scopeKey: event.target.value })} />
            </FieldGroup>
            <FieldGroup label="来源类型">
              <Select value={form.sourceType} onChange={(event) => setForm({ ...form, sourceType: event.target.value })}>
                <option value="manual">人工维护</option>
                <option value="skill">Skill</option>
                <option value="review_context">检视上下文</option>
                <option value="review_finding">检视结果</option>
                <option value="review_feedback">人工反馈</option>
              </Select>
            </FieldGroup>
            <FieldGroup label="Skill ID">
              <Input value={form.skillId} onChange={(event) => setForm({ ...form, skillId: event.target.value })} />
            </FieldGroup>
            <FieldGroup label="元数据 JSON" className="md:col-span-2">
              <Textarea
                rows={4}
                value={form.metadataJson}
                onChange={(event) => setForm({ ...form, metadataJson: event.target.value })}
              />
            </FieldGroup>
            <FieldGroup label="Markdown 内容" className="md:col-span-2">
              <Textarea
                className="min-h-72 font-mono"
                value={form.contentMd}
                onChange={(event) => setForm({ ...form, contentMd: event.target.value })}
              />
            </FieldGroup>
          </div>
          <div className="mt-5 flex items-center justify-between gap-3">
            {message ? <div className="text-sm text-[var(--danger)]">{message}</div> : <div />}
            <div className="flex gap-2">
              <Button type="button" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button type="button" variant="primary" onClick={save} disabled={pending}>
                {pending ? "保存中" : "保存"}
              </Button>
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
