export const openAiFunctionNamePattern = /^[a-zA-Z0-9_-]+$/;

export const workspaceToolNames = {
  searchRepo: "search_repo",
  readFile: "read_file",
  listDir: "list_dir",
  memorySearch: "memory_search",
  memoryRetrieve: "memory_retrieve",
  memoryRead: "memory_read",
} as const;

const workspaceToolNameAliases: Record<string, string> = {
  [workspaceToolNames.memorySearch]: "memory.search",
  [workspaceToolNames.memoryRetrieve]: "memory.retrieve",
  [workspaceToolNames.memoryRead]: "memory.read",
};

export function canonicalWorkspaceToolName(toolName: string) {
  return workspaceToolNameAliases[toolName] ?? toolName;
}

export function resolveWorkspaceToolPolicyNames(toolName: string) {
  const canonical = canonicalWorkspaceToolName(toolName);
  return canonical === toolName ? [toolName] : [toolName, canonical];
}
