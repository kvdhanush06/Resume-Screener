import type { ScreeningResponse, CandidateRecord, ScreeningSummary } from "../types/index.js";

const BASE = "/api";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || response.statusText);
  }
  return response.json();
}

export function fetchCandidates(): Promise<{ candidates: CandidateRecord[]; summary: ScreeningSummary }> {
  return request(`${BASE}/candidates`);
}

export function deleteCandidateRecord(id: string): Promise<void> {
  return request(`${BASE}/candidates/${id}`, { method: "DELETE" });
}

export function clearAllCandidateRecords(): Promise<void> {
  return request(`${BASE}/candidates`, { method: "DELETE" });
}

export function screenCandidates(jobDescription: string, files: File[], manualResumeText?: string): Promise<ScreeningResponse> {
  const formData = new FormData();
  formData.append("jobDescription", jobDescription);
  for (const file of files) formData.append("resumes", file);
  if (manualResumeText?.trim()) {
    formData.append("resumeText", manualResumeText.trim());
    formData.append("filename", "manual_candidate.txt");
  }
  return request(`${BASE}/screen`, { method: "POST", body: formData });
}
