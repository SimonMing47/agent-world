import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { SummaryStrip } from "@/components/ui/summary-strip";
import { translateStatus, translateVisibility } from "@/lib/presentation";
import { getTaskBlueprintsSnapshot } from "@/server/queries";

function triggerLabel(trigger: Record<string, unknown>) {
  if (trigger.type === "webhook") return `Webhook · ${String(trigger.event ?? trigger.webhookPathKey ?? "")}`;
  if (trigger.type === "cron") return `Cron · ${String(trigger.expression ?? "")}`;
  return String(trigger.type ?? "manual");
}

export default function TaskBlueprintsPage() {
  const snapshot = getTaskBlueprintsSnapshot();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Blueprints"
        title="任务蓝图目录"
        description="统一管理任务蓝图的触发器、环境、Agent 团队和输出策略。"
        badges={[
          { label: `${snapshot.blueprints.length} 个蓝图`, variant: "accent" },
          { label: `${snapshot.providerAdapters.length} 个 Provider Adapter`, variant: "neutral" },
        ]}
      />

      <SummaryStrip
        items={[
          {
            label: "任务蓝图",
            value: snapshot.blueprints.length,
            detail: "所有可配置任务模板",
          },
          {
            label: "Finding 总数",
            value: snapshot.findingDashboard.total,
            detail: "蓝图相关运行累计产出",
          },
          {
            label: "高危及以上",
            value: snapshot.findingDashboard.bySeverity
              .filter((item) => ["critical", "high"].includes(item.severity))
              .reduce((sum, item) => sum + item.count, 0),
            detail: "critical + high",
          },
          {
            label: "Provider Adapter",
            value: snapshot.providerAdapters.length,
            detail: "当前已注册执行适配器",
          },
        ]}
      />

      <section className="grid gap-4 2xl:grid-cols-[1.45fr_0.55fr]">
        <Panel>
          <PanelHeader
            eyebrow="Catalog"
            title="蓝图清单"
            description="按业务团队、触发方式、Provider 和风险产出查看每个蓝图。"
          />
          <PanelBody className="p-0">
            <DataTable>
              <DataTableHeader>
                <DataTableRow className="hover:bg-transparent">
                  <DataTableHead>蓝图</DataTableHead>
                  <DataTableHead>团队 / 可见性</DataTableHead>
                  <DataTableHead>触发器</DataTableHead>
                  <DataTableHead>Provider</DataTableHead>
                  <DataTableHead align="right">运行数</DataTableHead>
                  <DataTableHead align="right">Finding</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {snapshot.blueprints.map((blueprint) => (
                  <DataTableRow key={blueprint.id}>
                    <DataTableCell className="min-w-[260px]">
                      <Link
                        href={`/task-blueprints/${blueprint.id}`}
                        className="font-medium text-[var(--ink)] hover:underline"
                      >
                        {blueprint.name}
                      </Link>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="neutral">{blueprint.category}</Badge>
                        <Badge variant="neutral">v{blueprint.version}</Badge>
                        <Badge variant={blueprint.status === "active" ? "success" : "neutral"}>
                          {translateStatus(blueprint.status)}
                        </Badge>
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <div className="font-medium text-[var(--ink)]">{blueprint.businessTeamName}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">
                        {blueprint.agentTeamName} · {translateVisibility(blueprint.visibility)}
                      </div>
                    </DataTableCell>
                    <DataTableCell>{triggerLabel(blueprint.trigger)}</DataTableCell>
                    <DataTableCell>{blueprint.providerName}</DataTableCell>
                    <DataTableCell align="right">{blueprint.runCount}</DataTableCell>
                    <DataTableCell align="right">
                      <div className="font-medium text-[var(--ink)]">{blueprint.findingCount}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">
                        高危 {blueprint.criticalOrHighFindingCount}
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="Adapters"
            title="Provider Adapter 注册表"
            description="蓝图调度时真正使用的执行适配器能力声明。"
          />
          <PanelBody className="p-0">
            <DataTable>
              <DataTableHeader>
                <DataTableRow className="hover:bg-transparent">
                  <DataTableHead>适配器</DataTableHead>
                  <DataTableHead>生命周期</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {snapshot.providerAdapters.map((adapter) => (
                  <DataTableRow key={adapter.id}>
                    <DataTableCell className="min-w-[180px]">
                      <div className="font-medium text-[var(--ink)]">{adapter.name}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{adapter.id}</div>
                    </DataTableCell>
                    <DataTableCell>
                      <Badge variant={adapter.lifecycle === "ga" ? "success" : "neutral"}>
                        {adapter.lifecycle}
                      </Badge>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </PanelBody>
        </Panel>
      </section>
    </div>
  );
}
