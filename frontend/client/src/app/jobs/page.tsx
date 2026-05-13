"use client";

import { useEffect, useState, useCallback } from "react";
import { jobsApi } from "@/lib/api";
import type { Job, JobListParams } from "@/lib/types";
import JobCard from "@/components/JobCard";

// ── Shared Background Wrapper ─────────────────────────────────────────────
function GlassPageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div 
      className="min-h-screen w-full bg-cover bg-center bg-fixed relative flex flex-col items-center py-12 px-4"
      style={{ backgroundImage: `url(/bk2.jpg)` }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" />
      {/* Ambient Blur Blobs */}
      <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />
      
      <div className="relative z-10 w-full max-w-7xl">
        {children}
      </div>
    </div>
  );
}

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

  // Modern Glass Classes
  const inputClasses = "w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 focus:bg-white/[0.08] transition-all text-sm";
  const labelClasses = "block text-[10px] uppercase tracking-[0.2em] font-black text-white/40 mb-2 ml-1";

  return (
    <GlassPageWrapper>
      {/* Header Section */}
      <div className="mb-12 ml-4">
        <h1 className="text-4xl lg:text-6xl font-black text-white tracking-tighter italic uppercase leading-none mb-4">
          Open Positions
        </h1>
        <p className="text-white/40 font-black uppercase tracking-[0.3em] text-[10px]">
          Engineering the future of design
        </p>
      </div>

      {/* Filter Glass Panel */}
      <div className="bg-white/10 backdrop-blur-3xl rounded-[3rem] border border-white/20 p-8 lg:p-12 mb-12 shadow-2xl relative overflow-hidden">
        {/* Subtle decorative line */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        
        <form onSubmit={handleSearch} className="space-y-8 relative z-10">
          {/* Search bar */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <svg className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="text"
                placeholder="Search by title, stack, or role..."
                value={filters.search || ""}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, search: e.target.value }))
                }
                className={`${inputClasses} pl-14 text-base font-medium italic`}
              />
            </div>
            <button
              type="submit"
              className="px-10 py-4 bg-white text-slate-950 font-black uppercase tracking-[0.2em] text-[11px] rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-white/10"
            >
              Filter Results
            </button>
          </div>

          {/* Secondary Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div>
              <label className={labelClasses}>Geography</label>
              <input
                type="text"
                placeholder="Global / Remote"
                value={filters.location || ""}
                onChange={(e) => handleFilterChange("location", e.target.value)}
                className={inputClasses}
              />
            </div>
            <div>
              <label className={labelClasses}>Engagement Type</label>
              <select
                value={filters.employmentType || ""}
                onChange={(e) => handleFilterChange("employmentType", e.target.value)}
                className={`${inputClasses} appearance-none cursor-pointer`}
              >
               <option value="FULL_TIME" className="bg-slate-900">
  Full Time
</option>

<option value="PART_TIME" className="bg-slate-900">
  Part Time
</option>

<option value="CONTRACT" className="bg-slate-900">
  Contract
</option>

<option value="INTERNSHIP" className="bg-slate-900">
  Internship
</option>

<option value="REMOTE" className="bg-slate-900">
  Remote Only
</option>
              </select>
            </div>
            <div>
              <label className={labelClasses}>Expertise Level</label>
              <select
                value={filters.experienceLevel || ""}
                onChange={(e) => handleFilterChange("experienceLevel", e.target.value)}
                className={`${inputClasses} appearance-none cursor-pointer`}
              >
                <option value="" className="bg-slate-900">All Level</option>
               <option value="ENTRY" className="bg-slate-900">
  Entry
</option>

<option value="MID" className="bg-slate-900">
  Mid-Level
</option>

<option value="SENIOR" className="bg-slate-900">
  Senior
</option>

<option value="LEAD" className="bg-slate-900">
  Lead / Principal
</option>

<option value="EXECUTIVE" className="bg-slate-900">
  Executive
</option>
              </select>
            </div>
          </div>
        </form>
      </div>

      {/* Content Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white/5 backdrop-blur-xl rounded-[2.5rem] border border-white/10 p-10 animate-pulse h-64"
            />
          ))}
        </div>
      ) : jobs.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-20 flex items-center justify-center gap-12">
              <button
                onClick={() => setFilters(prev => ({ ...prev, page: Math.max(1, (prev.page || 1) - 1) }))}
                disabled={filters.page === 1}
                className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 hover:text-white disabled:opacity-10 transition-all group flex items-center"
              >
                <span className="mr-2 group-hover:-translate-x-1 transition-transform">←</span> Prev
              </button>
              
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Index</span>
                <span className="text-xl font-black text-white italic">0{filters.page}</span>
                <span className="text-white/20 font-black text-xs mx-2">/</span>
                <span className="text-sm font-black text-white/40">0{totalPages}</span>
              </div>

              <button
                onClick={() => setFilters(prev => ({ ...prev, page: Math.min(totalPages, (prev.page || 1) + 1) }))}
                disabled={filters.page === totalPages}
                className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 hover:text-white disabled:opacity-10 transition-all group flex items-center"
              >
                Next <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white/10 backdrop-blur-3xl rounded-[3rem] border border-white/20 p-24 text-center shadow-2xl">
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8 border border-white/10">
            <svg className="w-8 h-8 text-white/20" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </div>
         <h3 className="text-2xl font-black text-white mb-4 uppercase italic tracking-tighter">
  System: Null
</h3>

<p className="text-white/40 max-w-md mx-auto font-bold uppercase tracking-[0.18em] text-[10px] leading-loose">
  No opportunities match your current search parameters.
  Adjust filters, broaden your geography scope,
  or modify expertise constraints to continue exploration.
</p>
        </div>
      )}
    </GlassPageWrapper>
  );
}