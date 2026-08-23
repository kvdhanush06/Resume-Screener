import React, { useState, useEffect } from "react";
import type { CandidateRecord, ScreeningSummary } from "./types/index.js";
import { fetchCandidates, screenCandidates, deleteCandidateRecord, clearAllCandidateRecords } from "./services/api.js";
import { ResumeUpload } from "./components/ResumeUpload.js";
import { ScreeningResults } from "./components/ScreeningResults.js";
import { CandidateModal } from "./components/CandidateModal.js";

export const App: React.FC = () => {
  const [jobDescription, setJobDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [manualResumeText, setManualResumeText] = useState("");
  const [candidates, setCandidates] = useState<CandidateRecord[]>([]);
  const [summary, setSummary] = useState<ScreeningSummary | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateRecord | null>(null);
  const [isScreening, setIsScreening] = useState(false);
  const [activeTab, setActiveTab] = useState<"screen" | "results">("screen");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const notify = (msg: string, ms = 2500) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), ms);
  };

  useEffect(() => {
    fetchCandidates()
      .then((data) => {
        setCandidates(data.candidates || []);
        setSummary(data.summary || null);
        if (data.candidates?.length) setActiveTab("results");
      })
      .catch(() => {});
  }, []);

  const handleScreen = async () => {
    if (!jobDescription.trim()) { setErrorMessage("Please enter a job description before screening."); return; }
    if (!files.length && !manualResumeText.trim()) { setErrorMessage("Please add at least one resume file or paste resume text."); return; }
    setErrorMessage(null);
    setIsScreening(true);
    try {
      const response = await screenCandidates(jobDescription, files, manualResumeText);
      setCandidates(response.candidates);
      setSummary(response.summary);
      setActiveTab("results");
      notify(`Screened ${response.candidates.length} candidate(s) successfully.`, 4000);
    } catch (err) {
      setErrorMessage((err as Error).message || "An error occurred during screening.");
    } finally {
      setIsScreening(false);
    }
  };

  const handleDeleteCandidate = async (id: string) => {
    try {
      await deleteCandidateRecord(id);
      setCandidates(candidates.filter((c) => c.id !== id));
      setSummary((await fetchCandidates()).summary);
      notify("Candidate record deleted.");
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Are you sure you want to clear all screening records?")) return;
    try {
      await clearAllCandidateRecords();
      setCandidates([]);
      setSummary(null);
      notify("All candidate records cleared.");
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-content">
          <div className="header-brand">
            <div className="brand-icon">RS</div>
            <div>
              <div className="brand-title">Resume Screener</div>
              <div className="brand-subtitle">Automated Candidate Parsing & Semantic Job Alignment</div>
            </div>
          </div>
        </div>
      </header>

      <main className="main-content">
        {notification && <div className="alert-banner info">{notification}</div>}
        {errorMessage && <div className="alert-banner warning">{errorMessage}</div>}

        <nav className="tabs-navigation">
          <button type="button" className={`tab-btn ${activeTab === "screen" ? "active" : ""}`} onClick={() => setActiveTab("screen")}>
            Candidate Screening Setup
          </button>
          <button type="button" className={`tab-btn ${activeTab === "results" ? "active" : ""}`} onClick={() => setActiveTab("results")}>
            Ranked Evaluation Results
            {candidates.length > 0 && <span className="tab-count">{candidates.length}</span>}
          </button>
        </nav>

        {activeTab === "screen" ? (
          <div>
            <div className="grid-two-columns">
              <div className="card">
                <div className="card-header">
                  <div className="card-title-group">
                    <div className="card-title">1. Job Description</div>
                    <div className="card-description">Specify technical criteria, required qualifications, and responsibilities.</div>
                  </div>
                </div>
                <textarea className="textarea-field" placeholder="Paste complete job description here..." value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} rows={10} />
              </div>
              <ResumeUpload
                files={files}
                onAddFiles={(incoming) => setFiles((prev) => [...prev, ...incoming])}
                onRemoveFile={(index) => setFiles((prev) => prev.filter((_, i) => i !== index))}
                manualText={manualResumeText}
                onManualTextChange={setManualResumeText}
              />
            </div>
            <div className="actions-footer">
              <button type="button" className="btn btn-secondary" onClick={() => { setFiles([]); setManualResumeText(""); }} disabled={isScreening}>Reset Files</button>
              <button type="button" className="btn btn-primary" onClick={handleScreen} disabled={isScreening} style={{ minWidth: "180px" }}>
                {isScreening ? "Processing Candidates..." : "Screen Candidates"}
              </button>
            </div>
          </div>
        ) : (
          <ScreeningResults candidates={candidates} summary={summary} onSelectCandidate={setSelectedCandidate} onDeleteCandidate={handleDeleteCandidate} onClearAll={handleClearAll} />
        )}
      </main>

      <CandidateModal candidate={selectedCandidate} onClose={() => setSelectedCandidate(null)} />
    </div>
  );
};
