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
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Copy,
  Edit3,
  Eye,
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
import { getMarkdownKeyboardEdit } from "@/lib/markdown-editor";
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

type OpenVikingTreeNode = {
  id: string;
  label: string;
  uri: string;
  children: OpenVikingTreeNode[];
  entries: KnowledgeNotebookEntry[];
};

type OpenVikingIndexLevel = "L0" | "L1" | "L2";

type OpenVikingLayerItem = {
  level: OpenVikingIndexLevel;
  label: string;
  description: string;
  uri: string;
  preview: string;
  editable: boolean;
};

type OpenVikingQueryStep = {
  level: OpenVikingIndexLevel;
  label: string;
  description: string;
  uri: string;
  active: boolean;
  editable: boolean;
};

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
  { value: "manual", label: "手动整理" },
  { value: "skill", label: "Skill" },
  { value: "inspection_context", label: "巡检上下文" },
  { value: "inspection_finding", label: "巡检发现" },
  { value: "inspection_feedback", label: "巡检反馈" },
];

function typeLabel(type: string) {
  const labels: Record<string, string> = {
    global: "全局",
    team: "团队",
    project: "项目",
    agent_team: "Agent 团队",
  };
  return labels[type] ?? type;
}

function visibilityLabel(visibility: string) {
  const labels: Record<string, string> = {
    private: "私有",
    team: "团队可见",
    global: "全局可见",
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
  if (status.startsWith("remote_")) return "success";
  if (status === "remote_failed_local_shadow") return "warning";
  if (status === "local_shadow") return "accent";
  return "neutral";
}

function syncStatusLabel(status: string) {
  if (status.startsWith("remote_")) return "同步：OpenViking 已同步";
  if (status === "remote_failed_local_shadow") return "同步：仅本地保存";
  if (status === "local_shadow") return "同步：本地草稿";
  if (status === "draft") return "同步：待保存";
  return status ? `同步：${status}` : "同步：待保存";
}

function saveStateLabel(state: SaveState) {
  const labels: Record<SaveState, string> = {
    idle: "保存：无未保存修改",
    dirty: "保存：有未保存修改",
    saving: "保存：自动保存中",
    saved: "保存：已保存",
    error: "保存：保存失败",
    conflict: "保存：版本冲突",
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

function createBlankDraft(spaceId: string, parentFolderId: string | null = null, nodeType: "note" | "folder" = "note"): DraftEntry {
  const title = nodeType === "folder" ? "新建目录" : "未命名知识";
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
    contentMd: nodeType === "folder" ? "" : "# 未命名知识\n\n",
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
    vikingUri: entry.vikingUri,
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

function parseVikingUri(uri: string) {
  const match = /^viking:\/\/([^/]+)\/?(.*)$/.exec(uri.trim());
  if (!match) return [];
  const [, host, path] = match;
  return [host, ...path.split("/").filter(Boolean)].map(decodeUriSegment);
}

function sameSegments(left: string[], right: string[]) {
  return left.length === right.length && left.every((part, index) => part === right[index]);
}

function vikingScopeLabel(uri: string) {
  const parts = parseVikingUri(uri);
  if (parts[0] === "resources") return "Resources";
  if (parts[0] === "agent" && parts[1] === "skills") return "Agent Skills";
  if (parts[0] === "user" && parts[1] === "memories") return "User Memories";
  return parts[0] ? `viking://${parts[0]}` : "OpenViking";
}

function vikingScopePrefixLength(uri: string) {
  const parts = parseVikingUri(uri);
  if (parts[0] === "resources" && parts[1] === "agentworld") return 2;
  if (parts[0] === "agent" && parts[1] === "skills" && parts[2] === "agentworld") return 3;
  if (parts[0] === "user" && parts[1] === "memories" && parts[2] === "agentworld") return 3;
  return parts[0] ? 1 : 0;
}

function vikingRootUri(uri: string) {
  const parts = parseVikingUri(uri);
  const prefixLength = vikingScopePrefixLength(uri);
  return prefixLength ? `viking://${parts.slice(0, prefixLength).join("/")}` : uri;
}

function vikingDirectoryPath(space: KnowledgeNotebookSpace, entry: KnowledgeNotebookEntry) {
  const entryParts = parseVikingUri(entry.vikingUri);
  const spaceParts = parseVikingUri(space.vikingUri);
  const entryDirectories = entryParts.slice(0, Math.max(0, entryParts.length - 1));

  if (spaceParts.length && sameSegments(entryDirectories.slice(0, spaceParts.length), spaceParts)) {
    const relative = entryDirectories.slice(spaceParts.length);
    return {
      rootUri: space.vikingUri,
      scopeLabel: null as string | null,
      segments: relative.length ? relative : [entry.layer || entry.scopeKey || "manual"],
    };
  }

  const prefixLength = vikingScopePrefixLength(entry.vikingUri);
  const scoped = entryDirectories.slice(prefixLength);
  const scopeLabel = vikingScopeLabel(entry.vikingUri);
  return {
    rootUri: vikingRootUri(entry.vikingUri),
    scopeLabel,
    segments: [scopeLabel, ...(scoped.length ? scoped : [entry.layer || entry.scopeKey || "manual"])],
  };
}

function entrySearchText(entry: KnowledgeNotebookEntry) {
  return normalize(`${entry.title} ${entry.contentMd} ${entry.layer} ${entry.scopeKey} ${entry.vikingUri}`);
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

function openVikingLayerMeta(level: OpenVikingIndexLevel) {
  if (level === "L0") {
    return {
      label: "L0 摘要索引",
      description: "Abstract，约百 token，用于向量召回、快速过滤和列表感知。",
      editable: false,
    };
  }
  if (level === "L1") {
    return {
      label: "L1 概览索引",
      description: "Overview，约两千 token，用于目录递归、重排细化和内容导航。",
      editable: false,
    };
  }
  return {
    label: "L2 原文知识",
    description: "Details，完整 Markdown 原文，按需读取，也是唯一可编辑层。",
    editable: true,
  };
}

function openVikingLayerUri(entry: KnowledgeNotebookEntry | DraftEntry, level: OpenVikingIndexLevel) {
  const uri = entry.vikingUri || "未同步到 OpenViking";
  if (level === "L0") return `abstract(${uri})`;
  if (level === "L1") return `overview(${uri})`;
  return uri;
}

function openVikingDirectoryIndexUri(uri: string, level: Exclude<OpenVikingIndexLevel, "L2">) {
  const base = uri.replace(/\/+$/, "");
  return `${base}/${level === "L0" ? ".abstract.md" : ".overview.md"}`;
}

function openVikingLayerPreview(entry: KnowledgeNotebookEntry | DraftEntry, level: OpenVikingIndexLevel) {
  const plain = stripMarkdownForIndex(entry.contentMd);
  if (level === "L0") {
    return truncateText(plain || `${entry.title} 的 OpenViking 摘要索引。`, 220);
  }

  if (level === "L1") {
    const outline = markdownOutline(entry.contentMd);
    const body = truncateText(plain || `${entry.title} 暂无正文内容。`, 860);
    return outline ? `结构导航：${outline}\n\n${body}` : body;
  }

  return entry.contentMd;
}

function openVikingLayerItems(entry: KnowledgeNotebookEntry | DraftEntry): OpenVikingLayerItem[] {
  return (["L0", "L1", "L2"] as const).map((level) => {
    const meta = openVikingLayerMeta(level);
    return {
      level,
      label: meta.label,
      description: meta.description,
      uri: openVikingLayerUri(entry, level),
      preview: openVikingLayerPreview(entry, level),
      editable: meta.editable,
    };
  });
}

function openVikingQuerySteps(
  space: KnowledgeNotebookSpace | undefined,
  draft: DraftEntry,
  activeLevel: OpenVikingIndexLevel,
  query: string,
): OpenVikingQueryStep[] {
  const queryText = query.trim() || draft.title.trim() || "当前知识";
  const scope = space?.vikingUri || draft.vikingUri || "viking://resources/agentworld";
  const target = draft.vikingUri || scope;

  return [
    {
      level: "L0",
      label: "摘要召回",
      description: `用「${queryText}」在目标范围做 L0 向量召回，先拿最轻量摘要定位候选。`,
      uri: `find(query, target_uri=${scope}, level=0)`,
      active: activeLevel === "L0",
      editable: false,
    },
    {
      level: "L1",
      label: "概览重排",
      description: "进入高分目录或文档的 overview，理解结构、关键点和上下文后再重排。",
      uri: `overview(${target})`,
      active: activeLevel === "L1",
      editable: false,
    },
    {
      level: "L2",
      label: "原文读取",
      description: "最后按 URI 读取完整原文；这一层才进入编辑、保存、版本管理。",
      uri: `read(${target})`,
      active: activeLevel === "L2",
      editable: true,
    },
  ];
}

function buildOpenVikingTree(space: KnowledgeNotebookSpace, entries: KnowledgeNotebookEntry[]) {
  const roots: OpenVikingTreeNode[] = [];
  const nodes = new Map<string, OpenVikingTreeNode>();
  const rootEntries = entries.filter((entry) => !parentFolderIdOf(entry));

  const getNode = (parentId: string, segment: string, uri: string, bucket: OpenVikingTreeNode[]) => {
    const id = `${parentId}/${segment}`;
    const existing = nodes.get(id);
    if (existing) return existing;
    const next: OpenVikingTreeNode = { id, label: segment, uri, children: [], entries: [] };
    nodes.set(id, next);
    bucket.push(next);
    return next;
  };

  for (const entry of rootEntries) {
    const path = vikingDirectoryPath(space, entry);
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

  const sortNodes = (items: OpenVikingTreeNode[]) => {
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

function openVikingNodeCount(node: OpenVikingTreeNode): number {
  return node.entries.length + node.children.reduce((sum, child) => sum + openVikingNodeCount(child), 0);
}

function leafNameFromUri(uri: string) {
  const parts = parseVikingUri(uri);
  return parts.at(-1) ?? uri;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function hashCode(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index) | 0;
  }
  return Math.abs(hash).toString(36);
}

function renderInline(text: string) {
  const parts = text.split(/(!?\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*]+\*|_[^_]+_)/g).filter(Boolean);

  return parts.map((part, index) => {
    const image = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(part);
    if (image) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={index}
          src={image[2]}
          alt={image[1]}
          className="my-3 max-h-72 max-w-full rounded-2xl border border-[var(--line)] object-contain"
        />
      );
    }

    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      return (
        <a key={index} href={link[2]} target="_blank" rel="noreferrer" className="font-medium text-[var(--accent-strong)] underline-offset-4 hover:underline">
          {link[1]}
        </a>
      );
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="rounded-md bg-[rgba(15,23,42,0.06)] px-1.5 py-0.5 font-mono text-[0.92em] text-[var(--ink)]">
          {part.slice(1, -1)}
        </code>
      );
    }
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      return (
        <strong key={index} className="font-semibold text-[var(--ink)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("~~") && part.endsWith("~~")) {
      return (
        <del key={index} className="text-[var(--ink-subtle)]">
          {part.slice(2, -2)}
        </del>
      );
    }
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
      return (
        <em key={index} className="text-[var(--ink)]">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

function parseTaskItem(value: string) {
  const match = /^\s*[-*]\s*\[(x|X|\s*)\]\s*(.*)$/.exec(value) ?? /^\s*[-*]\s*\[\]\s*(.*)$/.exec(value);
  if (!match) return null;
  if (match.length === 2) return { checked: false, text: match[1] };
  return { checked: match[1].toLowerCase() === "x", text: match[2] };
}

function replaceTaskMarker(line: string, checked: boolean) {
  const match = /^(\s*)([-*])\s*\[(?:x|X|\s*)\](\s*.*)$/.exec(line) ?? /^(\s*)([-*])\s*\[\](\s*.*)$/.exec(line);
  if (!match) return line;
  const tail = match[3].trimStart();
  return `${match[1]}${match[2]} ${checked ? "[x]" : "[ ]"}${tail ? ` ${tail}` : ""}`;
}

function toggleTaskLine(content: string, lineIndex: number, checked: boolean) {
  const lines = content.split(/\r?\n/);
  if (!lines[lineIndex]) return content;
  lines[lineIndex] = replaceTaskMarker(lines[lineIndex], checked);
  return lines.join("\n");
}

function parseTable(lines: string[], start: number) {
  if (start + 1 >= lines.length) return null;
  const header = lines[start];
  const divider = lines[start + 1];
  if (!header.includes("|") || !/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(divider)) return null;

  const split = (line: string) =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());
  const rows = [split(header)];
  let index = start + 2;
  while (index < lines.length && lines[index]?.includes("|") && lines[index]?.trim()) {
    rows.push(split(lines[index] ?? ""));
    index += 1;
  }
  return { rows, nextIndex: index };
}

const codeLanguageAliases: Record<string, string> = {
  bash: "Shell",
  cjs: "JavaScript",
  css: "CSS",
  diff: "Diff",
  go: "Go",
  html: "HTML",
  java: "Java",
  js: "JavaScript",
  json: "JSON",
  jsx: "JSX",
  md: "Markdown",
  markdown: "Markdown",
  mjs: "JavaScript",
  patch: "Patch",
  py: "Python",
  python: "Python",
  sh: "Shell",
  shell: "Shell",
  sql: "SQL",
  ts: "TypeScript",
  tsx: "TSX",
  txt: "Text",
  xml: "XML",
  yaml: "YAML",
  yml: "YAML",
};

const codeKeywords = new Set([
  "abstract",
  "async",
  "await",
  "boolean",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "def",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "from",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "interface",
  "is",
  "let",
  "new",
  "null",
  "number",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "select",
  "static",
  "string",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "type",
  "undefined",
  "update",
  "var",
  "void",
  "where",
  "while",
  "with",
]);

function parseCodeFenceInfo(info: string) {
  const trimmed = info.trim();
  const [rawLanguage = "", ...metaParts] = trimmed.split(/\s+/);
  const language = rawLanguage.replace(/^\./, "").toLowerCase();
  const metaText = metaParts.join(" ");
  const namedFile = /(?:title|file|filename)=["']?([^"'\s]+)["']?/.exec(metaText)?.[1];
  const looseFile = metaParts.find((part) => /[/.]/.test(part) && !part.includes("="));

  return {
    language,
    label: codeLanguageAliases[language] ?? (language ? language.toUpperCase() : "Code"),
    meta: namedFile ?? looseFile ?? "",
  };
}

function tokenClassName(token: string, language: string) {
  if (!token) return "";
  if (/^(['"`]).*\1$/.test(token)) return "text-[#a6e3a1]";
  if (/^(\/\/|#|\/\*|<!--)/.test(token)) return "text-[#7f8da3]";
  if (/^<\/?[A-Za-z]/.test(token)) return "text-[#89dceb]";
  if (/^\d/.test(token)) return "text-[#fab387]";
  if (/^(true|false|null|undefined|NaN|Infinity)$/i.test(token)) return "text-[#f5c2e7]";
  if (codeKeywords.has(token.toLowerCase())) return "text-[#89b4fa]";
  if (["json", "yaml", "yml"].includes(language) && /^[A-Za-z_$][\w$-]*$/.test(token)) return "text-[#cba6f7]";
  if (/^[{}()[\].,;:+\-*/%=<>!&|?]+$/.test(token)) return "text-[#9aa7bb]";
  return "text-[#d7e0ee]";
}

function renderHighlightedLine(line: string, language: string): ReactNode {
  if (!line) return "\u00A0";
  if (["diff", "patch"].includes(language)) return line;

  const commentPattern = ["bash", "sh", "shell", "python", "py", "yaml", "yml"].includes(language)
    ? "#.*"
    : "//.*|/\\*.*?\\*/|<!--.*?-->";
  const tokenPattern = new RegExp(
    [
      "(",
      commentPattern,
      "|\"(?:\\\\.|[^\"\\\\])*\"",
      "|'(?:\\\\.|[^'\\\\])*'",
      "|`(?:\\\\.|[^`\\\\])*`",
      "|<\\/?[A-Za-z][^>]*>",
      "|\\b\\d+(?:\\.\\d+)?\\b",
      "|\\b[A-Za-z_$][\\w$-]*\\b",
      "|[{}()[\\].,;:+\\-*/%=<>!&|?]+",
      ")",
    ].join(""),
    "g",
  );
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(line))) {
    if (match.index > cursor) nodes.push(line.slice(cursor, match.index));
    const token = match[0];
    nodes.push(
      <span key={`${match.index}-${token}`} className={tokenClassName(token, language)}>
        {token}
      </span>,
    );
    cursor = match.index + token.length;
  }

  if (cursor < line.length) nodes.push(line.slice(cursor));
  return nodes.length ? nodes : line;
}

function codeLineTone(language: string, line: string) {
  if (!["diff", "patch"].includes(language)) return "";
  if (line.startsWith("+") && !line.startsWith("+++")) return "bg-[#143821] text-[#b7f7c4]";
  if (line.startsWith("-") && !line.startsWith("---")) return "bg-[#3b1d25] text-[#ffc1cb]";
  if (line.startsWith("@@")) return "bg-[#18304a] text-[#9fd8ff]";
  return "";
}

function CodeBlock({ code, info }: { code: string; info: string }) {
  const [copied, setCopied] = useState(false);
  const { language, label, meta } = parseCodeFenceInfo(info);
  const lines = code.split("\n");
  const lineDigits = Math.max(2, String(lines.length).length);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="my-5 overflow-hidden rounded-2xl border border-[#232b38] bg-[#0f141d] shadow-[0_18px_48px_rgba(15,23,42,0.16)]">
      <div className="flex items-center justify-between gap-3 border-b border-white/8 bg-[#151b26] px-4 py-2.5">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase text-[#d7e0ee]">{label}</div>
          {meta ? <div className="mt-0.5 truncate font-mono text-[11px] text-[#8d9aad]">{meta}</div> : null}
        </div>
        <button
          type="button"
          onClick={() => void copyCode()}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/6 px-2.5 text-xs font-medium text-[#d7e0ee] transition-colors hover:bg-white/10"
          aria-label="复制代码"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-[#a6e3a1]" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      <div className="overflow-auto">
        <code className="block min-w-max py-3 font-mono text-[12px] leading-6">
          {lines.map((codeLine, lineIndex) => (
            <div
              key={lineIndex}
              className={cn("grid grid-cols-[auto_1fr] px-0", codeLineTone(language, codeLine))}
            >
              <span
                className="select-none border-r border-white/8 px-3 text-right text-[#5f6b7d]"
                style={{ minWidth: `${lineDigits + 3}ch` }}
              >
                {lineIndex + 1}
              </span>
              <span className="whitespace-pre px-4">{renderHighlightedLine(codeLine, language)}</span>
            </div>
          ))}
        </code>
      </div>
    </div>
  );
}

function MermaidDiagram({ chart }: { chart: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = useMemo(() => `mermaid-${hashCode(chart)}`, [chart]);

  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setError(null);
    void import("mermaid")
      .then(async (module) => {
        const mermaid = module.default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        });
        const result = await mermaid.render(id, chart);
        if (!cancelled) setSvg(result.svg);
      })
      .catch((nextError: unknown) => {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : "Mermaid 渲染失败");
      });
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (error) {
    return (
      <div className="my-4 rounded-2xl border border-[var(--line)] bg-white p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--warning)]">Mermaid</div>
        <pre className="mt-3 overflow-auto text-xs leading-6 text-[var(--ink-muted)]">{chart}</pre>
      </div>
    );
  }

  return (
    <div className="my-4 overflow-auto rounded-2xl border border-[var(--line)] bg-white px-4 py-4 shadow-[0_10px_32px_rgba(15,23,42,0.05)]">
      {svg ? (
        <div className="min-w-fit [&_svg]:mx-auto [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="py-10 text-center text-sm text-[var(--ink-subtle)]">Mermaid 渲染中</div>
      )}
    </div>
  );
}

function plantUmlSequenceSvg(source: string) {
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("@start") && !line.startsWith("@end") && !line.startsWith("'"));
  const participantNames = new Set<string>();
  const messages: Array<{ from: string; to: string; label: string; dashed: boolean }> = [];

  for (const line of lines) {
    const participant = /^(actor|participant|boundary|control|entity|database)\s+"?([^"]+)"?/.exec(line);
    if (participant) participantNames.add(participant[2].trim());
    const message = /^"?([^"-]+?)"?\s*(-{1,2}>|<-{1,2})\s*"?([^":]+?)"?\s*:?\s*(.*)$/.exec(line);
    if (message) {
      const left = message[1].trim();
      const right = message[3].trim();
      const reverse = message[2].startsWith("<");
      const from = reverse ? right : left;
      const to = reverse ? left : right;
      participantNames.add(from);
      participantNames.add(to);
      messages.push({ from, to, label: message[4].trim(), dashed: message[2].includes("--") });
    }
  }

  const participants = [...participantNames];
  if (!participants.length || !messages.length) return null;

  const width = Math.max(720, participants.length * 170 + 80);
  const height = Math.max(260, messages.length * 72 + 150);
  const xFor = (name: string) => 60 + participants.indexOf(name) * 170;
  const boxes = participants
    .map((name) => {
      const x = xFor(name);
      return `
        <rect x="${x}" y="28" width="130" height="42" rx="12" fill="#fff" stroke="#dfe5eb"/>
        <text x="${x + 65}" y="54" text-anchor="middle" font-size="13" font-weight="600" fill="#1f2937">${escapeHtml(name)}</text>
        <line x="${x + 65}" y="78" x2="${x + 65}" y2="${height - 32}" stroke="#d9e0e8" stroke-dasharray="5 7"/>
      `;
    })
    .join("");
  const arrows = messages
    .map((message, index) => {
      const y = 120 + index * 72;
      const fromX = xFor(message.from) + 65;
      const toX = xFor(message.to) + 65;
      const direction = fromX <= toX ? 1 : -1;
      const labelX = (fromX + toX) / 2;
      return `
        <line x1="${fromX}" y1="${y}" x2="${toX - direction * 9}" y2="${y}" stroke="#263241" stroke-width="1.6" ${message.dashed ? 'stroke-dasharray="6 6"' : ""}/>
        <path d="M ${toX - direction * 10} ${y - 5} L ${toX} ${y} L ${toX - direction * 10} ${y + 5}" fill="none" stroke="#263241" stroke-width="1.6"/>
        <rect x="${labelX - 78}" y="${y - 28}" width="156" height="22" rx="11" fill="#f7fafc"/>
        <text x="${labelX}" y="${y - 13}" text-anchor="middle" font-size="12" fill="#516173">${escapeHtml(message.label || "message")}</text>
      `;
    })
    .join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
      <rect width="100%" height="100%" rx="18" fill="#fbfcfd"/>
      ${boxes}
      ${arrows}
    </svg>
  `;
}

function plantUmlClassSvg(source: string) {
  const classes = source
    .split(/\r?\n/)
    .map((line) => /^\s*(class|interface|enum)\s+"?([\w.\u4e00-\u9fa5-]+)"?/.exec(line))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => ({ kind: match[1], name: match[2] }));
  if (!classes.length) return null;

  const columns = Math.min(3, classes.length);
  const width = Math.max(520, columns * 210 + 60);
  const rows = Math.ceil(classes.length / columns);
  const height = rows * 120 + 50;
  const nodes = classes
    .map((item, index) => {
      const x = 30 + (index % columns) * 210;
      const y = 30 + Math.floor(index / columns) * 120;
      return `
        <rect x="${x}" y="${y}" width="180" height="78" rx="14" fill="#fff" stroke="#dfe5eb"/>
        <rect x="${x}" y="${y}" width="180" height="28" rx="14" fill="#f5f8fb"/>
        <text x="${x + 90}" y="${y + 20}" text-anchor="middle" font-size="11" fill="#6b7684">${escapeHtml(item.kind)}</text>
        <text x="${x + 90}" y="${y + 54}" text-anchor="middle" font-size="13" font-weight="700" fill="#1f2937">${escapeHtml(item.name)}</text>
      `;
    })
    .join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
      <rect width="100%" height="100%" rx="18" fill="#fbfcfd"/>
      ${nodes}
    </svg>
  `;
}

function PlantUmlDiagram({ source }: { source: string }) {
  const svg = plantUmlSequenceSvg(source) ?? plantUmlClassSvg(source);

  return (
    <div className="my-4 overflow-auto rounded-2xl border border-[var(--line)] bg-white px-4 py-4 shadow-[0_10px_32px_rgba(15,23,42,0.05)]">
      {svg ? (
        <div className="min-w-fit [&_svg]:mx-auto [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-subtle)]">PlantUML</div>
          <pre className="mt-3 overflow-auto rounded-xl bg-[#10141d] p-4 text-xs leading-6 text-[#d7e0ee]">{source}</pre>
        </>
      )}
    </div>
  );
}

function MarkdownPreview({
  content,
  onTaskToggle,
}: {
  content: string;
  onTaskToggle?: (lineIndex: number, checked: boolean) => void;
}) {
  const nodes = [];
  const lines = content.split(/\r?\n/);
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.trim().startsWith("```")) {
      const codeInfo = line.trim().slice(3).trim();
      const language = parseCodeFenceInfo(codeInfo).language;
      const codeLines = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? "").trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += 1;
      const code = codeLines.join("\n");
      if (language === "mermaid") {
        nodes.push(<MermaidDiagram key={`mermaid-${index}`} chart={code} />);
      } else if (["plantuml", "puml", "uml"].includes(language)) {
        nodes.push(<PlantUmlDiagram key={`plantuml-${index}`} source={code} />);
      } else {
        nodes.push(<CodeBlock key={`code-${index}`} code={code} info={codeInfo} />);
      }
      continue;
    }

    const table = parseTable(lines, index);
    if (table) {
      const [header, ...body] = table.rows;
      nodes.push(
        <div key={`table-${index}`} className="my-4 overflow-auto rounded-2xl border border-[var(--line)] bg-white">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="bg-[rgba(15,23,42,0.03)]">
                {header.map((cell, cellIndex) => (
                  <th key={cellIndex} className="border-b border-[var(--line)] px-4 py-3 text-left font-semibold text-[var(--ink)]">
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-[var(--line)] last:border-b-0">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-4 py-3 text-[var(--ink-muted)]">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      index = table.nextIndex;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const headingContent = renderInline(heading[2]);
      const className = cn(
        "mt-5 font-semibold tracking-normal text-[var(--ink)]",
        level === 1 && "text-2xl",
        level === 2 && "text-xl",
        level === 3 && "text-lg",
        level >= 4 && "text-base",
      );
      if (level === 1) nodes.push(<h1 key={`heading-${index}`} className={className}>{headingContent}</h1>);
      else if (level === 2) nodes.push(<h2 key={`heading-${index}`} className={className}>{headingContent}</h2>);
      else if (level === 3) nodes.push(<h3 key={`heading-${index}`} className={className}>{headingContent}</h3>);
      else nodes.push(<h4 key={`heading-${index}`} className={className}>{headingContent}</h4>);
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines = [];
      while (index < lines.length && /^>\s?/.test(lines[index] ?? "")) {
        quoteLines.push((lines[index] ?? "").replace(/^>\s?/, ""));
        index += 1;
      }
      nodes.push(
        <blockquote key={`quote-${index}`} className="my-4 border-l-2 border-[var(--accent)]/60 pl-4 text-sm leading-7 text-[var(--ink-muted)]">
          {quoteLines.map((quoteLine, quoteIndex) => (
            <p key={quoteIndex}>{renderInline(quoteLine)}</p>
          ))}
        </blockquote>,
      );
      continue;
    }

    if (/^\s*[-*]\s+/.test(line) || /^\s*[-*]\s*\[/.test(line)) {
      const listItems: Array<{ text: string; checked?: boolean; lineIndex?: number; indent: number }> = [];
      while (index < lines.length && (/^\s*[-*]\s+/.test(lines[index] ?? "") || /^\s*[-*]\s*\[/.test(lines[index] ?? ""))) {
        const current = lines[index] ?? "";
        const indent = Math.floor(((/^\s*/.exec(current)?.[0] ?? "").replace(/\t/g, "  ").length) / 2);
        const task = parseTaskItem(current);
        listItems.push(task ? { ...task, lineIndex: index, indent } : { text: current.replace(/^\s*[-*]\s+/, ""), indent });
        index += 1;
      }
      nodes.push(
        <ul key={`list-${index}`} className="my-4 space-y-2 text-sm leading-7 text-[var(--ink-muted)]">
          {listItems.map((item, itemIndex) => (
            <li key={itemIndex} className="flex items-start gap-2" style={{ paddingLeft: `${item.indent * 18}px` }}>
              {typeof item.checked === "boolean" ? (
                <button
                  type="button"
                  aria-label={item.checked ? "标记为未完成" : "标记为完成"}
                  aria-pressed={item.checked}
                  onClick={() => {
                    if (typeof item.lineIndex === "number") onTaskToggle?.(item.lineIndex, !item.checked);
                  }}
                  className={cn(
                    "mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                    item.checked
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_0_0_3px_rgba(9,199,232,0.12)]"
                      : "border-[var(--line)] bg-white hover:border-[var(--accent)]/60 hover:bg-[var(--accent-soft)]",
                  )}
                >
                  {item.checked ? <Check className="h-3 w-3" /> : null}
                </button>
              ) : (
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ink-subtle)]" />
              )}
              <span>{renderInline(item.text)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const listItems: Array<{ text: string; indent: number }> = [];
      while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index] ?? "")) {
        const current = lines[index] ?? "";
        const indent = Math.floor(((/^\s*/.exec(current)?.[0] ?? "").replace(/\t/g, "  ").length) / 2);
        listItems.push({ text: current.replace(/^\s*\d+[.)]\s+/, ""), indent });
        index += 1;
      }
      nodes.push(
        <ol key={`ordered-${index}`} className="my-4 list-decimal space-y-2 pl-5 text-sm leading-7 text-[var(--ink-muted)]">
          {listItems.map((item, itemIndex) => (
            <li key={itemIndex} style={{ marginLeft: `${item.indent * 18}px` }}>{renderInline(item.text)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (/^-{3,}$/.test(line.trim())) {
      nodes.push(<hr key={`rule-${index}`} className="my-5 border-[var(--line)]" />);
      index += 1;
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index]?.trim() &&
      !/^(#{1,6})\s+/.test(lines[index] ?? "") &&
      !/^>\s?/.test(lines[index] ?? "") &&
      !/^\s*[-*]\s+/.test(lines[index] ?? "") &&
      !/^\s*[-*]\s*\[/.test(lines[index] ?? "") &&
      !/^\s*\d+[.)]\s+/.test(lines[index] ?? "") &&
      !(lines[index] ?? "").trim().startsWith("```") &&
      !parseTable(lines, index)
    ) {
      paragraph.push((lines[index] ?? "").trim());
      index += 1;
    }

    nodes.push(
      <p key={`paragraph-${index}`} className="my-3 text-sm leading-8 text-[var(--ink-muted)]">
        {renderInline(paragraph.join(" "))}
      </p>,
    );
  }

  if (!nodes.length) {
    return (
      <div className="flex h-full min-h-[460px] items-center justify-center text-sm text-[var(--ink-subtle)]">
        暂无预览
      </div>
    );
  }

  return <div className="px-7 py-6">{nodes}</div>;
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
  if (!state) return null;

  let space: KnowledgeNotebookSpace | null = null;
  let entry: KnowledgeNotebookEntry | null = null;
  const target = state.target;
  if ("spaceId" in target && target.spaceId) {
    space = spaces.find((item) => item.id === target.spaceId) ?? null;
  } else if ("entryId" in target) {
    entry = entries.find((item) => item.id === target.entryId) ?? null;
  }
  const entrySpaceId = entry?.knowledgeSpaceId ?? space?.id ?? spaces[0]?.id ?? "";
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
            <Eye className="h-4 w-4 text-[var(--ink-subtle)]" />
            打开
          </button>
          <button className={itemClass} onClick={() => { onNewNote(entrySpaceId, entryParentId); onClose(); }}>
            <FileText className="h-4 w-4 text-[var(--ink-subtle)]" />
            {nodeTypeOf(entry) === "folder" ? "在目录中新建知识" : "新建同级知识"}
          </button>
          <button className={itemClass} onClick={() => { onNewFolder(entrySpaceId, entryParentId); onClose(); }}>
            <FolderPlus className="h-4 w-4 text-[var(--ink-subtle)]" />
            {nodeTypeOf(entry) === "folder" ? "新建子目录" : "新建同级目录"}
          </button>
          <button className={itemClass} onClick={() => { onRenameEntry(entry); onClose(); }}>
            <Edit3 className="h-4 w-4 text-[var(--ink-subtle)]" />
            重命名
          </button>
          <div className="my-1 h-px bg-[var(--line)]" />
          <button className={cn(itemClass, "text-[var(--danger)]")} onClick={() => { onDeleteEntry(entry); onClose(); }}>
            <Trash2 className="h-4 w-4" />
            {nodeTypeOf(entry) === "folder" ? "删除目录" : "删除知识"}
          </button>
        </>
      ) : (
        <>
          <button className={itemClass} disabled={!entrySpaceId} onClick={() => { onNewNote(entrySpaceId); onClose(); }}>
            <FileText className="h-4 w-4 text-[var(--ink-subtle)]" />
            新建知识
          </button>
          <button className={itemClass} disabled={!entrySpaceId} onClick={() => { onNewFolder(entrySpaceId); onClose(); }}>
            <FolderPlus className="h-4 w-4 text-[var(--ink-subtle)]" />
            新建目录
          </button>
          <div className="my-1 h-px bg-[var(--line)]" />
          <button className={itemClass} onClick={() => { onCreateSpace("team", space?.id); onClose(); }}>
            <Folder className="h-4 w-4 text-[var(--ink-subtle)]" />
            新建团队空间
          </button>
          <button className={itemClass} onClick={() => { onCreateSpace("project", space?.id); onClose(); }}>
            <Folder className="h-4 w-4 text-[var(--ink-subtle)]" />
            新建项目空间
          </button>
          <button className={itemClass} onClick={() => { onCreateSpace("agent_team", space?.id); onClose(); }}>
            <Folder className="h-4 w-4 text-[var(--ink-subtle)]" />
            新建 Agent 空间
          </button>
          {space ? (
            <>
              <div className="my-1 h-px bg-[var(--line)]" />
              <button className={itemClass} onClick={() => { onEditSpace(space); onClose(); }}>
                <Edit3 className="h-4 w-4 text-[var(--ink-subtle)]" />
                编辑空间
              </button>
              <button className={cn(itemClass, "text-[var(--danger)]")} onClick={() => { onDeleteSpace(space); onClose(); }}>
                <Trash2 className="h-4 w-4" />
                删除空间
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
  const { alert: showAlert, dialogHost } = useAppDialogs();
  const editing = state?.mode === "edit" ? state.space : null;
  const baseBusinessTeamId = editing?.businessTeamId ?? (editing?.agentTeamId ? agentTeams.find((team) => team.id === editing.agentTeamId)?.businessTeamId ?? "" : "");
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: editing?.name ?? "",
    slug: editing?.slug ?? "",
    tenantSpaceId: editing?.tenantSpaceId ?? tenantSpaces[0]?.id ?? "",
    spaceType: editing?.spaceType ?? (state?.mode === "create" ? state.preferredType ?? "team" : "team"),
    businessTeamId: baseBusinessTeamId,
    agentTeamId: editing?.agentTeamId ?? "",
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
      tenantSpaceId: nextEditing?.tenantSpaceId ?? tenantSpaces[0]?.id ?? "",
      spaceType: nextEditing?.spaceType ?? (state.mode === "create" ? state.preferredType ?? "team" : "team"),
      businessTeamId: nextBaseBusinessTeamId,
      agentTeamId: nextEditing?.agentTeamId ?? "",
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
          description: form.description,
          visibility: form.visibility,
          status: form.status,
          retentionPolicyJson,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) throw new Error(result.error ?? "保存空间失败");
      onClose();
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存空间失败";
      setErrorMessage(message);
      setPending(false);
      void showAlert({
        title: "保存空间失败",
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
            <div className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--ink-subtle)]">Knowledge Space</div>
            <div className="mt-1 text-lg font-semibold text-[var(--ink)]">{editing ? "编辑知识空间" : "新建知识空间"}</div>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="关闭">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
          <FieldGroup label="名称">
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="空间名称" />
          </FieldGroup>
          <FieldGroup label="Slug">
            <Input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="slug" />
          </FieldGroup>
          <FieldGroup label="租户空间">
            <Select value={form.tenantSpaceId} onChange={(event) => setForm({ ...form, tenantSpaceId: event.target.value })}>
              {tenantSpaces.map((space) => (
                <option key={space.id} value={space.id}>{space.name}</option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="空间类型">
            <Select value={form.spaceType} onChange={(event) => setForm({ ...form, spaceType: event.target.value })}>
              <option value="global">全局</option>
              <option value="team">团队</option>
              <option value="project">项目</option>
              <option value="agent_team">Agent 团队</option>
            </Select>
          </FieldGroup>
          <FieldGroup label="业务团队">
            <Select value={form.businessTeamId} onChange={(event) => setForm({ ...form, businessTeamId: event.target.value, agentTeamId: "" })}>
              <option value="">不绑定</option>
              {businessTeams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="Agent 团队">
            <Select
              value={form.agentTeamId}
              disabled={form.spaceType !== "agent_team"}
              onChange={(event) => setForm({ ...form, agentTeamId: event.target.value })}
            >
              <option value="">不绑定</option>
              {availableAgentTeams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="项目标识">
            <Input
              value={form.projectKey}
              disabled={form.spaceType !== "project"}
              onChange={(event) => setForm({ ...form, projectKey: event.target.value })}
            />
          </FieldGroup>
          <FieldGroup label="可见性">
            <Select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value })}>
              <option value="global">全局可见</option>
              <option value="team">团队可见</option>
              <option value="private">私有</option>
            </Select>
          </FieldGroup>
          <FieldGroup label="状态">
            <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="active">启用</option>
              <option value="paused">暂停</option>
              <option value="archived">归档</option>
            </Select>
          </FieldGroup>
          <FieldGroup label="归档策略">
            <Textarea value={form.retentionPolicyJson} onChange={(event) => setForm({ ...form, retentionPolicyJson: event.target.value })} className="min-h-20 font-mono text-xs" />
          </FieldGroup>
          <FieldGroup label="说明" className="md:col-span-2">
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
              <div className="font-semibold">保存空间失败</div>
              <div className="mt-1 leading-6">{errorMessage}</div>
            </div>
          </div>
        ) : null}
        <div className="flex justify-end gap-2 border-t border-[var(--line)] px-5 py-4">
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" onClick={saveSpace} disabled={pending || !form.name.trim()}>
            {pending ? "保存中" : "保存空间"}
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
  metrics,
}: {
  spaces: KnowledgeNotebookSpace[];
  entries: KnowledgeNotebookEntry[];
  tenantSpaces: TenantSpaceOption[];
  businessTeams: BusinessTeamOption[];
  agentTeams: AgentTeamOption[];
  metrics: KnowledgeWorkspaceMetric[];
}) {
  const router = useRouter();
  const { alert: showAlert, confirm: showConfirm, prompt: showPrompt, dialogHost } = useAppDialogs();
  const initialEntry = entries[0];
  const initialSpaceId = initialEntry?.knowledgeSpaceId ?? spaces[0]?.id ?? "";
  const [entriesState, setEntriesState] = useState(entries);
  const [selectedSpaceId, setSelectedSpaceId] = useState(initialSpaceId);
  const [selectedEntryId, setSelectedEntryId] = useState(initialEntry?.id ?? draftId);
  const [draft, setDraft] = useState<DraftEntry>(() => (initialEntry ? toDraft(initialEntry) : createBlankDraft(initialSpaceId)));
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [paneMode, setPaneMode] = useState<PaneMode>("split");
  const [selectedIndexLevel, setSelectedIndexLevel] = useState<OpenVikingIndexLevel>("L2");
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
  const [collapsedVikingPaths, setCollapsedVikingPaths] = useState<Set<string>>(() => new Set());
  const draftRef = useRef(draft);
  const dirtyRef = useRef(dirty);
  const saveStateRef = useRef(saveState);
  const savingRef = useRef(false);
  const pendingSaveRef = useRef<Promise<SaveResult> | null>(null);
  const navigatingRef = useRef(false);

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
      const spaceMatch = normalize(`${space.name} ${space.description} ${space.ownerName} ${space.vikingUri}`).includes(normalizedQuery);
      const entryMatch = (entriesBySpaceId.get(space.id) ?? []).some((entry) =>
        normalize(`${entry.title} ${entry.contentMd} ${entry.layer} ${entry.scopeKey}`).includes(normalizedQuery),
      );
      return spaceMatch || entryMatch;
    });
  }, [entriesBySpaceId, normalizedQuery, spaces]);

  const activeSpace = spaces.find((space) => space.id === (draft.knowledgeSpaceId || selectedSpaceId));
  const contentSize = formatBytes(new TextEncoder().encode(draft.contentMd).length);
  const totalEntries = entriesState.filter((entry) => nodeTypeOf(entry) !== "folder").length;
  const totalFolders = entriesState.filter((entry) => nodeTypeOf(entry) === "folder").length;
  const selectedLayerItems = useMemo(() => openVikingLayerItems(draft), [draft]);
  const selectedLayerItem = selectedLayerItems.find((item) => item.level === selectedIndexLevel) ?? selectedLayerItems[2];
  const querySteps = useMemo(
    () => openVikingQuerySteps(activeSpace, draft, selectedIndexLevel, query),
    [activeSpace, draft, query, selectedIndexLevel],
  );
  const isIndexReadOnly = draft.nodeType !== "folder" && draft.id !== "" && selectedIndexLevel !== "L2";

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
    if (selectedIndexLevel !== "L2" && draftRef.current.id && draftRef.current.nodeType !== "folder") return;
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
      if (!response.ok || result.ok === false) throw new Error(result.error ?? "读取历史版本失败");
      setVersions(result.versions ?? []);
    } catch (error) {
      setVersionsError(error instanceof Error ? error.message : "读取历史版本失败");
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
            title: currentDraft.title.trim() || (currentDraft.nodeType === "folder" ? "新建目录" : "未命名知识"),
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
              setSaveError(result.error ?? "知识已被其他编辑者更新，请先合并后再保存。");
            }
            saveResult = "conflict";
            return;
          }

          if (!response.ok || result.ok === false || !result.entry) {
            throw new Error(result.error ?? "保存失败");
          }

          updateEntryState(result.entry);
          if (draftRef.current === currentDraft) {
            setSelectedEntryId(result.entry.id);
            setSelectedSpaceId(result.entry.knowledgeSpaceId ?? "");
            replaceDraft(toDraft(result.entry), "saved", false);
            setSaveError(null);
            setConflictEntry(null);
            setMessage(silent ? "已自动保存" : "已保存到知识库");
            if (versionsOpen) void loadVersions(result.entry.id);
          }
          router.refresh();
          saveResult = "saved";
        } catch (error) {
          if (draftRef.current === currentDraft) {
            setSaveState("error");
            setSaveError(error instanceof Error ? error.message : "保存失败");
            setMessage(error instanceof Error ? error.message : "保存失败");
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
    [loadVersions, replaceDraft, router, spaces.length, updateEntryState, versionsOpen],
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
            setSaveError("检测到其他编辑者已经保存了新版本，自动保存已暂停。");
            return;
          }

          replaceDraft(toDraft(remoteEntry));
          setSelectedEntryId(remoteEntry.id);
          setSelectedSpaceId(remoteEntry.knowledgeSpaceId ?? "");
          setSaveError(null);
          setMessage("已同步其他编辑者的最新版本");
        })
        .catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(interval);
  }, [draft.id, replaceDraft, updateEntryState]);

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

  function openContextMenu(event: MouseEvent, target: ContextTarget) {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, target });
  }

  async function saveBeforeNavigation() {
    if (saveStateRef.current === "conflict") {
      setMessage("当前知识存在版本冲突，请先处理冲突后再切换。");
      return false;
    }
    if (!dirtyRef.current && !pendingSaveRef.current) return true;

    const result = await saveCurrentDraft({ silent: true });
    if (result === "error") {
      setMessage("当前知识保存失败，已停留在当前知识，避免丢失修改。");
      return false;
    }
    if (result === "conflict") {
      setMessage("当前知识存在版本冲突，请先处理冲突后再切换。");
      return false;
    }
    return true;
  }

  async function selectEntryLayer(entry: KnowledgeNotebookEntry, level: OpenVikingIndexLevel) {
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
    replaceDraft(createBlankDraft(nextSpaceId, parentFolderId, nodeType));
    setSaveError(null);
    setConflictEntry(null);
    setVersionsOpen(false);
    setPropertiesOpen(nodeType === "folder");
    setMessage(null);
  }

  async function saveDraft() {
    if (isIndexReadOnly) {
      setMessage("当前是 OpenViking 索引层，只读展示；请切换到 L2 原文知识后编辑保存。");
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
        if (!response.ok || result.ok === false) throw new Error(result.error ?? "删除失败");
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
      setMessage("已删除");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败");
    } finally {
      setPending(false);
    }
  }

  async function deleteEntry(entry: KnowledgeNotebookEntry) {
    const ids = nodeTypeOf(entry) === "folder" ? descendantIds(entriesState, entry.id) : [entry.id];
    const label = nodeTypeOf(entry) === "folder" ? `目录「${entry.title}」及其中 ${ids.length - 1} 个子项` : `知识「${entry.title}」`;
    const confirmed = await showConfirm({
      title: "删除确认",
      description: `确定删除${label}？这个操作不能撤销。`,
      confirmText: "删除",
      tone: "danger",
    });
    if (!confirmed) return;
    await deleteEntryIds(ids);
  }

  async function deleteDraft() {
    if (isIndexReadOnly) {
      setMessage("索引层由 OpenViking 生成，不能删除；请切换到 L2 原文知识后管理知识。");
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
      title: "重命名",
      description: "输入新的知识名称。",
      defaultValue: entry.title,
      placeholder: "知识名称",
      confirmText: "保存",
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
        throw new Error(result.error ?? "知识已被其他编辑者更新，请刷新后重命名。");
      }
      if (!response.ok || result.ok === false || !result.entry) throw new Error(result.error ?? "重命名失败");
      updateEntryState(result.entry);
      if (selectedEntryId === entry.id) replaceDraft(toDraft(result.entry));
      router.refresh();
    } catch (error) {
      setPending(false);
      await showAlert({
        title: "重命名失败",
        description: error instanceof Error ? error.message : "重命名失败",
        tone: "danger",
      });
    } finally {
      setPending(false);
    }
  }

  async function deleteSpace(space: KnowledgeNotebookSpace) {
    const confirmed = await showConfirm({
      title: "删除知识空间",
      description: `确定删除知识空间「${space.name}」？空间内知识不会在这里批量删除，请确认已经迁移。`,
      confirmText: "删除空间",
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
      if (!response.ok || result.ok === false) throw new Error(result.error ?? "删除空间失败");
      router.refresh();
    } catch (error) {
      setPending(false);
      await showAlert({
        title: "删除空间失败",
        description: error instanceof Error ? error.message : "删除空间失败",
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
        setSaveError(result.error ?? "恢复失败，当前知识已经被其他编辑者更新。");
        return;
      }

      if (!response.ok || result.ok === false || !result.entry) throw new Error(result.error ?? "恢复历史版本失败");
      updateEntryState(result.entry);
      replaceDraft(toDraft(result.entry), "saved", false);
      setSelectedEntryId(result.entry.id);
      setSelectedSpaceId(result.entry.knowledgeSpaceId ?? "");
      setSelectedIndexLevel("L2");
      setConflictEntry(null);
      setMessage(`已恢复到 R${version.revision}`);
      void loadVersions(result.entry.id);
      router.refresh();
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "恢复历史版本失败");
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

  function toggleVikingPath(pathId: string) {
    setCollapsedVikingPaths((current) => {
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
    setMessage(`已归档 ${nextEntries.length} 条知识`);
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
        setMessage(error instanceof Error ? error.message : "目录读取失败");
      });
  }

  function PaneModeControls() {
    const modes: Array<{ value: PaneMode; label: string; icon: typeof SplitSquareHorizontal }> = [
      { value: "split", label: "双栏", icon: SplitSquareHorizontal },
      { value: "editor", label: "编辑", icon: Edit3 },
      { value: "preview", label: "预览", icon: Eye },
    ];
    return (
      <div className="inline-flex items-center rounded-full border border-[var(--line)] bg-white p-0.5 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
        {modes.map((mode) => {
          const Icon = mode.icon;
          return (
            <button
              key={mode.value}
              type="button"
              onClick={() => setPaneMode(mode.value)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors",
                paneMode === mode.value
                  ? "bg-[var(--ink)] text-white shadow-[0_8px_20px_rgba(15,23,42,0.14)]"
                  : "text-[var(--ink-subtle)] hover:text-[var(--ink)]",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {mode.label}
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
    const collapsed = collapsedVikingPaths.has(pathId);
    const layerItems = isFolder ? [] : openVikingLayerItems(entry);

    return (
      <div key={entry.id}>
        <div className="group flex w-full items-start gap-1.5">
          <button
            type="button"
            aria-label={collapsed ? "展开目录" : "收起目录"}
            onClick={(event) => {
              event.stopPropagation();
              if (children.length) toggleVikingPath(pathId);
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
                {isFolder ? `${children.length} 个子项` : `${entry.scopeKey} · L2 可编辑原文`}
              </div>
            </div>
            {isFolder ? (
              <MoreHorizontal className="h-4 w-4 shrink-0 text-transparent group-hover:text-[var(--ink-subtle)]" />
            ) : (
              <span className="mt-0.5 rounded-full bg-[rgba(15,23,42,0.04)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ink-subtle)]">
                L0/L1/L2
              </span>
            )}
          </button>
        </div>
        {!isFolder ? (
          <div className="mt-1 space-y-1 border-l border-[var(--line)]/70 pl-2.5" style={{ marginLeft: `${44 + depth * 14}px` }}>
            {layerItems.map((item) => {
              const activeLayer = isActive && selectedIndexLevel === item.level;
              return (
                <button
                  key={`${entry.id}:${item.level}`}
                  type="button"
                  onClick={() => void selectEntryLayer(entry, item.level)}
                  onContextMenu={(event) => openContextMenu(event, { type: "entry", entryId: entry.id })}
                  className={cn(
                    "group/layer flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left transition-colors",
                    activeLayer ? "bg-white shadow-[0_8px_24px_rgba(15,23,42,0.08)]" : "hover:bg-white/80",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 min-w-8 items-center justify-center rounded-full text-[10px] font-semibold",
                      item.editable
                        ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                        : "bg-[rgba(15,23,42,0.04)] text-[var(--ink-subtle)]",
                    )}
                  >
                    {item.level}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-[var(--ink)]">{item.label.replace(/^L\d\s/, "")}</span>
                    <span className="mt-0.5 block truncate font-mono text-[10px] text-[var(--ink-subtle)]">
                      {item.editable ? leafNameFromUri(entry.vikingUri) : item.uri}
                    </span>
                  </span>
                  <span className="mt-0.5 text-[10px] font-medium text-[var(--ink-subtle)]">
                    {item.editable ? "可编辑" : "只读"}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
        {children.length && !collapsed ? (
          <div className="mt-0.5">
            {children.map((child) => renderEntryBranch(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  }

  function renderOpenVikingNodes(nodes: OpenVikingTreeNode[], space: KnowledgeNotebookSpace, depth = 0): ReactNode {
    return nodes.map((node) => {
      const collapsed = collapsedVikingPaths.has(node.id);
      const count = openVikingNodeCount(node);
      return (
        <div key={node.id} className="space-y-0.5">
          <button
            type="button"
            onClick={() => toggleVikingPath(node.id)}
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
              {(["L0", "L1"] as const).map((level) => {
                const meta = openVikingLayerMeta(level);
                const indexUri = openVikingDirectoryIndexUri(node.uri, level);
                return (
                  <button
                    key={`${node.id}:${level}`}
                    type="button"
                    onClick={() => setMessage(`${node.label} 的 ${meta.label} 是 OpenViking 目录索引，只读展示；可编辑内容在 L2 原文知识。`)}
                    className="group flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/75"
                    style={{ paddingLeft: `${22 + depth * 13}px` }}
                  >
                    <span className="mt-0.5 flex h-5 min-w-8 items-center justify-center rounded-full bg-[rgba(15,23,42,0.04)] text-[10px] font-semibold text-[var(--ink-subtle)]">
                      {level}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-[var(--ink)]">
                        {level === "L0" ? ".abstract.md" : ".overview.md"}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[10px] text-[var(--ink-subtle)]">{indexUri}</span>
                    </span>
                    <span className="mt-0.5 text-[10px] font-medium text-[var(--ink-subtle)]">只读</span>
                  </button>
                );
              })}
              {node.children.length ? renderOpenVikingNodes(node.children, space, depth + 1) : null}
              {node.entries.map((entry) => renderEntryBranch(entry, depth + 1))}
            </div>
          ) : null}
        </div>
      );
    });
  }

  return (
    <section
      className="relative flex min-h-[calc(100vh-154px)] flex-col overflow-hidden rounded-[28px] border border-[var(--line)] bg-[rgba(255,255,255,0.78)] shadow-[0_28px_80px_rgba(15,23,42,0.08)]"
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
              <div className="text-sm font-semibold">拖入后选择归档位置</div>
              <div className="mt-1 text-xs text-[var(--ink-subtle)]">文件或目录会按知识树结构写入 OpenViking 对应空间。</div>
            </div>
          </div>
        </div>
      ) : null}
      <div className="border-b border-[var(--line)] bg-[rgba(250,251,253,0.84)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setMetricsOpen((value) => !value)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink)]"
          >
            {metricsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            知识库状态
            <CircleDot className="h-3.5 w-3.5 text-[#16a34a]" />
          </button>
          <div className="flex flex-wrap items-center gap-2">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className={cn(
                  "rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs text-[var(--ink-muted)]",
                  metric.tone === "accent" && "border-[var(--accent)]/20 bg-[var(--accent-soft)] text-[var(--accent-strong)]",
                  metric.tone === "success" && "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]",
                  metric.tone === "warning" && "border-[#fed7aa] bg-[#fff7ed] text-[var(--warning)]",
                )}
              >
                <span className="mr-1">{metric.label}</span>
                <span className="font-semibold text-[var(--ink)]">{metric.value}</span>
              </div>
            ))}
          </div>
        </div>
        {metricsOpen ? (
          <div className="mt-3 grid gap-2 md:grid-cols-4">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl bg-white px-4 py-3 ring-1 ring-black/4">
                <div className="text-xs text-[var(--ink-subtle)]">{metric.label}</div>
                <div className="mt-1 text-lg font-semibold text-[var(--ink)]">{metric.value}</div>
                {metric.detail ? <div className="mt-1 text-xs text-[var(--ink-muted)]">{metric.detail}</div> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside
          className="flex min-h-0 flex-col border-b border-[var(--line)] bg-[rgba(250,251,253,0.88)] lg:border-b-0 lg:border-r"
          onContextMenu={(event) => openContextMenu(event, { type: "tree", spaceId: selectedSpaceId })}
        >
          <div className="border-b border-[var(--line)] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--ink-subtle)]">Knowledge Tree</div>
                <div className="mt-1 text-lg font-semibold tracking-normal text-[var(--ink)]">知识树</div>
              </div>
              <Button size="icon" variant="ghost" aria-label="新建知识" onClick={() => void startNewEntry()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <label className="mt-4 flex h-10 items-center gap-2 rounded-2xl border border-[var(--line)] bg-white px-3 text-sm text-[var(--ink-muted)]">
              <Search className="h-4 w-4" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-subtle)]"
                placeholder="搜索知识"
              />
            </label>
            <div className="mt-3 flex items-center gap-2 text-xs text-[var(--ink-subtle)]">
              <BookOpen className="h-3.5 w-3.5" />
              <span>{spaces.length} 个空间</span>
              <span className="h-1 w-1 rounded-full bg-[var(--ink-subtle)]/40" />
              <span>{totalFolders} 个目录</span>
              <span className="h-1 w-1 rounded-full bg-[var(--ink-subtle)]/40" />
              <span>{totalEntries} 篇知识</span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
            {filteredSpaces.length ? (
              <div className="space-y-2.5">
                {filteredSpaces.map((space) => {
                  const spaceEntries = entriesBySpaceId.get(space.id) ?? [];
                  const visibleEntries = filterEntriesWithAncestors(spaceEntries, normalizedQuery);
                  const treeNodes = buildOpenVikingTree(space, visibleEntries);
                  const isActiveSpace = selectedSpaceId === space.id || draft.knowledgeSpaceId === space.id;
                  const isCollapsed = collapsedSpaceIds.has(space.id) && !normalizedQuery;
                  return (
                    <div key={space.id} className="space-y-1">
                      <button
                        type="button"
                        aria-expanded={!isCollapsed}
                        aria-label={isCollapsed ? `展开知识空间 ${space.name}` : `收起知识空间 ${space.name}`}
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
                          <div className="mt-0.5 truncate text-xs text-[var(--ink-subtle)]">{vikingScopeLabel(space.vikingUri)} · {space.ownerName}</div>
                        </div>
                        <Badge variant={statusVariant(space.status)}>{space.entryCount}</Badge>
                      </button>
                      {!isCollapsed ? (
                        <div className="ml-7 border-l border-[var(--line)]/80 pl-2.5">
                          {treeNodes.length ? (
                            renderOpenVikingNodes(treeNodes, space)
                          ) : (
                            <button
                              type="button"
                              onClick={() => void startNewEntry(space.id)}
                              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--ink-subtle)] hover:bg-white/80"
                            >
                              <Plus className="h-4 w-4" />
                              新建知识
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
                暂无知识空间
              </div>
            )}
          </div>
        </aside>

        <div className="flex min-w-0 flex-col bg-[rgba(255,255,255,0.82)]">
          <div className="border-b border-[var(--line)] px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-[260px] flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--ink-subtle)]">
                  <span>{activeSpace?.tenantName ?? "未绑定租户"}</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                  <span>{activeSpace?.name ?? "未选择空间"}</span>
                  {draft.parentFolderId ? (
                    <>
                      <ChevronRight className="h-3.5 w-3.5" />
                      <span>{entriesState.find((entry) => entry.id === draft.parentFolderId)?.title ?? "目录"}</span>
                    </>
                  ) : null}
                </div>
                {isIndexReadOnly ? (
                  <div className="mt-2">
                    <div className="text-3xl font-semibold tracking-normal text-[var(--ink)]">{draft.title}</div>
                    <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-[rgba(15,23,42,0.04)] px-3 py-1 text-xs font-medium text-[var(--ink-subtle)]">
                      <CircleDot className="h-3.5 w-3.5" />
                      {selectedLayerItem.label} · OpenViking 生成索引，只读展示
                    </div>
                  </div>
                ) : (
                  <Input
                    value={draft.title}
                    onChange={(event) => updateDraft((current) => ({ ...current, title: event.target.value }))}
                    onBlur={flushDraftOnBlur}
                    className="mt-2 h-auto rounded-none border-0 bg-transparent px-0 py-0 text-3xl font-semibold tracking-normal shadow-none focus:ring-0"
                    placeholder="知识标题"
                  />
                )}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="secondary" onClick={() => openKnowledgeImport("url")} disabled={!spaces.length}>
                  <Globe2 className="h-4 w-4" />
                  知识发现
                </Button>
                <Button variant="secondary" onClick={() => openKnowledgeImport("files")} disabled={!spaces.length}>
                  <UploadCloud className="h-4 w-4" />
                  拖入归档
                </Button>
                <Button variant="secondary" onClick={() => openKnowledgeImport("directory")} disabled={!spaces.length}>
                  <FolderPlus className="h-4 w-4" />
                  目录导入
                </Button>
                {activeSpace ? <KnowledgeRetrievalTestDialog knowledgeSpaceId={activeSpace.id} knowledgeSpaceName={activeSpace.name} /> : null}
                <Button variant="secondary" onClick={() => void startNewEntry(draft.knowledgeSpaceId, draft.parentFolderId, "note")}>
                  <Plus className="h-4 w-4" />
                  新建
                </Button>
                <Button variant="ghost" onClick={deleteDraft} disabled={pending || isIndexReadOnly}>
                  <Trash2 className="h-4 w-4" />
                  删除
                </Button>
                <Button variant="secondary" onClick={toggleVersions} disabled={!draft.id || isIndexReadOnly}>
                  <History className="h-4 w-4" />
                  版本
                </Button>
                <Button variant="primary" onClick={saveDraft} disabled={pending || !spaces.length || isIndexReadOnly}>
                  <Save className="h-4 w-4" />
                  {pending ? "保存中" : "保存"}
                </Button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--ink-subtle)]">
                <Badge variant={draft.nodeType === "folder" ? "accent" : syncStatusVariant(draft.syncStatus)}>
                  {draft.nodeType === "folder" ? "目录" : syncStatusLabel(draft.syncStatus)}
                </Badge>
                {draft.nodeType !== "folder" ? (
                  <Badge variant={selectedLayerItem.editable ? "accent" : "neutral"}>
                    {selectedLayerItem.level} · {selectedLayerItem.editable ? "可编辑原文" : "只读索引"}
                  </Badge>
                ) : null}
                <Badge variant={saveStateVariant(saveState)}>{saveStateLabel(saveState)}</Badge>
                {draft.revision ? <span>R{draft.revision}</span> : null}
                <span>{contentSize}</span>
                {draft.updatedAt || draft.createdAt ? <span>{formatDateTime(draft.updatedAt || draft.createdAt)}</span> : <span>未保存</span>}
                {draft.updatedBy ? <span>{draft.updatedBy}</span> : null}
                {activeSpace ? (
                  <>
                    <span className="h-1 w-1 rounded-full bg-[var(--ink-subtle)]/40" />
                    <span>{typeLabel(activeSpace.spaceType)}</span>
                    <span>{visibilityLabel(activeSpace.visibility)}</span>
                  </>
                ) : null}
                {message ? <span className="text-[var(--accent-strong)]">{message}</span> : null}
              </div>
              <div className="flex items-center gap-2">
                {isIndexReadOnly ? null : <PaneModeControls />}
                <button
                  type="button"
                  disabled={isIndexReadOnly}
                  className="inline-flex h-8 items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
                  onClick={() => setPropertiesOpen((value) => !value)}
                >
                  {propertiesOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  属性
                </button>
              </div>
            </div>
            {saveError ? (
              <div className="mt-2 flex items-start gap-2 rounded-2xl border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-xs leading-5 text-[var(--warning)]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {saveError}
                  {conflictEntry ? ` 当前最新版本是 R${conflictEntry.revision}，保存于 ${formatDateTime(conflictEntry.updatedAt || conflictEntry.createdAt)}。` : ""}
                </span>
              </div>
            ) : null}
            {draft.syncError ? <div className="mt-2 text-xs text-[var(--warning)]">{draft.syncError}</div> : null}
            {draft.vikingUri ? <div className="mt-2 break-all font-mono text-[11px] text-[var(--ink-subtle)]">{draft.vikingUri}</div> : null}

            {draft.nodeType !== "folder" ? (
              <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[rgba(250,251,253,0.78)] px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                    <Search className="h-4 w-4 text-[var(--ink-subtle)]" />
                    OpenViking 多层查询路径
                  </div>
                  <span className="text-xs text-[var(--ink-subtle)]">索引展示只读，L2 原文可编辑</span>
                </div>
                <div className="mt-3 grid gap-2 xl:grid-cols-3">
                  {querySteps.map((step) => (
                    <button
                      key={step.level}
                      type="button"
                      onClick={() => {
                        const current = entriesState.find((entry) => entry.id === draft.id);
                        if (current) void selectEntryLayer(current, step.level);
                      }}
                      disabled={!draft.id}
                      className={cn(
                        "min-w-0 rounded-2xl border px-3 py-3 text-left transition-colors",
                        step.active
                          ? "border-[var(--accent)]/40 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
                          : "border-[var(--line)] bg-white/70 hover:bg-white",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={step.editable ? "accent" : "neutral"}>{step.level}</Badge>
                        <span className="text-[11px] font-medium text-[var(--ink-subtle)]">{step.editable ? "可编辑" : "只读索引"}</span>
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
                    最近 3 个历史版本
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => void loadVersions()} disabled={versionsLoading || !draft.id}>
                    刷新
                  </Button>
                </div>
                {versionsError ? <div className="mt-2 text-xs text-[var(--warning)]">{versionsError}</div> : null}
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {versionsLoading ? (
                    <div className="rounded-xl bg-white px-3 py-4 text-sm text-[var(--ink-subtle)]">读取历史版本中</div>
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
                          恢复
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl bg-white px-3 py-4 text-sm text-[var(--ink-subtle)]">暂无历史版本</div>
                  )}
                </div>
              </div>
            ) : null}

            {propertiesOpen && !isIndexReadOnly ? (
              <div className="mt-4 grid gap-3 rounded-2xl bg-[rgba(250,251,253,0.78)] p-3 md:grid-cols-2 xl:grid-cols-6">
                <FieldGroup label="知识空间">
                  <Select
                    value={draft.knowledgeSpaceId}
                    onBlur={flushDraftOnBlur}
                    onChange={(event) => {
                      updateDraft((current) => ({ ...current, knowledgeSpaceId: event.target.value, parentFolderId: null }));
                      setSelectedSpaceId(event.target.value);
                    }}
                  >
                    <option value="">未分配</option>
                    {spaces.map((space) => (
                      <option key={space.id} value={space.id}>{space.name}</option>
                    ))}
                  </Select>
                </FieldGroup>
                <FieldGroup label="类型">
                  <Select value={draft.nodeType} onBlur={flushDraftOnBlur} onChange={(event) => updateDraft((current) => ({ ...current, nodeType: event.target.value === "folder" ? "folder" : "note" }))}>
                    <option value="note">知识</option>
                    <option value="folder">目录</option>
                  </Select>
                </FieldGroup>
                <FieldGroup label="来源">
                  <Select value={draft.sourceType} onBlur={flushDraftOnBlur} onChange={(event) => updateDraft((current) => ({ ...current, sourceType: event.target.value }))}>
                    {sourceTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </Select>
                </FieldGroup>
                <FieldGroup label="Layer">
                  <Input value={draft.layer} onBlur={flushDraftOnBlur} onChange={(event) => updateDraft((current) => ({ ...current, layer: event.target.value }))} />
                </FieldGroup>
                <FieldGroup label="Scope">
                  <Input value={draft.scopeKey} onBlur={flushDraftOnBlur} onChange={(event) => updateDraft((current) => ({ ...current, scopeKey: event.target.value }))} />
                </FieldGroup>
                <FieldGroup label="Skill ID">
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
                        {selectedLayerItem.label}
                      </div>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">{selectedLayerItem.description}</p>
                    </div>
                    <Badge variant="neutral">只读索引</Badge>
                  </div>
                  <div className="mt-4 rounded-2xl bg-[rgba(15,23,42,0.035)] px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-subtle)]">OpenViking API</div>
                    <div className="mt-1 break-all font-mono text-xs text-[var(--ink-muted)]">{selectedLayerItem.uri}</div>
                  </div>
                  <div className="mt-5 whitespace-pre-wrap rounded-2xl border border-[var(--line)] bg-[rgba(255,255,255,0.78)] px-5 py-5 text-sm leading-7 text-[var(--ink)]">
                    {selectedLayerItem.preview || "索引内容等待 OpenViking 生成。"}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "grid min-h-0 flex-1",
                paneMode === "split" ? "lg:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.82fr)]" : "grid-cols-1",
              )}
            >
              <div
                className={cn(
                  "flex min-w-0 flex-col border-b border-[var(--line)]",
                  paneMode === "preview" && "hidden",
                  paneMode === "split" && "lg:border-b-0 lg:border-r",
                )}
              >
                <div className="flex h-11 items-center justify-between border-b border-[var(--line)] px-5">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                    <Edit3 className="h-4 w-4 text-[var(--ink-subtle)]" />
                    Markdown 编辑
                  </div>
                </div>
                <Textarea
                  value={draft.contentMd}
                  onChange={(event) => updateDraft((current) => ({ ...current, contentMd: event.target.value }))}
                  onBlur={flushDraftOnBlur}
                  onKeyDown={handleMarkdownKeyDown}
                  className="min-h-[620px] flex-1 resize-none rounded-none border-0 bg-transparent px-7 py-6 font-mono text-[14px] leading-8 shadow-none focus:ring-0"
                  placeholder={draft.nodeType === "folder" ? "目录说明..." : "开始编写知识..."}
                />
                <details className="border-t border-[var(--line)] px-5 py-4">
                  <summary className="cursor-pointer text-sm font-medium text-[var(--ink)]">元数据 JSON</summary>
                  <Textarea
                    value={draft.metadataJson}
                    onChange={(event) => updateDraft((current) => ({ ...current, metadataJson: event.target.value }))}
                    onBlur={flushDraftOnBlur}
                    className="mt-3 min-h-28 font-mono text-xs"
                  />
                </details>
              </div>

              <div
                className={cn(
                  "flex min-w-0 flex-col bg-[rgba(250,251,253,0.72)]",
                  paneMode === "editor" && "hidden",
                )}
              >
                <div className="flex h-11 items-center justify-between border-b border-[var(--line)] px-5">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                    <SplitSquareHorizontal className="h-4 w-4 text-[var(--ink-subtle)]" />
                    Markdown 预览
                  </div>
                  <Badge variant="neutral">Preview</Badge>
                </div>
                <div className="min-h-[620px] flex-1 overflow-auto">
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
