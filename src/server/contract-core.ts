import { type Contract } from "@/server/db";

export function buildContractSummary(contract: Contract) {
  const pricing = JSON.parse(contract.pricingModelJson) as {
    baseUsd?: number;
    tokenMultiplier?: number;
    platformFeePct?: number;
  };
  const scope = JSON.parse(contract.accessScopeJson) as {
    actions?: string[];
    tools?: string[];
  };
  const sla = JSON.parse(contract.slaJson) as {
    responseSeconds?: number;
    successRateFloor?: number;
  };

  return {
    id: contract.id,
    status: contract.status,
    serviceAccountRef: contract.serviceAccountRef,
    pricing,
    scope,
    sla,
  };
}
