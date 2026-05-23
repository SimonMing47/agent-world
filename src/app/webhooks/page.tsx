import { Eye, PencilLine, Plus } from "lucide-react";
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
import { WebhookEndpointForm } from "@/components/webhook-endpoint-form";
import { filterBusinessTeamsForAuthContext, getRequestAuthContext } from "@/server/auth-core";
import { listAgentTeams, listBusinessTeams, listWebhooks } from "@/server/queries";

function defaultWebhook(businessTeamId: string, teamId: string) {
  return {
    id: "",
	    businessTeamId,
	    teamId,
	    name: "",
	    pathKey: "",
	    method: "POST",
	    requestSchemaJson: "{}",
	    secretHint: "",
    isEnabled: 1,
  };
}

export default async function WebhooksPage() {
  const authContext = await getRequestAuthContext();
  const businessTeams = filterBusinessTeamsForAuthContext(listBusinessTeams(), authContext);
  const visibleBusinessTeamIds = new Set(businessTeams.map((team) => team.id));
  const webhooks = listWebhooks().filter((webhook) => visibleBusinessTeamIds.has(webhook.businessTeamId));
  const agentTeams = listAgentTeams().filter((team) => visibleBusinessTeamIds.has(team.businessTeamId));
  const businessTeamOptions = businessTeams.map((team) => ({ id: team.id, name: team.name }));
  const agentTeamOptions = agentTeams.map((team) => ({ id: team.id, name: team.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Webhook"
        title="ui.generated.cc6ce61d180"
        description="ui.generated.c653f4aa1d1"
        badges={[
          { label: <>{webhooks.length} ui.common.count.endpoints</>, variant: "accent" },
          { label: <>ui.common.enabled {webhooks.filter((webhook) => webhook.isEnabled === 1).length}</>, variant: "success" },
        ]}
      />

      <SummaryStrip
        items={[
          { label: "Webhook", value: webhooks.length, detail: "ui.generated.cd81d2b06bf" },
          { label: "ui.generated.c15b1b3fbcf", value: webhooks.filter((item) => item.isEnabled === 1).length, detail: "ui.generated.cbbe1b92023" },
          { label: "ui.generated.c2b90028ff3", value: new Set(webhooks.map((item) => item.businessTeamId)).size, detail: "ui.generated.c4614561e47" },
          { label: "ui.generated.c70f970c1fc", value: new Set(webhooks.map((item) => item.teamId)).size, detail: "ui.generated.cf8e90693d4" },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="ui.generated.c43e9039cf5"
          title="ui.generated.c876234656b"
          description="ui.generated.cc28127e59e"
          action={
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary">
                  <Plus className="h-4 w-4" />
                  ui.generated.c78cb758aca
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[min(96vw,920px)]">
                <DialogHeader>
                  <DialogTitle>ui.generated.c78cb758aca</DialogTitle>
                  <DialogDescription>ui.generated.cbb25284ce6</DialogDescription>
                </DialogHeader>
                <DialogBody>
                  <WebhookEndpointForm
                    embedded
	                    title="ui.generated.c78cb758aca"
	                    businessTeamOptions={businessTeamOptions}
	                    agentTeamOptions={agentTeamOptions}
	                    webhook={defaultWebhook("", "")}
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
                <DataTableHead>Webhook</DataTableHead>
                <DataTableHead>ui.generated.c2b90028ff3</DataTableHead>
                <DataTableHead>ui.generated.c70f970c1fc</DataTableHead>
                <DataTableHead>ui.generated.c16a2b88a52</DataTableHead>
                <DataTableHead>ui.generated.c62e951a692</DataTableHead>
                <DataTableHead align="right">ui.generated.cf3ea6d345e</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {webhooks.map((webhook) => {
                const businessTeam = businessTeams.find((item) => item.id === webhook.businessTeamId);
                const agentTeam = agentTeams.find((item) => item.id === webhook.teamId);
                return (
                  <DataTableRow key={webhook.id}>
                    <DataTableCell>
                      <div className="font-semibold text-[var(--ink)]">{webhook.name}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{webhook.id}</div>
                    </DataTableCell>
                    <DataTableCell>{businessTeam?.name ?? "ui.generated.c3bf179d8d0"}</DataTableCell>
                    <DataTableCell>{agentTeam?.name ?? "ui.generated.c3bf179d8d0"}</DataTableCell>
                    <DataTableCell>
                      <div>{webhook.method}</div>
                      <div className="mt-1 font-mono text-xs text-[var(--ink-muted)]">/api/webhooks/{webhook.pathKey}</div>
                    </DataTableCell>
                    <DataTableCell>
                      <Badge variant={webhook.isEnabled === 1 ? "success" : "neutral"}>{webhook.isEnabled === 1 ? "ui.generated.cd4e9ca3dd4" : "ui.generated.cd989e55188"}</Badge>
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
                          <DialogContent className="w-[min(96vw,880px)]">
                            <DialogHeader>
                              <DialogTitle>{webhook.name}</DialogTitle>
                              <DialogDescription>ui.generated.cdb9c982116</DialogDescription>
                            </DialogHeader>
                            <DialogBody>
                              <DefinitionList
                                columnsClassName="sm:grid-cols-2"
                                items={[
                                  { label: "ID", value: webhook.id },
                                  { label: "ui.generated.c2b90028ff3", value: businessTeam?.name ?? "ui.generated.c3bf179d8d0" },
                                  { label: "ui.generated.c70f970c1fc", value: agentTeam?.name ?? "ui.generated.c3bf179d8d0" },
                                  { label: "ui.generated.cb1d337493c", value: webhook.method },
                                  { label: "ui.generated.c9614806f47", value: webhook.pathKey },
                                  { label: "ui.generated.c75c9a7408e", value: `/api/webhooks/${webhook.pathKey}` },
                                  { label: "ui.generated.cf7981046c3", value: webhook.secretHint || "ui.generated.c63595e95b7" },
                                  { label: "ui.generated.c02aa35d407", value: <pre className="whitespace-pre-wrap font-mono text-xs">{webhook.requestSchemaJson}</pre> },
                                ]}
                              />
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
                          <DialogContent className="w-[min(96vw,920px)]">
                            <DialogHeader>
                              <DialogTitle>ui.generated.cd851bc608a</DialogTitle>
                              <DialogDescription>{webhook.name}</DialogDescription>
                            </DialogHeader>
                            <DialogBody>
                              <WebhookEndpointForm
                                embedded
                                title="ui.generated.cd851bc608a"
                                businessTeamOptions={businessTeamOptions}
                                agentTeamOptions={agentTeamOptions}
                                webhook={webhook}
                              />
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton
                          endpoint="/api/webhooks"
                          id={webhook.id}
                          confirmParams={{ resource: "ui.common.resources.webhook", name: webhook.name }}
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
