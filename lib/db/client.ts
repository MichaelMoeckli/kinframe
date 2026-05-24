import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

declare global {

  var __kinframePool: Pool | undefined;

  var __kinframeDb: NodePgDatabase<typeof schema> | undefined;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!global.__kinframePool) {
    global.__kinframePool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  if (!global.__kinframeDb) {
    global.__kinframeDb = drizzle(global.__kinframePool, { schema });
  }
  return global.__kinframeDb;
}

export { schema };
