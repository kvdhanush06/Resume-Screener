import { callGroqChatCompletion, parseJsonSafely } from "./groqClient.js";
import type { StructuredJob, StructuredResume } from "../types.js";

const SKILLS = [
  "JavaScript", "TypeScript", "Node.js", "Express", "React", "Next.js", "Vue", "Angular",
  "Python", "Django", "FastAPI", "Flask", "Java", "Spring Boot", "C++", "C#", ".NET",
  "Go", "Rust", "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "SQLite",
  "AWS", "GCP", "Azure", "Docker", "Kubernetes", "CI/CD", "Git", "GitHub", "Linux",
  "REST APIs", "GraphQL", "Microservices", "System Design", "OOP", "Data Structures",
  "Algorithms", "Unit Testing"
];

const RESUME_SKILLS = [...SKILLS, "Jest", "PyTest", "TailwindCSS", "HTML", "CSS"];

const JOB_PROMPT = `You are an expert technical recruiter analyzing job descriptions.
Extract the structured role criteria from the job description text.
Return ONLY a valid JSON object matching this schema:
{
  "title": "Job Title",
  "requiredSkills": ["Required Skill 1", "Required Skill 2"],
  "preferredSkills": ["Preferred Skill 1", "Preferred Skill 2"],
  "experienceRequired": "e.g. 2-4 years / Entry Level / Senior",
  "keyResponsibilities": ["Responsibility 1", "Responsibility 2"],
  "educationRequirements": ["Education Requirement 1"]
}
Only extract items explicitly stated or strongly demanded in the text.`;

const RESUME_PROMPT = `You are a precise technical resume parsing engine.
Extract structured profile information from the supplied resume text.
Return ONLY a valid JSON object matching this schema exactly:
{
  "name": "Candidate Full Name",
  "email": "candidate@email.com",
  "phone": "+1234567890",
  "summary": "Brief 2-3 sentence overview of candidate profile",
  "skills": ["Skill1", "Skill2", "Skill3"],
  "experience": [
    {
      "company": "Company Name",
      "role": "Job Title",
      "duration": "Dates / Duration",
      "responsibilities": ["Key responsibility 1", "Key achievement 2"]
    }
  ],
  "education": [
    {
      "degree": "Degree and Major",
      "institution": "University / College",
      "year": "Year of graduation"
    }
  ],
  "certifications": ["Certification 1", "Certification 2"]
}
Do not invent or infer data that is not in the text. Return empty strings or arrays if not found.`;

function matchSkills(text: string, catalog: string[]): string[] {
  const lower = text.toLowerCase();
  return catalog.filter((skill) => lower.includes(skill.toLowerCase()));
}

async function groqJson<T>(system: string, user: string): Promise<T | null> {
  const response = await callGroqChatCompletion(system, user);
  return response ? parseJsonSafely<T | null>(response, null) : null;
}

function extractJobHeuristically(rawText: string): StructuredJob {
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  const found = matchSkills(rawText, SKILLS);
  const split = Math.ceil(found.length * 0.7);
  return {
    title: (lines[0] || "Software Engineer Role").length < 80 ? lines[0] || "Software Engineer Role" : "Software Engineer",
    requiredSkills: found.length ? found.slice(0, split) : ["Software Engineering", "Problem Solving"],
    preferredSkills: found.slice(split),
    experienceRequired: "1+ years relevant technical experience",
    keyResponsibilities: [
      "Develop and maintain robust technical systems",
      "Collaborate across development teams to deliver features"
    ],
    educationRequirements: ["Bachelor's or Master's degree in Computer Science or related field"]
  };
}

function extractResumeHeuristically(rawText: string): StructuredResume {
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = rawText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const name = lines.find((l) => l.length > 2 && l.length < 50 && !l.includes("@") && !/\d/.test(l)) || "Candidate";
  const skills = matchSkills(rawText, RESUME_SKILLS);
  const educationMatch = rawText.match(/(?:education|degree|bachelor|master|b\.tech|m\.tech|b\.e|b\.sc|m\.sc|phd|university|college)[\s\S]{0,250}/i);
  const experienceMatch = rawText.match(/(?:experience|employment|work history|career|internship)[\s\S]{0,350}/i);
  return {
    name,
    email: emailMatch?.[0] || "",
    phone: phoneMatch?.[0] || "",
    summary: rawText.slice(0, 200).replace(/\n+/g, " "),
    skills: skills.length ? skills : ["Software Engineering", "Problem Solving"],
    experience: [{
      company: "Professional Experience",
      role: "Software Engineer",
      duration: "Relevant Period",
      responsibilities: experienceMatch ? [experienceMatch[0].slice(0, 200)] : ["Executed software engineering projects"]
    }],
    education: [{
      degree: "Undergraduate / Postgraduate Degree",
      institution: educationMatch ? educationMatch[0].slice(0, 100) : "Recognized University",
      year: "Completed"
    }],
    certifications: []
  };
}

export async function extractStructuredJob(rawText: string): Promise<StructuredJob> {
  const parsed = await groqJson<StructuredJob>(JOB_PROMPT, `Job description text:\n\n${rawText.slice(0, 8000)}`);
  if (parsed && Array.isArray(parsed.requiredSkills) && parsed.requiredSkills.length > 0) {
    return {
      title: parsed.title || "Target Role",
      requiredSkills: parsed.requiredSkills || [],
      preferredSkills: Array.isArray(parsed.preferredSkills) ? parsed.preferredSkills : [],
      experienceRequired: parsed.experienceRequired || "Not specified",
      keyResponsibilities: Array.isArray(parsed.keyResponsibilities) ? parsed.keyResponsibilities : [],
      educationRequirements: Array.isArray(parsed.educationRequirements) ? parsed.educationRequirements : []
    };
  }
  return extractJobHeuristically(rawText);
}

export async function extractStructuredResume(rawText: string): Promise<StructuredResume> {
  const parsed = await groqJson<StructuredResume>(RESUME_PROMPT, `Resume text to extract:\n\n${rawText.slice(0, 12000)}`);
  if (parsed && Array.isArray(parsed.skills)) {
    return {
      name: parsed.name || "Candidate",
      email: parsed.email || "",
      phone: parsed.phone || "",
      summary: parsed.summary || "",
      skills: parsed.skills || [],
      experience: Array.isArray(parsed.experience) ? parsed.experience : [],
      education: Array.isArray(parsed.education) ? parsed.education : [],
      certifications: Array.isArray(parsed.certifications) ? parsed.certifications : []
    };
  }
  return extractResumeHeuristically(rawText);
}
