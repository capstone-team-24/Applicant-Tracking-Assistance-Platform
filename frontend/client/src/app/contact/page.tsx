"use client";

import { useState } from "react";
import { platformAdminApi } from "@/lib/api";
import Link from "next/link";

export default function ContactUsPage() {
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      await platformAdminApi.submitContactMessage(formData);
      setStatus("success");
      setFormData({ name: "", email: "", message: "" });
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  return (
    <div 
      className="min-h-screen w-full bg-cover bg-center bg-fixed flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative"
      style={{ backgroundImage: `url(/contact-us.jpg)` }}
    >
      {/* Absolute overlay ensures the "darkening" covers the whole scrollable area */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-black text-white uppercase tracking-tighter">
          Contact Us
        </h2>
        <p className="mt-2 text-center text-sm text-white/60 font-medium">
          Interested in our platform for your organization? Get in touch!
        </p>
      </div>

      <div className="relative z-10 mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white/10 backdrop-blur-2xl py-8 px-4 shadow-2xl border border-white/20 sm:rounded-3xl sm:px-10">
          {status === "success" && (
            <div className="mb-4 bg-green-500/20 border border-green-500/40 p-4 rounded-xl">
              <p className="text-green-100 text-sm">
                Message sent successfully! We will get back to you shortly.
              </p>
            </div>
          )}
          {status === "error" && (
            <div className="mb-4 bg-red-500/20 border border-red-500/40 p-4 rounded-xl">
              <p className="text-red-100 text-sm">
                There was an error sending your message. Please try again later.
              </p>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name" className="block text-xs font-bold text-white/70 uppercase tracking-widest ml-1">
                Organization Name
              </label>
              <div className="mt-1">
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className="appearance-none block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl shadow-sm placeholder-white/20 text-white focus:outline-none focus:ring-2 focus:ring-white/20 focus:bg-white/10 transition-all sm:text-sm"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-bold text-white/70 uppercase tracking-widest ml-1">
                Contact Email
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="appearance-none block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl shadow-sm placeholder-white/20 text-white focus:outline-none focus:ring-2 focus:ring-white/20 focus:bg-white/10 transition-all sm:text-sm"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label htmlFor="message" className="block text-xs font-bold text-white/70 uppercase tracking-widest ml-1">
                Message
              </label>
              <div className="mt-1">
                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  required
                  className="appearance-none block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl shadow-sm placeholder-white/20 text-white focus:outline-none focus:ring-2 focus:ring-white/20 focus:bg-white/10 transition-all sm:text-sm resize-none"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-black uppercase tracking-widest text-slate-900 bg-white hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white transition-all disabled:opacity-50"
              >
                {status === "loading" ? "Sending..." : "Send Message"}
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