import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";

const dbUrl = process.env.DATABASE_URL?.replace("file:", "") || "sqlite.db";

export const client = new Database(dbUrl);
export const db = drizzle(client, { schema });

export * from "./schema";
