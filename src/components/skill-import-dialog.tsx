"use client";

import { useRef, useState, useTransition, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, Upload } from "lucide-react";
import { useLanguageText } from "@/components/language-pack-provider";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Option = { id: string; name: string };

type ImportFile = {
  name: string;
  relativePath?: string;
  content: string;
};

async function readFiles(fileList: FileList | File[]) {
  const files = Array.from(fileList);
  return Promise.all(
    files.map(async (file) => ({
      name: file.name,
      relativePath: file.webkitRelativePath || file.name,
      content: await file.text(),
    })),
  );
}

export function SkillImportDialog({ businessTeams }: { businessTeams: Option[] }) {
  const router = useRouter();
  const text = useLanguageText();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [ownerBusinessTeamId, setOwnerBusinessTeamId] = useState("");
  const [visibility, setVisibility] = useState("team");
  const [repoUrl, setRepoUrl] = useState("");
  const [files, setFiles] = useState<ImportFile[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function submitImport(payload: { files?: ImportFile[]; repoUrl?: string }) {
    setMessage(null);
    const response = await fetch("/api/skills/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        ownerBusinessTeamId: ownerBusinessTeamId || null,
        visibility,
      }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      result?: { imported?: number; skipped?: number; messages?: string[] };
    };
	    if (!response.ok || result.ok === false) throw new Error(result.error ?? text("skills.import.importFailed", "Skill import failed."));
    setMessage(
      text("skills.import.result", "Imported {imported} Skill(s), skipped {skipped}.", {
        imported: result.result?.imported ?? 0,
        skipped: result.result?.skipped ?? 0,
      }),
    );
    startTransition(() => router.refresh());
  }

  async function importSelectedFiles() {
    try {
      await submitImport({ files });
      setFiles([]);
    } catch (error) {
	      setMessage(error instanceof Error ? error.message : text("skills.import.importFailed", "Skill import failed."));
    }
  }

  async function discoverRepository() {
    try {
      await submitImport({ repoUrl });
      setRepoUrl("");
    } catch (error) {
	      setMessage(error instanceof Error ? error.message : text("skills.import.discoveryFailed", "Skill discovery failed."));
    }
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!event.dataTransfer.files.length) return;
    setFiles(await readFiles(event.dataTransfer.files));
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="skills.import.ownerTeam">
	          <Select value={ownerBusinessTeamId} onChange={(event) => setOwnerBusinessTeamId(event.target.value)}>
	            <option value="">{text("skills.import.noOwnerTeam", "No owner team")}</option>
            {businessTeams.map((team) => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label="skills.import.visibility">
	          <Select value={visibility} onChange={(event) => setVisibility(event.target.value)}>
	            <option value="private">{text("skills.import.private", "Private")}</option>
	            <option value="team">{text("skills.import.team", "Team visible")}</option>
	            <option value="global">{text("skills.import.global", "Global")}</option>
          </Select>
        </FieldGroup>
      </div>

      <div
        className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface-muted)] px-4 py-5"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-[var(--ink)]">{text("skills.import.dropTitle", "Drop Skill files here")}</div>
            <div className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
              {text("skills.import.dropDescription", "Supports SKILL.md, skill.json, *.skill.md, and *.skill.json.")}
            </div>
          </div>
          <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            {text("skills.import.chooseFiles", "Choose Files")}
          </Button>
          <input
            ref={fileInputRef}
            className="hidden"
            type="file"
            multiple
            accept=".md,.json"
            onChange={async (event) => {
              if (event.target.files) setFiles(await readFiles(event.target.files));
              event.target.value = "";
            }}
          />
        </div>
        <Textarea
          className="mt-4 min-h-[120px] font-mono text-xs"
          readOnly
          value={files.map((file) => file.relativePath || file.name).join("\n")}
          placeholder={text("skills.import.filePlaceholder", "Selected Skill files will appear here.")}
        />
        <div className="mt-3">
          <Button type="button" variant="primary" disabled={!files.length || isPending} onClick={importSelectedFiles}>
            {text("skills.import.importFiles", "Import Files")}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--line)] bg-white px-4 py-4">
        <FieldGroup
          label="skills.import.repoUrl"
          hint="skills.import.repoHint"
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={repoUrl}
              onChange={(event) => setRepoUrl(event.target.value)}
              placeholder="https://github.com/example/agentworld-skills.git"
            />
            <Button type="button" variant="secondary" disabled={!repoUrl.trim() || isPending} onClick={discoverRepository}>
              <GitBranch className="h-4 w-4" />
              {text("skills.import.discoverRepo", "Discover")}
            </Button>
          </div>
        </FieldGroup>
      </div>

      {message ? <div className="text-sm text-[var(--ink-muted)]">{message}</div> : null}
    </div>
  );
}
