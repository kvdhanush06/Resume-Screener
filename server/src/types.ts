export interface ExperienceItem { company: string; role: string; duration: string; responsibilities: string[]; }
export interface EducationItem { degree: string; institution: string; year: string; }

export interface StructuredResume {
  name: string; email: string; phone: string; summary: string;
  skills: string[]; experience: ExperienceItem[]; education: EducationItem[]; certifications: string[];
}

export interface StructuredJob {
  title: string; requiredSkills: string[]; preferredSkills: string[];
  experienceRequired: string; keyResponsibilities: string[]; educationRequirements: string[];
}

export interface DimensionScores {
  requiredSkillsScore: number; experienceScore: number; responsibilitiesScore: number;
  educationScore: number; preferredSkillsScore: number;
}

export interface EvaluationResult {
  overallScore: number; dimensionScores: DimensionScores;
  matchedSkills: string[]; missingSkills: string[]; strengths: string[]; gaps: string[];
  recommendation: "SHORTLIST" | "REVIEW" | "REJECT"; justification: string;
}

export interface CandidateRecord {
  id: string; filename: string; uploadedAt: string; rawResumeText: string;
  structuredResume: StructuredResume; jobTitle: string; jobDescriptionText: string;
  structuredJob: StructuredJob; evaluation: EvaluationResult;
}

export interface ScreeningSummary {
  totalScreened: number; shortlistedCount: number; reviewCount: number;
  rejectedCount: number; averageScore: number; highestScore: number;
}
