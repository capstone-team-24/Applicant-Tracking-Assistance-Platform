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
      PUBLISHED: "bg-green-500/20 text-green-200 border-green-500/30",
      DRAFT: "bg-white/10 text-white/70 border-white/20",
      SUSPENDED: "bg-red-500/20 text-red-200 border-red-500/30",
      CLOSED: "bg-yellow-500/20 text-yellow-200 border-yellow-500/30",
      ARCHIVED: "bg-purple-500/20 text-purple-200 border-purple-500/30",
    };
    return `inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${colors[status] || "bg-white/10 text-white/70"}`;
  };

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-fixed text-white"
      style={{ backgroundImage: `url(/bk2.jpg)` }}
    >
      {/* Header - Glass Effect */}
      <header className="border-b border-white/10 bg-black/30 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight uppercase">Admin Control</h1>
            <p className="text-[10px] font-medium text-white/50 mt-0.5 uppercase tracking-widest">{user?.firstName} {user?.lastName} // {user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs font-bold px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl border border-white/20 transition-all uppercase tracking-widest"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status message - Floating Glass */}
        {actionMsg && (
          <div className={`mb-6 p-4 rounded-2xl border backdrop-blur-xl flex justify-between items-center animate-in fade-in slide-in-from-top-4 ${actionMsg.type === "success" ? "bg-green-500/10 border-green-500/30 text-green-200" : "bg-red-500/10 border-red-500/30 text-red-200"}`}>
            <span className="text-sm font-medium">{actionMsg.text}</span>
            <button onClick={() => setActionMsg(null)} className="text-xl opacity-50 hover:opacity-100 transition-opacity">×</button>
          </div>
        )}

        {/* Tabs - Glass Pill */}
        <div className="flex gap-1 p-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 w-fit mb-8 shadow-2xl">
          {(["recruiters", "jobs"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all uppercase tracking-widest ${tab === t ? "bg-white text-slate-900 shadow-xl" : "text-white/50 hover:text-white hover:bg-white/5"}`}
            >
              {t === "recruiters" ? "Recruiters" : "Postings"}
            </button>
          ))}
        </div>

        {/* ── Recruiters Tab ── */}
        {tab === "recruiters" && (
          <div className="animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white tracking-tight">Management</h2>
              <button
                onClick={() => setRecruiterFormOpen(!recruiterFormOpen)}
                className="px-5 py-2.5 bg-white text-slate-900 text-xs font-black rounded-xl hover:bg-slate-200 transition-all uppercase tracking-tighter"
              >
                + New Recruiter
              </button>
            </div>

            {/* Add Recruiter form - Embedded Glass Card */}
            {recruiterFormOpen && (
              <div className="mb-8 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-6 shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent"></div>
                <h3 className="text-xs font-black text-white/40 uppercase tracking-[0.2em] mb-6">Provision New Access</h3>
                <form onSubmit={handleCreateRecruiter} className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-[10px] font-bold text-white/50 uppercase mb-2 ml-1">First Name</label>
                    <input
                      type="text"
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20 focus:bg-white/10 transition-all"
                      value={newRecruiter.firstName}
                      onChange={(e) => setNewRecruiter({ ...newRecruiter, firstName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-white/50 uppercase mb-2 ml-1">Last Name</label>
                    <input
                      type="text"
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20 focus:bg-white/10 transition-all"
                      value={newRecruiter.lastName}
                      onChange={(e) => setNewRecruiter({ ...newRecruiter, lastName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-white/50 uppercase mb-2 ml-1">Email Address</label>
                    <input
                      type="email"
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20 focus:bg-white/10 transition-all"
                      value={newRecruiter.email}
                      onChange={(e) => setNewRecruiter({ ...newRecruiter, email: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-3 flex gap-3 justify-end mt-2">
                    <button type="button" onClick={() => setRecruiterFormOpen(false)} className="px-6 py-3 text-xs font-bold text-white/40 hover:text-white transition-colors uppercase">
                      Cancel
                    </button>
                    <button type="submit" className="px-8 py-3 bg-white text-slate-900 text-xs font-black rounded-xl hover:bg-slate-200 transition-all uppercase">
                      Invite Member
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* List - Glass Table */}
            <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-8 py-5 text-left text-[10px] font-black text-white/40 uppercase tracking-widest">Identify</th>
                    <th className="px-8 py-5 text-left text-[10px] font-black text-white/40 uppercase tracking-widest">Contact</th>
                    <th className="px-8 py-5 text-left text-[10px] font-black text-white/40 uppercase tracking-widest">Status</th>
                    <th className="px-8 py-5 text-right text-[10px] font-black text-white/40 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recruiters.map((r) => (
                    <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-8 py-5 text-sm font-bold text-white">{r.firstName} {r.lastName}</td>
                      <td className="px-8 py-5 text-sm text-white/60">{r.email}</td>
                      <td className="px-8 py-5">
                        <span className={statusBadge(r.isSuspended ? "SUSPENDED" : "PUBLISHED")}>
                          {r.isSuspended ? "Revoked" : "Active"}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button
                          onClick={() => handleToggleSuspend(r.id, r.isSuspended)}
                          className={`text-xs font-black uppercase tracking-tighter transition-all ${r.isSuspended ? "text-green-400 hover:text-green-300" : "text-red-400 hover:text-red-300"}`}
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
        )}

        {/* ── Jobs Tab ── */}
        {tab === "jobs" && (
          <div className="animate-in fade-in duration-500">
            <h2 className="text-2xl font-bold text-white tracking-tight mb-6">Global Postings</h2>
            <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-8 py-5 text-left text-[10px] font-black text-white/40 uppercase tracking-widest">Job Title</th>
                    <th className="px-8 py-5 text-left text-[10px] font-black text-white/40 uppercase tracking-widest">Lifecycle</th>
                    <th className="px-8 py-5 text-left text-[10px] font-black text-white/40 uppercase tracking-widest">Owner</th>
                    <th className="px-8 py-5 text-right text-[10px] font-black text-white/40 uppercase tracking-widest">Update</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-8 py-5 text-sm font-bold text-white">{job.title}</td>
                      <td className="px-8 py-5">
                        <span className={statusBadge(job.status)}>{job.status}</span>
                      </td>
                      <td className="px-8 py-5">
                        <select
                          className="bg-white/5 border border-white/10 text-xs font-bold text-white rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all appearance-none cursor-pointer"
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
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button
                          onClick={() => handleReassign(job.id)}
                          className="text-xs font-black uppercase tracking-tighter text-white hover:text-white transition-all underline underline-offset-4"
                        >
                          Push Update
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-6 text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] text-center">
              Postings without active owners will be automatically suspended.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}