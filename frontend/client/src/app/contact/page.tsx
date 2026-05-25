"use client";

import { useState, useRef } from "react";
import { platformAdminApi, orgInquiryApi } from "@/lib/api";
import { VerificationDocument } from "@/lib/types";
import Link from "next/link";

export default function ContactUsPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    hrAdminName: "",
    companyDetails: "",
    message: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ACCEPTED = ".pdf,.doc,.docx,.png,.jpg,.jpeg";
  const MAX_FILES = 5;
  const MAX_SIZE_MB = 10;

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const arr = Array.from(incoming);
    const combined = [...files, ...arr].slice(0, MAX_FILES);
    const oversized = combined.filter((f) => f.size > MAX_SIZE_MB * 1024 * 1024);
    if (oversized.length) {
      setErrorMsg(`File "${oversized[0].name}" exceeds the ${MAX_SIZE_MB} MB limit.`);
      return;
    }
    setErrorMsg("");
    setFiles(combined);
  };

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      const msg = await platformAdminApi.submitContactMessage(formData);

      // Upload documents after submission
      if (files.length > 0) {
        for (const file of files) {
          try {
            await orgInquiryApi.uploadDocument(msg.id, file);
          } catch (err) {
            console.error("Failed to upload file:", file.name, err);
          }
        }
      }

      setSubmittedEmail(formData.email);
      setStatus("success");
      setFormData({ name: "", email: "", hrAdminName: "", companyDetails: "", message: "" });
      setFiles([]);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || "There was an error submitting your request. Please try again later.");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="min-h-screen w-full bg-cover bg-center bg-fixed flex flex-col justify-center items-center py-12 px-4 relative" style={{ backgroundImage: `url(/contact-us.jpg)` }}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" />
        <div className="relative z-10 max-w-md w-full text-center">
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-10 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-3">Request Submitted!</h2>
            <p className="text-white/60 text-sm leading-relaxed mb-2">
              Your organization registration request has been received. Our team will review your details and get back to you at{" "}
              <strong className="text-white/80">{submittedEmail}</strong> shortly.
            </p>
            <p className="text-white/30 text-xs leading-relaxed mb-8">
              If we need any clarification, we&apos;ll send you a link to update your submission.
            </p>
            <Link href="/" className="inline-block px-8 py-3 bg-white text-slate-900 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-slate-100 transition-all">
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-cover bg-center bg-fixed flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative" style={{ backgroundImage: `url(/contact-us.jpg)` }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-lg">
        <h2 className="mt-6 text-center text-3xl font-black text-white uppercase tracking-tighter">
          Register Your Organization
        </h2>
        <p className="mt-2 text-center text-sm text-white/60 font-medium">
          Fill in your details and we&apos;ll review your request within 2 business days.
        </p>
      </div>

      <div className="relative z-10 mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white/10 backdrop-blur-2xl py-8 px-4 shadow-2xl border border-white/20 sm:rounded-3xl sm:px-10">
          {(status === "error") && (
            <div className="mb-6 bg-red-500/20 border border-red-500/40 p-4 rounded-xl">
              <p className="text-red-100 text-sm">{errorMsg}</p>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Company Name */}
            <div>
              <label htmlFor="name" className="block text-xs font-bold text-white/70 uppercase tracking-widest mb-1">
                Company Name <span className="text-indigo-400">*</span>
              </label>
              <input id="name" name="name" type="text" required placeholder="Acme Corporation"
                className="appearance-none block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white/10 transition-all sm:text-sm"
                value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>

            {/* Business Email */}
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-white/70 uppercase tracking-widest mb-1">
                Business Email <span className="text-indigo-400">*</span>
              </label>
              <input id="email" name="email" type="email" required placeholder="hr@yourcompany.com"
                className="appearance-none block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white/10 transition-all sm:text-sm"
                value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </div>

            {/* HR Admin Name */}
            <div>
              <label htmlFor="hrAdminName" className="block text-xs font-bold text-white/70 uppercase tracking-widest mb-1">
                HR Admin Name
              </label>
              <input id="hrAdminName" name="hrAdminName" type="text" placeholder="Jane Smith"
                className="appearance-none block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white/10 transition-all sm:text-sm"
                value={formData.hrAdminName} onChange={(e) => setFormData({ ...formData, hrAdminName: e.target.value })} />
              <p className="text-white/30 text-xs mt-1 ml-1">The person who will manage recruitment on the platform</p>
            </div>

            {/* Company Details */}
            <div>
              <label htmlFor="companyDetails" className="block text-xs font-bold text-white/70 uppercase tracking-widest mb-1">
                Company Details
              </label>
              <textarea id="companyDetails" name="companyDetails" rows={2} placeholder="Industry, company size, what you're looking to hire for..."
                className="appearance-none block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white/10 transition-all sm:text-sm resize-none"
                value={formData.companyDetails} onChange={(e) => setFormData({ ...formData, companyDetails: e.target.value })} />
            </div>

            {/* Message */}
            <div>
              <label htmlFor="message" className="block text-xs font-bold text-white/70 uppercase tracking-widest mb-1">
                Message <span className="text-indigo-400">*</span>
              </label>
              <textarea id="message" name="message" rows={4} required placeholder="Tell us about your hiring needs..."
                className="appearance-none block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white/10 transition-all sm:text-sm resize-none"
                value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} />
            </div>

            {/* Verification Documents */}
            <div>
              <label className="block text-xs font-bold text-white/70 uppercase tracking-widest mb-2">
                Verification Documents
              </label>
              <p className="text-white/30 text-xs mb-3">Upload business registration certificates, licenses, or other verification documents (PDF, DOC, DOCX, PNG, JPG — max {MAX_SIZE_MB} MB each, up to {MAX_FILES} files)</p>

              {/* Drop zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
                className="border-2 border-dashed border-white/15 hover:border-indigo-400/50 rounded-2xl p-6 text-center cursor-pointer transition-all group"
              >
                <svg className="w-8 h-8 text-white/20 group-hover:text-indigo-400/60 mx-auto mb-2 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <p className="text-white/40 text-xs group-hover:text-white/60 transition-colors">
                  Click to browse or drag & drop files here
                </p>
                <input ref={fileInputRef} type="file" multiple accept={ACCEPTED} className="hidden"
                  onChange={(e) => addFiles(e.target.files)} />
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div className="mt-3 space-y-2">
                  {files.map((file, i) => (
                    <div key={i} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                      <svg className="w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium truncate">{file.name}</p>
                        <p className="text-white/30 text-[10px]">{formatSize(file.size)}</p>
                      </div>
                      <button type="button" onClick={() => removeFile(i)} className="text-white/30 hover:text-rose-400 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <button type="submit" disabled={status === "loading"}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-black uppercase tracking-widest text-slate-900 bg-white hover:bg-slate-100 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {status === "loading" ? "Submitting..." : "Submit Registration Request"}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <Link href="/" className="text-sm text-white/40 hover:text-white transition-colors font-medium">Return Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}