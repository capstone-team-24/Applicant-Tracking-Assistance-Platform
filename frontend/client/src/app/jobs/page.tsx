"use client";

import { useEffect, useState, useCallback } from "react";
import { jobsApi } from "@/lib/api";
import type { Job, JobListParams } from "@/lib/types";
import JobCard from "@/components/JobCard";

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState<JobListParams>({
    page: 1,
    pageSize: 12,
    search: "",
    location: "",
    employmentType: "",
    experienceLevel: "",
    status: "PUBLISHED",
  });

  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: JobListParams = { ...filters };
      Object.keys(params).forEach((key) => {
        const k = key as keyof JobListParams;
        if (params[k] === "") delete params[k];
      });
      const response = await jobsApi.listJobs(params);
      setJobs(response.content || []);
      setTotalPages(response.totalPages || 1);
    } catch {
      setJobs([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters((prev) => ({ ...prev, page: 1 }));
  };

  const handleFilterChange = (
    key: keyof JobListParams,
    value: string | number
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  // Consistent glass styling variables
  const inputClasses = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 focus:bg-white/10 transition-all text-sm";
  const labelClasses = "block text-[10px] uppercase tracking-widest font-black text-white/50 mb-1.5 ml-1";

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden">
      {/* 1. Fixed Background Image */}
      <div 
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: `url('/signup-bg.jpg')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      />

      {/* 2. Dark Tint & Ambient Blur Blobs */}
      <div className="fixed inset-0 z-0 bg-slate-950/50 backdrop-brightness-75" />
      <div className="fixed top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* 3. Main Content Layer */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-black text-white tracking-tight drop-shadow-lg">
            Open Positions
          </h1>
          <p className="text-white/60 mt-2 font-medium">
            Find your next opportunity from our available job listings.
          </p>
        </div>

        {/* Search and Filters Glass Panel */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 mb-10 shadow-2xl shadow-black/20">
          <form onSubmit={handleSearch} className="space-y-6">
            {/* Search bar */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search jobs by title, skills, or description..."
                  value={filters.search || ""}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, search: e.target.value }))
                  }
                  className={`${inputClasses} pl-12 text-base`}
                />
              </div>
              <button
                type="submit"
                className="px-8 py-3 bg-white text-black font-bold rounded-xl hover:bg-white/90 active:scale-95 transition-all shadow-lg shadow-white/5"
              >
                Search
              </button>
            </div>

            {/* Filter row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <label className={labelClasses}>Location</label>
                <input
                  type="text"
                  placeholder="Any location"
                  value={filters.location || ""}
                  onChange={(e) => handleFilterChange("location", e.target.value)}
                  className={inputClasses}
                />
              </div>
              <div>
                <label className={labelClasses}>Employment Type</label>
                <select
                  value={filters.employmentType || ""}
                  onChange={(e) => handleFilterChange("employmentType", e.target.value)}
                  className={`${inputClasses} appearance-none cursor-pointer`}
                >
                  <option value="" className="bg-slate-900 text-white">All Types</option>
                  <option value="FULL_TIME" className="bg-slate-900 text-white">Full Time</option>
                  <option value="PART_TIME" className="bg-slate-900 text-white">Part Time</option>
                  <option value="CONTRACT" className="bg-slate-900 text-white">Contract</option>
                  <option value="INTERNSHIP" className="bg-slate-900 text-white">Internship</option>
                  <option value="REMOTE" className="bg-slate-900 text-white">Remote</option>
                </select>
              </div>
              <div>
                <label className={labelClasses}>Experience Level</label>
                <select
                  value={filters.experienceLevel || ""}
                  onChange={(e) => handleFilterChange("experienceLevel", e.target.value)}
                  className={`${inputClasses} appearance-none cursor-pointer`}
                >
                  <option value="" className="bg-slate-900 text-white">All Levels</option>
                  <option value="ENTRY" className="bg-slate-900 text-white">Entry Level</option>
                  <option value="MID" className="bg-slate-900 text-white">Mid Level</option>
                  <option value="SENIOR" className="bg-slate-900 text-white">Senior</option>
                  <option value="LEAD" className="bg-slate-900 text-white">Lead</option>
                  <option value="EXECUTIVE" className="bg-slate-900 text-white">Executive</option>
                </select>
              </div>
            </div>
          </form>
        </div>

        {/* Results Section */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-8 animate-pulse"
              >
                <div className="h-6 bg-white/20 rounded-lg w-2/3 mb-4" />
                <div className="h-4 bg-white/10 rounded-lg w-1/2 mb-6" />
                <div className="flex gap-2 mb-6">
                  <div className="h-8 bg-white/10 rounded-full w-20" />
                  <div className="h-8 bg-white/10 rounded-full w-24" />
                </div>
                <div className="h-10 bg-white/10 rounded-xl w-32" />
              </div>
            ))}
          </div>
        ) : jobs.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-12 flex items-center justify-center gap-4">
                <button
                  onClick={() => setFilters(prev => ({ ...prev, page: Math.max(1, (prev.page || 1) - 1) }))}
                  disabled={filters.page === 1}
                  className="px-6 py-2 text-sm font-bold text-white bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  Previous
                </button>
                <span className="text-sm font-bold text-white/70">
                  Page <span className="text-white">{filters.page}</span> of <span className="text-white">{totalPages}</span>
                </span>
                <button
                  onClick={() => setFilters(prev => ({ ...prev, page: Math.min(totalPages, (prev.page || 1) + 1) }))}
                  disabled={filters.page === totalPages}
                  className="px-6 py-2 text-sm font-bold text-white bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 p-20 text-center shadow-2xl">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/5 border border-white/10 mb-6">
              <svg className="w-10 h-10 text-white/30" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">No jobs found</h3>
            <p className="text-white/50 max-w-md mx-auto font-medium">
              Try adjusting your filters or search terms. We're always adding new opportunities!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}