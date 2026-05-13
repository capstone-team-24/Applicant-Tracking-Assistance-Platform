"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { jobsApi } from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import toast from "react-hot-toast";
import {
  formatDateTime,
  nowLocalInputValue,
  toBackendDatetime,
} from "@/lib/dateUtils";


interface FormErrors {
  title?: string;
  description?: string;
  requirements?: string;
  location?: string;
  employmentType?: string;
  experienceLevel?: string;
  skills?: string;
}

export default function CreateJobPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    requirements: "",
    location: "",
    employmentType: "",
    experienceLevel: "",
    skills: "",
    skillsMatchWeight: "25",
    experienceMatchWeight: "25",
    educationMatchWeight: "25",
   overallFitWeight: "25",
applicationDeadline: "",
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!formData.title.trim()) newErrors.title = "Job title is required";
    if (!formData.description.trim())
      newErrors.description = "Description is required";
    if (!formData.location.trim()) newErrors.location = "Location is required";
    if (!formData.employmentType)
      newErrors.employmentType = "Employment type is required";
    if (!formData.experienceLevel)
      newErrors.experienceLevel = "Experience level is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent, publish: boolean = false) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const skills = formData.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const jobData = {
        title: formData.title,
        description: formData.description,
        requirements: formData.requirements,
        location: formData.location,
        employmentType: formData.employmentType,
        experienceLevel: formData.experienceLevel,
        skills,
       scoringWeights: {
  skillsMatch: parseInt(formData.skillsMatchWeight) || 25,
  experienceMatch: parseInt(formData.experienceMatchWeight) || 25,
  educationMatch: parseInt(formData.educationMatchWeight) || 25,
  overallFit: parseInt(formData.overallFitWeight) || 25,
},

applicationDeadline: formData.applicationDeadline
  ? toBackendDatetime(formData.applicationDeadline)
  : undefined,
      };

      const job = await jobsApi.createJob(jobData);

      if (publish) {
        await jobsApi.publishJob(job.id);
        toast.success("Job created and published!");
      } else {
        toast.success("Job saved as draft!");
      }

      router.push(`/recruiter/jobs/${job.id}`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to create job");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ProtectedRoute requiredRole="RECRUITER">
      <div 
        className="min-h-screen w-full bg-cover bg-center bg-fixed relative flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 transition-all duration-500"
        style={{ backgroundImage: `url(/bk2.jpg)`}}
      >
        {/* Liquid Overlays */}
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-[2px]" />
        <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-3xl">
          {/* Header */}
          <div className="mb-10 px-2">
            <h1 className="text-4xl font-bold text-white tracking-tight drop-shadow-md">
              Create New Job Posting
            </h1>
            <p className="text-gray-400 mt-2 font-medium">
              Fill in the details to create a new job listing.
            </p>
          </div>

          {/* Glass Form Card */}
          <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 sm:p-12 backdrop-blur-3xl shadow-2xl shadow-black/50 ring-1 ring-white/20">
            <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-8">
              
              {/* Title */}
              <div>
                <label htmlFor="title" className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  Job Title <span className="text-red-500">*</span>
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  value={formData.title}
                  onChange={handleChange}
                  className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                    errors.title ? "border-red-500/50" : "border-white/10"
                  }`}
                  placeholder="e.g., Senior Software Engineer"
                />
                {errors.title && <p className="mt-2 text-xs text-red-400 font-semibold ml-1">{errors.title}</p>}
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  Job Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={8}
                  value={formData.description}
                  onChange={handleChange}
                  className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all resize-y ${
                    errors.description ? "border-red-500/50" : "border-white/10"
                  }`}
                  placeholder="Describe the role, responsibilities, and what the candidate will be working on..."
                />
                {errors.description && <p className="mt-2 text-xs text-red-400 font-semibold ml-1">{errors.description}</p>}
              </div>

              {/* Requirements */}
              <div>
                <label htmlFor="requirements" className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  Requirements
                </label>
                <textarea
                  id="requirements"
                  name="requirements"
                  rows={6}
                  value={formData.requirements}
                  onChange={handleChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all resize-y"
                  placeholder="List the qualifications, experience, and skills required..."
                />
              </div>

              {/* Location & Type Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="location" className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">
                    Location <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="location"
                    name="location"
                    type="text"
                    value={formData.location}
                    onChange={handleChange}
                    className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                      errors.location ? "border-red-500/50" : "border-white/10"
                    }`}
                    placeholder="e.g., San Francisco, CA"
                  />
                  {errors.location && <p className="mt-2 text-xs text-red-400 font-semibold ml-1">{errors.location}</p>}
                </div>

                <div>
                  <label htmlFor="employmentType" className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">
                    Employment Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="employmentType"
                    name="employmentType"
                    value={formData.employmentType}
                    onChange={handleChange}
                    className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none cursor-pointer ${
                      errors.employmentType ? "border-red-500/50" : "border-white/10"
                    } ${!formData.employmentType ? "text-white/20" : "text-white"}`}
                  >
                    <option value="" className="bg-slate-900">Select type</option>
                    <option value="FULL_TIME" className="bg-slate-900">Full Time</option>
                    <option value="PART_TIME" className="bg-slate-900">Part Time</option>
                    <option value="CONTRACT" className="bg-slate-900">Contract</option>
                    <option value="INTERNSHIP" className="bg-slate-900">Internship</option>
                    <option value="REMOTE" className="bg-slate-900">Remote</option>
                  </select>
                  {errors.employmentType && <p className="mt-2 text-xs text-red-400 font-semibold ml-1">{errors.employmentType}</p>}
                </div>
              </div>

              {/* Experience Level */}
              <div>
                <label htmlFor="experienceLevel" className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  Experience Level <span className="text-red-500">*</span>
                </label>
                <select
                  id="experienceLevel"
                  name="experienceLevel"
                  value={formData.experienceLevel}
                  onChange={handleChange}
                  className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none cursor-pointer ${
                    errors.experienceLevel ? "border-red-500/50" : "border-white/10"
                  } ${!formData.experienceLevel ? "text-white/20" : "text-white"}`}
                >
                  <option value="" className="bg-slate-900">Select level</option>
                  <option value="ENTRY" className="bg-slate-900">Entry Level</option>
                  <option value="MID" className="bg-slate-900">Mid Level</option>
                  <option value="SENIOR" className="bg-slate-900">Senior</option>
                  <option value="LEAD" className="bg-slate-900">Lead</option>
                  <option value="EXECUTIVE" className="bg-slate-900">Executive</option>
                </select>
                {errors.experienceLevel && <p className="mt-2 text-xs text-red-400 font-semibold ml-1">{errors.experienceLevel}</p>}
              </div>

              {/* Skills */}
              <div>
                <label htmlFor="skills" className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  Required Skills
                </label>
                <input
                  id="skills"
                  name="skills"
                  type="text"
                  value={formData.skills}
                  onChange={handleChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  placeholder="e.g., React, TypeScript, Node.js"
                />
                <p className="mt-2 text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1">
                  Separate skills with commas
                </p>
                {formData.skills && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {formData.skills.split(",").map((s) => s.trim()).filter(Boolean).map((skill, i) => (
                      <span key={i} className="px-3 py-1 rounded-lg text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Scoring Weights Section */}
              <div className="border-t border-white/10 pt-8 mt-10">
                <h3 className="text-lg font-bold text-white tracking-tight mb-2">Scoring Weights</h3>
                <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                  Assign weights to different scoring criteria for candidate ranking.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { id: "skillsMatchWeight", label: "Skills Match" },
                    { id: "experienceMatchWeight", label: "Experience" },
                    { id: "educationMatchWeight", label: "Education" },
                    { id: "overallFitWeight", label: "Overall Fit" }
                  ].map((weight) => (
                    <div key={weight.id}>
                      <label htmlFor={weight.id} className="block text-[10px] font-bold text-gray-500 uppercase tracking-tighter mb-2 ml-1">
                        {weight.label}
                      </label>
                      <input
                        id={weight.id}
                        name={weight.id}
                        type="number"
                        min="0"
                        max="100"
                        value={formData[weight.id]}
                        onChange={handleChange}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                      />
                    </div>
                  ))}
                </div>
              </div>
			  
			  {/* Application Deadline */}
<div className="border-t border-white/10 pt-8 mt-10">
  <div className="flex items-center gap-2 mb-2">
    <h3 className="text-lg font-bold text-white tracking-tight">
      Application Deadline
    </h3>

    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-gray-400">
      Optional
    </span>
  </div>

  <p className="text-xs text-gray-400 mb-5 leading-relaxed max-w-xl">
    Set a date and time after which the job posting will automatically
    close and stop accepting applications.
  </p>

  <div className="flex flex-col gap-3">
    <input
      id="applicationDeadline"
      name="applicationDeadline"
      type="datetime-local"
      value={formData.applicationDeadline}
      onChange={handleChange}
      min={nowLocalInputValue()}
      className="w-full sm:w-[340px] bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
    />

    {formData.applicationDeadline && (
      <div className="inline-flex items-center gap-2 w-fit px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-400/20 text-amber-300 text-xs font-medium">
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        </svg>

        <span>
          Job will auto-close on{" "}
          {formatDateTime(formData.applicationDeadline)}
        </span>
      </div>
    )}
  </div>
</div>


              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-8 border-t border-white/10 mt-10">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="text-sm font-bold text-gray-400 hover:text-white transition-colors underline-offset-4 hover:underline"
                >
                  Cancel
                </button>
                <div className="flex gap-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-3 bg-white/5 text-gray-300 font-bold rounded-xl border border-white/10 hover:bg-white/10 transition-all disabled:opacity-50"
                  >
                    Save as Draft
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={(e) => handleSubmit(e, true)}
                    className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/30 disabled:opacity-50 active:scale-95 flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Creating...</span>
                      </>
                    ) : "Create & Publish"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
  }
