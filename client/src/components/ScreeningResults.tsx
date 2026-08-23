import React, { useMemo, useState } from "react";
import type { CandidateRecord, ScreeningSummary } from "../types/index.js";
import { CandidateCard } from "./CandidateCard.js";

const FILTERS: { key: string; label: string; color?: string; count: (s: ScreeningSummary | null, n: number) => number }[] = [
  { key: "ALL", label: "All", count: (_s, n) => n },
  { key: "SHORTLIST", label: "Shortlisted", color: "var(--success)", count: (s) => s?.shortlistedCount || 0 },
  { key: "REVIEW", label: "Review", color: "var(--warning)", count: (s) => s?.reviewCount || 0 },
  { key: "REJECT", label: "Rejected", color: "var(--danger)", count: (s) => s?.rejectedCount || 0 }
];

export const ScreeningResults: React.FC<{
  candidates: CandidateRecord[];
  summary: ScreeningSummary | null;
  onSelectCandidate: (c: CandidateRecord) => void;
  onDeleteCandidate: (id: string) => void;
  onClearAll: () => void;
}> = ({ candidates, summary, onSelectCandidate, onDeleteCandidate, onClearAll }) => {
  const [filterRecommendation, setFilterRecommendation] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCandidates = useMemo(() => candidates.filter((c) => {
    if (filterRecommendation !== "ALL" && c.evaluation.recommendation !== filterRecommendation) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return c.structuredResume.name.toLowerCase().includes(q)
      || c.structuredResume.skills.some((s) => s.toLowerCase().includes(q))
      || c.evaluation.matchedSkills.some((s) => s.toLowerCase().includes(q));
  }), [candidates, filterRecommendation, searchQuery]);

  const handleExportJson = () => {
    const a = document.createElement("a");
    a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(candidates, null, 2));
    a.download = "screening_results.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  if (!candidates.length) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-title">No Candidates Screened Yet</div>
          <p className="empty-copy">Provide a job description and upload candidate resumes on the left, then click Screen Candidates to view ranked evaluations and score breakdowns.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {summary && (
        <div className="summary-metrics-grid">
          <div className="metric-card"><span className="metric-label">Total Screened</span><span className="metric-value">{summary.totalScreened}</span></div>
          <div className="metric-card"><span className="metric-label metric-success">Shortlisted</span><span className="metric-value metric-success-val">{summary.shortlistedCount}</span></div>
          <div className="metric-card"><span className="metric-label metric-warning">Under Review</span><span className="metric-value metric-warning-val">{summary.reviewCount}</span></div>
        </div>
      )}

      <div className="filter-bar">
        <div className="filter-group">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`btn-chip ${filterRecommendation === f.key ? "btn-primary" : ""}`}
              style={filterRecommendation === f.key ? { background: f.color || "var(--primary)", color: "#fff" } : {}}
              onClick={() => setFilterRecommendation(f.key)}
            >
              {f.label} ({f.count(summary, candidates.length)})
            </button>
          ))}
        </div>
        <div className="filter-actions">
          <input type="text" className="search-input" placeholder="Search candidate or skill..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          <button type="button" className="btn btn-secondary btn-compact" onClick={handleExportJson}>Export JSON</button>
          <button type="button" className="btn btn-secondary btn-compact" onClick={onClearAll}>Clear History</button>
        </div>
      </div>

      <div className="candidates-list">
        {filteredCandidates.map((candidate, idx) => (
          <CandidateCard key={candidate.id} candidate={candidate} rank={idx + 1} onSelect={onSelectCandidate} onDelete={onDeleteCandidate} />
        ))}
      </div>
    </div>
  );
};
