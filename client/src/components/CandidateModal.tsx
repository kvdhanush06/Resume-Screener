import React, { useState } from "react";
import type { CandidateRecord } from "../types/index.js";
import { ScoreBreakdown } from "./ScoreBreakdown.js";

const badgeClass = (rec: string) => rec === "SHORTLIST" ? "badge-shortlist" : rec === "REVIEW" ? "badge-review" : "badge-reject";

export const CandidateModal: React.FC<{ candidate: CandidateRecord | null; onClose: () => void }> = ({ candidate, onClose }) => {
  const [showRawResume, setShowRawResume] = useState(false);
  if (!candidate) return null;

  const { structuredResume, evaluation, structuredJob } = candidate;
  const tags = (items: string[], cls: string, empty: string) =>
    items.length ? items.map((s) => <span key={s} className={cls}>{s}</span>) : <span className="muted">{empty}</span>;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="card-title">{structuredResume.name}</h2>
            <div className="card-description">Evaluated for: {candidate.jobTitle || structuredJob.title}</div>
          </div>
          <div className={`score-badge-large ${badgeClass(evaluation.recommendation)}`}>
            <span>{evaluation.overallScore} / 100</span>
            <span className="score-sub-lg">{evaluation.recommendation}</span>
          </div>
        </div>

        <div className="modal-body">
          <div>
            <div className="modal-section-title">Evaluation Summary & Justification</div>
            <p className="justification-body">{evaluation.justification}</p>
          </div>
          <div>
            <div className="modal-section-title">Dimension Scoring Breakdown</div>
            <ScoreBreakdown scores={evaluation.dimensionScores} />
          </div>
          <div className="modal-split">
            <div className="surface-box">
              <div className="modal-section-title title-success">Key Strengths</div>
              <ul className="bullet-list">{evaluation.strengths.map((item, i) => <li key={i}>{item}</li>)}</ul>
            </div>
            <div className="surface-box">
              <div className="modal-section-title title-danger">Gaps & Missing Requirements</div>
              <ul className="bullet-list">{evaluation.gaps.map((item, i) => <li key={i}>{item}</li>)}</ul>
            </div>
          </div>
          <div>
            <div className="modal-section-title">Skills Analysis</div>
            <div className="stack-sm">
              <div className="skill-tags-group"><span className="skill-tag-label">Matched Skills:</span>{tags(evaluation.matchedSkills, "tag-matched", "None directly matched")}</div>
              <div className="skill-tags-group"><span className="skill-tag-label">Missing Skills:</span>{tags(evaluation.missingSkills, "tag-missing", "No critical missing skills")}</div>
            </div>
          </div>
          <div>
            <div className="modal-section-title">Candidate Profile & Experience</div>
            <div className="profile-stack">
              <div><strong>Contact:</strong> {structuredResume.email || "No email"} | {structuredResume.phone || "No phone"}</div>
              {structuredResume.summary && <div><strong>Profile Summary:</strong> {structuredResume.summary}</div>}
              {structuredResume.experience?.length > 0 && (
                <div>
                  <strong>Work Experience:</strong>
                  <div className="exp-list">
                    {structuredResume.experience.map((exp, i) => (
                      <div key={i} className="exp-card">
                        <div className="fw-600">{exp.role} - {exp.company}</div>
                        <div className="muted">{exp.duration}</div>
                        {exp.responsibilities?.length > 0 && <ul className="bullet-list tight">{exp.responsibilities.map((r, j) => <li key={j}>{r}</li>)}</ul>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {structuredResume.education?.length > 0 && (
                <div>
                  <strong>Education:</strong>
                  <div className="edu-list">{structuredResume.education.map((edu, i) => <div key={i}>- {edu.degree}, {edu.institution} ({edu.year})</div>)}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer space-between">
          <button type="button" className="btn btn-secondary" onClick={() => setShowRawResume((v) => !v)}>
            {showRawResume ? "Hide" : "View"} Original Resume Text
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close Evaluation</button>
        </div>

        {showRawResume && (
          <div className="raw-resume-wrap">
            <div className="modal-section-title raw-title">Original Resume Text — {candidate.filename}</div>
            <pre className="resume-pre">{candidate.rawResumeText}</pre>
          </div>
        )}
      </div>
    </div>
  );
};
