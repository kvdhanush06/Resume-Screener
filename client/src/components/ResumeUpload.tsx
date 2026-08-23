import React, { useState, useRef } from "react";

interface ResumeUploadProps {
  files: File[];
  onAddFiles: (newFiles: File[]) => void;
  onRemoveFile: (index: number) => void;
  manualText: string;
  onManualTextChange: (val: string) => void;
}

export const ResumeUpload: React.FC<ResumeUploadProps> = ({ files, onAddFiles, onRemoveFile, manualText, onManualTextChange }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeMode, setActiveMode] = useState<"file" | "text">("file");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const takeFiles = (list: FileList | null) => { if (list?.length) onAddFiles(Array.from(list)); };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title-group">
          <div className="card-title">2. Candidate Resumes</div>
          <div className="card-description">Upload single/multiple PDF and TXT resumes or paste candidate text.</div>
        </div>
        <div className="chip-row">
          <button type="button" className={`btn-chip ${activeMode === "file" ? "btn-primary" : ""}`} onClick={() => setActiveMode("file")}>File Upload</button>
          <button type="button" className={`btn-chip ${activeMode === "text" ? "btn-primary" : ""}`} onClick={() => setActiveMode("text")}>Raw Text</button>
        </div>
      </div>

      {activeMode === "file" ? (
        <>
          <div
            className={`dropzone-container ${isDragOver ? "drag-over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragOver(false); takeFiles(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input type="file" ref={fileInputRef} className="hidden-input" multiple accept=".pdf,.txt" onChange={(e) => takeFiles(e.target.files)} />
            <div className="dropzone-primary-text">Click to browse or drop PDF / TXT resumes here</div>
            <div className="dropzone-sub-text">Supports single or batch file uploads (up to 10MB per file)</div>
          </div>
          {files.length > 0 && (
            <div className="file-list">
              {files.map((file, idx) => (
                <div key={`${file.name}-${idx}`} className="file-item">
                  <span className="file-name">{file.name}</span>
                  <span className="muted">{(file.size / 1024).toFixed(1)} KB</span>
                  <button type="button" className="btn-remove-file" onClick={(e) => { e.stopPropagation(); onRemoveFile(idx); }}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <textarea className="textarea-field" placeholder="Paste raw candidate resume text here..." value={manualText} onChange={(e) => onManualTextChange(e.target.value)} rows={10} />
      )}
    </div>
  );
};
