import { NextResponse } from "next/server";
import { uiText } from "@/lib/language-pack";
import { filterByBusinessTeamAccess } from "@/server/auth-core";
import {
  apiAccessErrorResponse,
  assertBusinessTeamAccess,
  requireAuthenticatedActor,
  requireMcpServerActor,
} from "@/server/api-access-control";
import type { McpServerProfile } from "@/server/db";

export const dynamic = "force-dynamic";

type McpServerInput = Partial<McpServerProfile> & Pick<McpServerProfile, "name" | "transport">;

export async function GET(request: Request) {
  try {
    const access = await requireAuthenticatedActor(request, "mcp-server-console");
    const { listMcpServers } = await import("@/server/governance-core");
    const servers = filterByBusinessTeamAccess(
      listMcpServers(),
      access.authContext,
      (server) => server.businessTeamId,
      { allowGlobal: true },
    );
    return NextResponse.json({ servers });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    throw error;
  }
}

async function saveMcpServer(request: Request) {
  try {
    const access = await requireAuthenticatedActor(request, "mcp-server-console");
    const body = (await request.json()) as McpServerInput;
    const { listMcpServers, upsertMcpServer } = await import("@/server/governance-core");
    const current = body.id ? listMcpServers().find((server) => server.id === body.id) : null;
    if (current) {
      assertBusinessTeamAccess(access.authContext, current.businessTeamId);
    }
    const targetBusinessTeamId =
      body.businessTeamId === undefined ? current?.businessTeamId ?? null : body.businessTeamId;
    assertBusinessTeamAccess(access.authContext, targetBusinessTeamId);
    const server = upsertMcpServer(body);
    return NextResponse.json({ ok: true, server });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error
          ? error.message
          : uiText("ui.api.errors.saveMcpServerFailed", "Failed to save MCP server."),
      },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  return saveMcpServer(request);
}

export async function PATCH(request: Request) {
  return saveMcpServer(request);
}

export async function DELETE(request: Request) {
  try {
    await requireAuthenticatedActor(request, "mcp-server-console");
    const body = (await request.json()) as { id: string };
    await requireMcpServerActor(request, body.id, "mcp-server-console");
    const { deleteManagedResource } = await import("@/server/governance-core");
    deleteManagedResource({ type: "mcp-server", id: body.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const accessError = apiAccessErrorResponse(error);
    if (accessError) return accessError;
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error
          ? error.message
          : uiText("ui.api.errors.saveMcpServerFailed", "Failed to save MCP server."),
      },
      { status: 400 },
    );
  }
}
