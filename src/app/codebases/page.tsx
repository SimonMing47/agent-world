import { Eye, KeyRound, PencilLine, Plus } from "lucide-react";
import { CodebaseForm, CodebaseTokenForm } from "@/components/admin-forms";
import { DeleteResourceButton } from "@/components/delete-resource-button";
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
import { listCodebaseOperatorTokens, listCodebases } from "@/server/governance-core";
import { listBusinessTeams } from "@/server/queries";

function parsePermissions(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export default function CodebasesPage() {
  const codebases = listCodebases();
  const tokens = listCodebaseOperatorTokens();
  const businessTeams = listBusinessTeams();
  const teamOptions = businessTeams.map((team) => ({ id: team.id, name: team.name }));
  const codebaseOptions = codebases.map((codebase) => ({ id: codebase.id, name: codebase.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="代码仓"
        title="Codebase 管理"
        description="统一录入代码仓地址、归属团队和多个操作者 token，任务执行时只引用受控的 Codebase 和 Token。"
        badges={[
          { label: `${codebases.length} 个代码仓`, variant: "accent" },
          { label: `${tokens.length} 个操作者 Token`, variant: "neutral" },
        ]}
      />

      <SummaryStrip
        items={[
          { label: "代码仓", value: codebases.length, detail: "按团队归属治理" },
          { label: "操作者 Token", value: tokens.length, detail: "只保存 Secret 引用" },
          { label: "代码平台", value: new Set(codebases.map((item) => item.provider)).size, detail: "Git / CodeHub / GitLab 等" },
          { label: "启用仓库", value: codebases.filter((item) => item.status === "active").length, detail: "可被任务选择" },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="仓库目录"
          title="代码仓目录"
          description="代码仓作为团队资产被任务蓝图、执行环境和插件引用。"
          action={
            <div className="flex gap-2">
              <Dialog>
                <DialogTrigger asChild><Button size="sm" variant="secondary"><Plus className="h-4 w-4" />新增 Codebase</Button></DialogTrigger>
                <DialogContent className="w-[min(94vw,860px)]">
                  <DialogHeader><DialogTitle>新增 Codebase</DialogTitle><DialogDescription>录入代码仓地址和团队归属。</DialogDescription></DialogHeader>
                  <DialogBody>
                    <CodebaseForm
                      businessTeams={teamOptions}
                      codebase={{
                        id: "",
                        businessTeamId: businessTeams[0]?.id ?? "",
                        name: "新增代码仓",
                        provider: "git",
                        repositoryUrl: "",
                        defaultBranch: "main",
                        visibility: "team",
                        description: "",
                        status: "active",
                      }}
                    />
                  </DialogBody>
                </DialogContent>
              </Dialog>
              <Dialog>
                <DialogTrigger asChild><Button size="sm" variant="ghost"><KeyRound className="h-4 w-4" />新增 Token</Button></DialogTrigger>
                <DialogContent className="w-[min(94vw,760px)]">
                  <DialogHeader><DialogTitle>新增操作者 Token</DialogTitle><DialogDescription>Token 只保存引用，不保存明文。</DialogDescription></DialogHeader>
                  <DialogBody>
                    <CodebaseTokenForm
                      codebases={codebaseOptions}
                      token={{
                        id: "",
                        codebaseId: codebases[0]?.id ?? "",
                        operatorName: "新增操作者",
                        tokenRef: "secret:",
                        role: "readonly",
                        permissionJson: "[]",
                        status: "active",
                      }}
                    />
                  </DialogBody>
                </DialogContent>
              </Dialog>
            </div>
          }
        />
        <PanelBody className="p-0">
          <DataTable>
            <DataTableHeader>
              <DataTableRow className="hover:bg-transparent">
                <DataTableHead>Codebase</DataTableHead>
                <DataTableHead>归属团队</DataTableHead>
                <DataTableHead>平台 / 分支</DataTableHead>
                <DataTableHead>操作者</DataTableHead>
                <DataTableHead>状态</DataTableHead>
                <DataTableHead align="right">操作</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {codebases.map((codebase) => {
                const team = businessTeams.find((item) => item.id === codebase.businessTeamId);
                const codebaseTokens = tokens.filter((token) => token.codebaseId === codebase.id);
                return (
                  <DataTableRow key={codebase.id}>
                    <DataTableCell className="min-w-[280px]">
                      <div className="font-semibold text-[var(--ink)]">{codebase.name}</div>
                      <div className="mt-1 break-all text-xs text-[var(--ink-muted)]">{codebase.repositoryUrl}</div>
                    </DataTableCell>
                    <DataTableCell>{team?.name ?? "未知团队"}</DataTableCell>
                    <DataTableCell>{codebase.provider} / {codebase.defaultBranch}</DataTableCell>
                    <DataTableCell>{codebaseTokens.length}</DataTableCell>
                    <DataTableCell><Badge variant={codebase.status === "active" ? "success" : "neutral"}>{codebase.status}</Badge></DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><Eye className="h-4 w-4" />查看</Button></DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>{codebase.name}</DialogTitle><DialogDescription>代码仓和操作者权限。</DialogDescription></DialogHeader>
                            <DialogBody className="space-y-5">
                              <DefinitionList
                                items={[
                                  { label: "ID", value: codebase.id },
                                  { label: "团队", value: team?.name ?? "未知团队" },
                                  { label: "平台", value: codebase.provider },
                                  { label: "地址", value: codebase.repositoryUrl },
                                  { label: "默认分支", value: codebase.defaultBranch },
                                  { label: "可见性", value: codebase.visibility },
                                  { label: "描述", value: codebase.description || "无" },
                                ]}
                              />
                              <DataTable>
                                <DataTableHeader><DataTableRow><DataTableHead>操作者</DataTableHead><DataTableHead>角色</DataTableHead><DataTableHead>权限</DataTableHead><DataTableHead align="right">操作</DataTableHead></DataTableRow></DataTableHeader>
                                <DataTableBody>
                                  {codebaseTokens.map((token) => (
                                    <DataTableRow key={token.id}>
                                      <DataTableCell>{token.operatorName}</DataTableCell>
                                      <DataTableCell>{token.role}</DataTableCell>
                                      <DataTableCell>{parsePermissions(token.permissionJson).join(", ")}</DataTableCell>
                                      <DataTableCell align="right">
                                        <div className="flex justify-end gap-2">
                                          <Dialog>
                                            <DialogTrigger asChild><Button size="sm" variant="ghost"><PencilLine className="h-4 w-4" />编辑</Button></DialogTrigger>
                                            <DialogContent className="w-[min(94vw,760px)]">
                                              <DialogHeader><DialogTitle>编辑操作者 Token</DialogTitle><DialogDescription>{token.operatorName}</DialogDescription></DialogHeader>
                                              <DialogBody><CodebaseTokenForm codebases={codebaseOptions} token={token} /></DialogBody>
                                            </DialogContent>
                                          </Dialog>
                                          <DeleteResourceButton endpoint="/api/codebases" id={token.id} body={{ entity: "token" }} confirmText={`确认删除操作者 Token「${token.operatorName}」？`} />
                                        </div>
                                      </DataTableCell>
                                    </DataTableRow>
                                  ))}
                                </DataTableBody>
                              </DataTable>
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><PencilLine className="h-4 w-4" />编辑</Button></DialogTrigger>
                          <DialogContent className="w-[min(94vw,860px)]">
                            <DialogHeader><DialogTitle>编辑 Codebase</DialogTitle><DialogDescription>{codebase.name}</DialogDescription></DialogHeader>
                            <DialogBody><CodebaseForm businessTeams={teamOptions} codebase={codebase} /></DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton endpoint="/api/codebases" id={codebase.id} confirmText={`确认删除 Codebase「${codebase.name}」？`} />
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
