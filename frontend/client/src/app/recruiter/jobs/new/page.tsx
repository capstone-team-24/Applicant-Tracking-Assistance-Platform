"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { jobsApi } from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import toast from "react-hot-toast";
import { formatDateTime, nowLocalInputValue, toBackendDatetime } from "@/lib/dateUtils";

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
        // Convert local datetime-local value to Spring-safe LocalDateTime format
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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Create New Job Posting
          </h1>
          <p className="text-gray-600 mt-1">
            Fill in the details to create a new job listing.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
            {/* Title */}
            <div>
              <label
                htmlFor="title"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Job Title <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                name="title"
                type="text"
                value={formData.title}
                onChange={handleChange}
                className={`w-full px-4 py-2.5 border rounded-lg text-gray-900 placeholder-gray-400 ${
                  errors.title ? "border-red-300" : "border-gray-300"
                }`}
                placeholder="e.g., Senior Software Engineer"
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">{errors.title}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Job Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                rows={8}
                value={formData.description}
                onChange={handleChange}
                className={`w-full px-4 py-2.5 border rounded-lg text-gray-900 placeholder-gray-400 resize-y ${
                  errors.description ? "border-red-300" : "border-gray-300"
                }`}
                placeholder="Describe the role, responsibilities, and what the candidate will be working on..."
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.description}
                </p>
              )}
            </div>

            {/* Requirements */}
            <div>
              <label
                htmlFor="requirements"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Requirements
              </label>
              <textarea
                id="requirements"
                name="requirements"
                rows={6}
                value={formData.requirements}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 resize-y"
                placeholder="List the qualifications, experience, and skills required..."
              />
            </div>

            {/* Location & Type Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="location"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Location <span className="text-red-500">*</span>
                </label>
                <input
                  id="location"
                  name="location"
                  type="text"
                  value={formData.location}
                  onChange={handleChange}
                  className={`w-full px-4 py-2.5 border rounded-lg text-gray-900 placeholder-gray-400 ${
                    errors.location ? "border-red-300" : "border-gray-300"
                  }`}
                  placeholder="e.g., San Francisco, CA"
                />
                {errors.location && (
                  <p className="mt-1 text-sm text-red-600">{errors.location}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="employmentType"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Employment Type <span className="text-red-500">*</span>
                </label>
                <select
                  id="employmentType"
                  name="employmentType"
                  value={formData.employmentType}
                  onChange={handleChange}
                  className={`w-full px-4 py-2.5 border rounded-lg text-gray-900 ${
                    errors.employmentType ? "border-red-300" : "border-gray-300"
                  } ${!formData.employmentType ? "text-gray-400" : ""}`}
                >
                  <option value="">Select type</option>
                  <option value="FULL_TIME">Full Time</option>
                  <option value="PART_TIME">Part Time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="INTERNSHIP">Internship</option>
                  <option value="REMOTE">Remote</option>
                </select>
                {errors.employmentType && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.employmentType}
                  </p>
                )}
              </div>
            </div>

            {/* Experience Level */}
            <div>
              <label
                htmlFor="experienceLevel"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Experience Level <span className="text-red-500">*</span>
              </label>
              <select
                id="experienceLevel"
                name="experienceLevel"
                value={formData.experienceLevel}
                onChange={handleChange}
                className={`w-full px-4 py-2.5 border rounded-lg text-gray-900 ${
                  errors.experienceLevel ? "border-red-300" : "border-gray-300"
                } ${!formData.experienceLevel ? "text-gray-400" : ""}`}
              >
                <option value="">Select level</option>
                <option value="ENTRY">Entry Level</option>
                <option value="MID">Mid Level</option>
                <option value="SENIOR">Senior</option>
                <option value="LEAD">Lead</option>
                <option value="EXECUTIVE">Executive</option>
              </select>
              {errors.experienceLevel && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.experienceLevel}
                </p>
              )}
            </div>

            {/* Skills */}
            <div>
              <label
                htmlFor="skills"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Required Skills
              </label>
              <input
                id="skills"
                name="skills"
                type="text"
                value={formData.skills}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400"
                placeholder="e.g., React, TypeScript, Node.js, PostgreSQL (comma-separated)"
              />
              <p className="mt-1 text-xs text-gray-500">
                Separate skills with commas
              </p>
              {formData.skills && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {formData.skills
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((skill, i) => (
                      <span
                        key={i}
                        className="inline-flex px-2 py-0.5 rounded-full text-xs bg-primary-100 text-primary-700"
                      >
                        {skill}
                      </span>
                    ))}
                </div>
              )}
            </div>

            {/* Scoring Weights */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Scoring Weights
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                Assign weights to different scoring criteria. These weights will
                be used when ranking candidates.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label
                    htmlFor="skillsMatchWeight"
                    className="block text-xs font-medium text-gray-600 mb-1"
                  >
                    Skills Match
                  </label>
                  <input
                    id="skillsMatchWeight"
                    name="skillsMatchWeight"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.skillsMatchWeight}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                  />
                </div>
                <div>
                  <label
                    htmlFor="experienceMatchWeight"
                    className="block text-xs font-medium text-gray-600 mb-1"
                  >
                    Experience
                  </label>
                  <input
                    id="experienceMatchWeight"
                    name="experienceMatchWeight"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.experienceMatchWeight}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                  />
                </div>
                <div>
                  <label
                    htmlFor="educationMatchWeight"
                    className="block text-xs font-medium text-gray-600 mb-1"
                  >
                    Education
                  </label>
                  <input
                    id="educationMatchWeight"
                    name="educationMatchWeight"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.educationMatchWeight}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                  />
                </div>
                <div>
                  <label
                    htmlFor="overallFitWeight"
                    className="block text-xs font-medium text-gray-600 mb-1"
                  >
                    Overall Fit
                  </label>
                  <input
                    id="overallFitWeight"
                    name="overallFitWeight"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.overallFitWeight}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                  />
                </div>
              </div>
            </div>

            {/* Application Deadline */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                Application Deadline
                <span className="ml-2 text-xs font-normal text-gray-400">(optional)</span>
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                Set a date and time after which the job posting will automatically close and stop accepting applications.
              </p>
              <input
                id="applicationDeadline"
                name="applicationDeadline"
                type="datetime-local"
                value={formData.applicationDeadline}
                onChange={handleChange}
                min={nowLocalInputValue()}
                className="w-full sm:w-72 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {formData.applicationDeadline && (
                <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                  Job will auto-close on {formatDateTime(formData.applicationDeadline)}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => router.back()}
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={(e) => handleSubmit(e, true)}
                  className="px-6 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Creating...
                    </span>
                  ) : (
                    "Create & Publish"
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </ProtectedRoute>
  );
}
