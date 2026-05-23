"use client";

import { useEffect, useState } from "react";
import { orgInquiryApi } from "@/lib/api";
import { ContactMessage } from "@/lib/types";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function OrgInquiryPage() {
  const params = useParams();
  const id = params.id as string;

  const [submission, setSubmission] = useState<ContactMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    message: "",
    hrAdminName: "",
    companyDetails: "",
  });

  useEffect(() => {
    const load = async () => {
      try {
        const data = await orgInquiryApi.getSubmission(id);

        if (data.status === "APPROVED") {
          setError("This registration has already been approved. No further changes are needed.");
          setLoading(false);
          return;
        }
        if (data.status === "REJECTED") {
          setError("This registration has been rejected. Please contact our support team if you have questions.");
          setLoading(false);
          return;
        }

        setSubmission(data);
        setForm({
          message: data.message || "",
          hrAdminName: data.hrAdminName || "",
          companyDetails: data.companyDetails || "",
        });
      } catch {
        setError("This link is invalid or has expired. Please contact our support team.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.message.trim()) return;
    setSubmitting(true);
    try {
      await orgInquiryApi.updateSubmission(id, form);
      setSubmitted(true);
    } catch {
      setError("Failed to submit your update. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const bg = (
    <div className="min-h-screen w-full bg-cover bg-center bg-fixed flex flex-col justify-center items-center py-12 px-4 relative" style={{ backgroundImage: `url(/contact-us.jpg)` }}>
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[3px]" />
      <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-cover bg-center bg-fixed flex items-center justify-center relative" style={{ backgroundImage: `url(/contact-us.jpg)` }}>
        <div className="absolute inset-0 bg-black/65 backdrop-blur-[3px]" />
        <p className="relative z-10 text-white/40 font-black uppercase tracking-[0.3em] text-xs animate-pulse">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen w-full bg-cover bg-center bg-fixed flex items-center justify-center px-4 relative" style={{ backgroundImage: `url(/contact-us.jpg)` }}>
        <div className="absolute inset-0 bg-black/65 backdrop-blur-[3px]" />
        <div className="relative z-10 max-w-md w-full bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-10 text-center shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-3">Unable to Load</h2>
          <p className="text-white/50 text-sm leading-relaxed">{error}</p>
          <Link href="/" className="mt-8 inline-block px-6 py-3 bg-white text-slate-900 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-slate-100 transition-all">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen w-full bg-cover bg-center bg-fixed flex items-center justify-center px-4 relative" style={{ backgroundImage: `url(/contact-us.jpg)` }}>
        <div className="absolute inset-0 bg-black/65 backdrop-blur-[3px]" />
        <div className="relative z-10 max-w-md w-full bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-10 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-3">Update Submitted!</h2>
          <p className="text-white/60 text-sm leading-relaxed mb-2">
            Your updated registration details have been received. Our team will review them shortly.
          </p>
          <p className="text-white/30 text-xs leading-relaxed">
            No further action is needed at this time. We&apos;ll reach out at <strong className="text-white/50">{submission?.email}</strong> with our decision.
          </p>
          <Link href="/" className="mt-8 inline-block px-6 py-3 bg-white text-slate-900 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-slate-100 transition-all">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-cover bg-center bg-fixed flex flex-col justify-center py-12 px-4 relative" style={{ backgroundImage: `url(/contact-us.jpg)` }}>
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[3px]" />
      <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 max-w-xl mx-auto w-full">
        {/* Platform label */}
        <div className="text-center mb-8">
          <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] mb-2">ATS Recruitment Platform</p>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Update Your Registration</h1>
          <p className="text-white/50 text-sm mt-2">Our team has a question about your organization registration.</p>
        </div>

        {/* Inquiry message from admin */}
        {submission?.inquiryMessage && (
          <div className="bg-blue-500/10 border border-blue-500/25 rounded-3xl p-6 mb-6 shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Question from our team</p>
            </div>
            <p className="text-sm text-blue-200/90 leading-relaxed whitespace-pre-wrap">{submission.inquiryMessage}</p>
          </div>
        )}

        {/* Form */}
        <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-8 shadow-2xl">
          <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-6">Please update your details below and resubmit for review.</p>

          {error && (
            <div className="mb-5 bg-rose-500/10 border border-rose-500/30 p-4 rounded-xl">
              <p className="text-rose-300 text-xs">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Read-only company name */}
            <div>
              <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1">Company Name</label>
              <div className="w-full px-4 py-3 bg-white/[0.03] border border-white/5 rounded-xl text-white/40 text-sm italic cursor-not-allowed">
                {submission?.name}
              </div>
            </div>

            {/* HR Admin Name */}
            <div>
              <label htmlFor="hrAdminName" className="block text-xs font-bold text-white/60 uppercase tracking-widest mb-1">
                HR Admin Name
              </label>
              <input
                id="hrAdminName"
                type="text"
                placeholder="Jane Smith"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:bg-white/10 transition-all text-sm"
                value={form.hrAdminName}
                onChange={(e) => setForm({ ...form, hrAdminName: e.target.value })}
              />
            </div>

            {/* Company Details */}
            <div>
              <label htmlFor="companyDetails" className="block text-xs font-bold text-white/60 uppercase tracking-widest mb-1">
                Company Details
              </label>
              <textarea
                id="companyDetails"
                rows={3}
                placeholder="Industry, company size, hiring needs..."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:bg-white/10 transition-all text-sm resize-none"
                value={form.companyDetails}
                onChange={(e) => setForm({ ...form, companyDetails: e.target.value })}
              />
            </div>

            {/* Message */}
            <div>
              <label htmlFor="message" className="block text-xs font-bold text-white/60 uppercase tracking-widest mb-1">
                Message <span className="text-blue-400">*</span>
              </label>
              <textarea
                id="message"
                rows={5}
                required
                placeholder="Provide your updated message / clarification here..."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:bg-white/10 transition-all text-sm resize-none"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !form.message.trim()}
              className="w-full py-4 bg-white text-slate-900 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-slate-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-white/10"
            >
              {submitting ? "Submitting..." : "Submit Updated Registration"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
