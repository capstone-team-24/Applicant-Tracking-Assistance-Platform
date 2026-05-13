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
      setActionMsg({ type: "success", text: `Invite sent to ${newRecruiter.email}. They will receive an email to set up their account.` });
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
      PUBLISHED: "bg-green-900/50 text-green-300 border-green-700/50",
      DRAFT: "bg-slate-700/50 text-slate-300 border-slate-600/50",
      SUSPENDED: "bg-red-900/50 text-red-300 border-red-700/50",
      CLOSED: "bg-yellow-900/50 text-yellow-300 border-yellow-700/50",
      ARCHIVED: "bg-purple-900/50 text-purple-300 border-purple-700/50",
    };
    return `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colors[status] || "bg-slate-700 text-slate-300"}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-white">Organization Admin</h1>
            <p className="text-xs text-slate-400 mt-0.5">{user?.firstName} {user?.lastName} · {user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status message */}
        {actionMsg && (
          <div className={`mb-6 p-4 rounded-lg border flex justify-between items-start ${actionMsg.type === "success" ? "bg-green-900/40 border-green-700/50 text-green-300" : "bg-red-900/40 border-red-700/50 text-red-300"}`}>
            <span className="text-sm">{actionMsg.text}</span>
            <button onClick={() => setActionMsg(null)} className="ml-4 text-lg leading-none opacity-60 hover:opacity-100">×</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-slate-800/60 rounded-xl border border-slate-700/50 w-fit mb-8">
          {(["recruiters", "jobs"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition capitalize ${tab === t ? "bg-purple-600 text-white shadow-lg shadow-purple-900/40" : "text-slate-400 hover:text-white"}`}
            >
              {t === "recruiters" ? "👥 Recruiters" : "💼 Job Postings"}
            </button>
          ))}
        </div>

        {/* ── Recruiters Tab ── */}
        {tab === "recruiters" && (
          <div>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-semibold text-white">Recruiters</h2>
              <button
                onClick={() => setRecruiterFormOpen(!recruiterFormOpen)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition"
              >
                + Add Recruiter
              </button>
            </div>

            {/* Add Recruiter form */}
            {recruiterFormOpen && (
              <div className="mb-6 bg-slate-800/60 border border-slate-700/50 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">New Recruiter</h3>
                <form onSubmit={handleCreateRecruiter} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">First Name</label>
                    <input
                      type="text"
                      required
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      value={newRecruiter.firstName}
                      onChange={(e) => setNewRecruiter({ ...newRecruiter, firstName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Last Name</label>
                    <input
                      type="text"
                      required
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      value={newRecruiter.lastName}
                      onChange={(e) => setNewRecruiter({ ...newRecruiter, lastName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Email</label>
                    <input
                      type="email"
                      required
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      value={newRecruiter.email}
                      onChange={(e) => setNewRecruiter({ ...newRecruiter, email: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-3 flex gap-3 justify-end pt-1">
                    <button type="button" onClick={() => setRecruiterFormOpen(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition">
                      Cancel
                    </button>
                    <button type="submit" className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition">
                      Send Invite
                    </button>
                  </div>
                </form>
                <p className="mt-3 text-xs text-slate-500">The recruiter will receive an email with a secure link to confirm their details and set a password.</p>
              </div>
            )}

            {/* Recruiter list */}
            {recruiterLoading ? (
              <div className="text-center py-10 text-slate-400">Loading...</div>
            ) : recruiters.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <p className="text-4xl mb-3">👤</p>
                <p>No recruiters yet. Add your first one above.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/40">
                <table className="min-w-full divide-y divide-slate-700/50">
                  <thead>
                    <tr className="bg-slate-800/60">
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {recruiters.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-700/20 transition">
                        <td className="px-6 py-4 text-sm text-white">{r.firstName} {r.lastName}</td>
                        <td className="px-6 py-4 text-sm text-slate-300">{r.email}</td>
                        <td className="px-6 py-4">
                          <span className={statusBadge(r.isSuspended ? "SUSPENDED" : "PUBLISHED")}>
                            {r.isSuspended ? "Suspended" : "Active"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleToggleSuspend(r.id, r.isSuspended)}
                            className={`text-sm font-medium transition ${r.isSuspended ? "text-green-400 hover:text-green-300" : "text-red-400 hover:text-red-300"}`}
                          >
                            {r.isSuspended ? "Unsuspend" : "Suspend"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Jobs Tab ── */}
        {tab === "jobs" && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-5">Job Postings</h2>
            {jobsLoading ? (
              <div className="text-center py-10 text-slate-400">Loading...</div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <p className="text-4xl mb-3">📋</p>
                <p>No job postings found for your organization.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/40">
                <table className="min-w-full divide-y divide-slate-700/50">
                  <thead>
                    <tr className="bg-slate-800/60">
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Title</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Assigned To</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Reassign</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {jobs.map((job) => (
                      <tr key={job.id} className="hover:bg-slate-700/20 transition">
                        <td className="px-6 py-4 text-sm text-white font-medium">{job.title}</td>
                        <td className="px-6 py-4">
                          <span className={statusBadge(job.status)}>{job.status}</span>
                        </td>
                        <td className="px-6 py-4">
                          <select
                            className="bg-slate-700 border border-slate-600 text-sm text-white rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            value={reassignMap[job.id] ?? ""}
                            onChange={(e) => setReassignMap({ ...reassignMap, [job.id]: e.target.value })}
                          >
                            <option value="">— Unassigned —</option>
                            {activeRecruiters.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.firstName} {r.lastName}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleReassign(job.id)}
                            className="text-sm font-medium text-purple-400 hover:text-purple-300 transition"
                          >
                            Apply
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-xs text-slate-500">
              Assigning a suspended or unassigned job to an active recruiter will <strong className="text-slate-400">reactivate</strong> it. Removing the assignment will <strong className="text-slate-400">suspend</strong> it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
