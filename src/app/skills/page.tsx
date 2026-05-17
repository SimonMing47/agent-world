import { Eye, PencilLine, Plus, RefreshCcw } from "lucide-react";
import { SkillForm } from "@/components/admin-forms";
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
import { listSkills } from "@/server/skill-core";
import { listBusinessTeams } from "@/server/queries";

function parseTags(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export default function SkillsPage() {
  const skills = listSkills();
  const businessTeams = listBusinessTeams();
  const teamOptions = businessTeams.map((team) => ({ id: team.id, name: team.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Skill Management"
        title="Skill 管理"
        description="Skill 是 Agent 运行时可复用的能力单元，归属团队、标签、权限和内容统一治理，内容同步存储到 OpenViking。"
        badges={[
          { label: `${skills.length} 个 Skill`, variant: "accent" },
          { label: `启用 ${skills.filter((skill) => skill.isEnabled).length}`, variant: "success" },
        ]}
      />

      <SummaryStrip
        items={[
          { label: "Skill 总数", value: skills.length, detail: "可被 AgentTeam 和任务引用" },
          { label: "团队 Skill", value: skills.filter((skill) => skill.visibility === "team").length, detail: "归属业务团队" },
          { label: "全局 Skill", value: skills.filter((skill) => skill.visibility === "global").length, detail: "跨团队可读" },
          { label: "已同步", value: skills.filter((skill) => skill.vikingUri).length, detail: "OpenViking URI 已生成" },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="Registry"
          title="Skill 注册表"
          description="新增、编辑、优化润色和同步 OpenViking 都通过弹窗完成。"
          action={
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary">
                  <Plus className="h-4 w-4" />
                  新增 Skill
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[min(96vw,980px)]">
                <DialogHeader>
                  <DialogTitle>新增 Skill</DialogTitle>
                  <DialogDescription>定义可在任务运行时使用的团队能力。</DialogDescription>
                </DialogHeader>
                <DialogBody>
                  <SkillForm
                    businessTeams={teamOptions}
                    skill={{
                      id: "",
                      ownerBusinessTeamId: businessTeams[0]?.id ?? null,
                      name: "新增 Skill",
                      layer: "global/code-review",
                      description: "",
                      tagsJson: "[]",
                      visibility: "team",
                      promptMd: "",
                      heuristicsJson: "{}",
                      isEnabled: 1,
                    }}
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
                <DataTableHead>Skill</DataTableHead>
                <DataTableHead>归属团队</DataTableHead>
                <DataTableHead>知识层</DataTableHead>
                <DataTableHead>标签</DataTableHead>
                <DataTableHead>运行状态</DataTableHead>
                <DataTableHead align="right">操作</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {skills.map((skill) => {
                const team = businessTeams.find((item) => item.id === skill.ownerBusinessTeamId);
                const tags = parseTags(skill.tagsJson);
                return (
                  <DataTableRow key={skill.id}>
                    <DataTableCell className="min-w-[280px]">
                      <div className="font-semibold text-[var(--ink)]">{skill.name}</div>
                      <div className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">{skill.description}</div>
                      {skill.vikingUri ? (
                        <div className="mt-1 flex items-center gap-1 text-xs text-[var(--ink-muted)]">
                          <RefreshCcw className="h-3.5 w-3.5" />
                          {skill.vikingUri}
                        </div>
                      ) : null}
                    </DataTableCell>
                    <DataTableCell>{team?.name ?? "全局"}</DataTableCell>
                    <DataTableCell>{skill.layer}</DataTableCell>
                    <DataTableCell>
                      <div className="flex max-w-[240px] flex-wrap gap-1">
                        {tags.length ? tags.map((tag) => <Badge key={tag} variant="neutral">{tag}</Badge>) : "未标注"}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <Badge variant={skill.isEnabled ? "success" : "neutral"}>{skill.isEnabled ? "运行时可用" : "停用"}</Badge>
                    </DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost"><Eye className="h-4 w-4" />查看</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{skill.name}</DialogTitle>
                              <DialogDescription>Skill 元数据和 OpenViking 地址。</DialogDescription>
                            </DialogHeader>
                            <DialogBody className="space-y-5">
                              <DefinitionList
                                items={[
                                  { label: "Skill ID", value: skill.id },
                                  { label: "归属团队", value: team?.name ?? "全局" },
                                  { label: "知识层", value: skill.layer },
                                  { label: "可见性", value: skill.visibility },
                                  { label: "OpenViking URI", value: skill.vikingUri ?? "未同步" },
                                  { label: "状态", value: skill.isEnabled ? "启用" : "停用" },
                                ]}
                              />
                              <pre className="max-h-[320px] overflow-auto rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4 text-xs leading-5 text-[var(--ink-muted)]">
                                {skill.promptMd}
                              </pre>
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost"><PencilLine className="h-4 w-4" />编辑</Button>
                          </DialogTrigger>
                          <DialogContent className="w-[min(96vw,980px)]">
                            <DialogHeader>
                              <DialogTitle>编辑 Skill</DialogTitle>
                              <DialogDescription>{skill.name}</DialogDescription>
                            </DialogHeader>
                            <DialogBody>
                              <SkillForm businessTeams={teamOptions} skill={skill} />
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
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

