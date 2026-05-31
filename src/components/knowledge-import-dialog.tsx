"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { Archive, FileText, Globe2, Loader2, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/form-field";
import { useLanguageText } from "@/components/language-pack-provider";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatBytes } from "@/lib/utils";

export type KnowledgeImportEntry = {
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

export type KnowledgeImportSpaceOption = {
  id: string;
  name: string;
};

export type KnowledgeImportFolderOption = {
  id: string;
  title: string;
  knowledgeSpaceId: string | null;
  depth: number;
};

export type KnowledgeImportMode = "url" | "files" | "directory";

export type KnowledgeImportFileSource = {
  file: File;
  relativePath?: string;
};

type FileImportItem = {
  id: string;
  name: string;
  relativePath: string;
  type: string;
  size: number;
  content: string;
  truncated: boolean;
  error: string | null;
};

type ImportResult = {
  ok?: boolean;
  error?: string;
  entries?: KnowledgeImportEntry[];
};

const maxClientFileChars = 900_000;
type TranslateText = ReturnType<typeof useLanguageText>;

type WebkitFileSystemEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
};

type WebkitFileSystemFileEntry = WebkitFileSystemEntry & {
  file: (success: (file: File) => void, error?: (error: DOMException) => void) => void;
};

type WebkitFileSystemDirectoryEntry = WebkitFileSystemEntry & {
  createReader: () => {
    readEntries: (success: (entries: WebkitFileSystemEntry[]) => void, error?: (error: DOMException) => void) => void;
  };
};

type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => unknown;
};

function splitUrls(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function fileKey(file: File, index: number) {
  return `${file.name}:${file.size}:${file.lastModified}:${index}`;
}

function fileRelativePath(source: KnowledgeImportFileSource, fallbackName = "ui.knowledgeImport.defaults.droppedKnowledge") {
  const browserPath = (source.file as File & { webkitRelativePath?: string }).webkitRelativePath;
  return (source.relativePath || browserPath || source.file.name || fallbackName).replace(/\\/g, "/").replace(/^\/+/, "");
}

function fileNameFromPath(path: string, fallback: string) {
  return path.split("/").filter(Boolean).pop() || fallback || "ui.knowledgeImport.defaults.droppedKnowledge";
}

function fileListSources(files: File[]) {
  return files.map((file) => ({
    file,
    relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
  }));
}

function isDirectoryLike(sources: KnowledgeImportFileSource[]) {
  return sources.some((source) => fileRelativePath(source).includes("/"));
}

function readEntryFile(entry: WebkitFileSystemFileEntry, relativePath: string) {
  return new Promise<KnowledgeImportFileSource>((resolve, reject) => {
    entry.file(
      (file) => resolve({ file, relativePath }),
      (error) => reject(error),
    );
  });
}

function readDirectoryBatch(directory: WebkitFileSystemDirectoryEntry) {
  const reader = directory.createReader();
  const entries: WebkitFileSystemEntry[] = [];
  return new Promise<WebkitFileSystemEntry[]>((resolve, reject) => {
    const readNext = () => {
      reader.readEntries(
        (batch) => {
          if (!batch.length) {
            resolve(entries);
            return;
          }
          entries.push(...batch);
          readNext();
        },
        (error) => reject(error),
      );
    };
    readNext();
  });
}

async function traverseEntry(entry: WebkitFileSystemEntry, parentPath = ""): Promise<KnowledgeImportFileSource[]> {
  const nextPath = [parentPath, entry.name].filter(Boolean).join("/");
  if (entry.isFile) return [await readEntryFile(entry as WebkitFileSystemFileEntry, nextPath)];
  if (!entry.isDirectory) return [];

  const children = await readDirectoryBatch(entry as WebkitFileSystemDirectoryEntry);
  const nested = await Promise.all(children.map((child) => traverseEntry(child, nextPath)));
  return nested.flat();
}

export async function knowledgeImportFilesFromDataTransfer(dataTransfer: DataTransfer) {
  const items = Array.from(dataTransfer.items ?? []);
  const entries: WebkitFileSystemEntry[] = [];
  for (const item of items) {
    const entry = item.kind === "file" ? (item as DataTransferItemWithEntry).webkitGetAsEntry?.() : null;
    if (entry && typeof entry === "object") entries.push(entry as WebkitFileSystemEntry);
  }

  if (entries.length) {
    const nested = await Promise.all(entries.map((entry) => traverseEntry(entry)));
    return nested.flat();
  }

  return fileListSources(Array.from(dataTransfer.files ?? []));
}

async function readFileItem(source: KnowledgeImportFileSource, index: number, text: TranslateText): Promise<FileImportItem> {
  const fallbackName = text("ui.knowledgeImport.defaults.droppedKnowledge");
  const relativePath = fileRelativePath(source, fallbackName);
  const name = fileNameFromPath(relativePath, source.file.name);
  try {
    const content = await source.file.text();
    return {
      id: fileKey(source.file, index),
      name,
      relativePath,
      type: source.file.type || "text/plain",
      size: source.file.size,
      content: content.slice(0, maxClientFileChars),
      truncated: content.length > maxClientFileChars,
      error: null,
    };
  } catch (error) {
    return {
      id: fileKey(source.file, index),
      name,
      relativePath,
      type: source.file.type || "unknown",
      size: source.file.size,
      content: "",
      truncated: false,
      error: error instanceof Error ? error.message : text("ui.knowledgeImport.errors.fileReadFailed"),
    };
  }
}

export function KnowledgeImportDialog({
  open,
  mode,
  files,
  spaces,
  folders,
  defaultSpaceId,
  defaultParentFolderId,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  mode: KnowledgeImportMode;
  files: KnowledgeImportFileSource[];
  spaces: KnowledgeImportSpaceOption[];
  folders: KnowledgeImportFolderOption[];
  defaultSpaceId: string;
  defaultParentFolderId: string | null;
  onOpenChange: (open: boolean) => void;
  onImported: (entries: KnowledgeImportEntry[]) => void;
}) {
  const text = useLanguageText();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const [activeMode, setActiveMode] = useState<KnowledgeImportMode>(mode);
  const [spaceId, setSpaceId] = useState(defaultSpaceId);
  const [parentFolderId, setParentFolderId] = useState(defaultParentFolderId ?? "");
  const [urlText, setUrlText] = useState("");
  const [fileItems, setFileItems] = useState<FileImportItem[]>([]);
  const [readingFiles, setReadingFiles] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const folderOptions = useMemo(
    () => folders.filter((folder) => folder.knowledgeSpaceId === spaceId),
    [folders, spaceId],
  );

  useEffect(() => {
    directoryInputRef.current?.setAttribute("webkitdirectory", "");
    directoryInputRef.current?.setAttribute("directory", "");
  }, []);

  useEffect(() => {
    if (!open) return;
    setActiveMode(mode);
    setSpaceId(defaultSpaceId || spaces[0]?.id || "");
    setParentFolderId(defaultParentFolderId ?? "");
    setUrlText("");
    setFileItems([]);
    setError(null);
  }, [defaultParentFolderId, defaultSpaceId, mode, open, spaces]);

  useEffect(() => {
    if (!open || !files.length) return;
    setActiveMode(isDirectoryLike(files) ? "directory" : "files");
    setReadingFiles(true);
    void Promise.all(files.map((file, index) => readFileItem(file, index, text))).then((items) => {
      setFileItems(items);
      setReadingFiles(false);
    });
  }, [files, open, text]);

  useEffect(() => {
    if (!parentFolderId) return;
    if (!folderOptions.some((folder) => folder.id === parentFolderId)) setParentFolderId("");
  }, [folderOptions, parentFolderId]);

  function selectFiles(nextFiles: KnowledgeImportFileSource[], nextMode?: KnowledgeImportMode) {
    if (!nextFiles.length) return;
    setActiveMode(nextMode ?? (isDirectoryLike(nextFiles) ? "directory" : "files"));
    setError(null);
    setReadingFiles(true);
    void Promise.all(nextFiles.map((file, index) => readFileItem(file, index, text))).then((items) => {
      setFileItems(items);
      setReadingFiles(false);
    });
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    selectFiles(fileListSources(Array.from(event.target.files ?? [])), "files");
    event.target.value = "";
  }

  function handleDirectoryInput(event: ChangeEvent<HTMLInputElement>) {
    selectFiles(fileListSources(Array.from(event.target.files ?? [])), "directory");
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setReadingFiles(true);
    void knowledgeImportFilesFromDataTransfer(event.dataTransfer)
      .then((sources) => {
        if (sources.length) selectFiles(sources, isDirectoryLike(sources) ? "directory" : activeMode);
        else setReadingFiles(false);
      })
      .catch((dropError) => {
        setReadingFiles(false);
        setError(dropError instanceof Error ? dropError.message : text("ui.knowledgeImport.errors.directoryReadFailed"));
      });
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  async function submit() {
    if (!spaceId) {
      setError(text("ui.knowledgeImport.errors.spaceRequired"));
      return;
    }
    const urls = splitUrls(urlText);
    const usableFiles = fileItems.filter((file) => file.content && !file.error);
    if (activeMode === "url" && !urls.length) {
      setError(text("ui.knowledgeImport.errors.urlRequired"));
      return;
    }
    if ((activeMode === "files" || activeMode === "directory") && !usableFiles.length) {
      setError(text(activeMode === "directory" ? "ui.knowledgeImport.errors.directoryRequired" : "ui.knowledgeImport.errors.fileRequired"));
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/knowledge/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          knowledgeSpaceId: spaceId,
          parentFolderId: parentFolderId || null,
          importMode: activeMode,
          preserveTree: activeMode === "directory",
          urls: activeMode === "url" ? urls : [],
          files: activeMode !== "url"
            ? usableFiles.map((file) => ({
                name: file.name,
                relativePath: file.relativePath,
                type: file.type,
                size: file.size,
                content: file.content,
              }))
            : [],
        }),
      });
      const result = (await response.json().catch(() => ({}))) as ImportResult;
      if (!response.ok || result.ok === false || !result.entries?.length) {
        throw new Error(result.error ?? text("ui.knowledgeImport.errors.importFailed"));
      }
      onImported(result.entries);
      onOpenChange(false);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : text("ui.knowledgeImport.errors.importFailed"));
    } finally {
      setPending(false);
    }
  }

  const selectedSpace = spaces.find((space) => space.id === spaceId);
  const submitText = text(
    activeMode === "url"
      ? "knowledge.import.actions.discover"
      : activeMode === "directory"
        ? "knowledge.import.actions.importDirectory"
        : "knowledge.import.actions.archive",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(94vw,780px)] rounded-[24px]">
        <DialogHeader className="px-5 py-4">
          <DialogTitle>{text("knowledge.import.dialog.title")}</DialogTitle>
          <DialogDescription>
            {text("knowledge.import.dialog.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5 px-5 py-4">
          <div className="inline-flex rounded-full border border-[var(--line)] bg-[rgba(250,251,253,0.9)] p-1">
            {[
              { value: "url" as const, label: "knowledge.import.modes.url", icon: Globe2 },
              { value: "files" as const, label: "knowledge.import.modes.files", icon: FileText },
              { value: "directory" as const, label: "knowledge.import.modes.directory", icon: Archive },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setActiveMode(item.value)}
                  className={cn(
                    "inline-flex h-8 items-center gap-2 rounded-full px-3 text-xs font-semibold transition-colors",
                    activeMode === item.value
                      ? "bg-white text-[var(--ink)] shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
                      : "text-[var(--ink-subtle)] hover:text-[var(--ink)]",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {text(item.label)}
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <FieldGroup label="knowledge.import.fields.space">
              <Select value={spaceId} onChange={(event) => setSpaceId(event.target.value)}>
                {spaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))}
              </Select>
            </FieldGroup>
            <FieldGroup
              label="knowledge.import.fields.location"
              hint={selectedSpace ? text("knowledge.import.fields.locationHint", undefined, { name: selectedSpace.name }) : undefined}
            >
              <Select value={parentFolderId} onChange={(event) => setParentFolderId(event.target.value)}>
                <option value="">{text("knowledge.import.fields.rootFolder")}</option>
                {folderOptions.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {"　".repeat(Math.max(0, folder.depth))}
                    {folder.title}
                  </option>
                ))}
              </Select>
            </FieldGroup>
          </div>

          {activeMode === "url" ? (
            <FieldGroup label="knowledge.import.fields.url" hint="knowledge.import.fields.urlHint">
              <Textarea
                value={urlText}
                onChange={(event) => setUrlText(event.target.value)}
                className="min-h-36 font-mono text-sm"
                placeholder="https://example.com/article"
              />
            </FieldGroup>
          ) : (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="rounded-[22px] border border-dashed border-[var(--line)] bg-[rgba(250,251,253,0.78)] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[var(--accent-strong)] shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
                    <Archive className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--ink)]">
                      {text(activeMode === "directory" ? "knowledge.import.drop.directoryTitle" : "knowledge.import.drop.filesTitle")}
                    </div>
                    <div className="mt-1 text-xs text-[var(--ink-subtle)]">
                      {text(activeMode === "directory" ? "knowledge.import.drop.directoryDescription" : "knowledge.import.drop.filesDescription")}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                    <UploadCloud className="h-4 w-4" />
                    {text("knowledge.import.actions.chooseFiles")}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => directoryInputRef.current?.click()}>
                    <Archive className="h-4 w-4" />
                    {text("knowledge.import.actions.chooseDirectory")}
                  </Button>
                </div>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInput} />
                <input ref={directoryInputRef} type="file" multiple className="hidden" onChange={handleDirectoryInput} />
              </div>

              <div className="mt-4 max-h-64 space-y-2 overflow-auto pr-1">
                {readingFiles ? (
                  <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-3 text-sm text-[var(--ink-subtle)]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {text("knowledge.import.states.readingFiles")}
                  </div>
                ) : fileItems.length ? (
                  fileItems.map((file) => (
                    <div key={file.id} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-3 ring-1 ring-black/4">
                      <FileText className="h-4 w-4 shrink-0 text-[var(--ink-subtle)]" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-[var(--ink)]">{file.name}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--ink-subtle)]">
                          {file.relativePath !== file.name ? <span className="max-w-[320px] truncate font-mono">{file.relativePath}</span> : null}
                          <span>{file.type || "text/plain"}</span>
                          <span>{formatBytes(file.size)}</span>
                          {file.truncated ? <Badge variant="warning">{text("knowledge.import.states.truncated")}</Badge> : null}
                          {file.error ? <span className="text-[var(--danger)]">{file.error}</span> : null}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl bg-white/70 px-3 py-6 text-center text-sm text-[var(--ink-subtle)]">
                    {text(activeMode === "directory" ? "knowledge.import.empty.directory" : "knowledge.import.empty.files")}
                  </div>
                )}
              </div>
            </div>
          )}

          {error ? (
            <div className="rounded-2xl border border-[#fecdd3] bg-[#fff1f3] px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
              {text("actions.cancel")}
            </Button>
            <Button type="button" variant="primary" onClick={() => void submit()} disabled={pending || readingFiles || !spaces.length}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : activeMode === "url" ? <Globe2 className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              {pending ? text("knowledge.import.states.processing") : submitText}
            </Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
