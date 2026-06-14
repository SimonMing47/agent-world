import { NextResponse } from "next/server";
import { createLanguagePackTemplate } from "@/lib/language-pack";
import { apiAccessErrorResponse, requireSystemAdminActor } from "@/server/api-access-control";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireSystemAdminActor(request, "language-pack-settings");
    const body = `${JSON.stringify(createLanguagePackTemplate(), null, 2)}\n`;

    return new NextResponse(body, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": 'attachment; filename="agentworld-language-template.json"',
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    const accessErrorResponse = apiAccessErrorResponse(error);
    if (accessErrorResponse) return accessErrorResponse;
    throw error;
  }
}
