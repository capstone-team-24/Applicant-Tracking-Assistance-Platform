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
    <div
      className="min-h-screen w-full bg-cover bg-center bg-fixed relative flex flex-col items-center py-12 px-4 text-white transition-colors duration-300"
      style={{ backgroundImage: `url(/bk2.jpg)` }}
    >
      {/* Dark Overlay with Base Blur */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" />

      {/* Ambient Blur Blobs */}
      <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Content Container */}
      <div className="relative z-10 w-full max-w-7xl">

        {/* Header - Glass Effect */}
        <header className="w-full bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] px-8 py-6 mb-12 shadow-2xl relative overflow-hidden flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div>
            <h1 className="text-2xl font-black text-white tracking-tighter italic uppercase">Admin Control</h1>
            <p className="text-[10px] font-black text-white/40 mt-1 uppercase tracking-[0.2em]">
              {user?.firstName} {user?.lastName} <span className="text-white/20 mx-2">//</span> {user?.email}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="text-[10px] font-black px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl border border-white/10 shadow-sm hover:shadow-2xl transition-all uppercase tracking-[0.2em]"
          >
            Sign out
          </button>
        </header>

        <div className="w-full">
          {/* Status message - Floating Glass */}
          {actionMsg && (
            <div className={`mb-10 p-6 rounded-[2rem] border backdrop-blur-3xl flex justify-between items-center shadow-2xl animate-in fade-in slide-in-from-top-4 ${actionMsg.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"}`}>
              <span className="text-xs font-black uppercase tracking-[0.1em]">{actionMsg.text}</span>
              <button onClick={() => setActionMsg(null)} className="text-2xl opacity-50 hover:opacity-100 transition-opacity text-white">×</button>
            </div>
          )}

          {/* Tabs - Glass Pill */}
          <div className="flex gap-2 p-1.5 bg-white/5 backdrop-blur-3xl rounded-2xl border border-white/10 w-fit mb-12 shadow-inner">
            {(["recruiters", "jobs"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-8 py-3 rounded-xl text-[10px] font-black transition-all uppercase tracking-[0.2em] ${tab === t ? "bg-white text-slate-950 shadow-xl" : "text-white/40 hover:text-white hover:bg-white/5"}`}
              >
                {t === "recruiters" ? "Recruiters" : "Postings"}
              </button>
            ))}
          </div>

          {/* ── Recruiters Tab ── */}
          {tab === "recruiters" && (
            <div className="animate-in fade-in duration-500">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 gap-4">
                <h2 className="text-4xl lg:text-5xl font-black text-white tracking-tighter italic uppercase leading-none">Management</h2>
                <button
                  onClick={() => setRecruiterFormOpen(!recruiterFormOpen)}
                  className="px-8 py-4 bg-white text-slate-950 text-[11px] font-black rounded-2xl hover:scale-105 shadow-2xl shadow-white/10 transition-all uppercase tracking-[0.2em] w-fit"
                >
                  + New Recruiter
                </button>
              </div>

              {/* Add Recruiter form - Embedded Glass Card */}
              {recruiterFormOpen && (
                <div className="mb-12 bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[3rem] p-8 lg:p-12 shadow-2xl overflow-hidden relative">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                  <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-8 ml-1">Provision New Access</h3>
                  <form onSubmit={handleCreateRecruiter} className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-white/40 mb-2 ml-1">First Name</label>
                      <input
                        type="text"
                        required
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 focus:bg-white/[0.08] transition-all text-sm font-medium italic"
                        value={newRecruiter.firstName}
                        onChange={(e) => setNewRecruiter({ ...newRecruiter, firstName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-white/40 mb-2 ml-1">Last Name</label>
                      <input
                        type="text"
                        required
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 focus:bg-white/[0.08] transition-all text-sm font-medium italic"
                        value={newRecruiter.lastName}
                        onChange={(e) => setNewRecruiter({ ...newRecruiter, lastName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-white/40 mb-2 ml-1">Email Address</label>
                      <input
                        type="email"
                        required
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 focus:bg-white/[0.08] transition-all text-sm font-medium italic"
                        value={newRecruiter.email}
                        onChange={(e) => setNewRecruiter({ ...newRecruiter, email: e.target.value })}
                      />
                    </div>
                    <div className="sm:col-span-3 flex gap-4 justify-end mt-4">
                      <button type="button" onClick={() => setRecruiterFormOpen(false)} className="px-6 py-4 text-[10px] font-black text-white/40 hover:text-white transition-colors uppercase tracking-[0.2em]">
                        Cancel
                      </button>
                      <button type="submit" className="px-10 py-4 bg-white text-slate-950 text-[11px] font-black rounded-2xl hover:scale-105 active:scale-95 shadow-2xl shadow-white/10 transition-all uppercase tracking-[0.2em]">
                        Invite Member
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* List - Glass Table */}
              <div className="bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[3rem] overflow-hidden shadow-2xl relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5">
                        <th className="px-8 py-6 text-left text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Identify</th>
                        <th className="px-8 py-6 text-left text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Contact</th>
                        <th className="px-8 py-6 text-left text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Status</th>
                        <th className="px-8 py-6 text-right text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recruiters.map((r) => (
                        <tr key={r.id} className="hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                          <td className="px-8 py-6 text-sm font-bold text-white italic">{r.firstName} {r.lastName}</td>
                          <td className="px-8 py-6 text-sm font-medium text-white/60">{r.email}</td>
                          <td className="px-8 py-6">
                            <span className={statusBadge(r.isSuspended ? "SUSPENDED" : "PUBLISHED")}>
                              {r.isSuspended ? "Revoked" : "Active"}
                            </span>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <button
                              onClick={() => handleToggleSuspend(r.id, r.isSuspended)}
                              className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all ${r.isSuspended ? "text-emerald-400 hover:text-emerald-300" : "text-rose-400 hover:text-rose-300"}`}
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
              <h2 className="text-4xl lg:text-5xl font-black text-white tracking-tighter italic uppercase leading-none mb-8">Global Postings</h2>
              <div className="bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[3rem] overflow-hidden shadow-2xl relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5">
                        <th className="px-8 py-6 text-left text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Job Title</th>
                        <th className="px-8 py-6 text-left text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Lifecycle</th>
                        <th className="px-8 py-6 text-left text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Owner</th>
                        <th className="px-8 py-6 text-right text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Update</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((job) => (
                        <tr key={job.id} className="hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                          <td className="px-8 py-6 text-sm font-bold text-white italic">{job.title}</td>
                          <td className="px-8 py-6">
                            <span className={statusBadge(job.status)}>{job.status}</span>
                          </td>
                          <td className="px-8 py-6">
                            <div className="relative inline-block w-full max-w-[200px]">
                              <select
                                className="w-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.1em] text-white rounded-2xl pl-4 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-white/20 focus:bg-white/[0.08] transition-all cursor-pointer appearance-none shadow-sm"
                                value={reassignMap[job.id] ?? ""}
                                onChange={(e) => setReassignMap({ ...reassignMap, [job.id]: e.target.value })}
                              >
                                <option value="" className="bg-slate-900 text-white">None (Unassigned)</option>
                                {activeRecruiters.map((r) => (
                                  <option key={r.id} value={r.id} className="bg-slate-900 text-white">
                                    {r.firstName} {r.lastName}
                                  </option>
                                ))}
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-white/40">
                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                                </svg>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <button
                              onClick={() => handleReassign(job.id)}
                              className="text-[10px] font-black uppercase tracking-[0.2em] text-white hover:text-white/70 transition-all underline underline-offset-4"
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
              <p className="mt-8 text-[10px] font-black text-white/40 uppercase tracking-[0.3em] text-center leading-loose max-w-lg mx-auto">
                Postings without active owners will be automatically suspended.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}