import { callGroqChatCompletion, parseJsonSafely } from "./groqClient.js";
import type { StructuredResume, StructuredJob, EvaluationResult, DimensionScores } from "../types.js";

const MATCHER_SYSTEM_PROMPT = `You are a strict, objective, and unbiased principal technical recruiter.
Evaluate the candidate's structured resume against the target structured job description.
Do not hallucinate skills or assume experience that is not supported by the candidate profile.

Score each dimension from 0 to 100 based on strict alignment:
1. requiredSkillsScore (0-100): Direct overlap with required skills and competencies.
2. experienceScore (0-100): Alignment of years of experience, relevant roles, and domain depth.
3. responsibilitiesScore (0-100): Alignment between past duties and target job responsibilities.
4. educationScore (0-100): Alignment with degree and academic criteria.
5. preferredSkillsScore (0-100): Presence of bonus / nice-to-have skills (default 50 if none specified).

Identify exact matched skills, missing required/preferred skills, key technical strengths, areas of concern / gaps, and a concise recruiter justification.

Return ONLY a JSON object matching this schema:
{
  "dimensionScores": {
    "requiredSkillsScore": 85,
    "experienceScore": 80,
    "responsibilitiesScore": 80,
    "educationScore": 90,
    "preferredSkillsScore": 70
  },
  "matchedSkills": ["Python", "FastAPI", "PostgreSQL"],
  "missingSkills": ["Kubernetes", "AWS"],
  "strengths": ["Strong backend API development background", "Solid database optimization experience"],
  "gaps": ["No demonstrated production Kubernetes orchestration"],
  "justification": "Candidate demonstrates high technical competency in core required technologies and matches 80% of role requirements."
}`;

const clamp = (n: number) => Math.min(100, Math.max(0, n));

export function computeWeightedOverallScore(scores: DimensionScores): number {
  return clamp(Math.round(
    scores.requiredSkillsScore * 0.40 +
    scores.experienceScore * 0.25 +
    scores.responsibilitiesScore * 0.20 +
    scores.educationScore * 0.10 +
    scores.preferredSkillsScore * 0.05
  ));
}

export function determineRecommendation(score: number): "SHORTLIST" | "REVIEW" | "REJECT" {
  return score >= 75 ? "SHORTLIST" : score >= 50 ? "REVIEW" : "REJECT";
}

function evaluateHeuristically(resume: StructuredResume, job: StructuredJob, rawResumeText: string): EvaluationResult {
  const haystack = (rawResumeText + " " + resume.skills.join(" ")).toLowerCase();
  const hit = (skill: string) => haystack.includes(skill.toLowerCase());
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];
  const preferredMatched: string[] = [];

  for (const skill of job.requiredSkills) (hit(skill) ? matchedSkills : missingSkills).push(skill);
  for (const skill of job.preferredSkills) {
    if (hit(skill)) { matchedSkills.push(skill); preferredMatched.push(skill); }
    else missingSkills.push(skill);
  }

  const totalReq = job.requiredSkills.length || 1;
  const requiredSkillsScore = Math.round(((job.requiredSkills.length - missingSkills.filter((s) => job.requiredSkills.includes(s)).length) / totalReq) * 100);
  const dimensionScores: DimensionScores = {
    requiredSkillsScore,
    experienceScore: resume.experience.length > 0 ? Math.min(95, 60 + resume.experience.length * 15) : 40,
    responsibilitiesScore: Math.round(requiredSkillsScore * 0.8 + 15),
    educationScore: resume.education.length > 0 ? 85 : 50,
    preferredSkillsScore: job.preferredSkills.length > 0 ? Math.round((preferredMatched.length / job.preferredSkills.length) * 100) : 70
  };

  const overallScore = computeWeightedOverallScore(dimensionScores);
  const recommendation = determineRecommendation(overallScore);
  const strengths: string[] = [];
  const gaps: string[] = [];
  if (matchedSkills.length) strengths.push(`Demonstrated proficiency in key requirements: ${matchedSkills.slice(0, 4).join(", ")}`);
  if (resume.experience.length) strengths.push(`Practical experience across ${resume.experience.length} highlighted role(s)/project(s)`);
  if (dimensionScores.educationScore >= 80) strengths.push("Academic background aligns with standard engineering qualification standards");
  if (missingSkills.length) gaps.push(`Missing core demanded skills: ${missingSkills.slice(0, 3).join(", ")}`);
  if (requiredSkillsScore < 60) gaps.push("Low direct overlap with primary technical requirements");

  return {
    overallScore,
    dimensionScores,
    matchedSkills: [...new Set(matchedSkills)],
    missingSkills: [...new Set(missingSkills)],
    strengths: strengths.length ? strengths : ["General technical foundation present"],
    gaps: gaps.length ? gaps : ["No critical blocking gaps detected"],
    recommendation,
    justification:
      recommendation === "SHORTLIST"
        ? "Candidate meets or exceeds primary requirements with strong alignment across required skills and background."
        : recommendation === "REVIEW"
        ? "Candidate shows moderate alignment with certain transferable skills, but has noticeable gaps in demanded areas."
        : "Candidate lacks key prerequisite technical skills and sufficient experience required for this specific role."
  };
}

export async function matchCandidateAgainstJob(
  resume: StructuredResume,
  job: StructuredJob,
  rawResumeText: string,
  _rawJobText: string
): Promise<EvaluationResult> {
  const payload = {
    candidate: { name: resume.name, summary: resume.summary, skills: resume.skills, experience: resume.experience, education: resume.education, certifications: resume.certifications },
    targetJob: { title: job.title, requiredSkills: job.requiredSkills, preferredSkills: job.preferredSkills, experienceRequired: job.experienceRequired, keyResponsibilities: job.keyResponsibilities, educationRequirements: job.educationRequirements }
  };
  const response = await callGroqChatCompletion(MATCHER_SYSTEM_PROMPT, `Compare Candidate and Target Job:\n${JSON.stringify(payload, null, 2)}`);
  const parsed = response ? parseJsonSafely<{
    dimensionScores?: Partial<DimensionScores>;
    matchedSkills?: string[];
    missingSkills?: string[];
    strengths?: string[];
    gaps?: string[];
    justification?: string;
  } | null>(response, null) : null;

  if (parsed?.dimensionScores) {
    const d = parsed.dimensionScores;
    const dimensionScores: DimensionScores = {
      requiredSkillsScore: clamp(Number(d.requiredSkillsScore ?? 50)),
      experienceScore: clamp(Number(d.experienceScore ?? 50)),
      responsibilitiesScore: clamp(Number(d.responsibilitiesScore ?? 50)),
      educationScore: clamp(Number(d.educationScore ?? 50)),
      preferredSkillsScore: clamp(Number(d.preferredSkillsScore ?? 50))
    };
    const overallScore = computeWeightedOverallScore(dimensionScores);
    const recommendation = determineRecommendation(overallScore);
    return {
      overallScore,
      dimensionScores,
      matchedSkills: Array.isArray(parsed.matchedSkills) ? parsed.matchedSkills : [],
      missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills : [],
      strengths: parsed.strengths?.length ? parsed.strengths : ["Demonstrates core technical background"],
      gaps: parsed.gaps?.length ? parsed.gaps : ["No critical deficiencies found"],
      recommendation,
      justification: parsed.justification || `Candidate scored ${overallScore}/100 with ${recommendation} recommendation.`
    };
  }
  return evaluateHeuristically(resume, job, rawResumeText);
}
