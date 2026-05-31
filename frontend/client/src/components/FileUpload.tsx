"use client";

import { useCallback, useState, useRef } from "react";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSizeMB?: number;
  label?: string;
  hint?: string;
}

export default function FileUpload({
  onFileSelect,
  accept = ".pdf,.doc,.docx",
  maxSizeMB = 10,
  label = "Upload File",
  hint = "PDF, DOC, or DOCX up to 10MB",
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback(
    (file: File): boolean => {
      setError(null);
      const maxBytes = maxSizeMB * 1024 * 1024;
      if (file.size > maxBytes) {
        setError(`File size must be less than ${maxSizeMB}MB`);
        return false;
      }
      if (accept) {
        const acceptedTypes = accept.split(",").map((t) => t.trim().toLowerCase());
        const fileExt = "." + file.name.split(".").pop()?.toLowerCase();
        const fileType = file.type.toLowerCase();
        const isAccepted = acceptedTypes.some(
          (t) => t === fileExt || t === fileType || (t.endsWith("/*") && fileType.startsWith(t.replace("/*", "/")))
        );
        if (!isAccepted) {
          setError(`Accepted file types: ${accept}`);
          return false;
        }
      }
      return true;
    },
    [accept, maxSizeMB]
  );

  const handleFile = useCallback(
    (file: File) => {
      if (validateFile(file)) {
        setSelectedFile(file);
        onFileSelect(file);
      }
    },
    [validateFile, onFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleRemove = useCallback(() => {
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  return (
    <div className="w-full">
      <label className="block text-[10px] uppercase tracking-widest font-black text-white/50 mb-2 ml-1">
        {label}
      </label>
      
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`group relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 backdrop-blur-md shadow-xl ${
          isDragging
            ? "border-white/20 bg-white/20 scale-[1.01] shadow-white/5"
            : selectedFile
            ? "border-emerald-500/40 bg-emerald-500/5 shadow-emerald-500/10"
            : "border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          className="hidden"
        />

        {selectedFile ? (
          <div className="flex items-center justify-center gap-4 animate-in fade-in zoom-in duration-300">
            <div className="p-3 bg-emerald-500/20 rounded-xl border border-emerald-500/30 shadow-inner">
              <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-white truncate max-w-[200px]">
                {selectedFile.name}
              </p>
              <p className="text-[11px] font-black uppercase tracking-wider text-white/40">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove();
              }}
              className="ml-4 p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-all border border-white/10"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <>
            <div className="mx-auto w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-white/10 transition-all">
              <svg className="w-7 h-7 text-white/40 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <p className="text-sm text-white/80 font-medium">
              <span className="text-white font-black underline decoration-white/20 underline-offset-4">
                Click to upload
              </span>{" "}
              or drag and drop
            </p>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-widest text-white/30">{hint}</p>
          </>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 animate-in slide-in-from-top-1">
          <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <p className="text-xs font-bold text-red-400 uppercase tracking-tight">{error}</p>
        </div>
      )}
    </div>
  );
}