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
    name: "模型服务",
    href: "/runtimes",
    group: "常用基础配置",
    scope: "模型服务",
    description: "Base URL、模型、密钥引用和能力参数配置。",
  },
  {
    name: "Skill",
    href: "/skills",
    group: "常用基础配置",
    scope: "运行能力",
    description: "可被 Agent 在任务运行时引用的团队能力，内容存储到 OpenViking。",
  },
  {
    name: "MCP",
    href: "/mcp",
    group: "常用基础配置",
    scope: "工具服务",
    description: "MCP Server、传输方式、鉴权引用和工具白名单。",
  },
  {
    name: "Connector",
    href: "/connectors",
    group: "常用基础配置",
    scope: "外部通道",
    description: "IM、邮件、Web Push 和任务输出发布通道。",
  },
  {
    name: "Codebase",
    href: "/codebases",
    group: "常用基础配置",
    scope: "代码资产",
    description: "代码仓地址、归属团队和多个操作者 token。",
  },
  {
    name: "知识库",
    href: "/knowledge",
    group: "常用基础配置",
    scope: "OpenViking",
    description: "团队、项目和 Agent 团队级知识空间。",
  },
  {
    name: "执行配置",
    href: "/runtime-bindings",
    group: "系统运行配置",
    scope: "模型执行",
    description: "默认模型服务、服务地址、密钥引用、审批模式和附加参数。",
  },
  {
    name: "执行环境",
    href: "/environments",
    group: "系统运行配置",
    scope: "任务运行对象",
    description: "代码仓、执行人、私钥引用、运行路径、沙箱和记忆依赖。",
  },
  {
    name: "Webhook",
    href: "/webhooks",
    group: "系统运行配置",
    scope: "外部触发入口",
    description: "Webhook 路径、签名密钥引用、请求 Schema 和接收 Agent 团队。",
  },
  {
    name: "执行策略",
    href: "/execution-policies",
    group: "系统运行配置",
    scope: "权限与审批",
    description: "工具权限、预算、审批和输出约束。",
  },
  {
    name: "租户空间",
    href: "/tenant-spaces",
    group: "系统运行配置",
    scope: "系统边界",
    description: "租户配额、白名单和全局 Guardrail。",
  },
  {
    name: "服务目录",
    href: "/service-catalog",
    group: "系统运行配置",
    scope: "跨团队能力",
    description: "团队之间复用 Agent 能力时的服务目录。",
  },
  {
    name: "跨团队授权",
    href: "/access-grants",
    group: "系统运行配置",
    scope: "授权关系",
    description: "业务团队之间调用 Agent 服务的授权、SLA 和范围约束。",
  },
];

const systemEntryGroups = ["常用基础配置", "系统运行配置"] as const;

export default function SettingsPage() {
  const snapshot = getSettingsSnapshot();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="系统配置"
        title="系统配置"
        description="左侧只放高频治理入口；执行配置、执行环境、Webhook、租户、策略和服务目录等长尾系统项在这里统一进入。"
        badges={[
          { label: `${snapshot.providers.length} 个模型服务`, variant: "accent" },
          { label: `${snapshot.environments.length} 个执行环境`, variant: "neutral" },
        ]}
      />

      <SummaryStrip
        items={[
          { label: "模型服务", value: snapshot.providers.length, detail: "可用模型服务" },
          { label: "执行环境", value: snapshot.environments.length, detail: "任务运行对象" },
          { label: "Webhook", value: snapshot.webhooks.length, detail: "外部触发入口" },
          { label: "任务定义", value: snapshot.taskBlueprints.length, detail: "归属业务团队" },
        ]}
      />

      {systemEntryGroups.map((group) => (
        <Panel key={group}>
          <PanelHeader
            eyebrow="系统模块"
            title={group}
            description={group === "常用基础配置" ? "这些模块也保留在侧边栏，便于日常治理。" : "这些模块不占用侧边栏，用于系统运行和长尾配置治理。"}
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
                {systemEntries.filter((entry) => entry.group === group).map((entry) => (
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
      ))}
    </div>
  );
}
