import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
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
import { getSettingsSnapshot } from "@/server/queries";

const systemEntries = [
  {
    name: "AI Provider",
    href: "/runtimes",
    scope: "模型接口",
    description: "Base URL、模型、密钥引用和模型能力配置。",
  },
  {
    name: "Skill",
    href: "/skills",
    scope: "运行能力",
    description: "可被 Agent 在任务运行时引用的团队能力，内容存储到 OpenViking。",
  },
  {
    name: "MCP",
    href: "/mcp",
    scope: "工具服务",
    description: "MCP Server、传输方式、鉴权引用和工具白名单。",
  },
  {
    name: "Connector",
    href: "/connectors",
    scope: "外部通道",
    description: "IM、邮件、Web Push 和任务输出发布通道。",
  },
  {
    name: "Codebase",
    href: "/codebases",
    scope: "代码资产",
    description: "代码仓地址、归属团队和多个操作者 token。",
  },
  {
    name: "知识库",
    href: "/knowledge",
    scope: "OpenViking",
    description: "团队、项目和 AgentTeam 级知识空间。",
  },
  {
    name: "执行策略",
    href: "/execution-policies",
    scope: "权限与审批",
    description: "工具权限、预算、审批和输出约束。",
  },
  {
    name: "租户空间",
    href: "/tenant-spaces",
    scope: "系统边界",
    description: "租户配额、白名单和全局 Guardrail。",
  },
];

export default function SettingsPage() {
  const snapshot = getSettingsSnapshot();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="系统配置"
        description="这里仅保留系统级配置入口。具体配置进入对应模块，以表格和弹窗维护，避免在一个页面堆叠所有配置。"
        badges={[
          { label: `${snapshot.providers.length} 个 Provider`, variant: "accent" },
          { label: `${snapshot.environments.length} 个执行环境`, variant: "neutral" },
        ]}
      />

      <SummaryStrip
        items={[
          { label: "Provider", value: snapshot.providers.length, detail: "模型接口" },
          { label: "执行环境", value: snapshot.environments.length, detail: "任务运行对象" },
          { label: "Webhook", value: snapshot.webhooks.length, detail: "外部触发入口" },
          { label: "任务定义", value: snapshot.taskBlueprints.length, detail: "归属业务团队" },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="System Modules"
          title="配置模块"
          description="基础配置、团队治理和智能体治理各自独立维护；系统配置页只做清晰入口。"
        />
        <PanelBody className="p-0">
          <DataTable>
            <DataTableHeader>
              <DataTableRow className="hover:bg-transparent">
                <DataTableHead>模块</DataTableHead>
                <DataTableHead>范围</DataTableHead>
                <DataTableHead>说明</DataTableHead>
                <DataTableHead align="right">操作</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {systemEntries.map((entry) => (
                <DataTableRow key={entry.href}>
                  <DataTableCell className="font-semibold text-[var(--ink)]">{entry.name}</DataTableCell>
                  <DataTableCell>{entry.scope}</DataTableCell>
                  <DataTableCell>{entry.description}</DataTableCell>
                  <DataTableCell align="right">
                    <Button asChild size="sm" variant="ghost">
                      <Link href={entry.href}>打开</Link>
                    </Button>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </PanelBody>
      </Panel>
    </div>
  );
}
