import React from "react";
import type { CandidateRecord } from "../types/index.js";
import { ScoreBreakdown } from "./ScoreBreakdown.js";

const badgeClass = (rec: string) => rec === "SHORTLIST" ? "badge-shortlist" : rec === "REVIEW" ? "badge-review" : "badge-reject";

export const CandidateCard: React.FC<{
  candidate: CandidateRecord;
  rank: number;
  onSelect: (c: CandidateRecord) => void;
  onDelete: (id: string) => void;
}> = ({ candidate, rank, onSelect, onDelete }) => {
  const { structuredResume, evaluation } = candidate;
  return (
    <div className="candidate-card">
      <div className="candidate-card-header">
        <div>
          <div className="candidate-name-row">
            <span className="rank-index">#{rank}</span>
            <div className="candidate-name">{structuredResume.name}</div>
          </div>
          <div className="candidate-meta">
            <span>{candidate.filename}</span>
            {structuredResume.email && <span>{structuredResume.email}</span>}
            <span>Role: {candidate.jobTitle}</span>
          </div>
        </div>
        <div className={`score-badge-large ${badgeClass(evaluation.recommendation)}`}>
          <span>{evaluation.overallScore} / 100</span>
          <span className="score-sub">{evaluation.recommendation}</span>
        </div>
      </div>

      <ScoreBreakdown scores={evaluation.dimensionScores} />

      <div className="candidate-skills-row">
        <div className="skill-tags-group">
          <span className="skill-tag-label">Matched Skills:</span>
          {evaluation.matchedSkills.length ? evaluation.matchedSkills.slice(0, 6).map((skill) => <span key={skill} className="tag-matched">{skill}</span>) : <span className="muted">None detected</span>}
          {evaluation.matchedSkills.length > 6 && <span className="muted">+{evaluation.matchedSkills.length - 6} more</span>}
        </div>
        {evaluation.missingSkills.length > 0 && (
          <div className="skill-tags-group">
            <span className="skill-tag-label">Missing Skills:</span>
            {evaluation.missingSkills.slice(0, 5).map((skill) => <span key={skill} className="tag-missing">{skill}</span>)}
            {evaluation.missingSkills.length > 5 && <span className="muted">+{evaluation.missingSkills.length - 5} more</span>}
          </div>
        )}
      </div>

      <div className="candidate-footer-row">
        <div className="justification-snippet"><strong>Recruiter Note:</strong> {evaluation.justification}</div>
        <div className="btn-row">
          <button type="button" className="btn btn-secondary btn-compact" onClick={() => onSelect(candidate)}>View Details</button>
          <button type="button" className="btn btn-danger-outline btn-compact" onClick={() => onDelete(candidate.id)}>Remove</button>
        </div>
      </div>
    </div>
  );
};
