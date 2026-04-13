import { refreshDatabase, getDatabasePath } from "@/server/db";

refreshDatabase();

console.log(`Seeded AgentHelix data at ${getDatabasePath()}`);
