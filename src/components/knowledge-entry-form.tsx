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
    title: entry?.title ?? "ui.generated.c1880d5bbcc",
    contentMd: entry?.contentMd ?? "ui.generated.c14408d6be9",
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
      if (!response.ok || result.ok === false) throw new Error(result.error ?? "ui.generated.c8f484cbc06");
      setOpen(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ui.generated.c8f484cbc06");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={isEdit ? "ghost" : "secondary"} size={isEdit ? "sm" : "md"}>
          {isEdit ? <PencilLine className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {triggerLabel ?? (isEdit ? "ui.generated.ca7f814c0a4" : "ui.generated.c1880d5bbcc")}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[min(96vw,980px)]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "ui.generated.caaae11cf1f" : "ui.generated.c1880d5bbcc"}</DialogTitle>
          <DialogDescription>
            ui.generated.c61daf548b0
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-4 md:grid-cols-2">
            <FieldGroup label="ui.generated.c748d7dc7e3">
              <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </FieldGroup>
            <FieldGroup label="ui.generated.c7d405cc6a6">
              <Select
                value={form.knowledgeSpaceId}
                onChange={(event) => setForm({ ...form, knowledgeSpaceId: event.target.value })}
              >
                <option value="">ui.generated.ca6c793ffbe</option>
                {spaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))}
              </Select>
            </FieldGroup>
            <FieldGroup label="ui.generated.c986ff01617">
              <Input value={form.layer} onChange={(event) => setForm({ ...form, layer: event.target.value })} />
            </FieldGroup>
            <FieldGroup label="Scope Key">
              <Input value={form.scopeKey} onChange={(event) => setForm({ ...form, scopeKey: event.target.value })} />
            </FieldGroup>
            <FieldGroup label="ui.generated.c7b3f497abb">
              <Select value={form.sourceType} onChange={(event) => setForm({ ...form, sourceType: event.target.value })}>
                <option value="manual">ui.generated.c2c6e7307ce</option>
                <option value="skill">Skill</option>
                <option value="review_context">ui.generated.cd9ef5d882a</option>
                <option value="review_finding">ui.generated.cad1e33a0cf</option>
                <option value="review_feedback">ui.generated.c3099cc73b2</option>
              </Select>
            </FieldGroup>
            <FieldGroup label="Skill ID">
              <Input value={form.skillId} onChange={(event) => setForm({ ...form, skillId: event.target.value })} />
            </FieldGroup>
            <FieldGroup label="ui.generated.c1dfddb8d25" className="md:col-span-2">
              <Textarea
                rows={4}
                value={form.metadataJson}
                onChange={(event) => setForm({ ...form, metadataJson: event.target.value })}
              />
            </FieldGroup>
            <FieldGroup label="ui.generated.c740c8ca1f1" className="md:col-span-2">
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
                ui.generated.c4d0b4688c7
              </Button>
              <Button type="button" variant="primary" onClick={save} disabled={pending}>
                {pending ? "ui.generated.ca032e8fdda" : "ui.generated.cfadf24dbc5"}
              </Button>
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
