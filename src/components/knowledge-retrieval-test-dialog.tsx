"use client";

import { Search, Sparkles } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { uiText } from "@/lib/language-pack";

type RetrievalHit = {
  id: string;
  title: string;
  vikingUri: string;
  syncStatus: string;
  layer: string;
  score: number;
  excerpt: string;
  levels?: Array<{
    level: "L0" | "L1" | "L2";
    label: string;
    purpose: string;
    score: number;
    excerpt: string;
    editable: boolean;
  }>;
};

export function KnowledgeRetrievalTestDialog({
  knowledgeSpaceId,
  knowledgeSpaceName,
}: {
  knowledgeSpaceId: string;
  knowledgeSpaceName: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hits, setHits] = useState<RetrievalHit[]>([]);

  async function runTest() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/knowledge/retrieval-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          knowledgeSpaceId,
          query,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        hits?: RetrievalHit[];
      };
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error ?? uiText("knowledge.retrieval.errors.failed"));
      }
      setHits(payload.hits ?? []);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : uiText("knowledge.retrieval.errors.failed"));
      setHits([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Search className="h-4 w-4" />
          knowledge.retrieval.action
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[min(96vw,960px)]">
        <DialogHeader>
          <DialogTitle>{uiText("knowledge.retrieval.dialogTitle", undefined, { name: knowledgeSpaceName })}</DialogTitle>
          <DialogDescription>knowledge.retrieval.dialogDescription</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-subtle)] px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-[var(--ink)] shadow-sm">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-semibold text-[var(--ink)]">knowledge.retrieval.tipTitle</div>
                <p className="text-sm leading-6 text-[var(--ink-muted)]">knowledge.retrieval.tipDescription</p>
              </div>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            {[
              ["L0", "空间摘要召回", "先用知识空间全局 Abstract 做向量召回和快速过滤。"],
              ["L1", "空间概览重排", "再用知识空间全局 Overview 理解目录结构并重排。"],
              ["L2", "原文读取", "最后读取完整 Markdown，只有这一层可编辑。"],
            ].map(([level, title, description]) => (
              <div key={level} className="rounded-2xl border border-[var(--line)] bg-white px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={level === "L2" ? "accent" : "neutral"}>{level}</Badge>
                  <span className="text-[11px] text-[var(--ink-subtle)]">{level === "L2" ? "可编辑" : "只读索引"}</span>
                </div>
                <div className="mt-2 text-sm font-semibold text-[var(--ink)]">{title}</div>
                <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">{description}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <FieldGroup label="knowledge.retrieval.queryLabel">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="knowledge.retrieval.queryPlaceholder"
              />
            </FieldGroup>
            <div className="flex items-end">
              <Button type="button" variant="primary" onClick={runTest} disabled={loading}>
                {loading ? "knowledge.retrieval.running" : "knowledge.retrieval.run"}
              </Button>
            </div>
          </div>

          {error ? <div className="text-sm text-[var(--danger)]">{error}</div> : null}

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-[var(--ink)]">knowledge.retrieval.resultsTitle</div>
              <Badge variant="neutral">
                {uiText("knowledge.retrieval.resultsCount", undefined, { count: hits.length })}
              </Badge>
            </div>

            {hits.length ? (
              <div className="space-y-3">
                {hits.map((hit) => (
                  <div key={hit.id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--ink)]">{hit.title}</div>
                        <div className="mt-1 break-all font-mono text-xs text-[var(--ink-subtle)]">{hit.vikingUri}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="accent">{uiText("knowledge.retrieval.score", undefined, { score: hit.score })}</Badge>
                        <Badge variant="neutral">{hit.layer}</Badge>
                        <Badge variant="success">{hit.syncStatus}</Badge>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-[var(--ink-muted)]">{hit.excerpt}</p>
                    {hit.levels?.length ? (
                      <div className="mt-3 grid gap-2">
                        {hit.levels.map((level) => (
                          <div key={`${hit.id}:${level.level}`} className="rounded-2xl border border-[var(--line)] bg-[var(--surface-subtle)] px-3 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="inline-flex items-center gap-2">
                                <Badge variant={level.editable ? "accent" : "neutral"}>{level.level}</Badge>
                                <span className="text-sm font-semibold text-[var(--ink)]">{level.label}</span>
                              </div>
                              <div className="inline-flex items-center gap-2 text-xs text-[var(--ink-subtle)]">
                                <span>{level.editable ? "可编辑" : "只读"}</span>
                                <span>score {level.score}</span>
                              </div>
                            </div>
                            <div className="mt-1 text-xs leading-5 text-[var(--ink-subtle)]">{level.purpose}</div>
                            {level.excerpt ? <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{level.excerpt}</p> : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface-subtle)] px-4 py-6 text-sm leading-7 text-[var(--ink-muted)]">
                {query.trim() ? uiText("knowledge.retrieval.empty") : uiText("knowledge.retrieval.idle")}
              </div>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
