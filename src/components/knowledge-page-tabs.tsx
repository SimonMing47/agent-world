"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useLanguageText } from "@/components/language-pack-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type KnowledgeTabId = "editor" | "skill";

const tabs: Array<{ id: KnowledgeTabId; hash: string; label: string }> = [
  { id: "editor", hash: "knowledge-editor", label: "knowledge.tabs.editor" },
  { id: "skill", hash: "skill", label: "knowledge.tabs.skill" },
];

function tabFromHash(hash: string): KnowledgeTabId {
  const normalized = hash.replace(/^#/, "");
  if (normalized === "skill" || normalized === "knowledge-skill" || normalized === "knowledge-assets") return "skill";
  return "editor";
}

export function KnowledgePageTabs({ editor, skill }: { editor: ReactNode; skill: ReactNode }) {
  const text = useLanguageText();
  const [activeTab, setActiveTab] = useState<KnowledgeTabId>("editor");

  useEffect(() => {
    const syncHash = () => setActiveTab(tabFromHash(window.location.hash));
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  function selectTab(tabId: KnowledgeTabId) {
    setActiveTab(tabId);
    const tab = tabs.find((item) => item.id === tabId);
    window.history.replaceState(null, "", `#${tab?.hash ?? "knowledge-editor"}`);
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden" data-testid="knowledge-tabs">
      <div
        role="tablist"
        aria-label={text("knowledge.tabs.label")}
        className="mb-3 flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--line)] pb-2"
      >
        {tabs.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <Button
              key={tab.id}
              type="button"
              role="tab"
              size="sm"
              variant={selected ? "primary" : "secondary"}
              aria-selected={selected}
              aria-controls={`knowledge-tabpanel-${tab.id}`}
              onClick={() => selectTab(tab.id)}
            >
              {tab.label}
            </Button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <div
          id="knowledge-tabpanel-editor"
          role="tabpanel"
          className={cn("h-full min-h-0", activeTab === "editor" ? "flex" : "hidden")}
        >
          {editor}
        </div>
        <div
          id="knowledge-tabpanel-skill"
          role="tabpanel"
          className={cn("h-full min-h-0 overflow-auto", activeTab === "skill" ? "block" : "hidden")}
        >
          {skill}
        </div>
      </div>
    </section>
  );
}
