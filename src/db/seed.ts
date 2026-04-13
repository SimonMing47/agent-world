import { refreshDatabase, getDatabasePath } from "@/server/db";

refreshDatabase();

console.log(`Seeded AgentWorld data at ${getDatabasePath()}`);
