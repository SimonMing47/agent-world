import { LegacyRouteRedirect } from "@/components/legacy-route-redirect";

export default function McpPage() {
  return <LegacyRouteRedirect href="/connectors#mcp-connectors" label="connector.mcp.title" />;
}
