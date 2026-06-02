import fs from "node:fs";
import path from "node:path";
import { getKnowledgeBaseSettings } from "@/server/knowledge-base-settings";

type KnowledgeEngineProcessState = {
  status: "healthy" | "disabled";
  startedAt: string | null;
  baseUrl: string;
  binaryPath: string | null;
  configPath: string;
  lastError: string | null;
  logs: string[];
};

const globalState = globalThis as typeof globalThis & {
  __agentWorldKnowledgeEngine?: KnowledgeEngineProcessState;
};

function appendLog(state: KnowledgeEngineProcessState, message: string) {
  state.logs = [...state.logs.slice(-40), `${new Date().toISOString()} ${message}`];
}

function dataDir() {
  return path.resolve(/* turbopackIgnore: true */ getKnowledgeBaseSettings().storageWorkspace);
}

function initialState(): KnowledgeEngineProcessState {
  const setting = getKnowledgeBaseSettings();
  return {
    status: setting.enabled ? "healthy" : "disabled",
    startedAt: new Date().toISOString(),
    baseUrl: "local://agentworld-knowledge",
    binaryPath: null,
    configPath: dataDir(),
    lastError: null,
    logs: [],
  };
}

function state() {
  globalState.__agentWorldKnowledgeEngine ??= initialState();
  return globalState.__agentWorldKnowledgeEngine;
}

export function ensureKnowledgeEngineStorage() {
  const root = dataDir();
  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(path.join(root, "shadow"), { recursive: true });
  fs.mkdirSync(path.join(root, "packs"), { recursive: true });
  return { root };
}

export async function ensureKnowledgeEngineStarted(reason = "agentworld-startup") {
  const current = state();
  const setting = getKnowledgeBaseSettings();
  current.status = setting.enabled ? "healthy" : "disabled";
  current.startedAt ??= new Date().toISOString();
  current.baseUrl = "local://agentworld-knowledge";
  current.configPath = dataDir();
  current.binaryPath = null;
  current.lastError = null;
  if (setting.enabled) ensureKnowledgeEngineStorage();
  appendLog(current, `${current.status}: ${reason}`);
  return getKnowledgeEngineProcessStatus();
}

export function getKnowledgeEngineProcessStatus() {
  const current = state();
  return {
    status: current.status,
    startedAt: current.startedAt,
    baseUrl: current.baseUrl,
    binaryPath: current.binaryPath,
    configPath: current.configPath,
    pid: null,
    lastError: current.lastError,
    logs: current.logs.slice(-12),
  };
}
