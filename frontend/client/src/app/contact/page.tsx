"use client";

import { useState } from "react";
import { platformAdminApi } from "@/lib/api";
import Link from "next/link";

export default function ContactUsPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    hrAdminName: "",
    companyDetails: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      await platformAdminApi.submitContactMessage(formData);
      setStatus("success");
      setFormData({ name: "", email: "", hrAdminName: "", companyDetails: "", message: "" });
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div
        className="min-h-screen w-full bg-cover bg-center bg-fixed flex flex-col justify-center items-center py-12 px-4 relative"
        style={{ backgroundImage: `url(/contact-us.jpg)` }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" />
        <div className="relative z-10 max-w-md w-full text-center">
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-10 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-3">
              Request Submitted!
            </h2>
            <p className="text-white/60 text-sm leading-relaxed mb-6">
              Your organization registration request has been received. Our team will review your
              details and get back to you at <strong className="text-white/80">{formData.email || "your email"}</strong> shortly.
            </p>
            <p className="text-white/40 text-xs leading-relaxed mb-8">
              If we need any clarification, we&apos;ll send you a link to update your submission.
            </p>
            <Link
              href="/"
              className="inline-block px-8 py-3 bg-white text-slate-900 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-slate-100 transition-all"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full bg-cover bg-center bg-fixed flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative"
      style={{ backgroundImage: `url(/contact-us.jpg)` }}
    >
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
          {status === "error" && (
            <div className="mb-6 bg-red-500/20 border border-red-500/40 p-4 rounded-xl">
              <p className="text-red-100 text-sm">
                There was an error submitting your request. Please try again later.
              </p>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Company Name */}
            <div>
              <label htmlFor="name" className="block text-xs font-bold text-white/70 uppercase tracking-widest ml-1 mb-1">
                Company Name <span className="text-indigo-400">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="Acme Corporation"
                className="appearance-none block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl shadow-sm placeholder-white/20 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white/10 transition-all sm:text-sm"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            {/* Business Email */}
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-white/70 uppercase tracking-widest ml-1 mb-1">
                Business Email <span className="text-indigo-400">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="hr@yourcompany.com"
                className="appearance-none block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl shadow-sm placeholder-white/20 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white/10 transition-all sm:text-sm"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            {/* HR Admin Name */}
            <div>
              <label htmlFor="hrAdminName" className="block text-xs font-bold text-white/70 uppercase tracking-widest ml-1 mb-1">
                HR Admin Name
              </label>
              <input
                id="hrAdminName"
                name="hrAdminName"
                type="text"
                placeholder="Jane Smith"
                className="appearance-none block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl shadow-sm placeholder-white/20 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white/10 transition-all sm:text-sm"
                value={formData.hrAdminName}
                onChange={(e) => setFormData({ ...formData, hrAdminName: e.target.value })}
              />
              <p className="text-white/30 text-xs mt-1 ml-1">The person who will manage recruitment on the platform</p>
            </div>

            {/* Company Details */}
            <div>
              <label htmlFor="companyDetails" className="block text-xs font-bold text-white/70 uppercase tracking-widest ml-1 mb-1">
                Company Details
              </label>
              <textarea
                id="companyDetails"
                name="companyDetails"
                rows={2}
                placeholder="Industry, company size, what you're looking to hire for..."
                className="appearance-none block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl shadow-sm placeholder-white/20 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white/10 transition-all sm:text-sm resize-none"
                value={formData.companyDetails}
                onChange={(e) => setFormData({ ...formData, companyDetails: e.target.value })}
              />
            </div>

            {/* Message */}
            <div>
              <label htmlFor="message" className="block text-xs font-bold text-white/70 uppercase tracking-widest ml-1 mb-1">
                Message <span className="text-indigo-400">*</span>
              </label>
              <textarea
                id="message"
                name="message"
                rows={4}
                required
                placeholder="Tell us about your hiring needs and why you'd like to join our platform..."
                className="appearance-none block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl shadow-sm placeholder-white/20 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white/10 transition-all sm:text-sm resize-none"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-black uppercase tracking-widest text-slate-900 bg-white hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === "loading" ? "Submitting..." : "Submit Registration Request"}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <Link href="/" className="text-sm text-white/40 hover:text-white transition-colors font-medium">
              Return Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}