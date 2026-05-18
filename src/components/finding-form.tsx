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
	    taskRunId: finding?.taskRunId ?? "",
	    sourceAgent: finding?.sourceAgent ?? "",
	    category: finding?.category ?? "",
	    severity: finding?.severity ?? "info",
	    confidence: String(finding?.confidence ?? 1),
	    title: finding?.title ?? "",
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
      if (!response.ok || result.ok === false) throw new Error(result.error ?? "ui.generated.cc4389dc37f");
      setOpen(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ui.generated.cc4389dc37f");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={isEdit ? "ghost" : "secondary"} size={isEdit ? "sm" : "md"}>
          {isEdit ? <PencilLine className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {triggerLabel ?? (isEdit ? "ui.generated.ca7f814c0a4" : "ui.generated.c3b576dc25d")}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[min(96vw,1040px)]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "ui.generated.cedb5b2b6bb" : "ui.generated.c3b576dc25d"}</DialogTitle>
          <DialogDescription>
            ui.generated.c955d76553e
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-4 md:grid-cols-2">
            <FieldGroup label="ui.generated.c9e55ae88d8">
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
            <FieldGroup label="ui.generated.cbcd2a00caf">
              <Input value={form.sourceAgent} onChange={(event) => setForm({ ...form, sourceAgent: event.target.value })} />
            </FieldGroup>
            <FieldGroup label="ui.generated.c748d7dc7e3" className="md:col-span-2">
              <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </FieldGroup>
            <FieldGroup label="ui.generated.ced9f6d4d8e">
              <Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
            </FieldGroup>
            <FieldGroup label="ui.generated.c9272e8abe5">
              <Select value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value })}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="info">Info</option>
              </Select>
            </FieldGroup>
            <FieldGroup label="ui.generated.c62e951a692">
              <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option value="open">ui.generated.c59a9eb4e65</option>
                <option value="published">ui.generated.c176a2eb4eb</option>
                <option value="fixed">ui.generated.c50138c31ac</option>
                <option value="ignored">ui.generated.cbd172c8dcb</option>
                <option value="false_positive">ui.generated.c2d8bd33c00</option>
              </Select>
            </FieldGroup>
            <FieldGroup label="ui.generated.cb78c2dc2e2">
              <Input value={form.confidence} onChange={(event) => setForm({ ...form, confidence: event.target.value })} />
            </FieldGroup>
            <FieldGroup label="ui.generated.c412f54dc38" className="md:col-span-2">
              <Textarea
                className="min-h-28"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </FieldGroup>
            <FieldGroup label="ui.generated.cd7edee9ff4" className="md:col-span-2">
              <Textarea
                className="min-h-24"
                value={form.recommendation}
                onChange={(event) => setForm({ ...form, recommendation: event.target.value })}
              />
            </FieldGroup>
            <FieldGroup label="ui.generated.c23f30ae0c4" className="md:col-span-2">
              <Textarea
                className="min-h-28 font-mono"
                value={form.evidenceJson}
                onChange={(event) => setForm({ ...form, evidenceJson: event.target.value })}
              />
            </FieldGroup>
            <FieldGroup label="ui.generated.c211b8d9818">
              <Textarea
                className="min-h-24 font-mono"
                value={form.skillRefsJson}
                onChange={(event) => setForm({ ...form, skillRefsJson: event.target.value })}
              />
            </FieldGroup>
            <FieldGroup label="ui.generated.c00ae640edd">
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
                ui.generated.c4d0b4688c7
              </Button>
              <Button type="button" variant="primary" onClick={save} disabled={isSaving || !form.taskRunId || !form.title.trim()}>
                {isSaving ? "ui.generated.ca032e8fdda" : "ui.generated.cfadf24dbc5"}
              </Button>
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
