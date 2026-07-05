import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { DbShape, ReportRecord, ReportStatus, User } from "./types";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "db.json");

const EMPTY_DB: DbShape = { users: [], reports: [] };

async function ensureDb(): Promise<DbShape> {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await readFile(DB_PATH, "utf8");
    return JSON.parse(raw) as DbShape;
  } catch {
    await writeFile(DB_PATH, JSON.stringify(EMPTY_DB, null, 2), "utf8");
    return { ...EMPTY_DB };
  }
}

async function saveDb(db: DbShape): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const db = await ensureDb();
  return db.users.find((user) => user.email === email.toLowerCase());
}

export async function findUserById(id: string): Promise<User | undefined> {
  const db = await ensureDb();
  return db.users.find((user) => user.id === id);
}

export async function createUser(email: string, passwordHash: string): Promise<User> {
  const db = await ensureDb();
  const normalized = email.trim().toLowerCase();
  if (db.users.some((user) => user.email === normalized)) {
    throw new Error("EMAIL_EXISTS");
  }

  const user: User = {
    id: randomUUID(),
    email: normalized,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  await saveDb(db);
  return user;
}

export async function createReport(input: {
  userId: string;
  stockId: string;
  agentJobId: string;
}): Promise<ReportRecord> {
  const db = await ensureDb();
  const now = new Date().toISOString();
  const report: ReportRecord = {
    id: randomUUID(),
    userId: input.userId,
    stockId: input.stockId,
    agentJobId: input.agentJobId,
    status: "queued",
    createdAt: now,
    updatedAt: now,
  };
  db.reports.push(report);
  await saveDb(db);
  return report;
}

export async function updateReport(
  id: string,
  patch: Partial<Pick<ReportRecord, "status" | "tradeDate" | "error">>,
): Promise<ReportRecord | undefined> {
  const db = await ensureDb();
  const report = db.reports.find((item) => item.id === id);
  if (!report) {
    return undefined;
  }

  Object.assign(report, patch, { updatedAt: new Date().toISOString() });
  await saveDb(db);
  return report;
}

export async function findReportById(id: string): Promise<ReportRecord | undefined> {
  const db = await ensureDb();
  return db.reports.find((item) => item.id === id);
}

export async function listReportsForUser(userId: string): Promise<ReportRecord[]> {
  const db = await ensureDb();
  return db.reports
    .filter((item) => item.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function isValidStockId(value: string): boolean {
  return /^\d{4,6}$/.test(value.trim());
}

export function isValidReportStatus(value: string): value is ReportStatus {
  return ["queued", "fetching", "gating", "done", "failed"].includes(value);
}
