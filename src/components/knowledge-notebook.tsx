"use client";

import { useEffect, useMemo, useState, useTransition, type KeyboardEvent } from "react";
import { Check, FileText, Folder, Plus, Save, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { KnowledgeSpaceForm } from "@/components/knowledge-space-form";
import { useAppDialogs } from "@/components/ui/app-dialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getMarkdownKeyboardEdit } from "@/lib/markdown-editor";
import { cn, formatBytes, formatDateTime } from "@/lib/utils";

type KnowledgeSpaceOption = {
  id: string;
  name: string;
  tenantSpaceId: string;
  businessTeamId: string | null;
  agentTeamId: string | null;
  projectKey: string | null;
  spaceType: string;
  visibility: string;
  status: string;
  vikingUri: string;
  description: string;
};

type KnowledgeEntryValue = {
  id: string;
  knowledgeSpaceId: string | null;
  layer: string;
  scopeKey: string;
  skillId: string | null;
  vikingUri: string;
  title: string;
  contentMd: string;
  metadataJson: string;
  sourceType: string;
  syncStatus: string;
  syncError: string | null;
  createdAt: string;
};

type TenantSpaceOption = { id: string; name: string };
type BusinessTeamOption = { id: string; name: string; tenantSpaceId?: string };
type AgentTeamOption = { id: string; businessTeamId: string; name: string };

type DraftEntry = {
  id: string;
  knowledgeSpaceId: string;
  layer: string;
  scopeKey: string;
  skillId: string;
  title: string;
  contentMd: string;
  metadataJson: string;
  sourceType: string;
};

function entryToDraft(entry: KnowledgeEntryValue | null, fallbackSpaceId: string): DraftEntry {
  return {
    id: entry?.id ?? "",
    knowledgeSpaceId: entry?.knowledgeSpaceId ?? fallbackSpaceId,
    layer: entry?.layer ?? "manual",
    scopeKey: entry?.scopeKey ?? "manual",
    skillId: entry?.skillId ?? "",
    title: entry?.title ?? "未命名知识",
    contentMd: entry?.contentMd ?? "# 未命名知识\n\n在这里记录可复用的上下文、决策和执行经验。",
    metadataJson: entry?.metadataJson ?? "{}",
    sourceType: entry?.sourceType ?? "manual",
  };
}

function syncLabel(status: string) {
  if (status.startsWith("remote_")) return "已同步";
  if (status === "remote_failed_local_shadow") return "本地影子";
  if (status === "local_shadow") return "本地";
  return "待同步";
}

function syncVariant(status: string): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (status.startsWith("remote_")) return "success";
  if (status === "remote_failed_local_shadow") return "warning";
  if (status === "local_shadow") return "accent";
  return "neutral";
}

function spaceLabel(spaceType: string) {
  const labels: Record<string, string> = {
    global: "全局",
    team: "团队",
    project: "项目",
    agent_team: "Agent 团队",
  };
  return labels[spaceType] ?? spaceType;
}

function renderInline(text: string) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={`${part}-${index}`} className="rounded bg-[rgba(15,23,42,0.06)] px-1.5 py-0.5 font-mono text-[0.92em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function MarkdownPreview({ content }: { content: string }) {
  const blocks = useMemo(() => {
    const output: Array<{ type: string; text?: string; items?: string[]; language?: string }> = [];
    const lines = content.split(/\r?\n/);
    let paragraph: string[] = [];
    let list: string[] = [];
    let code: string[] = [];
    let codeLanguage = "";
    let inCode = false;

    const flushParagraph = () => {
      if (!paragraph.length) return;
      output.push({ type: "p", text: paragraph.join(" ") });
      paragraph = [];
    };
    const flushList = () => {
      if (!list.length) return;
      output.push({ type: "ul", items: list });
      list = [];
    };

    for (const line of lines) {
      if (line.startsWith("```")) {
        if (inCode) {
          output.push({ type: "code", text: code.join("\n"), language: codeLanguage });
          code = [];
          codeLanguage = "";
          inCode = false;
        } else {
          flushParagraph();
          flushList();
          inCode = true;
          codeLanguage = line.replace(/^```/, "").trim();
        }
        continue;
      }
      if (inCode) {
        code.push(line);
        continue;
      }

      const trimmed = line.trim();
      if (!trimmed) {
        flushParagraph();
        flushList();
        continue;
      }

      if (/^#{1,3}\s/.test(trimmed)) {
        flushParagraph();
        flushList();
        const depth = trimmed.match(/^#+/)?.[0].length ?? 1;
        output.push({ type: `h${depth}`, text: trimmed.replace(/^#+\s*/, "") });
        continue;
      }

      if (/^[-*]\s+/.test(trimmed)) {
        flushParagraph();
        list.push(trimmed.replace(/^[-*]\s+/, ""));
        continue;
      }

      if (/^>\s?/.test(trimmed)) {
        flushParagraph();
        flushList();
        output.push({ type: "quote", text: trimmed.replace(/^>\s?/, "") });
        continue;
      }

      paragraph.push(trimmed);
    }
    flushParagraph();
    flushList();
    if (inCode) output.push({ type: "code", text: code.join("\n"), language: codeLanguage });
    return output;
  }, [content]);

  if (!blocks.length) {
    return <div className="text-sm text-[var(--ink-muted)]">预览会在这里显示。</div>;
  }

  return (
    <div className="space-y-4 text-[15px] leading-7 text-[var(--ink-muted)]">
      {blocks.map((block, index) => {
        if (block.type === "h1") {
          return <h1 key={index} className="text-2xl font-semibold tracking-[-0.03em] text-[var(--ink)]">{block.text}</h1>;
        }
        if (block.type === "h2") {
          return <h2 key={index} className="text-xl font-semibold tracking-[-0.02em] text-[var(--ink)]">{block.text}</h2>;
        }
        if (block.type === "h3") {
          return <h3 key={index} className="text-base font-semibold text-[var(--ink)]">{block.text}</h3>;
        }
        if (block.type === "ul") {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5">
              {block.items?.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}
            </ul>
          );
        }
        if (block.type === "quote") {
          return (
            <blockquote key={index} className="border-l-2 border-[var(--accent)] pl-4 text-[var(--ink)]">
              {renderInline(block.text ?? "")}
            </blockquote>
          );
        }
        if (block.type === "code") {
          return (
            <pre key={index} className="overflow-auto rounded-lg bg-[rgba(15,23,42,0.05)] p-4 text-xs leading-6 text-[var(--ink)]">
              {block.language ? <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-[var(--ink-subtle)]">{block.language}</div> : null}
              <code>{block.text}</code>
            </pre>
          );
        }
        return <p key={index}>{renderInline(block.text ?? "")}</p>;
      })}
    </div>
  );
}

export function KnowledgeNotebook({
  spaces,
  entries,
  tenantSpaces,
  businessTeams,
  agentTeams,
}: {
  spaces: KnowledgeSpaceOption[];
  entries: KnowledgeEntryValue[];
  tenantSpaces: TenantSpaceOption[];
  businessTeams: BusinessTeamOption[];
  agentTeams: AgentTeamOption[];
}) {
  const router = useRouter();
  const { confirm: showConfirm, dialogHost } = useAppDialogs();
  const [query, setQuery] = useState("");
  const [selectedSpaceId, setSelectedSpaceId] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState("");
  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId) ?? null;
  const [draft, setDraft] = useState<DraftEntry>(() => entryToDraft(selectedEntry, selectedSpaceId));
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDraft(entryToDraft(selectedEntry, selectedSpaceId));
    setMessage(null);
  }, [selectedEntry, selectedSpaceId]);

  const filteredSpaces = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return spaces.map((space) => {
      const spaceEntries = entries
        .filter((entry) => entry.knowledgeSpaceId === space.id)
        .filter((entry) => {
          if (!normalizedQuery) return true;
          return `${entry.title} ${entry.contentMd} ${entry.vikingUri}`.toLowerCase().includes(normalizedQuery);
        });
      return { space, entries: spaceEntries };
    }).filter((group) => group.entries.length || group.space.name.toLowerCase().includes(normalizedQuery));
  }, [entries, query, spaces]);

  const selectedSpace = spaces.find((space) => space.id === draft.knowledgeSpaceId) ?? spaces[0] ?? null;
  const selectedEntrySize = formatBytes(new TextEncoder().encode(draft.contentMd).length);

  function newEntry(spaceId = selectedSpaceId || spaces[0]?.id || "") {
    setSelectedSpaceId(spaceId);
    setSelectedEntryId("");
    setDraft(entryToDraft(null, spaceId));
  }

  async function saveEntry() {
    setMessage(null);
    try {
      JSON.parse(draft.metadataJson || "{}");
      const response = await fetch("/api/knowledge/entries", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          id: draft.id || undefined,
          knowledgeSpaceId: draft.knowledgeSpaceId || null,
          skillId: draft.skillId || null,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string; entry?: KnowledgeEntryValue };
      if (!response.ok || result.ok === false) throw new Error(result.error ?? "保存失败");
      if (result.entry?.id) setSelectedEntryId(result.entry.id);
      setMessage("已保存并同步到知识库");
      startTransition(() => router.refresh());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    }
  }

  async function deleteEntry() {
    if (!draft.id) {
      newEntry(draft.knowledgeSpaceId);
      return;
    }
    const confirmed = await showConfirm({
      title: "删除知识",
      description: `确定删除「${draft.title}」？这个操作不能撤销。`,
      confirmText: "删除",
      tone: "danger",
    });
    if (!confirmed) return;
    setMessage(null);
    const response = await fetch("/api/knowledge/entries", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: draft.id }),
    });
    if (!response.ok) {
      setMessage("删除失败");
      return;
    }
    const nextEntry = entries.find((entry) => entry.id !== draft.id && entry.knowledgeSpaceId === draft.knowledgeSpaceId) ?? entries.find((entry) => entry.id !== draft.id) ?? null;
    setSelectedEntryId(nextEntry?.id ?? "");
    setSelectedSpaceId(nextEntry?.knowledgeSpaceId ?? draft.knowledgeSpaceId);
    startTransition(() => router.refresh());
  }

  function handleMarkdownKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const edit = getMarkdownKeyboardEdit({
      value: event.currentTarget.value,
      selectionStart: event.currentTarget.selectionStart,
      selectionEnd: event.currentTarget.selectionEnd,
      key: event.key,
      shiftKey: event.shiftKey,
    });
    if (!edit) return;

    event.preventDefault();
    const textarea = event.currentTarget;
    setDraft((current) => ({ ...current, contentMd: edit.value }));
    requestAnimationFrame(() => {
      textarea.selectionStart = edit.selectionStart;
      textarea.selectionEnd = edit.selectionEnd;
    });
  }

  return (
    <section className="grid min-h-[720px] overflow-hidden rounded-lg border border-white/60 bg-[var(--surface)] shadow-[0_18px_60px_rgba(15,23,42,0.05)] lg:grid-cols-[320px_minmax(0,1fr)]">
      {dialogHost}
      <aside className="border-b border-[var(--line)] bg-[rgba(255,255,255,0.7)] lg:border-b-0 lg:border-r">
        <div className="border-b border-[var(--line)] px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">Knowledge Tree</div>
              <div className="mt-1 text-base font-semibold text-[var(--ink)]">知识树</div>
            </div>
            <Button type="button" size="sm" variant="primary" onClick={() => newEntry()}>
              <Plus className="h-4 w-4" />
              新建
            </Button>
          </div>
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-subtle)]" />
            <Input
              className="pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索标题、内容或 URI"
            />
          </div>
        </div>

        <div className="max-h-[640px] overflow-auto px-2 py-3">
          {filteredSpaces.length ? filteredSpaces.map(({ space, entries: spaceEntries }) => (
            <div key={space.id} className="mb-3">
              <button
                type="button"
                className={cn(
                  "flex w-full items-start gap-2 rounded-md px-3 py-2 text-left transition hover:bg-[rgba(15,23,42,0.035)]",
                  selectedSpaceId === space.id && "bg-[var(--accent-soft)]",
                )}
                onClick={() => {
                  setSelectedSpaceId(space.id);
                  if (!spaceEntries.some((entry) => entry.id === selectedEntryId)) {
                    setSelectedEntryId("");
                  }
                }}
              >
                <Folder className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--ink)]">{space.name}</span>
                  <span className="mt-1 flex items-center gap-2 text-[11px] text-[var(--ink-muted)]">
                    <span>{spaceLabel(space.spaceType)}</span>
                    <span>{spaceEntries.length} 篇</span>
                  </span>
                </span>
              </button>

              <div className="mt-1 space-y-1 pl-6">
                {spaceEntries.length ? spaceEntries.map((entry) => (
                  <button
                    type="button"
                    key={entry.id}
                    className={cn(
                      "group flex w-full gap-2 rounded-md px-3 py-2 text-left transition hover:bg-[rgba(15,23,42,0.035)]",
                      selectedEntryId === entry.id && "bg-[rgba(15,23,42,0.055)]",
                    )}
                    onClick={() => {
                      setSelectedSpaceId(space.id);
                      setSelectedEntryId(entry.id);
                    }}
                  >
                    <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--ink-subtle)] group-hover:text-[var(--ink-muted)]" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-[var(--ink)]">{entry.title}</span>
                      <span className="mt-1 block truncate text-[11px] text-[var(--ink-muted)]">{entry.layer} · {formatDateTime(entry.createdAt)}</span>
                    </span>
                  </button>
                )) : (
                  <button
                    type="button"
                    className="ml-3 rounded-md px-3 py-2 text-left text-xs text-[var(--ink-muted)] hover:bg-[rgba(15,23,42,0.035)]"
                    onClick={() => newEntry(space.id)}
                  >
                    这个空间还没有知识，点击新建。
                  </button>
                )}
              </div>
            </div>
          )) : (
            <div className="px-4 py-8 text-sm leading-6 text-[var(--ink-muted)]">没有匹配的知识条目。</div>
          )}
        </div>

        <div className="border-t border-[var(--line)] px-4 py-4">
          <KnowledgeSpaceForm
            tenantSpaces={tenantSpaces}
            businessTeams={businessTeams}
            agentTeams={agentTeams}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <div className="border-b border-[var(--line)] px-5 py-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <Input
                className="h-auto border-0 bg-transparent px-0 text-2xl font-semibold tracking-[-0.03em] shadow-none focus:ring-0"
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant={selectedEntry?.syncStatus ? syncVariant(selectedEntry.syncStatus) : "neutral"}>
                  {selectedEntry?.syncStatus ? syncLabel(selectedEntry.syncStatus) : "草稿"}
                </Badge>
                {selectedSpace ? <Badge variant="accent">{selectedSpace.name}</Badge> : null}
                <span className="text-xs text-[var(--ink-muted)]">{selectedEntrySize}</span>
                {selectedEntry?.vikingUri ? <span className="max-w-[520px] truncate font-mono text-xs text-[var(--ink-subtle)]">{selectedEntry.vikingUri}</span> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => newEntry(draft.knowledgeSpaceId)}>
                <Plus className="h-4 w-4" />
                新建知识
              </Button>
              <Button type="button" variant="secondary" onClick={deleteEntry}>
                <Trash2 className="h-4 w-4" />
                删除
              </Button>
              <Button type="button" variant="primary" onClick={saveEntry} disabled={isPending || !draft.title.trim()}>
                {isPending ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {isPending ? "保存中" : "保存"}
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <FieldGroup label="知识空间">
              <Select
                value={draft.knowledgeSpaceId}
                onChange={(event) => {
                  setSelectedSpaceId(event.target.value);
                  setDraft((current) => ({ ...current, knowledgeSpaceId: event.target.value }));
                }}
              >
                <option value="">不绑定</option>
                {spaces.map((space) => (
                  <option key={space.id} value={space.id}>{space.name}</option>
                ))}
              </Select>
            </FieldGroup>
            <FieldGroup label="Layer">
              <Input value={draft.layer} onChange={(event) => setDraft((current) => ({ ...current, layer: event.target.value }))} />
            </FieldGroup>
            <FieldGroup label="Scope">
              <Input value={draft.scopeKey} onChange={(event) => setDraft((current) => ({ ...current, scopeKey: event.target.value }))} />
            </FieldGroup>
            <FieldGroup label="Source">
              <Select value={draft.sourceType} onChange={(event) => setDraft((current) => ({ ...current, sourceType: event.target.value }))}>
                <option value="manual">手工录入</option>
                <option value="skill">Skill</option>
                <option value="inspection_context">检查上下文</option>
                <option value="inspection_finding">检查 Finding</option>
                <option value="inspection_feedback">检查反馈</option>
              </Select>
            </FieldGroup>
          </div>
          {message ? <div className="mt-3 text-sm text-[var(--ink-muted)]">{message}</div> : null}
        </div>

        <div className="grid min-h-[520px] flex-1 lg:grid-cols-2">
          <div className="flex min-h-[520px] flex-col border-b border-[var(--line)] lg:border-b-0 lg:border-r">
            <div className="flex h-11 items-center justify-between border-b border-[var(--line)] px-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-subtle)]">Markdown</div>
              <div className="text-xs text-[var(--ink-muted)]">编辑</div>
            </div>
            <Textarea
              className="min-h-[520px] flex-1 resize-none rounded-none border-0 bg-transparent px-5 py-5 font-mono text-sm leading-7 shadow-none focus:ring-0"
              value={draft.contentMd}
              onChange={(event) => setDraft((current) => ({ ...current, contentMd: event.target.value }))}
              onKeyDown={handleMarkdownKeyDown}
            />
          </div>
          <div className="flex min-h-[520px] flex-col bg-[rgba(255,255,255,0.54)]">
            <div className="flex h-11 items-center justify-between border-b border-[var(--line)] px-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-subtle)]">Preview</div>
              <div className="text-xs text-[var(--ink-muted)]">渲染预览</div>
            </div>
            <div className="flex-1 overflow-auto px-6 py-6">
              <MarkdownPreview content={draft.contentMd} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
