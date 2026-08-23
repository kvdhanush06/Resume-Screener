import { Request, Response, Router } from "express";
import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";
import { CONFIG } from "../config.js";
import { isGroqConfigured } from "../services/groqClient.js";
import { parsePdfBuffer, normalizeExtractedText } from "../services/pdfParser.js";
import { extractStructuredResume, extractStructuredJob } from "../services/extractors.js";
import { matchCandidateAgainstJob } from "../services/matcher.js";
import { getAllCandidates, getCandidateById, saveCandidates, deleteCandidate, clearAllCandidates, getScreeningSummary } from "../db.js";
import type { CandidateRecord, StructuredJob } from "../types.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 20 } });
export const apiRouter = Router();

const idParam = (req: Request) => String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);

async function buildRecord(filename: string, resumeText: string, jobText: string, structuredJob: StructuredJob): Promise<CandidateRecord> {
  const structuredResume = await extractStructuredResume(resumeText);
  const evaluation = await matchCandidateAgainstJob(structuredResume, structuredJob, resumeText, jobText);
  return {
    id: crypto.randomUUID(),
    filename,
    uploadedAt: new Date().toISOString(),
    rawResumeText: resumeText,
    structuredResume,
    jobTitle: structuredJob.title,
    jobDescriptionText: jobText,
    structuredJob,
    evaluation
  };
}

apiRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), groqConfigured: isGroqConfigured(), model: CONFIG.GROQ_MODEL });
});

apiRouter.get("/candidates", (_req, res) => {
  const candidates = getAllCandidates();
  res.json({ candidates, summary: getScreeningSummary(candidates) });
});

apiRouter.get("/candidates/:id", (req, res) => {
  const candidate = getCandidateById(idParam(req));
  if (!candidate) { res.status(404).json({ error: "Candidate record not found" }); return; }
  res.json(candidate);
});

apiRouter.delete("/candidates/:id", (req, res) => {
  const id = idParam(req);
  if (!deleteCandidate(id)) { res.status(404).json({ error: "Candidate record not found" }); return; }
  res.json({ success: true, id });
});

apiRouter.delete("/candidates", (_req, res) => {
  clearAllCandidates();
  res.json({ success: true, message: "All candidate records cleared" });
});

apiRouter.post("/parse-job", async (req: Request, res: Response) => {
  try {
    const text = req.body.jobDescriptionText;
    if (!text?.trim()) { res.status(400).json({ error: "jobDescriptionText is required" }); return; }
    res.json({ structuredJob: await extractStructuredJob(text) });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

apiRouter.post("/analyze-text", async (req: Request, res: Response) => {
  try {
    const { resumeText, jobDescriptionText, filename = "candidate_resume.txt" } = req.body;
    if (!resumeText?.trim()) { res.status(400).json({ error: "resumeText is required" }); return; }
    if (!jobDescriptionText?.trim()) { res.status(400).json({ error: "jobDescriptionText is required" }); return; }
    const normalizedResume = normalizeExtractedText(resumeText);
    const normalizedJob = normalizeExtractedText(jobDescriptionText);
    const structuredJob = await extractStructuredJob(normalizedJob);
    const record = await buildRecord(filename, normalizedResume, normalizedJob, structuredJob);
    saveCandidates([record]);
    res.json({ candidate: record });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

apiRouter.post("/screen", upload.array("resumes"), async (req: Request, res: Response) => {
  try {
    const jobDescriptionText = req.body.jobDescription || req.body.jobDescriptionText || "";
    if (!jobDescriptionText?.trim()) { res.status(400).json({ error: "Job description is required" }); return; }

    const files = req.files as Express.Multer.File[] | undefined;
    const directResumeText = req.body.resumeText;
    if ((!files || !files.length) && !directResumeText?.trim()) {
      res.status(400).json({ error: "At least one resume file or resume text is required" });
      return;
    }

    const normalizedJob = normalizeExtractedText(jobDescriptionText);
    const structuredJob = await extractStructuredJob(normalizedJob);
    const inputs: { filename: string; text: string }[] = [];

    for (const file of files || []) {
      const ext = path.extname(file.originalname).toLowerCase();
      const extracted = normalizeExtractedText(ext === ".pdf" ? await parsePdfBuffer(file.buffer) : file.buffer.toString("utf8"));
      if (extracted) inputs.push({ filename: file.originalname, text: extracted });
    }
    if (directResumeText?.trim()) {
      inputs.push({ filename: req.body.filename || "manual_entry.txt", text: normalizeExtractedText(directResumeText) });
    }
    if (!inputs.length) {
      res.status(400).json({ error: "Could not extract valid text from any provided resume" });
      return;
    }

    const processed: CandidateRecord[] = [];
    for (const input of inputs) processed.push(await buildRecord(input.filename, input.text, normalizedJob, structuredJob));
    processed.sort((a, b) => b.evaluation.overallScore - a.evaluation.overallScore);
    saveCandidates(processed);
    res.json({ candidates: processed, summary: getScreeningSummary(processed), job: structuredJob });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
