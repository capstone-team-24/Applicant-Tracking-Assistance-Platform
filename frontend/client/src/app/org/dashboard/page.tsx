"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { orgAdminApi } from "@/lib/api";
import { Job, RecruiterUser } from "@/lib/types";
import { getStoredUser, removeTokens } from "@/lib/auth";

type Tab = "recruiters" | "jobs";

export default function OrgDashboardPage() {
  const router = useRouter();
  const user = getStoredUser();

  const [tab, setTab] = useState<Tab>("recruiters");

  // Recruiter state
  const [recruiters, setRecruiters] = useState<RecruiterUser[]>([]);
  const [recruiterLoading, setRecruiterLoading] = useState(false);
  const [newRecruiter, setNewRecruiter] = useState({ email: "", firstName: "", lastName: "" });
  const [recruiterFormOpen, setRecruiterFormOpen] = useState(false);

  // Job state
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [reassignMap, setReassignMap] = useState<Record<string, string>>({});

  const [actionMsg, setActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!user || (user.role as string) !== "ORG_ADMIN") {
      router.push("/org/login");
    }
  }, [user, router]);

  const loadRecruiters = useCallback(async () => {
    setRecruiterLoading(true);
    try {
      const data = await orgAdminApi.getRecruiters();
      setRecruiters(data);
    } catch (err) {
      console.error("Failed to load recruiters", err);
    } finally {
      setRecruiterLoading(false);
    }
  }, []);

  const loadJobs = useCallback(async () => {
    if (!user?.orgId) return;
    setJobsLoading(true);
    try {
      const data = await orgAdminApi.getOrgJobs(user.orgId, { size: 100 });
      setJobs(data.content);
      const initialMap: Record<string, string> = {};
      data.content.forEach((j) => { initialMap[j.id] = j.assignedTo ?? ""; });
      setReassignMap(initialMap);
    } catch (err) {
      console.error("Failed to load jobs", err);
    } finally {
      setJobsLoading(false);
    }
  }, [user?.orgId]);

  useEffect(() => {
    if (tab === "recruiters") loadRecruiters();
    if (tab === "jobs") { loadRecruiters(); loadJobs(); }
  }, [tab, loadRecruiters, loadJobs]);

  const handleCreateRecruiter = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await orgAdminApi.inviteRecruiter(newRecruiter);
      setActionMsg({ type: "success", text: `Invite sent to ${newRecruiter.email}.` });
      setNewRecruiter({ email: "", firstName: "", lastName: "" });
      setRecruiterFormOpen(false);
      loadRecruiters();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setActionMsg({ type: "error", text: e.response?.data?.message || "Failed to send invite." });
    }
  };

  const handleToggleSuspend = async (id: string, current: boolean) => {
    try {
      await orgAdminApi.suspendRecruiter(id, !current);
      setActionMsg({ type: "success", text: `Recruiter ${!current ? "suspended" : "unsuspended"} successfully.` });
      loadRecruiters();
      if (tab === "jobs") loadJobs();
    } catch {
      setActionMsg({ type: "error", text: "Failed to update recruiter status." });
    }
  };

  const handleReassign = async (jobId: string) => {
    const newAssignee = reassignMap[jobId] || null;
    try {
      await orgAdminApi.reassignJob(jobId, newAssignee || null);
      setActionMsg({ type: "success", text: "Job reassigned successfully." });
      loadJobs();
    } catch {
      setActionMsg({ type: "error", text: "Failed to reassign job." });
    }
  };

  const handleLogout = () => {
    removeTokens();
    router.push("/org/login");
  };

  const activeRecruiters = recruiters.filter(r => !r.isSuspended);

 const statusBadge = (status: string) => {
  const colors: Record<string, string> = {
    PUBLISHED: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
    DRAFT: "bg-slate-100 text-slate-600 border-slate-200",
    SUSPENDED: "bg-rose-50 text-rose-700 border-rose-200/60",
    CLOSED: "bg-amber-50 text-amber-700 border-amber-200/60",
    ARCHIVED: "bg-purple-50 text-purple-700 border-purple-200/60",
  };
  return `inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${colors[status] || "bg-slate-100 text-slate-600 border-slate-200"}`;
};

return (
  <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 text-slate-900 transition-colors duration-300">
    {/* Header - Glass Effect */}
    <header className="border-b border-slate-200/80 bg-white/70 backdrop-blur-md sticky top-0 z-10 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight uppercase">Admin Control</h1>
          <p className="text-[10px] font-semibold text-slate-500 mt-0.5 uppercase tracking-widest">
            {user?.firstName} {user?.lastName} <span className="text-slate-300 mx-1">//</span> {user?.email}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs font-bold px-4 py-2 bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 rounded-xl border border-slate-200 shadow-sm hover:shadow transition-all uppercase tracking-widest"
        >
          Sign out
        </button>
      </div>
    </header>

    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Status message - Floating Glass */}
      {actionMsg && (
        <div className={`mb-6 p-4 rounded-2xl border backdrop-blur-xl flex justify-between items-center shadow-sm animate-in fade-in slide-in-from-top-4 ${actionMsg.type === "success" ? "bg-emerald-50/80 border-emerald-200 text-emerald-800" : "bg-rose-50/80 border-rose-200 text-rose-800"}`}>
          <span className="text-sm font-medium">{actionMsg.text}</span>
          <button onClick={() => setActionMsg(null)} className="text-xl opacity-50 hover:opacity-100 transition-opacity">×</button>
        </div>
      )}

      {/* Tabs - Glass Pill */}
      <div className="flex gap-1 p-1 bg-slate-200/50 backdrop-blur-md rounded-2xl border border-slate-200/60 w-fit mb-8 shadow-inner">
        {(["recruiters", "jobs"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all uppercase tracking-widest ${tab === t ? "bg-white text-indigo-600 shadow-md" : "text-slate-600 hover:text-slate-900 hover:bg-white/40"}`}
          >
            {t === "recruiters" ? "Recruiters" : "Postings"}
          </button>
        ))}
      </div>

      {/* ── Recruiters Tab ── */}
      {tab === "recruiters" && (
        <div className="animate-in fade-in duration-500">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Management</h2>
            <button
              onClick={() => setRecruiterFormOpen(!recruiterFormOpen)}
              className="px-5 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 shadow-sm hover:shadow-md transition-all uppercase tracking-wider"
            >
              + New Recruiter
            </button>
          </div>

          {/* Add Recruiter form - Embedded Glass Card */}
          {recruiterFormOpen && (
            <div className="mb-8 bg-white/80 backdrop-blur-2xl border border-slate-200/80 rounded-3xl p-6 shadow-xl overflow-hidden relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-400/30 to-transparent"></div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-6">Provision New Access</h3>
              <form onSubmit={handleCreateRecruiter} className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 ml-1">First Name</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 focus:bg-white transition-all shadow-sm"
                    value={newRecruiter.firstName}
                    onChange={(e) => setNewRecruiter({ ...newRecruiter, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 ml-1">Last Name</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 focus:bg-white transition-all shadow-sm"
                    value={newRecruiter.lastName}
                    onChange={(e) => setNewRecruiter({ ...newRecruiter, lastName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 ml-1">Email Address</label>
                  <input
                    type="email"
                    required
                    className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 focus:bg-white transition-all shadow-sm"
                    value={newRecruiter.email}
                    onChange={(e) => setNewRecruiter({ ...newRecruiter, email: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-3 flex gap-3 justify-end mt-2">
                  <button type="button" onClick={() => setRecruiterFormOpen(false)} className="px-6 py-3 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors uppercase tracking-wider">
                    Cancel
                  </button>
                  <button type="submit" className="px-8 py-3 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 shadow-sm hover:shadow transition-all uppercase tracking-wider">
                    Invite Member
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* List - Glass Table */}
          <div className="bg-white/70 backdrop-blur-xl border border-slate-200/80 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-8 py-5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Identify</th>
                    <th className="px-8 py-5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contact</th>
                    <th className="px-8 py-5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-8 py-5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/70">
                  {recruiters.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="px-8 py-5 text-sm font-semibold text-slate-900">{r.firstName} {r.lastName}</td>
                      <td className="px-8 py-5 text-sm text-slate-600">{r.email}</td>
                      <td className="px-8 py-5">
                        <span className={statusBadge(r.isSuspended ? "SUSPENDED" : "PUBLISHED")}>
                          {r.isSuspended ? "Revoked" : "Active"}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button
                          onClick={() => handleToggleSuspend(r.id, r.isSuspended)}
                          className={`text-xs font-bold uppercase tracking-wide transition-all ${r.isSuspended ? "text-emerald-600 hover:text-emerald-700" : "text-rose-600 hover:text-rose-700"}`}
                        >
                          {r.isSuspended ? "Restore" : "Suspend"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Jobs Tab ── */}
      {tab === "jobs" && (
        <div className="animate-in fade-in duration-500">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-6">Global Postings</h2>
          <div className="bg-white/70 backdrop-blur-xl border border-slate-200/80 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-8 py-5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Job Title</th>
                    <th className="px-8 py-5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lifecycle</th>
                    <th className="px-8 py-5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Owner</th>
                    <th className="px-8 py-5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Update</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/70">
                  {jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="px-8 py-5 text-sm font-semibold text-slate-900">{job.title}</td>
                      <td className="px-8 py-5">
                        <span className={statusBadge(job.status)}>{job.status}</span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="relative inline-block w-full max-w-[200px]">
                          <select
                            className="w-full bg-white/80 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40 transition-all cursor-pointer appearance-none shadow-sm"
                            value={reassignMap[job.id] ?? ""}
                            onChange={(e) => setReassignMap({ ...reassignMap, [job.id]: e.target.value })}
                          >
                            <option value="" className="bg-white text-slate-700">None (Unassigned)</option>
                            {activeRecruiters.map((r) => (
                              <option key={r.id} value={r.id} className="bg-white text-slate-700">
                                {r.firstName} {r.lastName}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                            </svg>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button
                          onClick={() => handleReassign(job.id)}
                          className="text-xs font-bold uppercase tracking-wide text-indigo-600 hover:text-indigo-700 transition-all underline underline-offset-4"
                        >
                          Push Update
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-6 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] text-center">
            Postings without active owners will be automatically suspended.
          </p>
        </div>
      )}
    </div>
  </div>
);}