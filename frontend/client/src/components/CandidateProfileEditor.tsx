"use client";

import { useEffect, useState } from "react";
import type { Profile } from "@/lib/types";

type CandidateProfileEditorProps = {
  profile: Profile | null;
  isSaving: boolean;
  onSave: (data: Partial<Profile>) => Promise<void>;
  submitLabel?: string;
};

type FormState = {
  firstName: string;
  lastName: string;
  headline: string;
  location: string;
  phone: string;
  yearsOfExperience: string;
  bio: string;
  linkedinUrl: string;
  portfolioUrl: string;
  websiteUrl: string;
};

const emptyForm: FormState = {
  firstName: "",
  lastName: "",
  headline: "",
  location: "",
  phone: "",
  yearsOfExperience: "",
  bio: "",
  linkedinUrl: "",
  portfolioUrl: "",
  websiteUrl: "",
};

export default function CandidateProfileEditor({
  profile,
  isSaving,
  onSave,
  submitLabel = "Save profile",
}: CandidateProfileEditorProps) {
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    setForm({
      firstName: profile?.firstName ?? "",
      lastName: profile?.lastName ?? "",
      headline: profile?.headline ?? "",
      location: profile?.location ?? "",
      phone: profile?.phone ?? "",
      yearsOfExperience:
        profile?.yearsOfExperience != null ? String(profile.yearsOfExperience) : "",
      bio: profile?.bio ?? "",
      linkedinUrl: profile?.linkedinUrl ?? "",
      portfolioUrl: profile?.portfolioUrl ?? "",
      websiteUrl: profile?.websiteUrl ?? "",
    });
  }, [profile]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await onSave({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      headline: form.headline.trim(),
      location: form.location.trim(),
      phone: form.phone.trim(),
      bio: form.bio.trim(),
      linkedinUrl: form.linkedinUrl.trim(),
      portfolioUrl: form.portfolioUrl.trim(),
      websiteUrl: form.websiteUrl.trim(),
      yearsOfExperience:
        form.yearsOfExperience.trim() === ""
          ? undefined
          : Number(form.yearsOfExperience),
    });
  };

  const inputClassName =
    "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-white/20";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
            First Name
          </label>
          <input
            name="firstName"
            value={form.firstName}
            onChange={handleChange}
            className={inputClassName}
            placeholder="Jane"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
            Last Name
          </label>
          <input
            name="lastName"
            value={form.lastName}
            onChange={handleChange}
            className={inputClassName}
            placeholder="Smith"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
            Professional Headline
          </label>
          <input
            name="headline"
            value={form.headline}
            onChange={handleChange}
            className={inputClassName}
            placeholder="Product designer focused on fintech"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
            Location
          </label>
          <input
            name="location"
            value={form.location}
            onChange={handleChange}
            className={inputClassName}
            placeholder="Nairobi, Kenya"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
            Phone
          </label>
          <input
            name="phone"
            value={form.phone}
            onChange={handleChange}
            className={inputClassName}
            placeholder="+254 700 000 000"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
            Years of Experience
          </label>
          <input
            name="yearsOfExperience"
            type="number"
            min="0"
            value={form.yearsOfExperience}
            onChange={handleChange}
            className={inputClassName}
            placeholder="4"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
          About You
        </label>
        <textarea
          name="bio"
          value={form.bio}
          onChange={handleChange}
          rows={5}
          className={`${inputClassName} resize-none py-4`}
          placeholder="Share your strengths, work style, and the kind of roles you are targeting."
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
            LinkedIn URL
          </label>
          <input
            name="linkedinUrl"
            type="url"
            value={form.linkedinUrl}
            onChange={handleChange}
            className={inputClassName}
            placeholder="https://linkedin.com/in/you"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
            Portfolio URL
          </label>
          <input
            name="portfolioUrl"
            type="url"
            value={form.portfolioUrl}
            onChange={handleChange}
            className={inputClassName}
            placeholder="https://portfolio.example.com"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
            Website URL
          </label>
          <input
            name="websiteUrl"
            type="url"
            value={form.websiteUrl}
            onChange={handleChange}
            className={inputClassName}
            placeholder="https://your-site.example"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isSaving}
        className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-100 disabled:opacity-50"
      >
        {isSaving ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
