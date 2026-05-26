import { NextResponse } from "next/server";
import { createLanguagePackTemplate } from "@/lib/language-pack";

export const dynamic = "force-dynamic";

export function GET() {
  const body = `${JSON.stringify(createLanguagePackTemplate(), null, 2)}\n`;

  return new NextResponse(body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": 'attachment; filename="agentworld-language-template.json"',
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
