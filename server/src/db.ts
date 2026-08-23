import fs from "node:fs";
import path from "node:path";
import { CONFIG } from "./config.js";
import type { CandidateRecord, ScreeningSummary } from "./types.js";

const DB_PATH = path.join(CONFIG.DATA_DIR, "candidates.json");

function ensureDatabase(): void {
  if (!fs.existsSync(CONFIG.DATA_DIR)) fs.mkdirSync(CONFIG.DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, "[]", "utf8");
}

function writeAll(records: CandidateRecord[]): void {
  ensureDatabase();
  fs.writeFileSync(DB_PATH, JSON.stringify(records, null, 2), "utf8");
}

export function getAllCandidates(): CandidateRecord[] {
  ensureDatabase();
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8")) as CandidateRecord[];
  } catch {
    return [];
  }
}

export function getCandidateById(id: string): CandidateRecord | undefined {
  return getAllCandidates().find((c) => c.id === id);
}

export function saveCandidates(candidates: CandidateRecord[]): CandidateRecord[] {
  const all = getAllCandidates();
  for (const candidate of candidates) {
    const i = all.findIndex((item) => item.id === candidate.id);
    if (i >= 0) all[i] = candidate;
    else all.unshift(candidate);
  }
  writeAll(all);
  return candidates;
}

export function deleteCandidate(id: string): boolean {
  const all = getAllCandidates();
  const filtered = all.filter((item) => item.id !== id);
  if (filtered.length === all.length) return false;
  writeAll(filtered);
  return true;
}

export function clearAllCandidates(): void {
  writeAll([]);
}

export function getScreeningSummary(candidates: CandidateRecord[]): ScreeningSummary {
  const scores = candidates.map((c) => c.evaluation.overallScore);
  const rec = (r: string) => candidates.filter((c) => c.evaluation.recommendation === r).length;
  return {
    totalScreened: candidates.length,
    shortlistedCount: rec("SHORTLIST"),
    reviewCount: rec("REVIEW"),
    rejectedCount: rec("REJECT"),
    averageScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    highestScore: scores.length ? Math.max(...scores) : 0
  };
}
