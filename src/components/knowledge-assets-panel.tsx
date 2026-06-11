import { Eye, PencilLine, Plus, RefreshCcw, Upload } from "lucide-react";
import { SkillForm } from "@/components/admin-forms";
import { DeleteResourceButton } from "@/components/delete-resource-button";
import { SkillImportDialog } from "@/components/skill-import-dialog";
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
import type { BusinessTeam, InspectionSkill } from "@/server/db";

type BusinessTeamOption = Pick<BusinessTeam, "id" | "name">;

function parseTags(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function displayKnowledgeValue(value: string) {
  if (value === "skill" || value === "skills") return "knowledge";
  return value
    .replace(/\bskills\//g, "knowledge/")
    .replace(/\bskill\//g, "knowledge/")
    .replace(/\bskill-/g, "knowledge-")
    .replace(/\/skills\//g, "/knowledge/")
    .replace(/\/skills-/g, "/knowledge-");
}

export function KnowledgeAssetsPanel({
  skills,
  businessTeams,
}: {
  skills: InspectionSkill[];
  businessTeams: BusinessTeamOption[];
}) {
  const teamOptions = businessTeams.map((team) => ({ id: team.id, name: team.name }));

  return (
    <Panel id="knowledge-assets">
      <PanelHeader
        eyebrow="knowledge.assets.eyebrow"
        title="knowledge.assets.title"
        description="knowledge.assets.description"
        action={
          <div className="flex flex-wrap gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary">
                  <Upload className="h-4 w-4" />
                  skills.import.title
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[min(96vw,980px)]">
                <DialogHeader>
                  <DialogTitle>skills.import.title</DialogTitle>
                  <DialogDescription>skills.import.description</DialogDescription>
                </DialogHeader>
                <DialogBody>
                  <SkillImportDialog businessTeams={teamOptions} />
                </DialogBody>
              </DialogContent>
            </Dialog>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary">
                  <Plus className="h-4 w-4" />
                  knowledge.assets.create
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[min(96vw,980px)]">
                <DialogHeader>
                  <DialogTitle>knowledge.assets.create</DialogTitle>
                  <DialogDescription>knowledge.assets.createDescription</DialogDescription>
                </DialogHeader>
                <DialogBody>
                  <SkillForm
                    businessTeams={teamOptions}
                    skill={{
                      id: "",
                      ownerBusinessTeamId: null,
                      name: "",
                      layer: "",
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
          </div>
        }
      />
      <PanelBody className="space-y-5">
        <SummaryStrip
          items={[
            { label: "knowledge.assets.metrics.total", value: skills.length, detail: "knowledge.assets.metrics.totalDetail" },
            {
              label: "knowledge.assets.metrics.teamVisible",
              value: skills.filter((skill) => skill.visibility === "team").length,
              detail: "knowledge.assets.metrics.teamVisibleDetail",
            },
            {
              label: "knowledge.assets.metrics.global",
              value: skills.filter((skill) => skill.visibility === "global").length,
              detail: "knowledge.assets.metrics.globalDetail",
            },
            {
              label: "knowledge.assets.metrics.synced",
              value: skills.filter((skill) => skill.vikingUri).length,
              detail: "knowledge.assets.metrics.syncedDetail",
            },
          ]}
        />

        <DataTable>
          <DataTableHeader>
            <DataTableRow className="hover:bg-transparent">
              <DataTableHead>knowledge.assets.columns.knowledge</DataTableHead>
              <DataTableHead>ui.generated.c53d4919c45</DataTableHead>
              <DataTableHead>ui.generated.c986ff01617</DataTableHead>
              <DataTableHead>ui.generated.cae0a7afece</DataTableHead>
              <DataTableHead>ui.generated.c2a4080ad9f</DataTableHead>
              <DataTableHead align="right">ui.generated.cf3ea6d345e</DataTableHead>
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
                        {displayKnowledgeValue(skill.vikingUri)}
                      </div>
                    ) : null}
                  </DataTableCell>
                  <DataTableCell>{team?.name ?? "ui.generated.ca5644f4bbf"}</DataTableCell>
                  <DataTableCell>{displayKnowledgeValue(skill.layer)}</DataTableCell>
                  <DataTableCell>
                    <div className="flex max-w-[240px] flex-wrap gap-1">
                      {tags.length ? tags.map((tag) => <Badge key={tag} variant="neutral">{displayKnowledgeValue(tag)}</Badge>) : "ui.generated.c86f9195e25"}
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <Badge variant={skill.isEnabled ? "success" : "neutral"}>
                      {skill.isEnabled ? "ui.generated.c0e122f82e5" : "ui.generated.cd989e55188"}
                    </Badge>
                  </DataTableCell>
                  <DataTableCell align="right">
                    <div className="flex justify-end gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="ghost">
                            <Eye className="h-4 w-4" />
                            ui.generated.cf7acefd2d4
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{skill.name}</DialogTitle>
                            <DialogDescription>knowledge.assets.viewDescription</DialogDescription>
                          </DialogHeader>
                          <DialogBody className="space-y-5">
                            <DefinitionList
                              items={[
                                { label: "knowledge.assets.fields.id", value: skill.id },
                                { label: "ui.generated.c53d4919c45", value: team?.name ?? "ui.generated.ca5644f4bbf" },
                                { label: "ui.generated.c986ff01617", value: displayKnowledgeValue(skill.layer) },
                                { label: "ui.generated.c747b74cec9", value: skill.visibility },
                                { label: "knowledge.labels.knowledgeUri", value: skill.vikingUri ? displayKnowledgeValue(skill.vikingUri) : "ui.generated.c16f4087b8b" },
                                { label: "ui.generated.c62e951a692", value: skill.isEnabled ? "ui.generated.cd4e9ca3dd4" : "ui.generated.cd989e55188" },
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
                          <Button size="sm" variant="ghost">
                            <PencilLine className="h-4 w-4" />
                            ui.generated.ca7f814c0a4
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="w-[min(96vw,980px)]">
                          <DialogHeader>
                            <DialogTitle>knowledge.assets.edit</DialogTitle>
                            <DialogDescription>{skill.name}</DialogDescription>
                          </DialogHeader>
                          <DialogBody>
                            <SkillForm businessTeams={teamOptions} skill={skill} />
                          </DialogBody>
                        </DialogContent>
                      </Dialog>
                      <DeleteResourceButton endpoint="/api/skills" id={skill.id} confirmParams={{ resource: "ui.common.resources.skill", name: skill.name }} />
                    </div>
                  </DataTableCell>
                </DataTableRow>
              );
            })}
          </DataTableBody>
        </DataTable>
      </PanelBody>
    </Panel>
  );
}
