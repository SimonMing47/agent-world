import { type BusinessTeam, type TenantSpace } from "@/server/db";

export function buildTenantSpaceSummary(tenantSpace: TenantSpace, business_teams: BusinessTeam[]) {
  const quota = JSON.parse(tenantSpace.quotaLimitJson) as {
    monthlyUsd?: number;
    maxRunningTasks?: number;
    maxRunningTaskRuns?: number;
  };

  return {
    id: tenantSpace.id,
    name: tenantSpace.name,
    status: tenantSpace.status,
    businessTeamCount: business_teams.filter((businessTeam) => businessTeam.tenantSpaceId === tenantSpace.id).length,
    monthlyUsd: quota.monthlyUsd ?? 0,
    maxRunningTaskRuns: quota.maxRunningTasks ?? quota.maxRunningTaskRuns ?? 0,
  };
}

export function buildBusinessTeamSummary(businessTeam: BusinessTeam) {
  return {
    id: businessTeam.id,
    name: businessTeam.name,
    status: businessTeam.status,
    balance: businessTeam.balance,
    creditLimit: businessTeam.creditLimit,
    privateMemoryNamespace: businessTeam.privateMemoryNamespace,
    toolRefCount: (JSON.parse(businessTeam.privateToolRefsJson) as string[]).length,
  };
}
