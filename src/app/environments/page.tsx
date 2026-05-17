import { Eye, PencilLine, Plus } from "lucide-react";
import { DeleteResourceButton } from "@/components/delete-resource-button";
import { ExecutionEnvironmentForm } from "@/components/execution-environment-form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import { DefinitionList } from "@/components/ui/definition-list";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { SummaryStrip } from "@/components/ui/summary-strip";
import { listBusinessTeams, listExecutionEnvironments } from "@/server/queries";

function defaultEnvironment(businessTeamId: string) {
  return {
    id: "",
    businessTeamId,
    name: "新增执行环境",
    repositoryProvider: "git",
    repositoryName: "repository-name",
    repositoryUrl: "git@example.com:team/repository.git",
    defaultBranch: "main",
    executorRef: "repo-executor",
    privateKeyRef: "secret:repo_executor_key",
    workingDirectory: ".",
    sandboxProfileJson: "{}",
    memoryLayerRefsJson: "[]",
    visibility: "team",
    status: "active",
  };
}

export default function EnvironmentsPage() {
  const environments = listExecutionEnvironments();
  const businessTeams = listBusinessTeams();
  const businessTeamOptions = businessTeams.map((team) => ({ id: team.id, name: team.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Environment"
        title="执行环境管理"
        description="执行环境是任务运行对象，配置代码仓、执行人、私钥引用、运行路径、沙箱和记忆依赖。"
        badges={[
          { label: `${environments.length} 个执行环境`, variant: "accent" },
          { label: `启用 ${environments.filter((environment) => environment.status === "active").length}`, variant: "success" },
        ]}
      />

      <SummaryStrip
        items={[
          { label: "执行环境", value: environments.length, detail: "可被任务定义选择" },
          { label: "代码平台", value: new Set(environments.map((item) => item.repositoryProvider)).size, detail: "Git / CodeHub / GitLab 等" },
          { label: "团队范围", value: new Set(environments.map((item) => item.businessTeamId)).size, detail: "按业务团队隔离" },
          { label: "启用", value: environments.filter((item) => item.status === "active").length, detail: "运行时可选" },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="Catalog"
          title="执行环境目录"
          description="环境配置必须可新增、查看、编辑和删除；PRIVATE_KEY 只保存 Secret 引用，不保存明文。"
          action={
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary">
                  <Plus className="h-4 w-4" />
                  新增环境
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[min(96vw,980px)]">
                <DialogHeader>
                  <DialogTitle>新增执行环境</DialogTitle>
                  <DialogDescription>配置任务运行时要使用的代码仓、执行人和工作目录。</DialogDescription>
                </DialogHeader>
                <DialogBody>
                  <ExecutionEnvironmentForm
                    embedded
                    title="新增执行环境"
                    businessTeamOptions={businessTeamOptions}
                    environment={defaultEnvironment(businessTeams[0]?.id ?? "")}
                  />
                </DialogBody>
              </DialogContent>
            </Dialog>
          }
        />
        <PanelBody className="p-0">
          <DataTable>
            <DataTableHeader>
              <DataTableRow className="hover:bg-transparent">
                <DataTableHead>环境</DataTableHead>
                <DataTableHead>业务团队</DataTableHead>
                <DataTableHead>代码仓</DataTableHead>
                <DataTableHead>执行人 / 路径</DataTableHead>
                <DataTableHead>状态</DataTableHead>
                <DataTableHead align="right">操作</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {environments.map((environment) => {
                const team = businessTeams.find((item) => item.id === environment.businessTeamId);
                return (
                  <DataTableRow key={environment.id}>
                    <DataTableCell>
                      <div className="font-semibold text-[var(--ink)]">{environment.name}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{environment.id}</div>
                    </DataTableCell>
                    <DataTableCell>{team?.name ?? "未绑定"}</DataTableCell>
                    <DataTableCell>
                      <div>{environment.repositoryProvider} · {environment.repositoryName}</div>
                      <div className="mt-1 max-w-[360px] truncate text-xs text-[var(--ink-muted)]">{environment.repositoryUrl}</div>
                    </DataTableCell>
                    <DataTableCell>
                      <div>{environment.executorRef}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{environment.workingDirectory}</div>
                    </DataTableCell>
                    <DataTableCell>
                      <Badge variant={environment.status === "active" ? "success" : "neutral"}>{environment.status}</Badge>
                    </DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <Eye className="h-4 w-4" />
                              查看
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-[min(96vw,940px)]">
                            <DialogHeader>
                              <DialogTitle>{environment.name}</DialogTitle>
                              <DialogDescription>执行环境配置明细。</DialogDescription>
                            </DialogHeader>
                            <DialogBody>
                              <DefinitionList
                                columnsClassName="sm:grid-cols-2"
                                items={[
                                  { label: "ID", value: environment.id },
                                  { label: "业务团队", value: team?.name ?? "未绑定" },
                                  { label: "代码平台", value: environment.repositoryProvider },
                                  { label: "代码仓", value: environment.repositoryName },
                                  { label: "仓库地址", value: environment.repositoryUrl },
                                  { label: "默认分支", value: environment.defaultBranch },
                                  { label: "执行人引用", value: environment.executorRef },
                                  { label: "私钥引用", value: environment.privateKeyRef },
                                  { label: "工作目录", value: environment.workingDirectory },
                                  { label: "可见性", value: environment.visibility },
                                  { label: "沙箱配置", value: <pre className="whitespace-pre-wrap font-mono text-xs">{environment.sandboxProfileJson}</pre> },
                                  { label: "记忆层", value: <pre className="whitespace-pre-wrap font-mono text-xs">{environment.memoryLayerRefsJson}</pre> },
                                ]}
                              />
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <PencilLine className="h-4 w-4" />
                              编辑
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-[min(96vw,980px)]">
                            <DialogHeader>
                              <DialogTitle>编辑执行环境</DialogTitle>
                              <DialogDescription>{environment.name}</DialogDescription>
                            </DialogHeader>
                            <DialogBody>
                              <ExecutionEnvironmentForm
                                embedded
                                title={`编辑 ${environment.name}`}
                                businessTeamOptions={businessTeamOptions}
                                environment={environment}
                              />
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton
                          endpoint="/api/environments"
                          id={environment.id}
                          confirmText={`确认删除执行环境「${environment.name}」？`}
                        />
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
        </PanelBody>
      </Panel>
    </div>
  );
}
