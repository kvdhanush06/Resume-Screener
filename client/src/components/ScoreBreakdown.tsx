import React from "react";
import type { DimensionScores } from "../types/index.js";

const DIMENSIONS: { label: string; weight: string; key: keyof DimensionScores }[] = [
  { label: "Required Skills", weight: "40%", key: "requiredSkillsScore" },
  { label: "Experience", weight: "25%", key: "experienceScore" },
  { label: "Responsibilities", weight: "20%", key: "responsibilitiesScore" },
  { label: "Education", weight: "10%", key: "educationScore" }
];

export const ScoreBreakdown: React.FC<{ scores: DimensionScores }> = ({ scores }) => (
  <div className="score-dimension-bars">
    {DIMENSIONS.map((dim) => {
      const score = scores[dim.key];
      return (
        <div key={dim.label} className="dimension-item">
          <div className="dimension-label-row">
            <span>{dim.label} ({dim.weight})</span>
            <span className="fw-600">{score}/100</span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${Math.min(100, Math.max(0, score))}%`,
                backgroundColor: score >= 75 ? "var(--success)" : score >= 50 ? "var(--warning)" : "var(--danger)"
              }}
            />
          </div>
        </div>
      );
    })}
  </div>
);
