"use client";

import { Send } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLanguageText } from "@/components/language-pack-provider";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type TaskRunTeamNoteType = "note" | "blocker" | "decision" | "handoff";

type TaskRunTeamNoteFormProps = {
  taskRunId: string;
};

const noteTypes: TaskRunTeamNoteType[] = ["note", "blocker", "decision", "handoff"];

async function postTeamNote(args: {
  taskRunId: string;
  note: string;
  noteType: TaskRunTeamNoteType;
}) {
  const response = await fetch(`/api/task-runs/${encodeURIComponent(args.taskRunId)}/team-notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      note: args.note,
      noteType: args.noteType,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "ui.taskRunDetail.teamNote.messages.failed");
  }
}

export function TaskRunTeamNoteForm({ taskRunId }: TaskRunTeamNoteFormProps) {
  const text = useLanguageText();
  const router = useRouter();
  const [noteType, setNoteType] = useState<TaskRunTeamNoteType>("note");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function submitNote() {
    const nextNote = note.trim();
    if (!nextNote) {
      setMessage("ui.taskRunDetail.teamNote.messages.blank");
      return;
    }

    startTransition(async () => {
      try {
        setMessage("");
        await postTeamNote({ taskRunId, note: nextNote, noteType });
        setNote("");
        setMessage("ui.taskRunDetail.teamNote.messages.saved");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "ui.taskRunDetail.teamNote.messages.failed");
      }
    });
  }

  return (
    <Panel>
      <PanelHeader
        eyebrow="ui.taskRunDetail.teamNote.eyebrow"
        title="ui.taskRunDetail.teamNote.title"
        description="ui.taskRunDetail.teamNote.description"
      />
      <PanelBody className="space-y-4">
        <label className="block space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
            {text("ui.taskRunDetail.teamNote.fields.type")}
          </span>
          <Select
            value={noteType}
            disabled={isPending}
            aria-label="ui.taskRunDetail.teamNote.fields.type"
            onChange={(event) => setNoteType(event.target.value as TaskRunTeamNoteType)}
          >
            {noteTypes.map((type) => (
              <option key={type} value={type}>
                {`ui.taskRunDetail.teamNote.types.${type}`}
              </option>
            ))}
          </Select>
        </label>

        <label className="block space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
            {text("ui.taskRunDetail.teamNote.fields.note")}
          </span>
          <Textarea
            value={note}
            disabled={isPending}
            placeholder="ui.taskRunDetail.teamNote.placeholders.note"
            aria-label="ui.taskRunDetail.teamNote.fields.note"
            onChange={(event) => setNote(event.target.value)}
          />
        </label>

        <Button
          type="button"
          variant="primary"
          className="w-full"
          disabled={isPending || !note.trim()}
          onClick={submitNote}
        >
          <Send className="h-4 w-4" />
          {isPending
            ? "ui.taskRunDetail.teamNote.actions.submitting"
            : "ui.taskRunDetail.teamNote.actions.submit"}
        </Button>
        {message ? <div className="text-sm leading-6 text-[var(--ink-muted)]">{text(message)}</div> : null}
      </PanelBody>
    </Panel>
  );
}
