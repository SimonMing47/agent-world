import { FindingFeedbackForm } from "@/components/finding-feedback-form";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { uiText } from "@/lib/language-pack";
import { getFindingFeedbackContext } from "@/server/finding-feedback-core";

export const dynamic = "force-dynamic";

function parseEvidenceLocation(evidence: Record<string, unknown>) {
  return [
    typeof evidence.file_path === "string" ? evidence.file_path : null,
    typeof evidence.line_start === "number" ? `L${evidence.line_start}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export default async function FindingFeedbackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolved = await params;
  const token = decodeURIComponent(resolved.token);
  const context = getFindingFeedbackContext(token);

  if (!context) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-5 py-10">
        <Panel className="w-full rounded-lg">
          <PanelHeader
            title="findingFeedback.page.invalidTitle"
            description="findingFeedback.page.invalidDescription"
          />
        </Panel>
      </main>
    );
  }

  const location = parseEvidenceLocation(context.evidence);
  const defaultVerdict =
    context.existingFeedback?.verdict === "accurate" ||
    context.existingFeedback?.verdict === "inaccurate" ||
    context.existingFeedback?.verdict === "unclear"
      ? context.existingFeedback.verdict
      : "unclear";

  return (
    <main className="min-h-screen bg-[var(--canvas)] px-5 py-8 sm:py-12">
      <div className="mx-auto max-w-4xl space-y-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-subtle)]">
            {uiText("findingFeedback.page.eyebrow")}
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink)]">
            {uiText("findingFeedback.page.title")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
            {uiText("findingFeedback.page.description")}
          </p>
        </div>

        <Panel className="rounded-lg">
          <PanelHeader
            title={context.finding.title}
            description={
              <span>
                {uiText("findingFeedback.page.taskRun", undefined, { taskRunId: context.taskRun.id })}
                {location ? ` · ${location}` : ""}
              </span>
            }
            action={<Badge variant="warning">{context.finding.severity}</Badge>}
          />
          <PanelBody className="space-y-5">
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-[var(--ink)]">
                {uiText("findingFeedback.page.findingDescription")}
              </h2>
              <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--ink-muted)]">
                {context.finding.description}
              </p>
            </section>
            {context.finding.recommendation ? (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-[var(--ink)]">
                  {uiText("findingFeedback.page.recommendation")}
                </h2>
                <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--ink-muted)]">
                  {context.finding.recommendation}
                </p>
              </section>
            ) : null}
            <FindingFeedbackForm
              token={context.token}
              defaultVerdict={defaultVerdict}
              defaultNote={context.existingFeedback?.note ?? ""}
            />
          </PanelBody>
        </Panel>
      </div>
    </main>
  );
}
