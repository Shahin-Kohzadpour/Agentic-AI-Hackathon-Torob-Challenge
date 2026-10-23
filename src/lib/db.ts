import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

let dbInstance: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  // Determine path
  const candidatePaths = [
    ...(process.env.CATALOGUE_PATH ? [process.env.CATALOGUE_PATH] : []),
    ...(process.env.DATA_DIR ? [path.join(process.env.DATA_DIR, "torob.db")] : []),
    path.join(process.cwd(), "data", "torob.db"),
    path.join(process.cwd(), "..", "data", "torob.db"),
    path.resolve(__dirname, "..", "..", "data", "torob.db"),
  ];

  let dbPath: string | null = null;
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      dbPath = p;
      break;
    }
  }

  if (!dbPath) {
    // If not found, use default path and throw clear error
    dbPath = candidatePaths[0];
    if (!fs.existsSync(dbPath)) {
      throw new Error(`Torob SQLite database not found. Checked: ${candidatePaths.join(", ")}`);
    }
  }

  dbInstance = new DatabaseSync(dbPath, { open: true, readOnly: true });
  dbInstance.exec("PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
  return dbInstance;
}
