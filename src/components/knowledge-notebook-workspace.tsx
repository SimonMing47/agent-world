"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type FocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type UIEvent,
} from "react";
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Edit3,
  FileText,
  Folder,
  FolderPlus,
  Globe2,
  History,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Save,
  Search,
  SplitSquareHorizontal,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { MarkdownPreview, toggleTaskLine } from "@/components/knowledge-markdown-preview";
import { useLanguageText } from "@/components/language-pack-provider";
import { useAppDialogs } from "@/components/ui/app-dialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  KnowledgeImportDialog,
  type KnowledgeImportEntry,
  type KnowledgeImportFileSource,
  type KnowledgeImportFolderOption,
  type KnowledgeImportMode,
  knowledgeImportFilesFromDataTransfer,
} from "@/components/knowledge-import-dialog";
import { KnowledgeRetrievalTestDialog } from "@/components/knowledge-retrieval-test-dialog";
import { LEGACY_KNOWLEDGE_URI_SCHEME, normalizeKnowledgeUri } from "@/lib/knowledge-uri";
import { getMarkdownKeyboardEdit } from "@/lib/markdown-editor";
import { isCodebaseKnowledgeCategory, type KnowledgeCategory } from "@/lib/knowledge-categories";
import { cn, formatBytes, formatDateTime } from "@/lib/utils";

type TenantSpaceOption = {
  id: string;
  name: string;
};

type BusinessTeamOption = {
  id: string;
  name: string;
  tenantSpaceId?: string;
};

type AgentTeamOption = {
  id: string;
  businessTeamId: string;
  name: string;
};

export type KnowledgeWorkspaceMetric = {
  label: string;
  value: string | number;
  detail?: string;
  tone?: "default" | "accent" | "success" | "warning";
};

export type KnowledgeNotebookSpace = {
  id: string;
  tenantSpaceId: string;
  businessTeamId: string | null;
  agentTeamId: string | null;
  projectKey: string | null;
  knowledgeCategory: KnowledgeCategory;
  repositoryName: string | null;
  slug: string;
  name: string;
  spaceType: string;
  vikingUri: string;
  description: string;
  visibility: string;
  status: string;
  retentionPolicyJson: string;
  tenantName: string;
  ownerName: string;
  entryCount: number;
};

export type KnowledgeNotebookEntry = {
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
  updatedAt: string;
  updatedBy: string | null;
  revision: number;
};

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
  vikingUri: string;
  syncStatus: string;
  syncError: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
  revision: number;
  nodeType: "note" | "folder";
  parentFolderId: string | null;
};

type KnowledgeEntryVersion = {
  id: string;
  entryId: string;
  revision: number;
  knowledgeSpaceId: string | null;
  title: string;
  contentMd: string;
  metadataJson: string;
  sourceType: string;
  syncStatus: string;
  syncError: string | null;
  createdAt: string;
  createdBy: string | null;
};

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict";
type SaveResult = "saved" | "skipped" | "conflict" | "error";

type KnowledgeTreeNode = {
  id: string;
  label: string;
  uri: string;
  children: KnowledgeTreeNode[];
  entries: KnowledgeNotebookEntry[];
};

type KnowledgeIndexLevel = "L0" | "L1" | "L2";

type KnowledgeLayerItem = {
  level: KnowledgeIndexLevel;
  label: string;
  description: string;
  uri: string;
  preview: string;
  editable: boolean;
  scope: "space" | "entry";
};

type KnowledgeQueryStep = {
  level: KnowledgeIndexLevel;
  label: string;
  description: string;
  uri: string;
  active: boolean;
  editable: boolean;
};

const reasoningStepKeys = ["search", "read", "traverse", "repair"] as const;
const minEditorPreviewPaneRatio = 28;
const maxEditorPreviewPaneRatio = 78;

type PaneMode = "split" | "editor" | "preview";

type ContextTarget =
  | { type: "tree"; spaceId?: string }
  | { type: "space"; spaceId: string }
  | { type: "entry"; entryId: string };

type ContextMenuState = {
  x: number;
  y: number;
  target: ContextTarget;
};

type SpaceDialogState =
  | { mode: "create"; preferredType?: string; baseSpaceId?: string }
  | { mode: "edit"; space: KnowledgeNotebookSpace };

type KnowledgeImportDialogState = {
  open: boolean;
  mode: KnowledgeImportMode;
  files: KnowledgeImportFileSource[];
  defaultSpaceId: string;
  defaultParentFolderId: string | null;
};

const draftId = "__draft__";

const sourceTypeOptions = [
  { value: "manual", label: "knowledge.sourceType.manual" },
  { value: "skill", label: "terminology.knowledge" },
  { value: "inspection_context", label: "knowledge.sourceType.inspectionContext" },
  { value: "inspection_finding", label: "knowledge.sourceType.inspectionFinding" },
  { value: "inspection_feedback", label: "knowledge.sourceType.inspectionFeedback" },
];

function typeLabel(type: string) {
  const labels: Record<string, string> = {
    global: "common.knowledgeType.global",
    team: "common.knowledgeType.team",
    project: "common.knowledgeType.project",
    agent_team: "common.knowledgeType.agentTeam",
  };
  return labels[type] ?? type;
}

function visibilityLabel(visibility: string) {
  const labels: Record<string, string> = {
    private: "labels.visibility.private",
    team: "labels.visibility.team",
    global: "labels.visibility.global",
  };
  return labels[visibility] ?? visibility;
}

function statusVariant(status: string): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (status === "active") return "success";
  if (status === "paused") return "warning";
  if (status === "archived") return "neutral";
  return "neutral";
}

function syncStatusVariant(status: string): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (status === "local_indexed") return "success";
  if (status === "remote_failed_local_shadow") return "warning";
  if (status === "remote_pending_retry") return "warning";
  if (status.startsWith("remote_")) return "success";
  if (status === "local_shadow") return "accent";
  return "neutral";
}

function syncStatusLabel(status: string) {
  if (status === "local_indexed") return "knowledge.sync.localIndexed";
  if (status === "remote_failed_local_shadow") return "knowledge.sync.localOnly";
  if (status === "remote_pending_retry") return "knowledge.sync.engineBusy";
  if (status.startsWith("remote_")) return "knowledge.sync.engineIndexed";
  if (status === "local_shadow") return "knowledge.sync.localDraft";
  if (status === "draft") return "knowledge.sync.pendingSave";
  return status || "knowledge.sync.pendingSave";
}

function saveStateLabel(state: SaveState) {
  const labels: Record<SaveState, string> = {
    idle: "knowledge.saveState.idle",
    dirty: "knowledge.saveState.dirty",
    saving: "knowledge.saveState.saving",
    saved: "knowledge.saveState.saved",
    error: "knowledge.saveState.error",
    conflict: "knowledge.saveState.conflict",
  };
  return labels[state];
}

function saveStateVariant(state: SaveState): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (state === "dirty" || state === "saving") return "accent";
  if (state === "saved") return "success";
  if (state === "conflict") return "warning";
  if (state === "error") return "danger";
  return "neutral";
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function parseMetadataJson(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value || "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function nodeTypeOf(entry: KnowledgeNotebookEntry): "note" | "folder" {
  return parseMetadataJson(entry.metadataJson).notebookNodeType === "folder" ? "folder" : "note";
}

function parentFolderIdOf(entry: KnowledgeNotebookEntry) {
  const parentFolderId = parseMetadataJson(entry.metadataJson).parentFolderId;
  return typeof parentFolderId === "string" && parentFolderId ? parentFolderId : null;
}

function metadataForDraft(draft: DraftEntry) {
  return {
    ...parseMetadataJson(draft.metadataJson),
    notebookNodeType: draft.nodeType,
    parentFolderId: draft.parentFolderId,
  };
}

function createBlankDraft(
  spaceId: string,
  parentFolderId: string | null = null,
  nodeType: "note" | "folder" = "note",
  text: (key: string, fallback?: string, params?: Record<string, string | number>) => string,
): DraftEntry {
  const title = nodeType === "folder" ? text("knowledge.defaults.newFolderTitle") : text("knowledge.defaults.untitledEntryTitle");
  const metadata = {
    notebookNodeType: nodeType,
    parentFolderId,
  };

  return {
    id: "",
    knowledgeSpaceId: spaceId,
    layer: nodeType === "folder" ? "notebook/folder" : "manual",
    scopeKey: "manual",
    skillId: "",
    title,
    contentMd: nodeType === "folder" ? "" : text("knowledge.defaults.untitledEntryMarkdown"),
    metadataJson: JSON.stringify(metadata, null, 2),
    sourceType: "manual",
    vikingUri: "",
    syncStatus: "draft",
    syncError: null,
    createdAt: "",
    updatedAt: "",
    updatedBy: null,
    revision: 0,
    nodeType,
    parentFolderId,
  };
}

function toDraft(entry: KnowledgeNotebookEntry): DraftEntry {
  const nodeType = nodeTypeOf(entry);
  const parentFolderId = parentFolderIdOf(entry);

  return {
    id: entry.id,
    knowledgeSpaceId: entry.knowledgeSpaceId ?? "",
    layer: entry.layer,
    scopeKey: entry.scopeKey,
    skillId: entry.skillId ?? "",
    title: entry.title,
    contentMd: entry.contentMd,
    metadataJson: entry.metadataJson || "{}",
    sourceType: entry.sourceType || "manual",
    vikingUri: normalizeKnowledgeUri(entry.vikingUri),
    syncStatus: entry.syncStatus,
    syncError: entry.syncError,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt || entry.createdAt,
    updatedBy: entry.updatedBy,
    revision: entry.revision ?? 1,
    nodeType,
    parentFolderId,
  };
}

function descendantIds(entries: KnowledgeNotebookEntry[], folderId: string) {
  const childrenByParent = new Map<string, string[]>();
  for (const entry of entries) {
    const parentFolderId = parentFolderIdOf(entry);
    if (!parentFolderId) continue;
    childrenByParent.set(parentFolderId, [...(childrenByParent.get(parentFolderId) ?? []), entry.id]);
  }

  const ids = new Set<string>([folderId]);
  const visit = (id: string) => {
    for (const childId of childrenByParent.get(id) ?? []) {
      if (ids.has(childId)) continue;
      ids.add(childId);
      visit(childId);
    }
  };
  visit(folderId);
  return [...ids];
}

function decodeUriSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function parseKnowledgeUri(uri: string) {
  const value = uri.trim();
  const nativeMatch = /^agentworld:\/\/knowledge\/?(.*)$/.exec(value);
  if (nativeMatch) return nativeMatch[1].split("/").filter(Boolean).map(decodeUriSegment);

  const legacyMatch = new RegExp(`^${LEGACY_KNOWLEDGE_URI_SCHEME.replace("://", ":\\/\\/")}([^/]+)\\/?(.*)$`).exec(value);
  if (!legacyMatch) return [];
  const [, host, uriPath] = legacyMatch;
  return [host, ...uriPath.split("/").filter(Boolean)].map(decodeUriSegment);
}

function sameSegments(left: string[], right: string[]) {
  return left.length === right.length && left.every((part, index) => part === right[index]);
}

function knowledgeScopeLabel(uri: string) {
  const parts = parseKnowledgeUri(uri);
  if (parts[0] === "resources") return "Resources";
  if (parts[0] === "agent" && parts[1] === "skills") return "Agent Knowledge";
  if (parts[0] === "user" && parts[1] === "memories") return "User Memories";
  return parts[0] ? `agentworld://knowledge/${parts[0]}` : "AgentWorld Knowledge";
}

function knowledgeScopePrefixLength(uri: string) {
  const parts = parseKnowledgeUri(uri);
  if (parts[0] === "resources" && parts[1] === "agentworld") return 2;
  if (parts[0] === "agent" && parts[1] === "skills" && parts[2] === "agentworld") return 3;
  if (parts[0] === "user" && parts[1] === "memories" && parts[2] === "agentworld") return 3;
  return parts[0] ? 1 : 0;
}

function knowledgeRootUri(uri: string) {
  const parts = parseKnowledgeUri(uri);
  const prefixLength = knowledgeScopePrefixLength(uri);
  return prefixLength ? `agentworld://knowledge/${parts.slice(0, prefixLength).join("/")}` : uri;
}

function knowledgeDirectoryPath(space: KnowledgeNotebookSpace, entry: KnowledgeNotebookEntry) {
  const entryUri = normalizeKnowledgeUri(entry.vikingUri);
  const spaceUri = normalizeKnowledgeUri(space.vikingUri);
  const entryParts = parseKnowledgeUri(entryUri);
  const spaceParts = parseKnowledgeUri(spaceUri);
  const entryDirectories = entryParts.slice(0, Math.max(0, entryParts.length - 1));

  if (spaceParts.length && sameSegments(entryDirectories.slice(0, spaceParts.length), spaceParts)) {
    const relative = entryDirectories.slice(spaceParts.length);
    return {
      rootUri: spaceUri,
      scopeLabel: null as string | null,
      segments: relative.length ? relative : [entry.layer || entry.scopeKey || "manual"],
    };
  }

  const prefixLength = knowledgeScopePrefixLength(entryUri);
  const scoped = entryDirectories.slice(prefixLength);
  const scopeLabel = knowledgeScopeLabel(entryUri);
  return {
    rootUri: knowledgeRootUri(entryUri),
    scopeLabel,
    segments: [scopeLabel, ...(scoped.length ? scoped : [entry.layer || entry.scopeKey || "manual"])],
  };
}

function entrySearchText(entry: KnowledgeNotebookEntry) {
  return normalize(`${entry.title} ${entry.contentMd} ${entry.layer} ${entry.scopeKey} ${normalizeKnowledgeUri(entry.vikingUri)}`);
}

function filterEntriesWithAncestors(entries: KnowledgeNotebookEntry[], query: string) {
  if (!query) return entries;
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const included = new Set<string>();
  for (const entry of entries) {
    if (!entrySearchText(entry).includes(query)) continue;
    let current: KnowledgeNotebookEntry | undefined = entry;
    while (current && !included.has(current.id)) {
      included.add(current.id);
      const parentId = parentFolderIdOf(current);
      current = parentId ? byId.get(parentId) : undefined;
    }
  }
  return entries.filter((entry) => included.has(entry.id));
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function stripMarkdownForIndex(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+\[[ xX]]\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[*_~>#|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function markdownOutline(value: string) {
  const headings = value
    .split(/\r?\n/)
    .map((line) => /^#{1,4}\s+(.+)$/.exec(line.trim())?.[1]?.trim())
    .filter((line): line is string => Boolean(line));

  if (headings.length) return headings.slice(0, 8).join(" / ");

  const bullets = value
    .split(/\r?\n/)
    .map((line) => /^\s*[-*+]\s+(?:\[[ xX]]\s+)?(.+)$/.exec(line)?.[1]?.trim())
    .filter((line): line is string => Boolean(line));

  return bullets.slice(0, 8).join(" / ");
}

function knowledgeEngineLayerMeta(level: KnowledgeIndexLevel) {
  if (level === "L0") {
    return {
      label: "knowledge.engine.layers.l0.label",
      description: "knowledge.engine.layers.l0.description",
      editable: false,
    };
  }
  if (level === "L1") {
    return {
      label: "knowledge.engine.layers.l1.label",
      description: "knowledge.engine.layers.l1.description",
      editable: false,
    };
  }
  return {
    label: "knowledge.engine.layers.l2.label",
    description: "knowledge.engine.layers.l2.description",
    editable: true,
  };
}

function knowledgeEngineEntryLayerUri(entry: KnowledgeNotebookEntry | DraftEntry) {
  return normalizeKnowledgeUri(entry.vikingUri) || "agentworld://knowledge/pending";
}

function knowledgeEngineSpaceLayerUri(space: KnowledgeNotebookSpace | undefined, level: Exclude<KnowledgeIndexLevel, "L2">) {
  const uri = normalizeKnowledgeUri(space?.vikingUri) || "agentworld://knowledge/unassigned";
  return level === "L0" ? `abstract(${uri})` : `overview(${uri})`;
}

function knowledgeEngineSpaceLayerPreview(
  space: KnowledgeNotebookSpace | undefined,
  entries: KnowledgeNotebookEntry[],
  level: Exclude<KnowledgeIndexLevel, "L2">,
  text: (key: string, fallback?: string, params?: Record<string, string | number>) => string,
) {
  if (!space) return text("knowledge.engine.preview.selectSpaceFirst");
  const notes = entries.filter((entry) => nodeTypeOf(entry) !== "folder");
  const folders = entries.filter((entry) => nodeTypeOf(entry) === "folder");

  if (level === "L0") {
    const summaries = notes
      .slice(0, 16)
      .map((entry) => {
        const plain = stripMarkdownForIndex(entry.contentMd);
        return `- ${entry.title}: ${truncateText(plain || text("knowledge.engine.preview.noBody"), 96)}`;
      });
    return [
      text("knowledge.engine.preview.spaceAbstractTitle", undefined, { name: space.name }),
      text("knowledge.engine.preview.spaceStats", undefined, { folderCount: folders.length, entryCount: notes.length }),
      "",
      summaries.length ? summaries.join("\n") : text("knowledge.engine.preview.noSummarizableBody"),
    ].join("\n");
  }

  const outlines = notes
    .slice(0, 24)
    .map((entry) => {
      const outline = markdownOutline(entry.contentMd);
      return `## ${entry.title}\n${outline || truncateText(stripMarkdownForIndex(entry.contentMd) || text("knowledge.engine.preview.noStructure"), 220)}`;
    });
  return [
    text("knowledge.engine.preview.spaceOverviewTitle", undefined, { name: space.name }),
    "",
    text("knowledge.engine.preview.entryCountLine", undefined, { count: notes.length }),
    text("knowledge.engine.preview.folderCountLine", undefined, { count: folders.length }),
    `- Knowledge URI: ${normalizeKnowledgeUri(space.vikingUri)}`,
    "",
    outlines.length ? outlines.join("\n\n") : text("knowledge.engine.preview.noOverviewBody"),
  ].join("\n");
}

function knowledgeEngineEntryLayerPreview(entry: KnowledgeNotebookEntry | DraftEntry) {
  return entry.contentMd;
}

function knowledgeEngineLayerItems(
  entry: KnowledgeNotebookEntry | DraftEntry,
  space: KnowledgeNotebookSpace | undefined,
  spaceEntries: KnowledgeNotebookEntry[],
  text: (key: string, fallback?: string, params?: Record<string, string | number>) => string,
): KnowledgeLayerItem[] {
  const spaceItems = (["L0", "L1"] as const).map((level) => {
    const meta = knowledgeEngineLayerMeta(level);
    return {
      level,
      label: meta.label,
      description: meta.description,
      uri: knowledgeEngineSpaceLayerUri(space, level),
      preview: knowledgeEngineSpaceLayerPreview(space, spaceEntries, level, text),
      editable: meta.editable,
      scope: "space" as const,
    };
  });
  const meta = knowledgeEngineLayerMeta("L2");
  return [
    ...spaceItems,
    {
      level: "L2",
      label: meta.label,
      description: meta.description,
      uri: knowledgeEngineEntryLayerUri(entry),
      preview: knowledgeEngineEntryLayerPreview(entry),
      editable: meta.editable,
      scope: "entry",
    },
  ];
}

function knowledgeEngineQuerySteps(
  space: KnowledgeNotebookSpace | undefined,
  draft: DraftEntry,
  activeLevel: KnowledgeIndexLevel,
  query: string,
  text: (key: string, fallback?: string, params?: Record<string, string | number>) => string,
): KnowledgeQueryStep[] {
  const queryText = query.trim() || draft.title.trim() || text("knowledge.engine.query.currentKnowledge");
  const scope = normalizeKnowledgeUri(space?.vikingUri) || normalizeKnowledgeUri(draft.vikingUri) || "agentworld://knowledge/resources/agentworld";
  const target = normalizeKnowledgeUri(draft.vikingUri) || scope;

  return [
    {
      level: "L0",
      label: text("knowledge.engine.query.l0.label"),
      description: text("knowledge.engine.query.l0.description", undefined, { query: queryText }),
      uri: `find(query, target_uri=${scope}, level=0)`,
      active: activeLevel === "L0",
      editable: false,
    },
    {
      level: "L1",
      label: text("knowledge.engine.query.l1.label"),
      description: text("knowledge.engine.query.l1.description"),
      uri: `overview(${scope})`,
      active: activeLevel === "L1",
      editable: false,
    },
    {
      level: "L2",
      label: text("knowledge.engine.query.l2.label"),
      description: text("knowledge.engine.query.l2.description"),
      uri: `read(${target})`,
      active: activeLevel === "L2",
      editable: true,
    },
  ];
}

function buildKnowledgeEngineTree(space: KnowledgeNotebookSpace, entries: KnowledgeNotebookEntry[]) {
  const roots: KnowledgeTreeNode[] = [];
  const nodes = new Map<string, KnowledgeTreeNode>();
  const rootEntries = entries.filter((entry) => !parentFolderIdOf(entry));

  const getNode = (parentId: string, segment: string, uri: string, bucket: KnowledgeTreeNode[]) => {
    const id = `${parentId}/${segment}`;
    const existing = nodes.get(id);
    if (existing) return existing;
    const next: KnowledgeTreeNode = { id, label: segment, uri, children: [], entries: [] };
    nodes.set(id, next);
    bucket.push(next);
    return next;
  };

  for (const entry of rootEntries) {
    const path = knowledgeDirectoryPath(space, entry);
    const segments = path.segments;
    let children = roots;
    let parentId = space.id;
    let uri = path.rootUri;
    for (const [index, segment] of segments.entries()) {
      if (!(index === 0 && segment === path.scopeLabel)) {
        uri = uri ? `${uri.replace(/\/$/, "")}/${segment}` : segment;
      }
      const node = getNode(parentId, segment, uri, children);
      parentId = node.id;
      children = node.children;
    }
    const leafNode = nodes.get(parentId);
    if (leafNode) leafNode.entries.push(entry);
  }

  const sortNodes = (items: KnowledgeTreeNode[]) => {
    items.sort((left, right) => left.label.localeCompare(right.label, "zh-CN"));
    for (const item of items) {
      item.entries.sort((left, right) => {
        const leftFolder = nodeTypeOf(left) === "folder";
        const rightFolder = nodeTypeOf(right) === "folder";
        if (leftFolder !== rightFolder) return leftFolder ? -1 : 1;
        return left.title.localeCompare(right.title, "zh-CN");
      });
      sortNodes(item.children);
    }
  };
  sortNodes(roots);
  return roots;
}

function knowledgeEngineNodeCount(node: KnowledgeTreeNode): number {
  return node.entries.length + node.children.reduce((sum, child) => sum + knowledgeEngineNodeCount(child), 0);
}

function ContextMenu({
  state,
  entries,
  spaces,
  onClose,
  onNewNote,
  onNewFolder,
  onEditSpace,
  onCreateSpace,
  onDeleteSpace,
  onOpenEntry,
  onRenameEntry,
  onDeleteEntry,
}: {
  state: ContextMenuState | null;
  entries: KnowledgeNotebookEntry[];
  spaces: KnowledgeNotebookSpace[];
  onClose: () => void;
  onNewNote: (spaceId: string, parentFolderId?: string | null) => void;
  onNewFolder: (spaceId: string, parentFolderId?: string | null) => void;
  onEditSpace: (space: KnowledgeNotebookSpace) => void;
  onCreateSpace: (preferredType?: string, baseSpaceId?: string) => void;
  onDeleteSpace: (space: KnowledgeNotebookSpace) => void;
  onOpenEntry: (entry: KnowledgeNotebookEntry) => void;
  onRenameEntry: (entry: KnowledgeNotebookEntry) => void;
  onDeleteEntry: (entry: KnowledgeNotebookEntry) => void;
}) {
  const text = useLanguageText();

  if (!state) return null;

  let space: KnowledgeNotebookSpace | null = null;
  let entry: KnowledgeNotebookEntry | null = null;
  const target = state.target;
  if ("spaceId" in target && target.spaceId) {
    space = spaces.find((item) => item.id === target.spaceId) ?? null;
  } else if ("entryId" in target) {
    entry = entries.find((item) => item.id === target.entryId) ?? null;
  }
  const entrySpaceId = entry?.knowledgeSpaceId ?? space?.id ?? "";
  const entryParentId = entry && nodeTypeOf(entry) === "folder" ? entry.id : parentFolderIdOf(entry ?? ({} as KnowledgeNotebookEntry));

  const itemClass = "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-[var(--ink)] hover:bg-[rgba(15,23,42,0.04)]";

  return (
    <div
      className="fixed z-50 w-56 rounded-2xl border border-[var(--line)] bg-white p-1.5 shadow-[0_24px_70px_rgba(15,23,42,0.18)]"
      style={{ left: Math.min(state.x, window.innerWidth - 240), top: Math.min(state.y, window.innerHeight - 300) }}
      onClick={(event) => event.stopPropagation()}
    >
      {entry ? (
        <>
          <button className={itemClass} onClick={() => { onOpenEntry(entry); onClose(); }}>
            <BookOpen className="h-4 w-4 text-[var(--ink-subtle)]" />
            {text("actions.open")}
          </button>
          <button className={itemClass} onClick={() => { onNewNote(entrySpaceId, entryParentId); onClose(); }}>
            <FileText className="h-4 w-4 text-[var(--ink-subtle)]" />
            {text(nodeTypeOf(entry) === "folder" ? "knowledge.context.newEntryInsideFolder" : "knowledge.context.newSiblingEntry")}
          </button>
          <button className={itemClass} onClick={() => { onNewFolder(entrySpaceId, entryParentId); onClose(); }}>
            <FolderPlus className="h-4 w-4 text-[var(--ink-subtle)]" />
            {text(nodeTypeOf(entry) === "folder" ? "knowledge.context.newChildFolder" : "knowledge.context.newSiblingFolder")}
          </button>
          <button className={itemClass} onClick={() => { onRenameEntry(entry); onClose(); }}>
            <Edit3 className="h-4 w-4 text-[var(--ink-subtle)]" />
            {text("actions.rename")}
          </button>
          <div className="my-1 h-px bg-[var(--line)]" />
          <button className={cn(itemClass, "text-[var(--danger)]")} onClick={() => { onDeleteEntry(entry); onClose(); }}>
            <Trash2 className="h-4 w-4" />
            {text(nodeTypeOf(entry) === "folder" ? "knowledge.actions.deleteFolder" : "knowledge.actions.deleteEntry")}
          </button>
        </>
      ) : (
        <>
          <button className={itemClass} disabled={!entrySpaceId} onClick={() => { onNewNote(entrySpaceId); onClose(); }}>
            <FileText className="h-4 w-4 text-[var(--ink-subtle)]" />
            {text("knowledge.actions.newEntry")}
          </button>
          <button className={itemClass} disabled={!entrySpaceId} onClick={() => { onNewFolder(entrySpaceId); onClose(); }}>
            <FolderPlus className="h-4 w-4 text-[var(--ink-subtle)]" />
            {text("knowledge.actions.newFolder")}
          </button>
          <div className="my-1 h-px bg-[var(--line)]" />
          <button className={itemClass} onClick={() => { onCreateSpace("team", space?.id); onClose(); }}>
            <Folder className="h-4 w-4 text-[var(--ink-subtle)]" />
            {text("knowledge.actions.newTeamSpace")}
          </button>
          <button className={itemClass} onClick={() => { onCreateSpace("project", space?.id); onClose(); }}>
            <Folder className="h-4 w-4 text-[var(--ink-subtle)]" />
            {text("knowledge.actions.newProjectSpace")}
          </button>
          <button className={itemClass} onClick={() => { onCreateSpace("agent_team", space?.id); onClose(); }}>
            <Folder className="h-4 w-4 text-[var(--ink-subtle)]" />
            {text("knowledge.actions.newAgentSpace")}
          </button>
          {space ? (
            <>
              <div className="my-1 h-px bg-[var(--line)]" />
              <button className={itemClass} onClick={() => { onEditSpace(space); onClose(); }}>
                <Edit3 className="h-4 w-4 text-[var(--ink-subtle)]" />
                {text("knowledge.actions.editSpace")}
              </button>
              <button className={cn(itemClass, "text-[var(--danger)]")} onClick={() => { onDeleteSpace(space); onClose(); }}>
                <Trash2 className="h-4 w-4" />
                {text("knowledge.actions.deleteSpace")}
              </button>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

function SpaceQuickDialog({
  state,
  tenantSpaces,
  businessTeams,
  agentTeams,
  onClose,
}: {
  state: SpaceDialogState | null;
  tenantSpaces: TenantSpaceOption[];
  businessTeams: BusinessTeamOption[];
  agentTeams: AgentTeamOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const text = useLanguageText();
  const { alert: showAlert, dialogHost } = useAppDialogs();
  const editing = state?.mode === "edit" ? state.space : null;
  const baseBusinessTeamId = editing?.businessTeamId ?? (editing?.agentTeamId ? agentTeams.find((team) => team.id === editing.agentTeamId)?.businessTeamId ?? "" : "");
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: editing?.name ?? "",
    slug: editing?.slug ?? "",
    tenantSpaceId: editing?.tenantSpaceId ?? "",
    spaceType: editing?.spaceType ?? (state?.mode === "create" ? state.preferredType ?? "team" : "team"),
    businessTeamId: baseBusinessTeamId,
    agentTeamId: editing?.agentTeamId ?? "",
    knowledgeCategory: editing?.knowledgeCategory ?? "domain",
    repositoryName: editing?.repositoryName ?? "",
    projectKey: editing?.projectKey ?? "",
    visibility: editing?.visibility ?? "team",
    status: editing?.status ?? "active",
    description: editing?.description ?? "",
    retentionPolicyJson: editing?.retentionPolicyJson ?? "{}",
  });

  useEffect(() => {
    if (!state) return;
    setErrorMessage(null);
    const nextEditing = state.mode === "edit" ? state.space : null;
    const nextBaseBusinessTeamId = nextEditing?.businessTeamId ?? (nextEditing?.agentTeamId ? agentTeams.find((team) => team.id === nextEditing.agentTeamId)?.businessTeamId ?? "" : "");
    setForm({
      name: nextEditing?.name ?? "",
      slug: nextEditing?.slug ?? "",
      tenantSpaceId: nextEditing?.tenantSpaceId ?? "",
      spaceType: nextEditing?.spaceType ?? (state.mode === "create" ? state.preferredType ?? "team" : "team"),
      businessTeamId: nextBaseBusinessTeamId,
      agentTeamId: nextEditing?.agentTeamId ?? "",
      knowledgeCategory: nextEditing?.knowledgeCategory ?? "domain",
      repositoryName: nextEditing?.repositoryName ?? "",
      projectKey: nextEditing?.projectKey ?? "",
      visibility: nextEditing?.visibility ?? "team",
      status: nextEditing?.status ?? "active",
      description: nextEditing?.description ?? "",
      retentionPolicyJson: nextEditing?.retentionPolicyJson ?? "{}",
    });
  }, [agentTeams, state, tenantSpaces]);

  if (!state) return null;

  const availableAgentTeams = agentTeams.filter((team) => !form.businessTeamId || team.businessTeamId === form.businessTeamId);

  async function saveSpace() {
    setPending(true);
    setErrorMessage(null);
    try {
      const retentionPolicyJson = form.retentionPolicyJson.trim() || "{}";
      JSON.parse(retentionPolicyJson);
      const response = await fetch("/api/knowledge/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_space",
          id: editing?.id,
          tenantSpaceId: form.tenantSpaceId || null,
          name: form.name.trim(),
          slug: form.slug.trim() || undefined,
          spaceType: form.spaceType,
          businessTeamId: form.spaceType === "global" ? null : form.businessTeamId || null,
          agentTeamId: form.spaceType === "agent_team" ? form.agentTeamId || null : null,
          projectKey: form.spaceType === "project" ? form.projectKey.trim() || null : null,
          knowledgeCategory: form.knowledgeCategory,
          repositoryName: isCodebaseKnowledgeCategory(form.knowledgeCategory) ? form.repositoryName.trim() || null : null,
          description: form.description,
          visibility: form.visibility,
          status: form.status,
          retentionPolicyJson,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) throw new Error(result.error ?? text("knowledge.spaceForm.errors.saveFailed"));
      onClose();
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : text("knowledge.spaceForm.errors.saveFailed");
      setErrorMessage(message);
      setPending(false);
      void showAlert({
        title: text("knowledge.spaceForm.errors.saveFailed"),
        description: message,
        tone: "danger",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4 backdrop-blur-sm">
        <div className="w-[min(94vw,760px)] rounded-[24px] border border-[var(--line)] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.22)]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-5 py-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--ink-subtle)]">{text("terminology.knowledgeSpace")}</div>
            <div className="mt-1 text-lg font-semibold text-[var(--ink)]">{text(editing ? "knowledge.spaceForm.editTitle" : "knowledge.spaceForm.createTitle")}</div>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label={text("actions.close")}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
          <FieldGroup label={text("common.fields.name")}>
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={text("knowledge.spaceForm.placeholders.name")} />
          </FieldGroup>
          <FieldGroup label="Slug">
            <Input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="slug" />
          </FieldGroup>
          <FieldGroup label={text("terminology.tenantSpace")}>
            <Select value={form.tenantSpaceId} onChange={(event) => setForm({ ...form, tenantSpaceId: event.target.value })}>
              {tenantSpaces.map((space) => (
                <option key={space.id} value={space.id}>{space.name}</option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label={text("knowledge.fields.spaceType")}>
            <Select value={form.spaceType} onChange={(event) => setForm({ ...form, spaceType: event.target.value })}>
              <option value="global">{text("common.knowledgeType.global")}</option>
              <option value="team">{text("common.knowledgeType.team")}</option>
              <option value="project">{text("common.knowledgeType.project")}</option>
              <option value="agent_team">{text("common.knowledgeType.agentTeam")}</option>
            </Select>
          </FieldGroup>
          <FieldGroup label={text("terminology.businessTeam")}>
            <Select value={form.businessTeamId} onChange={(event) => setForm({ ...form, businessTeamId: event.target.value, agentTeamId: "" })}>
              <option value="">{text("common.select.none")}</option>
              {businessTeams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label={text("terminology.agentTeam")}>
            <Select
              value={form.agentTeamId}
              disabled={form.spaceType !== "agent_team"}
              onChange={(event) => setForm({ ...form, agentTeamId: event.target.value })}
            >
              <option value="">{text("common.select.none")}</option>
              {availableAgentTeams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label={text("knowledge.fields.projectKey")}>
            <Input
              value={form.projectKey}
              disabled={form.spaceType !== "project"}
              onChange={(event) => setForm({ ...form, projectKey: event.target.value })}
            />
          </FieldGroup>
          <FieldGroup label={text("common.fields.visibility")}>
            <Select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value })}>
              <option value="global">{text("labels.visibility.global")}</option>
              <option value="team">{text("labels.visibility.team")}</option>
              <option value="private">{text("labels.visibility.private")}</option>
            </Select>
          </FieldGroup>
          <FieldGroup label={text("common.fields.status")}>
            <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="active">{text("labels.status.active")}</option>
              <option value="paused">{text("labels.status.paused")}</option>
              <option value="archived">{text("labels.status.archived")}</option>
            </Select>
          </FieldGroup>
          <FieldGroup label={text("knowledge.category.label")}>
            <Select
              value={form.knowledgeCategory}
              onChange={(event) => setForm({ ...form, knowledgeCategory: event.target.value as KnowledgeCategory })}
            >
              <option value="global">{text("knowledge.category.global")}</option>
              <option value="domain">{text("knowledge.category.domain")}</option>
              <option value="skill">{text("knowledge.category.skill")}</option>
              <option value="codebase">{text("knowledge.category.codebase")}</option>
            </Select>
          </FieldGroup>
          <FieldGroup label={text("knowledge.repositoryName")}>
            <Input
              value={form.repositoryName}
              onChange={(event) => setForm({ ...form, repositoryName: event.target.value })}
              disabled={!isCodebaseKnowledgeCategory(form.knowledgeCategory)}
              placeholder={text("knowledge.repositoryName.placeholder")}
            />
          </FieldGroup>
          <FieldGroup label={text("knowledge.fields.retentionPolicy")}>
            <Textarea value={form.retentionPolicyJson} onChange={(event) => setForm({ ...form, retentionPolicyJson: event.target.value })} className="min-h-20 font-mono text-xs" />
          </FieldGroup>
          <FieldGroup label={text("common.fields.description")} className="md:col-span-2">
            <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="min-h-24" />
          </FieldGroup>
        </div>
        {errorMessage ? (
          <div
            className="mx-5 mb-5 flex items-start gap-3 rounded-2xl border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-sm text-[#9f1239]"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold">{text("knowledge.spaceForm.errors.saveFailed")}</div>
              <div className="mt-1 leading-6">{errorMessage}</div>
            </div>
          </div>
        ) : null}
        <div className="flex justify-end gap-2 border-t border-[var(--line)] px-5 py-4">
          <Button onClick={onClose}>{text("actions.cancel")}</Button>
          <Button variant="primary" onClick={saveSpace} disabled={pending || !form.name.trim()}>
            {text(pending ? "actions.saving" : "knowledge.actions.saveSpace")}
          </Button>
        </div>
        </div>
      </div>
      {dialogHost}
    </>
  );
}

export function KnowledgeNotebookWorkspace({
  spaces,
  entries,
  tenantSpaces,
  businessTeams,
  agentTeams,
}: {
  spaces: KnowledgeNotebookSpace[];
  entries: KnowledgeNotebookEntry[];
  tenantSpaces: TenantSpaceOption[];
  businessTeams: BusinessTeamOption[];
  agentTeams: AgentTeamOption[];
}) {
  const router = useRouter();
  const text = useLanguageText();
  const { alert: showAlert, confirm: showConfirm, prompt: showPrompt, dialogHost } = useAppDialogs();
  const initialEntry = entries[0];
  const initialSpaceId = initialEntry?.knowledgeSpaceId ?? "";
  const [entriesState, setEntriesState] = useState(entries);
  const [selectedSpaceId, setSelectedSpaceId] = useState(initialSpaceId);
  const [selectedEntryId, setSelectedEntryId] = useState(initialEntry?.id ?? draftId);
  const [draft, setDraft] = useState<DraftEntry>(() => (initialEntry ? toDraft(initialEntry) : createBlankDraft(initialSpaceId, null, "note", text)));
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [queryPathOpen, setQueryPathOpen] = useState(false);
  const [treeCollapsed, setTreeCollapsed] = useState(false);
  const [paneMode, setPaneMode] = useState<PaneMode>("split");
  const [editorPaneRatio, setEditorPaneRatio] = useState(58);
  const [selectedIndexLevel, setSelectedIndexLevel] = useState<KnowledgeIndexLevel>("L2");
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflictEntry, setConflictEntry] = useState<KnowledgeNotebookEntry | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<KnowledgeEntryVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [spaceDialog, setSpaceDialog] = useState<SpaceDialogState | null>(null);
  const [importDialog, setImportDialog] = useState<KnowledgeImportDialogState | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [collapsedSpaceIds, setCollapsedSpaceIds] = useState<Set<string>>(
    () => new Set(spaces.filter((space) => space.id !== initialSpaceId).map((space) => space.id)),
  );
  const [collapsedKnowledgePaths, setCollapsedKnowledgePaths] = useState<Set<string>>(() => new Set());
  const draftRef = useRef(draft);
  const dirtyRef = useRef(dirty);
  const saveStateRef = useRef(saveState);
  const savingRef = useRef(false);
  const pendingSaveRef = useRef<Promise<SaveResult> | null>(null);
  const navigatingRef = useRef(false);
  const editorPreviewShellRef = useRef<HTMLDivElement | null>(null);
  const editorTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef<"editor" | "preview" | null>(null);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    saveStateRef.current = saveState;
  }, [saveState]);

  useEffect(() => {
    const close = () => setContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const entriesBySpaceId = useMemo(() => {
    const map = new Map<string, KnowledgeNotebookEntry[]>();
    for (const space of spaces) map.set(space.id, []);
    for (const entry of entriesState) {
      if (!entry.knowledgeSpaceId) continue;
      map.set(entry.knowledgeSpaceId, [...(map.get(entry.knowledgeSpaceId) ?? []), entry]);
    }
    return map;
  }, [entriesState, spaces]);

  const childEntriesByParentId = useMemo(() => {
    const map = new Map<string, KnowledgeNotebookEntry[]>();
    for (const entry of entriesState) {
      const parentFolderId = parentFolderIdOf(entry);
      if (!parentFolderId) continue;
      map.set(parentFolderId, [...(map.get(parentFolderId) ?? []), entry]);
    }
    for (const children of map.values()) {
      children.sort((left, right) => {
        const leftFolder = nodeTypeOf(left) === "folder";
        const rightFolder = nodeTypeOf(right) === "folder";
        if (leftFolder !== rightFolder) return leftFolder ? -1 : 1;
        return left.title.localeCompare(right.title, "zh-CN");
      });
    }
    return map;
  }, [entriesState]);

  const importFolderOptions = useMemo<KnowledgeImportFolderOption[]>(() => {
    const options: KnowledgeImportFolderOption[] = [];
    const visitFolder = (entry: KnowledgeNotebookEntry, depth: number) => {
      options.push({
        id: entry.id,
        title: entry.title,
        knowledgeSpaceId: entry.knowledgeSpaceId,
        depth,
      });
      for (const child of childEntriesByParentId.get(entry.id) ?? []) {
        if (nodeTypeOf(child) === "folder") visitFolder(child, depth + 1);
      }
    };

    for (const space of spaces) {
      entriesState
        .filter((entry) => entry.knowledgeSpaceId === space.id && nodeTypeOf(entry) === "folder" && !parentFolderIdOf(entry))
        .sort((left, right) => left.title.localeCompare(right.title, "zh-CN"))
        .forEach((entry) => visitFolder(entry, 0));
    }
    return options;
  }, [childEntriesByParentId, entriesState, spaces]);

  const normalizedQuery = normalize(query);
  const filteredSpaces = useMemo(() => {
    if (!normalizedQuery) return spaces;
    return spaces.filter((space) => {
      const spaceMatch = normalize(`${space.name} ${space.description} ${space.ownerName} ${normalizeKnowledgeUri(space.vikingUri)}`).includes(normalizedQuery);
      const entryMatch = (entriesBySpaceId.get(space.id) ?? []).some((entry) =>
        normalize(`${entry.title} ${entry.contentMd} ${entry.layer} ${entry.scopeKey}`).includes(normalizedQuery),
      );
      return spaceMatch || entryMatch;
    });
  }, [entriesBySpaceId, normalizedQuery, spaces]);

  const activeSpaceId = selectedIndexLevel === "L2"
    ? (draft.knowledgeSpaceId || selectedSpaceId)
    : (selectedSpaceId || draft.knowledgeSpaceId);
  const activeSpace = spaces.find((space) => space.id === activeSpaceId);
  const activeSpaceEntries = useMemo(() => {
    if (!activeSpace) return [];
    return entriesBySpaceId.get(activeSpace.id) ?? [];
  }, [activeSpace, entriesBySpaceId]);
  const contentSize = formatBytes(new TextEncoder().encode(draft.contentMd).length);
  const totalEntries = entriesState.filter((entry) => nodeTypeOf(entry) !== "folder").length;
  const totalFolders = entriesState.filter((entry) => nodeTypeOf(entry) === "folder").length;
  const selectedLayerItems = useMemo(
    () => knowledgeEngineLayerItems(draft, activeSpace, activeSpaceEntries, text),
    [activeSpace, activeSpaceEntries, draft, text],
  );
  const selectedLayerItem = selectedLayerItems.find((item) => item.level === selectedIndexLevel) ?? selectedLayerItems[2];
  const querySteps = useMemo(
    () => knowledgeEngineQuerySteps(activeSpace, draft, selectedIndexLevel, query, text),
    [activeSpace, draft, query, selectedIndexLevel, text],
  );
  const reasoningSteps = useMemo(
    () =>
      reasoningStepKeys.map((key) => ({
        key,
        label: text(`knowledge.engine.reasoning.${key}.label`),
        description: text(`knowledge.engine.reasoning.${key}.description`),
      })),
    [text],
  );
  const isIndexReadOnly = selectedIndexLevel !== "L2";
  const activeContentSize = isIndexReadOnly
    ? formatBytes(new TextEncoder().encode(selectedLayerItem.preview).length)
    : contentSize;
  const activeTitle = isIndexReadOnly
    ? `${activeSpace?.name ?? text("terminology.knowledge")} · ${text(selectedLayerItem.label)}`
    : draft.title;
  const showEditorPane = paneMode !== "preview";
  const showPreviewPane = paneMode !== "editor";
  const splitEditorPreviewActive = paneMode === "split" && showEditorPane && showPreviewPane;
  const editorPaneStyle = splitEditorPreviewActive
    ? { flex: `0 0 ${editorPaneRatio}%` }
    : undefined;
  const previewPaneStyle = splitEditorPreviewActive
    ? { flex: `0 0 ${100 - editorPaneRatio}%` }
    : undefined;

  function syncScrollToTarget({
    from,
    source,
    target,
  }: {
    from: "editor" | "preview";
    source: HTMLElement;
    target: HTMLElement;
  }) {
    if (syncingScrollRef.current === from) return;
    const sourceScrollable = source.scrollHeight - source.clientHeight;
    const targetScrollable = target.scrollHeight - target.clientHeight;
    if (sourceScrollable <= 0 || targetScrollable <= 0) return;

    const ratio = Math.max(0, Math.min(1, source.scrollTop / sourceScrollable));
    syncingScrollRef.current = from === "editor" ? "preview" : "editor";
    requestAnimationFrame(() => {
      target.scrollTop = ratio * targetScrollable;
      syncingScrollRef.current = null;
    });
  }

  function handleEditorScroll(event: UIEvent<HTMLTextAreaElement>) {
    const target = previewScrollRef.current;
    if (!target) return;
    syncScrollToTarget({ from: "editor", source: event.currentTarget, target });
  }

  function handlePreviewScroll(event: UIEvent<HTMLDivElement>) {
    const target = editorTextareaRef.current;
    if (!target) return;
    syncScrollToTarget({ from: "preview", source: event.currentTarget, target });
  }

  const updateEntryState = useCallback((entry: KnowledgeNotebookEntry) => {
    setEntriesState((current) => [entry, ...current.filter((item) => item.id !== entry.id)]);
  }, []);

  const replaceDraft = useCallback((nextDraft: DraftEntry, nextSaveState: SaveState = "idle", nextDirty = false) => {
    draftRef.current = nextDraft;
    dirtyRef.current = nextDirty;
    saveStateRef.current = nextSaveState;
    setDraft(nextDraft);
    setDirty(nextDirty);
    setSaveState(nextSaveState);
  }, []);

  function updateDraft(updater: DraftEntry | ((current: DraftEntry) => DraftEntry)) {
    if (selectedIndexLevel !== "L2") return;
    const next = typeof updater === "function"
      ? (updater as (current: DraftEntry) => DraftEntry)(draftRef.current)
      : updater;
    draftRef.current = next;
    dirtyRef.current = true;
    saveStateRef.current = "dirty";
    setDraft(next);
    setDirty(true);
    setSaveState("dirty");
    setSaveError(null);
    setConflictEntry(null);
    setMessage(null);
  }

  const loadVersions = useCallback(async (entryId = draftRef.current.id) => {
    if (!entryId) {
      setVersions([]);
      return;
    }

    setVersionsLoading(true);
    setVersionsError(null);
    try {
      const response = await fetch(`/api/knowledge/entry-versions?entryId=${encodeURIComponent(entryId)}`, {
        cache: "no-store",
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        versions?: KnowledgeEntryVersion[];
      };
      if (!response.ok || result.ok === false) throw new Error(result.error ?? "knowledge.versions.errors.loadFailed");
      setVersions(result.versions ?? []);
    } catch (error) {
      setVersionsError(error instanceof Error ? error.message : "knowledge.versions.errors.loadFailed");
      setVersions([]);
    } finally {
      setVersionsLoading(false);
    }
  }, []);

  const saveCurrentDraft = useCallback(
    async ({ silent = false, force = false }: { silent?: boolean; force?: boolean } = {}): Promise<SaveResult> => {
      if (savingRef.current && pendingSaveRef.current) {
        await pendingSaveRef.current;
      }

      const currentDraft = draftRef.current;
      if (!spaces.length || !currentDraft.knowledgeSpaceId) return "skipped";
      if (!force && !dirtyRef.current) return "skipped";
      if (!force && saveStateRef.current === "conflict") return "conflict";

      savingRef.current = true;
      if (!silent) setPending(true);
      setSaveState("saving");
      setSaveError(null);
      if (!silent) setMessage(null);

      let settleSave: (result: SaveResult) => void = () => undefined;
      const savePromise = new Promise<SaveResult>((resolve) => {
        settleSave = resolve;
      });
      pendingSaveRef.current = savePromise;

      void (async () => {
        let saveResult: SaveResult = "error";
        try {
          const metadata = metadataForDraft(currentDraft);
          const payload = {
            id: currentDraft.id || undefined,
            knowledgeSpaceId: currentDraft.knowledgeSpaceId || null,
            layer: currentDraft.layer.trim() || (currentDraft.nodeType === "folder" ? "notebook/folder" : "manual"),
            scopeKey: currentDraft.scopeKey.trim() || "manual",
            skillId: currentDraft.skillId.trim() || null,
            title: currentDraft.title.trim() || (currentDraft.nodeType === "folder" ? text("knowledge.defaults.newFolderTitle") : text("knowledge.defaults.untitledEntryTitle")),
            contentMd: currentDraft.contentMd,
            metadataJson: JSON.stringify(metadata, null, 2),
            sourceType: currentDraft.sourceType,
            baseRevision: currentDraft.id ? currentDraft.revision : null,
            saveReason: silent ? "auto" : "manual",
          };
          const response = await fetch("/api/knowledge/entries", {
            method: currentDraft.id ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const result = (await response.json().catch(() => ({}))) as {
            ok?: boolean;
            error?: string;
            entry?: KnowledgeNotebookEntry | null;
            currentEntry?: KnowledgeNotebookEntry | null;
          };

          if (response.status === 409) {
            if (result.currentEntry) updateEntryState(result.currentEntry);
            if (draftRef.current === currentDraft) {
              setConflictEntry(result.currentEntry ?? null);
              setSaveState("conflict");
              setSaveError(result.error ?? "knowledge.messages.conflictBeforeSave");
            }
            saveResult = "conflict";
            return;
          }

          if (!response.ok || result.ok === false || !result.entry) {
            throw new Error(result.error ?? "common.messages.saveFailed");
          }

          updateEntryState(result.entry);
          if (draftRef.current === currentDraft) {
            setSelectedEntryId(result.entry.id);
            setSelectedSpaceId(result.entry.knowledgeSpaceId ?? "");
            replaceDraft(toDraft(result.entry), "saved", false);
            setSaveError(null);
            setConflictEntry(null);
            setMessage(silent ? "knowledge.messages.autoSaved" : "knowledge.messages.savedToKnowledgeBase");
            if (versionsOpen) void loadVersions(result.entry.id);
          }
          router.refresh();
          saveResult = "saved";
        } catch (error) {
          if (draftRef.current === currentDraft) {
            setSaveState("error");
            setSaveError(error instanceof Error ? error.message : "common.messages.saveFailed");
            setMessage(error instanceof Error ? error.message : "common.messages.saveFailed");
          }
          saveResult = "error";
        } finally {
          savingRef.current = false;
          if (pendingSaveRef.current === savePromise) pendingSaveRef.current = null;
          if (!silent) setPending(false);
          settleSave(saveResult);
        }
      })();

      return savePromise;
    },
    [loadVersions, replaceDraft, router, spaces.length, text, updateEntryState, versionsOpen],
  );

  useEffect(() => {
    if (!dirty || saveState === "conflict") return;
    const timer = window.setTimeout(() => {
      void saveCurrentDraft({ silent: true });
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [dirty, draft, saveCurrentDraft, saveState]);

  useEffect(() => {
    if (!draft.id) return;
    const interval = window.setInterval(() => {
      const currentId = draftRef.current.id;
      if (!currentId) return;
      void fetch("/api/knowledge/entries", { cache: "no-store" })
        .then(async (response) => {
          const result = (await response.json().catch(() => ({}))) as {
            entries?: KnowledgeNotebookEntry[];
          };
          if (!response.ok) return;
          const remoteEntry = result.entries?.find((entry) => entry.id === currentId);
          if (!remoteEntry || remoteEntry.revision <= draftRef.current.revision) return;

          updateEntryState(remoteEntry);
          if (dirtyRef.current) {
            setConflictEntry(remoteEntry);
            setSaveState("conflict");
            setSaveError(text("knowledge.messages.autoSavePausedByConflict"));
            return;
          }

          replaceDraft(toDraft(remoteEntry));
          setSelectedEntryId(remoteEntry.id);
          setSelectedSpaceId(remoteEntry.knowledgeSpaceId ?? "");
          setSaveError(null);
          setMessage("knowledge.messages.syncedLatestVersion");
        })
        .catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(interval);
  }, [draft.id, replaceDraft, text, updateEntryState]);

  function handleWorkspaceBlur(event: FocusEvent<HTMLElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    if (dirtyRef.current && saveStateRef.current !== "conflict") void saveCurrentDraft({ silent: true });
  }

  function flushDraftOnBlur() {
    if (!dirtyRef.current || saveStateRef.current === "conflict") return;
    window.setTimeout(() => void saveCurrentDraft({ silent: true }), 0);
  }

  function handleMarkdownKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
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
    updateDraft((current) => ({ ...current, contentMd: edit.value }));
    requestAnimationFrame(() => {
      textarea.selectionStart = edit.selectionStart;
      textarea.selectionEnd = edit.selectionEnd;
    });
  }

  function selectPaneMode(nextMode: PaneMode) {
    setPaneMode(nextMode);
  }

  function startEditorPreviewResize(event: ReactPointerEvent<HTMLButtonElement>) {
    const shell = editorPreviewShellRef.current;
    if (!shell) return;

    event.preventDefault();
    const updateRatio = (clientX: number) => {
      const rect = shell.getBoundingClientRect();
      if (!rect.width) return;
      const nextRatio = ((clientX - rect.left) / rect.width) * 100;
      setEditorPaneRatio(Math.min(maxEditorPreviewPaneRatio, Math.max(minEditorPreviewPaneRatio, nextRatio)));
    };
    updateRatio(event.clientX);

    const handlePointerMove = (moveEvent: PointerEvent) => updateRatio(moveEvent.clientX);
    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  function openContextMenu(event: MouseEvent, target: ContextTarget) {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, target });
  }

  async function saveBeforeNavigation() {
    if (saveStateRef.current === "conflict") {
      setMessage("knowledge.messages.resolveConflictBeforeSwitch");
      return false;
    }
    if (!dirtyRef.current && !pendingSaveRef.current) return true;

    const result = await saveCurrentDraft({ silent: true });
    if (result === "error") {
      setMessage(text("knowledge.messages.stayedAfterSaveFailed"));
      return false;
    }
    if (result === "conflict") {
      setMessage("knowledge.messages.resolveConflictBeforeSwitch");
      return false;
    }
    return true;
  }

  async function selectEntryLayer(entry: KnowledgeNotebookEntry, level: "L2") {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    const canNavigate = await saveBeforeNavigation().finally(() => {
      navigatingRef.current = false;
    });
    if (!canNavigate) return;
    setCollapsedSpaceIds((current) => {
      const next = new Set(current);
      if (entry.knowledgeSpaceId) next.delete(entry.knowledgeSpaceId);
      return next;
    });
    setSelectedIndexLevel(level);
    setSelectedEntryId(entry.id);
    setSelectedSpaceId(entry.knowledgeSpaceId ?? "");
    replaceDraft(toDraft(entry));
    setSaveError(null);
    setConflictEntry(null);
    setVersionsOpen(false);
    setMessage(null);
  }

  function selectEntry(entry: KnowledgeNotebookEntry) {
    void selectEntryLayer(entry, "L2");
  }

  async function selectSpaceIndex(space: KnowledgeNotebookSpace, level: Exclude<KnowledgeIndexLevel, "L2">) {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    const canNavigate = await saveBeforeNavigation().finally(() => {
      navigatingRef.current = false;
    });
    if (!canNavigate) return;
    setCollapsedSpaceIds((current) => {
      const next = new Set(current);
      next.delete(space.id);
      return next;
    });
    setSelectedSpaceId(space.id);
    setSelectedEntryId(`space:${space.id}:${level}`);
    setSelectedIndexLevel(level);
    replaceDraft({
      ...createBlankDraft(space.id, null, "folder", text),
      title: `${space.name} · ${knowledgeEngineLayerMeta(level).label}`,
      layer: "knowledge/space-index",
      scopeKey: space.slug || knowledgeScopeLabel(normalizeKnowledgeUri(space.vikingUri)),
      vikingUri: normalizeKnowledgeUri(space.vikingUri),
      syncStatus: "remote_synced",
    });
    setSaveError(null);
    setConflictEntry(null);
    setVersionsOpen(false);
    setPropertiesOpen(false);
    setMessage(text("knowledge.messages.spaceIndexReadOnly", undefined, { name: space.name, layer: text(knowledgeEngineLayerMeta(level).label) }));
  }

  async function startNewEntry(spaceId = selectedSpaceId, parentFolderId: string | null = null, nodeType: "note" | "folder" = "note") {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    const canNavigate = await saveBeforeNavigation().finally(() => {
      navigatingRef.current = false;
    });
    if (!canNavigate) return;
    const nextSpaceId = spaceId || spaces[0]?.id || "";
    setCollapsedSpaceIds((current) => {
      const next = new Set(current);
      next.delete(nextSpaceId);
      return next;
    });
    setSelectedSpaceId(nextSpaceId);
    setSelectedEntryId(draftId);
    setSelectedIndexLevel("L2");
    replaceDraft(createBlankDraft(nextSpaceId, parentFolderId, nodeType, text));
    setSaveError(null);
    setConflictEntry(null);
    setVersionsOpen(false);
    setPropertiesOpen(nodeType === "folder");
    setMessage(null);
  }

  async function saveDraft() {
    if (isIndexReadOnly) {
      setMessage("knowledge.messages.indexLayerReadOnlyEdit");
      return;
    }
    await saveCurrentDraft({ force: true });
  }

  async function deleteEntryIds(ids: string[]) {
    setPending(true);
    setMessage(null);
    try {
      for (const id of ids) {
        const response = await fetch("/api/knowledge/entries", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!response.ok || result.ok === false) throw new Error(result.error ?? "common.messages.deleteFailed");
      }

      const nextEntries = entriesState.filter((entry) => !ids.includes(entry.id));
      setEntriesState(nextEntries);
      const nextEntry = nextEntries.find((entry) => entry.knowledgeSpaceId === draft.knowledgeSpaceId && nodeTypeOf(entry) !== "folder") ?? nextEntries[0];
      if (nextEntry) {
        setSelectedEntryId(nextEntry.id);
        setSelectedSpaceId(nextEntry.knowledgeSpaceId ?? "");
        setSelectedIndexLevel("L2");
        replaceDraft(toDraft(nextEntry));
        setSaveError(null);
        setConflictEntry(null);
      } else {
        await startNewEntry(draft.knowledgeSpaceId);
      }
      setMessage("common.messages.deleted");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "common.messages.deleteFailed");
    } finally {
      setPending(false);
    }
  }

  async function deleteEntry(entry: KnowledgeNotebookEntry) {
    const ids = nodeTypeOf(entry) === "folder" ? descendantIds(entriesState, entry.id) : [entry.id];
    const label = nodeTypeOf(entry) === "folder"
      ? text("knowledge.delete.folderLabel", undefined, { title: entry.title, count: ids.length - 1 })
      : text("knowledge.delete.entryLabel", undefined, { title: entry.title });
    const confirmed = await showConfirm({
      title: "common.dialog.deleteConfirmTitle",
      description: text("knowledge.delete.confirmDescription", undefined, { label }),
      confirmText: "actions.delete",
      tone: "danger",
    });
    if (!confirmed) return;
    await deleteEntryIds(ids);
  }

  async function deleteDraft() {
    if (isIndexReadOnly) {
      setMessage(text("knowledge.messages.indexLayerCannotDelete"));
      return;
    }
    if (!draft.id) {
      await startNewEntry(draft.knowledgeSpaceId, draft.parentFolderId, draft.nodeType);
      return;
    }
    const entry = entriesState.find((item) => item.id === draft.id);
    if (entry) await deleteEntry(entry);
  }

  async function renameEntry(entry: KnowledgeNotebookEntry) {
    const nextTitle = (await showPrompt({
      title: "actions.rename",
      description: "knowledge.rename.description",
      defaultValue: entry.title,
      placeholder: "knowledge.rename.placeholder",
      confirmText: "actions.save",
    }))?.trim();
    if (!nextTitle || nextTitle === entry.title) return;
    const currentDraft = toDraft(entry);
    setPending(true);
    try {
      const response = await fetch("/api/knowledge/entries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: entry.id,
          knowledgeSpaceId: entry.knowledgeSpaceId,
          layer: entry.layer,
          scopeKey: entry.scopeKey,
          skillId: entry.skillId,
          title: nextTitle,
          contentMd: entry.contentMd,
          metadataJson: JSON.stringify(metadataForDraft({ ...currentDraft, title: nextTitle }), null, 2),
          sourceType: entry.sourceType,
          baseRevision: entry.revision,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        entry?: KnowledgeNotebookEntry | null;
        currentEntry?: KnowledgeNotebookEntry | null;
      };
      if (response.status === 409) {
        if (result.currentEntry) updateEntryState(result.currentEntry);
        throw new Error(result.error ?? text("knowledge.rename.conflict"));
      }
      if (!response.ok || result.ok === false || !result.entry) throw new Error(result.error ?? text("knowledge.rename.failed"));
      updateEntryState(result.entry);
      if (selectedEntryId === entry.id) replaceDraft(toDraft(result.entry));
      router.refresh();
    } catch (error) {
      setPending(false);
      await showAlert({
        title: "knowledge.rename.failed",
        description: error instanceof Error ? error.message : text("knowledge.rename.failed"),
        tone: "danger",
      });
    } finally {
      setPending(false);
    }
  }

  async function deleteSpace(space: KnowledgeNotebookSpace) {
    const confirmed = await showConfirm({
      title: "knowledge.space.deleteTitle",
      description: text("knowledge.space.deleteDescription", undefined, { name: space.name }),
      confirmText: "knowledge.actions.deleteSpace",
      tone: "danger",
    });
    if (!confirmed) return;
    setPending(true);
    try {
      const response = await fetch("/api/knowledge/spaces", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: space.id }),
      });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) throw new Error(result.error ?? text("knowledge.space.deleteFailed"));
      router.refresh();
    } catch (error) {
      setPending(false);
      await showAlert({
        title: "knowledge.space.deleteFailed",
        description: error instanceof Error ? error.message : text("knowledge.space.deleteFailed"),
        tone: "danger",
      });
    } finally {
      setPending(false);
    }
  }

  function toggleVersions() {
    setVersionsOpen((current) => {
      const next = !current;
      if (next) void loadVersions(draftRef.current.id);
      return next;
    });
  }

  async function restoreVersion(version: KnowledgeEntryVersion) {
    if (!draft.id) return;
    setPending(true);
    setMessage(null);
    setSaveError(null);
    try {
      const response = await fetch("/api/knowledge/entry-versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore",
          entryId: draft.id,
          versionId: version.id,
          baseRevision: draft.revision,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        entry?: KnowledgeNotebookEntry | null;
        currentEntry?: KnowledgeNotebookEntry | null;
      };

      if (response.status === 409) {
        if (result.currentEntry) updateEntryState(result.currentEntry);
        setConflictEntry(result.currentEntry ?? null);
        setSaveState("conflict");
        setSaveError(result.error ?? "knowledge.versions.restoreConflict");
        return;
      }

      if (!response.ok || result.ok === false || !result.entry) throw new Error(result.error ?? "knowledge.versions.restoreFailed");
      updateEntryState(result.entry);
      replaceDraft(toDraft(result.entry), "saved", false);
      setSelectedEntryId(result.entry.id);
      setSelectedSpaceId(result.entry.knowledgeSpaceId ?? "");
      setSelectedIndexLevel("L2");
      setConflictEntry(null);
      setMessage(text("knowledge.versions.restored", undefined, { revision: version.revision }));
      void loadVersions(result.entry.id);
      router.refresh();
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "knowledge.versions.restoreFailed");
    } finally {
      setPending(false);
    }
  }

  function toggleSpaceCollapse(spaceId: string) {
    setCollapsedSpaceIds((current) => {
      const next = new Set(current);
      if (next.has(spaceId)) next.delete(spaceId);
      else next.add(spaceId);
      return next;
    });
  }

  function toggleKnowledgePath(pathId: string) {
    setCollapsedKnowledgePaths((current) => {
      const next = new Set(current);
      if (next.has(pathId)) next.delete(pathId);
      else next.add(pathId);
      return next;
    });
  }

  function currentImportParentFolderId() {
    if (draftRef.current.nodeType === "folder" && draftRef.current.id) return draftRef.current.id;
    return draftRef.current.parentFolderId;
  }

  function openKnowledgeImport(mode: KnowledgeImportMode, files: KnowledgeImportFileSource[] = []) {
    const defaultSpaceId = draftRef.current.knowledgeSpaceId || selectedSpaceId || spaces[0]?.id || "";
    setImportDialog({
      open: true,
      mode,
      files,
      defaultSpaceId,
      defaultParentFolderId: currentImportParentFolderId(),
    });
  }

  async function handleImportedEntries(importedEntries: KnowledgeImportEntry[]) {
    if (!importedEntries.length) return;
    const nextEntries: KnowledgeNotebookEntry[] = importedEntries;
    setEntriesState((current) => {
      const importedIds = new Set(nextEntries.map((entry) => entry.id));
      return [...nextEntries, ...current.filter((entry) => !importedIds.has(entry.id))];
    });
    setMessage(text("knowledge.import.messages.archivedEntries", undefined, { count: nextEntries.length }));
    router.refresh();

    const canNavigate = await saveBeforeNavigation();
    if (!canNavigate) return;
    const first = nextEntries.find((entry) => nodeTypeOf(entry) !== "folder") ?? nextEntries[0];
    setCollapsedSpaceIds((current) => {
      const next = new Set(current);
      if (first.knowledgeSpaceId) next.delete(first.knowledgeSpaceId);
      return next;
    });
    setSelectedIndexLevel("L2");
    setSelectedEntryId(first.id);
    setSelectedSpaceId(first.knowledgeSpaceId ?? "");
    replaceDraft(toDraft(first), "saved", false);
    setSaveError(null);
    setConflictEntry(null);
    setVersionsOpen(false);
  }

  function hasDraggedFiles(event: ReactDragEvent<HTMLElement>) {
    return Array.from(event.dataTransfer.types ?? []).includes("Files");
  }

  function handleWorkspaceDragEnter(event: ReactDragEvent<HTMLElement>) {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    setDragActive(true);
  }

  function handleWorkspaceDragOver(event: ReactDragEvent<HTMLElement>) {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDragActive(true);
  }

  function handleWorkspaceDragLeave(event: ReactDragEvent<HTMLElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    setDragActive(false);
  }

  function handleWorkspaceDrop(event: ReactDragEvent<HTMLElement>) {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    setDragActive(false);
    void knowledgeImportFilesFromDataTransfer(event.dataTransfer)
      .then((files) => {
        if (!files.length) return;
        const hasDirectory = files.some((file) => (file.relativePath || file.file.name).includes("/"));
        openKnowledgeImport(hasDirectory ? "directory" : "files", files);
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "knowledge.import.errors.directoryReadFailed");
      });
  }

  function PaneModeControls() {
    const modes: Array<{ value: PaneMode; label: string; title: string; icon: typeof SplitSquareHorizontal }> = [
      { value: "split", label: "knowledge.pane.split", title: "knowledge.pane.mode.split", icon: SplitSquareHorizontal },
      { value: "editor", label: "knowledge.pane.editor", title: "knowledge.pane.mode.editor", icon: Edit3 },
      { value: "preview", label: "knowledge.pane.read", title: "knowledge.pane.mode.read", icon: BookOpen },
    ];
    return (
      <div className="inline-flex items-center rounded-xl border border-[var(--line)] bg-white p-0.5 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
        {modes.map((mode) => {
          const Icon = mode.icon;
          return (
            <button
              key={mode.value}
              type="button"
              aria-label={text(mode.title)}
              aria-pressed={paneMode === mode.value}
              title={text(mode.title)}
              onClick={() => selectPaneMode(mode.value)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors",
                paneMode === mode.value
                  ? "bg-[var(--ink)] text-white shadow-[0_8px_20px_rgba(15,23,42,0.14)]"
                  : "text-[var(--ink-subtle)] hover:text-[var(--ink)]",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {text(mode.label)}
            </button>
          );
        })}
      </div>
    );
  }

  function renderEntryBranch(entry: KnowledgeNotebookEntry, depth = 0): ReactNode {
    const isActive = selectedEntryId === entry.id;
    const isFolder = nodeTypeOf(entry) === "folder";
    const children = childEntriesByParentId.get(entry.id) ?? [];
    const pathId = `entry:${entry.id}`;
    const collapsed = collapsedKnowledgePaths.has(pathId);

    return (
      <div key={entry.id}>
        <div className="group flex w-full items-start gap-1.5">
          <button
            type="button"
            aria-label={text(collapsed ? "knowledge.tree.expandDirectory" : "knowledge.tree.collapseDirectory")}
            onClick={(event) => {
              event.stopPropagation();
              if (children.length) toggleKnowledgePath(pathId);
            }}
            className={cn(
              "mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[var(--ink-subtle)] transition-colors",
              children.length ? "hover:bg-white hover:text-[var(--ink)]" : "pointer-events-none opacity-0",
            )}
            style={{ marginLeft: `${depth * 14}px` }}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => selectEntry(entry)}
            onContextMenu={(event) => openContextMenu(event, { type: "entry", entryId: entry.id })}
            className={cn(
              "flex min-w-0 flex-1 items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors",
              isActive && selectedIndexLevel === "L2" ? "bg-[rgba(9,199,232,0.1)]" : "hover:bg-white/85",
            )}
          >
            {isFolder ? (
              <Folder className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[var(--accent-strong)]" />
            ) : (
              <FileText className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[var(--ink-subtle)]" />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-[var(--ink)]">{entry.title}</div>
              <div className="mt-0.5 truncate text-xs text-[var(--ink-subtle)]">
                {isFolder ? text("knowledge.tree.childCount", undefined, { count: children.length }) : text("knowledge.tree.entryLayerMeta", undefined, { scope: entry.scopeKey })}
              </div>
            </div>
            {isFolder ? (
              <MoreHorizontal className="h-4 w-4 shrink-0 text-transparent group-hover:text-[var(--ink-subtle)]" />
            ) : (
              <span className="mt-0.5 rounded-full bg-[rgba(15,23,42,0.04)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ink-subtle)]">
                L2
              </span>
            )}
          </button>
        </div>
        {children.length && !collapsed ? (
          <div className="mt-0.5">
            {children.map((child) => renderEntryBranch(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  }

  function renderSpaceIndexButtons(space: KnowledgeNotebookSpace, spaceEntries: KnowledgeNotebookEntry[]): ReactNode {
    const notes = spaceEntries.filter((entry) => nodeTypeOf(entry) !== "folder");
    const folders = spaceEntries.filter((entry) => nodeTypeOf(entry) === "folder");

    return (
      <div className="mb-1 space-y-1">
        {(["L0", "L1"] as const).map((level) => {
          const meta = knowledgeEngineLayerMeta(level);
          const active = selectedSpaceId === space.id && selectedIndexLevel === level && selectedLayerItem.scope === "space";
          return (
            <button
              key={`${space.id}:${level}`}
              type="button"
              onClick={() => void selectSpaceIndex(space, level)}
              className={cn(
                "group flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors",
                active ? "bg-[rgba(9,199,232,0.1)]" : "hover:bg-white/80",
              )}
            >
              <span className="mt-0.5 flex h-6 min-w-9 items-center justify-center rounded-full bg-[rgba(15,23,42,0.04)] text-[10px] font-semibold text-[var(--ink-subtle)]">
                {level}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-[var(--ink)]">{text(meta.label)}</span>
                <span className="mt-0.5 block truncate text-[10px] text-[var(--ink-subtle)]">
                  {text("knowledge.engine.spaceIndexStats", undefined, { entries: notes.length, folders: folders.length })}
                </span>
                <span className="mt-0.5 block truncate font-mono text-[10px] text-[var(--ink-subtle)]">
                  {knowledgeEngineSpaceLayerUri(space, level)}
                </span>
              </span>
              <span className="mt-0.5 text-[10px] font-medium text-[var(--ink-subtle)]">{text("knowledge.labels.readOnly")}</span>
            </button>
          );
        })}
      </div>
    );
  }

  function renderKnowledgeEngineNodes(nodes: KnowledgeTreeNode[], space: KnowledgeNotebookSpace, depth = 0): ReactNode {
    return nodes.map((node) => {
      const collapsed = collapsedKnowledgePaths.has(node.id);
      const count = knowledgeEngineNodeCount(node);
      return (
        <div key={node.id} className="space-y-0.5">
          <button
            type="button"
            onClick={() => toggleKnowledgePath(node.id)}
            onContextMenu={(event) => openContextMenu(event, { type: "tree", spaceId: space.id })}
            className="group flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/80"
            style={{ paddingLeft: `${10 + depth * 13}px` }}
          >
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[var(--ink-subtle)] group-hover:bg-white">
              {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </span>
            <Folder className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[var(--accent-strong)]" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-[var(--ink)]">{node.label}</div>
              <div className="mt-0.5 truncate font-mono text-[10px] text-[var(--ink-subtle)]">{node.uri}</div>
            </div>
            <span className="mt-0.5 rounded-full bg-[rgba(15,23,42,0.04)] px-2 py-0.5 text-[11px] font-medium text-[var(--ink-subtle)]">
              {count}
            </span>
          </button>
          {!collapsed ? (
            <div className="ml-2 border-l border-[var(--line)]/70 pl-1">
              {node.children.length ? renderKnowledgeEngineNodes(node.children, space, depth + 1) : null}
              {node.entries.map((entry) => renderEntryBranch(entry, depth + 1))}
            </div>
          ) : null}
        </div>
      );
    });
  }

  return (
    <section
      data-testid="knowledge-notebook-workspace"
      className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-[var(--line)] bg-[rgba(255,255,255,0.78)] shadow-[0_22px_64px_rgba(15,23,42,0.07)]"
      onBlurCapture={handleWorkspaceBlur}
      onDragEnter={handleWorkspaceDragEnter}
      onDragOver={handleWorkspaceDragOver}
      onDragLeave={handleWorkspaceDragLeave}
      onDrop={handleWorkspaceDrop}
    >
      {dragActive ? (
        <div className="pointer-events-none absolute inset-4 z-30 flex items-center justify-center rounded-[26px] border border-[var(--accent)]/35 bg-[rgba(245,252,255,0.84)] shadow-[0_24px_70px_rgba(9,199,232,0.16)] backdrop-blur-sm">
          <div className="flex items-center gap-4 rounded-[22px] bg-white px-5 py-4 text-[var(--ink)] shadow-[0_16px_44px_rgba(15,23,42,0.1)]">
            <UploadCloud className="h-6 w-6 text-[var(--accent-strong)]" />
            <div>
              <div className="text-sm font-semibold">{text("knowledge.drop.title")}</div>
              <div className="mt-1 text-xs text-[var(--ink-subtle)]">{text("knowledge.drop.description")}</div>
            </div>
          </div>
        </div>
      ) : null}
      <div className={cn("grid min-h-0 flex-1 overflow-hidden", treeCollapsed ? "lg:grid-cols-[56px_minmax(0,1fr)]" : "lg:grid-cols-[288px_minmax(0,1fr)]")}>
        <aside
          className={cn(
            "flex min-h-0 overflow-hidden border-b border-[var(--line)] bg-[rgba(250,251,253,0.88)] lg:border-b-0 lg:border-r",
            treeCollapsed ? "h-14 flex-row items-center justify-between px-3 lg:h-auto lg:flex-col lg:px-0 lg:py-2" : "flex-col",
          )}
          onContextMenu={(event) => openContextMenu(event, { type: "tree", spaceId: selectedSpaceId })}
        >
          {treeCollapsed ? (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 rounded-xl"
                aria-label={text("knowledge.tree.expand")}
                title={text("knowledge.tree.expand")}
                onClick={() => setTreeCollapsed(false)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-[var(--ink-subtle)] lg:min-h-0 lg:flex-1 lg:flex-col lg:justify-center">
                <BookOpen className="h-4 w-4 shrink-0" />
                <span className="truncate lg:[writing-mode:vertical-rl]">{text("knowledge.tree.title")}</span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 rounded-xl"
                aria-label={text("knowledge.actions.newEntry")}
                title={text("knowledge.actions.newEntry")}
                onClick={() => void startNewEntry()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
          <div className="border-b border-[var(--line)] px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold tracking-normal text-[var(--ink)]">{text("knowledge.tree.title")}</div>
                <div className="mt-0.5 text-[11px] text-[var(--ink-subtle)]">{text("knowledge.hub.sourceOfTruth")}</div>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl" aria-label={text("knowledge.actions.newEntry")} onClick={() => void startNewEntry()}>
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 rounded-xl"
                  aria-label={text("knowledge.tree.collapse")}
                  title={text("knowledge.tree.collapse")}
                  onClick={() => setTreeCollapsed(true)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <label className="mt-3 flex h-9 items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 text-sm text-[var(--ink-muted)]">
              <Search className="h-4 w-4" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-subtle)]"
                placeholder={text("knowledge.search.placeholder")}
              />
            </label>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--ink-subtle)]">
              <BookOpen className="h-3.5 w-3.5" />
              <span>{text("knowledge.tree.spaceCount", undefined, { count: spaces.length })}</span>
              <span className="h-1 w-1 rounded-full bg-[var(--ink-subtle)]/40" />
              <span>{text("knowledge.tree.folderCount", undefined, { count: totalFolders })}</span>
              <span className="h-1 w-1 rounded-full bg-[var(--ink-subtle)]/40" />
              <span>{text("knowledge.tree.entryCount", undefined, { count: totalEntries })}</span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
            {filteredSpaces.length ? (
              <div className="space-y-2.5">
                {filteredSpaces.map((space) => {
                  const spaceEntries = entriesBySpaceId.get(space.id) ?? [];
                  const visibleEntries = filterEntriesWithAncestors(spaceEntries, normalizedQuery);
                  const treeNodes = buildKnowledgeEngineTree(space, visibleEntries);
                  const isActiveSpace = selectedSpaceId === space.id || draft.knowledgeSpaceId === space.id;
                  const isCollapsed = collapsedSpaceIds.has(space.id) && !normalizedQuery;
                  return (
                    <div key={space.id} className="space-y-1">
                      <button
                        type="button"
                        aria-expanded={!isCollapsed}
                        aria-label={isCollapsed ? text("knowledge.tree.expandSpace", undefined, { name: space.name }) : text("knowledge.tree.collapseSpace", undefined, { name: space.name })}
                        onClick={() => toggleSpaceCollapse(space.id)}
                        onContextMenu={(event) => openContextMenu(event, { type: "space", spaceId: space.id })}
                        className={cn(
                          "group flex w-full items-center gap-2 rounded-2xl px-3 py-3 text-left transition-colors",
                          isActiveSpace ? "bg-white shadow-[0_10px_32px_rgba(15,23,42,0.08)]" : "hover:bg-white/70",
                        )}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[var(--ink-subtle)] transition-colors group-hover:bg-[rgba(15,23,42,0.04)] group-hover:text-[var(--ink)]">
                          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </span>
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                            isActiveSpace ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "bg-[rgba(15,23,42,0.04)] text-[var(--ink-muted)]",
                          )}
                        >
                          <Folder className="h-[18px] w-[18px]" />
                        </div>
                        <div
                          className="min-w-0 flex-1 cursor-pointer"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleSpaceCollapse(space.id);
                          }}
                        >
                          <div className="truncate text-sm font-semibold text-[var(--ink)]">{space.name}</div>
                          <div className="mt-0.5 truncate text-xs text-[var(--ink-subtle)]">{knowledgeScopeLabel(normalizeKnowledgeUri(space.vikingUri))} · {space.ownerName}</div>
                        </div>
                        <Badge variant={statusVariant(space.status)}>{space.entryCount}</Badge>
                      </button>
                      {!isCollapsed ? (
                        <div className="ml-7 border-l border-[var(--line)]/80 pl-2.5">
                          {renderSpaceIndexButtons(space, spaceEntries)}
                          {treeNodes.length ? (
                            renderKnowledgeEngineNodes(treeNodes, space)
                          ) : (
                            <button
                              type="button"
                              onClick={() => void startNewEntry(space.id)}
                              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--ink-subtle)] hover:bg-white/80"
                            >
                              <Plus className="h-4 w-4" />
                              {text("knowledge.actions.newEntry")}
                            </button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white/70 px-4 py-8 text-center text-sm text-[var(--ink-subtle)]">
                knowledge.empty.noSpaces
              </div>
            )}
          </div>
            </>
          )}
        </aside>

        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[rgba(255,255,255,0.82)]">
          <div className="shrink-0 border-b border-[var(--line)] px-4 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-[260px] flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--ink-subtle)]">
                  <span>{activeSpace?.tenantName ?? text("knowledge.fallback.unboundTenant")}</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                  <span>{activeSpace?.name ?? text("knowledge.fallback.noSpaceSelected")}</span>
                  {draft.parentFolderId ? (
                    <>
                      <ChevronRight className="h-3.5 w-3.5" />
                      <span>{entriesState.find((entry) => entry.id === draft.parentFolderId)?.title ?? "knowledge.node.folder"}</span>
                    </>
                  ) : null}
                </div>
                {isIndexReadOnly ? (
                  <div className="mt-2">
                    <div className="text-2xl font-semibold tracking-normal text-[var(--ink)]">{activeTitle}</div>
                    <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-[rgba(15,23,42,0.04)] px-3 py-1 text-xs font-medium text-[var(--ink-subtle)]">
                      <CircleDot className="h-3.5 w-3.5" />
                      {text("knowledge.engine.selectedLayerMeta", undefined, { layer: text(selectedLayerItem.label) })}
                    </div>
                  </div>
                ) : (
                  <Input
                    value={draft.title}
                    onChange={(event) => updateDraft((current) => ({ ...current, title: event.target.value }))}
                    onBlur={flushDraftOnBlur}
                    className="mt-1 h-auto rounded-none border-0 bg-transparent px-0 py-0 text-2xl font-semibold tracking-normal shadow-none focus:ring-0"
                    placeholder={text("knowledge.placeholders.entryTitle")}
                  />
                )}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => openKnowledgeImport("url")} disabled={!spaces.length}>
                  <Globe2 className="h-4 w-4" />
                  knowledge.actions.discover
                </Button>
                <Button size="sm" variant="secondary" onClick={() => openKnowledgeImport("files")} disabled={!spaces.length}>
                  <UploadCloud className="h-4 w-4" />
                  knowledge.actions.importDrop
                </Button>
                <Button size="sm" variant="secondary" onClick={() => openKnowledgeImport("directory")} disabled={!spaces.length}>
                  <FolderPlus className="h-4 w-4" />
                  knowledge.actions.importDirectory
                </Button>
                {activeSpace ? <KnowledgeRetrievalTestDialog knowledgeSpaceId={activeSpace.id} knowledgeSpaceName={activeSpace.name} /> : null}
                <Button size="sm" variant="secondary" onClick={() => void startNewEntry(draft.knowledgeSpaceId, draft.parentFolderId, "note")}>
                  <Plus className="h-4 w-4" />
                  actions.create
                </Button>
                <Button size="sm" variant="ghost" onClick={deleteDraft} disabled={pending || isIndexReadOnly}>
                  <Trash2 className="h-4 w-4" />
                  actions.delete
                </Button>
                <Button size="sm" variant="secondary" onClick={toggleVersions} disabled={!draft.id || isIndexReadOnly}>
                  <History className="h-4 w-4" />
                  knowledge.versions.title
                </Button>
                <Button size="sm" variant="primary" onClick={saveDraft} disabled={pending || !spaces.length || isIndexReadOnly}>
                  <Save className="h-4 w-4" />
                  {pending ? "actions.saving" : "actions.save"}
                </Button>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--ink-subtle)]">
                <Badge variant={isIndexReadOnly ? "neutral" : draft.nodeType === "folder" ? "accent" : syncStatusVariant(draft.syncStatus)}>
                      {text(isIndexReadOnly ? "knowledge.labels.spaceIndex" : draft.nodeType === "folder" ? "knowledge.node.folder" : syncStatusLabel(draft.syncStatus))}
                </Badge>
                {isIndexReadOnly || draft.nodeType !== "folder" ? (
                  <Badge variant={selectedLayerItem.editable ? "accent" : "neutral"}>
                    {selectedLayerItem.level} · {selectedLayerItem.editable ? text("knowledge.labels.editableSource") : text("knowledge.labels.readOnlyIndex")}
                  </Badge>
                ) : null}
                {isIndexReadOnly ? <Badge variant="neutral">{text("knowledge.labels.readOnlyView")}</Badge> : <Badge variant={saveStateVariant(saveState)}>{text(saveStateLabel(saveState))}</Badge>}
                {!isIndexReadOnly && draft.nodeType !== "folder" ? <Badge variant="accent">{text("knowledge.labels.mutableSource")}</Badge> : null}
                {!isIndexReadOnly && draft.revision ? <span>R{draft.revision}</span> : null}
                <span>{activeContentSize}</span>
                {isIndexReadOnly ? (
                  <span>{text("knowledge.labels.spaceGeneratedView")}</span>
                ) : draft.updatedAt || draft.createdAt ? (
                  <span>{formatDateTime(draft.updatedAt || draft.createdAt)}</span>
                ) : (
                  <span>{text("knowledge.labels.unsaved")}</span>
                )}
                {!isIndexReadOnly && draft.updatedBy ? <span>{draft.updatedBy}</span> : null}
                {activeSpace ? (
                  <>
                    <span className="h-1 w-1 rounded-full bg-[var(--ink-subtle)]/40" />
                    <span>{text(typeLabel(activeSpace.spaceType))}</span>
                    <span>{text(visibilityLabel(activeSpace.visibility))}</span>
                  </>
                ) : null}
                {message ? <span className="text-[var(--accent-strong)]">{text(message, message)}</span> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isIndexReadOnly ? null : <PaneModeControls />}
                {isIndexReadOnly || draft.nodeType !== "folder" ? (
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
                    onClick={() => setQueryPathOpen((value) => !value)}
                  >
                    {queryPathOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    {text("knowledge.engine.queryPathTitle")}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={isIndexReadOnly}
                  className="inline-flex h-8 items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
                  onClick={() => setPropertiesOpen((value) => !value)}
                >
                  {propertiesOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  {text("knowledge.properties.title")}
                </button>
              </div>
            </div>
            {saveError ? (
              <div className="mt-2 flex items-start gap-2 rounded-2xl border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-xs leading-5 text-[var(--warning)]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {saveError}
                  {conflictEntry ? text("knowledge.messages.conflictLatestVersion", undefined, { revision: conflictEntry.revision, time: formatDateTime(conflictEntry.updatedAt || conflictEntry.createdAt) }) : ""}
                </span>
              </div>
            ) : null}
            {!isIndexReadOnly && draft.syncError ? <div className="mt-2 text-xs text-[var(--warning)]">{draft.syncError}</div> : null}
            {isIndexReadOnly ? (
              <div className="mt-1 truncate font-mono text-[11px] text-[var(--ink-subtle)]">{selectedLayerItem.uri}</div>
            ) : draft.vikingUri ? (
              <div className="mt-1 truncate font-mono text-[11px] text-[var(--ink-subtle)]">{normalizeKnowledgeUri(draft.vikingUri)}</div>
            ) : null}

            {(isIndexReadOnly || draft.nodeType !== "folder") && queryPathOpen ? (
              <div className="mt-2 rounded-2xl border border-[var(--line)] bg-[rgba(250,251,253,0.78)] px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                    <Search className="h-4 w-4 text-[var(--ink-subtle)]" />
                    {text("knowledge.engine.queryPathTitle")}
                  </div>
                  <span className="text-xs text-[var(--ink-subtle)]">{text("knowledge.engine.queryPathDescription")}</span>
                </div>
                {!isIndexReadOnly && draft.nodeType !== "folder" ? (
                  <div className="mt-2 rounded-xl border border-[var(--accent)]/20 bg-[var(--accent-soft)] px-3 py-2 text-xs leading-5 text-[var(--accent-strong)]">
                    {text("knowledge.engine.mutableSourceNotice")}
                  </div>
                ) : null}
                <div className="mt-3 grid gap-2 md:grid-cols-4">
                  {reasoningSteps.map((step, index) => (
                    <div key={step.key} className="rounded-xl border border-[var(--line)] bg-white/75 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(15,23,42,0.05)] text-[10px] font-semibold text-[var(--ink-subtle)]">
                          {index + 1}
                        </span>
                        <span className="truncate text-xs font-semibold text-[var(--ink)]">{step.label}</span>
                      </div>
                      <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-[var(--ink-muted)]">{step.description}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 grid gap-2 xl:grid-cols-3">
                  {querySteps.map((step) => (
                    <button
                      key={step.level}
                      type="button"
                      onClick={() => {
                        if (step.level === "L2") {
                          const current = entriesState.find((entry) => entry.id === draft.id && nodeTypeOf(entry) !== "folder");
                          if (current) void selectEntryLayer(current, "L2");
                          return;
                        }
                        if (activeSpace) void selectSpaceIndex(activeSpace, step.level);
                      }}
                      disabled={step.level === "L2" ? !draft.id || draft.nodeType === "folder" : !activeSpace}
                      className={cn(
                        "min-w-0 rounded-2xl border px-3 py-2.5 text-left transition-colors",
                        step.active
                          ? "border-[var(--accent)]/40 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
                          : "border-[var(--line)] bg-white/70 hover:bg-white",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={step.editable ? "accent" : "neutral"}>{step.level}</Badge>
                        <span className="text-[11px] font-medium text-[var(--ink-subtle)]">{text(step.editable ? "knowledge.labels.editable" : "knowledge.labels.readOnlyIndex")}</span>
                      </div>
                      <div className="mt-2 text-sm font-semibold text-[var(--ink)]">{step.label}</div>
                      <div className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--ink-muted)]">{step.description}</div>
                      <div className="mt-2 truncate font-mono text-[10px] text-[var(--ink-subtle)]">{step.uri}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {versionsOpen ? (
              <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[rgba(250,251,253,0.86)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                    <History className="h-4 w-4 text-[var(--ink-subtle)]" />
                    knowledge.versions.recentTitle
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => void loadVersions()} disabled={versionsLoading || !draft.id}>
                    actions.refresh
                  </Button>
                </div>
                {versionsError ? <div className="mt-2 text-xs text-[var(--warning)]">{versionsError}</div> : null}
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {versionsLoading ? (
                    <div className="rounded-xl bg-white px-3 py-4 text-sm text-[var(--ink-subtle)]">{text("knowledge.versions.loading")}</div>
                  ) : versions.length ? (
                    versions.map((version) => (
                      <div key={version.id} className="rounded-xl border border-[var(--line)] bg-white px-3 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="neutral">R{version.revision}</Badge>
                          <span className="text-[11px] text-[var(--ink-subtle)]">{formatBytes(new TextEncoder().encode(version.contentMd).length)}</span>
                        </div>
                        <div className="mt-2 truncate text-sm font-semibold text-[var(--ink)]">{version.title}</div>
                        <div className="mt-1 text-xs leading-5 text-[var(--ink-subtle)]">
                          {formatDateTime(version.createdAt)}
                          {version.createdBy ? ` · ${version.createdBy}` : ""}
                        </div>
                        <Button className="mt-3 w-full" size="sm" variant="secondary" onClick={() => void restoreVersion(version)} disabled={pending}>
                          <RotateCcw className="h-3.5 w-3.5" />
                          knowledge.versions.restore
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl bg-white px-3 py-4 text-sm text-[var(--ink-subtle)]">{text("knowledge.versions.empty")}</div>
                  )}
                </div>
              </div>
            ) : null}

            {propertiesOpen && !isIndexReadOnly ? (
              <div className="mt-4 grid gap-3 rounded-2xl bg-[rgba(250,251,253,0.78)] p-3 md:grid-cols-2 xl:grid-cols-6">
                <FieldGroup label={text("terminology.knowledge")}>
                  <Select
                    value={draft.knowledgeSpaceId}
                    onBlur={flushDraftOnBlur}
                    onChange={(event) => {
                      updateDraft((current) => ({ ...current, knowledgeSpaceId: event.target.value, parentFolderId: null }));
                      setSelectedSpaceId(event.target.value);
                    }}
                  >
                    <option value="">{text("common.select.unassigned")}</option>
                    {spaces.map((space) => (
                      <option key={space.id} value={space.id}>{space.name}</option>
                    ))}
                  </Select>
                </FieldGroup>
                <FieldGroup label={text("common.fields.type")}>
                  <Select value={draft.nodeType} onBlur={flushDraftOnBlur} onChange={(event) => updateDraft((current) => ({ ...current, nodeType: event.target.value === "folder" ? "folder" : "note" }))}>
                    <option value="note">{text("terminology.knowledge")}</option>
                    <option value="folder">{text("knowledge.node.folder")}</option>
                  </Select>
                </FieldGroup>
                <FieldGroup label={text("common.fields.source")}>
                  <Select value={draft.sourceType} onBlur={flushDraftOnBlur} onChange={(event) => updateDraft((current) => ({ ...current, sourceType: event.target.value }))}>
                    {sourceTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>{text(option.label)}</option>
                    ))}
                  </Select>
                </FieldGroup>
                <FieldGroup label={text("knowledge.fields.layer")}>
                  <Input value={draft.layer} onBlur={flushDraftOnBlur} onChange={(event) => updateDraft((current) => ({ ...current, layer: event.target.value }))} />
                </FieldGroup>
                <FieldGroup label={text("knowledge.fields.scope")}>
                  <Input value={draft.scopeKey} onBlur={flushDraftOnBlur} onChange={(event) => updateDraft((current) => ({ ...current, scopeKey: event.target.value }))} />
                </FieldGroup>
                <FieldGroup label={text("knowledge.fields.skillId")}>
                  <Input value={draft.skillId} onBlur={flushDraftOnBlur} onChange={(event) => updateDraft((current) => ({ ...current, skillId: event.target.value }))} />
                </FieldGroup>
              </div>
            ) : null}
          </div>

          {isIndexReadOnly ? (
            <div className="min-h-0 flex-1 overflow-auto bg-[rgba(250,251,253,0.72)] px-6 py-6">
              <div className="mx-auto max-w-5xl">
                <div className="rounded-[24px] border border-[var(--line)] bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                        <CircleDot className="h-4 w-4 text-[var(--accent-strong)]" />
                        {text(selectedLayerItem.label)}
                      </div>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">{text(selectedLayerItem.description)}</p>
                    </div>
                    <Badge variant="neutral">{text("knowledge.labels.readOnlyIndex")}</Badge>
                  </div>
                  <div className="mt-4 rounded-2xl bg-[rgba(15,23,42,0.035)] px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-subtle)]">{text("settings.knowledge.engineName")}</div>
                    <div className="mt-1 break-all font-mono text-xs text-[var(--ink-muted)]">{selectedLayerItem.uri}</div>
                  </div>
                  <div className="mt-5 whitespace-pre-wrap rounded-2xl border border-[var(--line)] bg-[rgba(255,255,255,0.78)] px-5 py-5 text-sm leading-7 text-[var(--ink)]">
                    {selectedLayerItem.preview || text("knowledge.engine.preview.waiting")}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div
                ref={editorPreviewShellRef}
                className={cn(
                  "min-h-0 flex-1 overflow-hidden",
                  splitEditorPreviewActive ? "flex flex-col lg:flex-row" : "flex flex-col",
                )}
              >
                {showEditorPane ? (
                  <div
                    className={cn(
                      "flex min-h-0 min-w-0 flex-col overflow-hidden border-b border-[var(--line)]",
                      splitEditorPreviewActive ? "flex-1 lg:flex-none lg:border-b-0" : "flex-1",
                    )}
                    style={editorPaneStyle}
                  >
                    <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--line)] px-5">
                      <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                        <Edit3 className="h-4 w-4 text-[var(--ink-subtle)]" />
                        Markdown {text("actions.edit")}
                      </div>
                    </div>
                    <Textarea
                      ref={editorTextareaRef}
                      value={draft.contentMd}
                      onChange={(event) => updateDraft((current) => ({ ...current, contentMd: event.target.value }))}
                      onBlur={flushDraftOnBlur}
                      onKeyDown={handleMarkdownKeyDown}
                      onScroll={handleEditorScroll}
                      className="min-h-0 flex-1 resize-none overflow-y-auto rounded-none border-0 bg-transparent px-7 py-6 font-mono text-[14px] leading-8 shadow-none focus:ring-0"
                      placeholder={draft.nodeType === "folder" ? "knowledge.placeholders.folderDescription" : "knowledge.placeholders.entryContent"}
                    />
                    <details className="max-h-56 shrink-0 overflow-auto border-t border-[var(--line)] px-5 py-4">
                      <summary className="cursor-pointer text-sm font-medium text-[var(--ink)]">{text("knowledge.metadata.title")}</summary>
                      <Textarea
                        value={draft.metadataJson}
                        onChange={(event) => updateDraft((current) => ({ ...current, metadataJson: event.target.value }))}
                        onBlur={flushDraftOnBlur}
                        className="mt-3 max-h-40 min-h-24 overflow-y-auto font-mono text-xs"
                      />
                    </details>
                  </div>
                ) : null}
                {splitEditorPreviewActive ? (
                  <button
                    type="button"
                    aria-label={text("knowledge.pane.resize")}
                    title={text("knowledge.pane.resize")}
                    onPointerDown={startEditorPreviewResize}
                    className="group hidden w-3 shrink-0 cursor-col-resize touch-none items-center justify-center border-x border-[var(--line)] bg-[rgba(250,251,253,0.86)] transition-colors hover:bg-white lg:flex"
                  >
                    <span className="h-10 w-1 rounded-full bg-[rgba(15,23,42,0.18)] transition-colors group-hover:bg-[var(--accent-strong)]" />
                  </button>
                ) : null}
                {showPreviewPane ? (
                  <div
                    className={cn(
                      "flex min-h-0 min-w-0 flex-col overflow-hidden bg-[rgba(250,251,253,0.72)]",
                      splitEditorPreviewActive ? "flex-1 lg:flex-none" : "flex-1",
                    )}
                    style={previewPaneStyle}
                  >
                    <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--line)] px-5">
                      <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                        <BookOpen className="h-4 w-4 text-[var(--ink-subtle)]" />
                        Markdown {text("knowledge.pane.read")}
                      </div>
                    </div>
                    <div ref={previewScrollRef} onScroll={handlePreviewScroll} className="min-h-0 flex-1 overflow-y-scroll">
                      <MarkdownPreview
                        content={draft.contentMd}
                        onTaskToggle={(lineIndex, checked) =>
                          updateDraft((current) => ({
                            ...current,
                            contentMd: toggleTaskLine(current.contentMd, lineIndex, checked),
                          }))
                        }
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      <ContextMenu
        state={contextMenu}
        entries={entriesState}
        spaces={spaces}
        onClose={() => setContextMenu(null)}
        onNewNote={(spaceId, parentFolderId) => void startNewEntry(spaceId, parentFolderId ?? null, "note")}
        onNewFolder={(spaceId, parentFolderId) => void startNewEntry(spaceId, parentFolderId ?? null, "folder")}
        onEditSpace={(space) => setSpaceDialog({ mode: "edit", space })}
        onCreateSpace={(preferredType, baseSpaceId) => setSpaceDialog({ mode: "create", preferredType, baseSpaceId })}
        onDeleteSpace={deleteSpace}
        onOpenEntry={selectEntry}
        onRenameEntry={renameEntry}
        onDeleteEntry={deleteEntry}
      />
      {dialogHost}
      {importDialog ? (
        <KnowledgeImportDialog
          open={importDialog.open}
          mode={importDialog.mode}
          files={importDialog.files}
          spaces={spaces.map((space) => ({ id: space.id, name: space.name }))}
          folders={importFolderOptions}
          defaultSpaceId={importDialog.defaultSpaceId}
          defaultParentFolderId={importDialog.defaultParentFolderId}
          onOpenChange={(open) => {
            if (open) setImportDialog((current) => (current ? { ...current, open } : current));
            else setImportDialog(null);
          }}
          onImported={(nextEntries) => void handleImportedEntries(nextEntries)}
        />
      ) : null}
      <SpaceQuickDialog
        state={spaceDialog}
        tenantSpaces={tenantSpaces}
        businessTeams={businessTeams}
        agentTeams={agentTeams}
        onClose={() => setSpaceDialog(null)}
      />
    </section>
  );
}
