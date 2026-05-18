import { Eye, PencilLine, Plus, RefreshCcw } from "lucide-react";
import { SkillForm } from "@/components/admin-forms";
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
        eyebrow="ui.generated.ceb5b6ad433"
        title="ui.generated.ceb5b6ad433"
        description="ui.generated.c62d736b98a"
        badges={[
          { label: <>{skills.length} ui.generated.cd927cc5599</>, variant: "accent" },
          { label: <>ui.common.enabled {skills.filter((skill) => skill.isEnabled).length}</>, variant: "success" },
        ]}
      />

      <SummaryStrip
        items={[
          { label: "ui.generated.c689ed1840a", value: skills.length, detail: "ui.generated.c88de249f0c" },
          { label: "ui.generated.cb4a1e14fb0", value: skills.filter((skill) => skill.visibility === "team").length, detail: "ui.generated.c26f30fd79b" },
          { label: "ui.generated.ccfdaeadfc4", value: skills.filter((skill) => skill.visibility === "global").length, detail: "ui.generated.cc01f8c8827" },
          { label: "ui.generated.c76ce8e3d5e", value: skills.filter((skill) => skill.vikingUri).length, detail: "ui.generated.c312888d6b1" },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="ui.generated.c41e5243e2d"
          title="ui.generated.c58f961e5b0"
          description="ui.generated.c87b80ff260"
          action={
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary">
                  <Plus className="h-4 w-4" />
                  ui.generated.c502ac6e63b
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[min(96vw,980px)]">
                <DialogHeader>
                  <DialogTitle>ui.generated.c502ac6e63b</DialogTitle>
                  <DialogDescription>ui.generated.c0e37e96b3c</DialogDescription>
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
          }
        />
        <PanelBody className="p-0">
          <DataTable>
            <DataTableHeader>
              <DataTableRow className="hover:bg-transparent">
                <DataTableHead>Skill</DataTableHead>
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
                          {skill.vikingUri}
                        </div>
                      ) : null}
                    </DataTableCell>
                    <DataTableCell>{team?.name ?? "ui.generated.ca5644f4bbf"}</DataTableCell>
                    <DataTableCell>{skill.layer}</DataTableCell>
                    <DataTableCell>
                      <div className="flex max-w-[240px] flex-wrap gap-1">
                        {tags.length ? tags.map((tag) => <Badge key={tag} variant="neutral">{tag}</Badge>) : "ui.generated.c86f9195e25"}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <Badge variant={skill.isEnabled ? "success" : "neutral"}>{skill.isEnabled ? "ui.generated.c0e122f82e5" : "ui.generated.cd989e55188"}</Badge>
                    </DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost"><Eye className="h-4 w-4" />ui.generated.cf7acefd2d4</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{skill.name}</DialogTitle>
                              <DialogDescription>ui.generated.c8191f8fe7e</DialogDescription>
                            </DialogHeader>
                            <DialogBody className="space-y-5">
                              <DefinitionList
                                items={[
                                  { label: "Skill ID", value: skill.id },
                                  { label: "ui.generated.c53d4919c45", value: team?.name ?? "ui.generated.ca5644f4bbf" },
                                  { label: "ui.generated.c986ff01617", value: skill.layer },
                                  { label: "ui.generated.c747b74cec9", value: skill.visibility },
                                  { label: "OpenViking URI", value: skill.vikingUri ?? "ui.generated.c16f4087b8b" },
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
                            <Button size="sm" variant="ghost"><PencilLine className="h-4 w-4" />ui.generated.ca7f814c0a4</Button>
                          </DialogTrigger>
                          <DialogContent className="w-[min(96vw,980px)]">
                            <DialogHeader>
                              <DialogTitle>ui.generated.cdbb8f200a6</DialogTitle>
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
    </div>
  );
}
