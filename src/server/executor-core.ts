import { type QuestNode } from "@/server/db";

export function buildExecutionBoard(nodes: QuestNode[]) {
  return {
    ready: nodes.filter((node) => node.status === "ready"),
    running: nodes.filter((node) => node.status === "running"),
    awaiting: nodes.filter((node) => node.status === "awaiting"),
    completed: nodes.filter((node) => node.status === "completed"),
    failed: nodes.filter((node) => node.status === "failed"),
  };
}

export function summarizeNodeState(node: QuestNode) {
  return {
    id: node.id,
    nodeKey: node.nodeKey,
    status: node.status,
    attemptLabel: `${node.attemptCount}/${node.maxAttempts}`,
    dependencyCount: JSON.parse(node.dependsOnJson).length as number,
  };
}
