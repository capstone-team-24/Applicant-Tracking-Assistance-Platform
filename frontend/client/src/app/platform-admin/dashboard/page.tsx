"use client";

import { useEffect, useState } from "react";
import { platformAdminApi } from "@/lib/api";
import { ContactMessage, Organization } from "@/lib/types";
import { useRouter } from "next/navigation";
import { getStoredUser, removeTokens } from "@/lib/auth";

export default function PlatformAdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"messages" | "organizations" | "create_admin">("messages");

  // Data state
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  // Create state
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgPolicies, setNewOrgPolicies] = useState("");

  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [processingMessageId, setProcessingMessageId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [actionStatus, setActionStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== "ADMIN") {
      router.push("/platform-admin/login");
      return;
    }
    loadData();
  }, [router]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === "messages") {
        const res = await platformAdminApi.getContactMessages();
        setMessages(res.content);
      } else if (activeTab === "organizations" || activeTab === "create_admin") {
        const res = await platformAdminApi.getOrganizations();
        setOrganizations(res.content);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await platformAdminApi.createOrganization({ name: newOrgName, organizationPolicies: newOrgPolicies });
      setActionStatus({ type: "success", text: "Organization created successfully." });
      setNewOrgName("");
      setNewOrgPolicies("");
      loadData();
    } catch (err) {
      console.error(err);
      setActionStatus({ type: "error", text: "Failed to create organization." });
    }
  };

  const handleToggleSuspension = async (id: string, currentStatus: boolean) => {
    try {
      await platformAdminApi.toggleSuspension(id, !currentStatus);
      loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to toggle suspension status.");
    }
  };

  const handleApproveMessage = async (messageId: string) => {
    setProcessingMessageId(messageId);
    try {
      await platformAdminApi.approveContactMessage(messageId);
      setActionStatus({ type: "success", text: "Organization created and HR admin notified." });
      await loadData();
    } catch (err) {
      console.error(err);
      setActionStatus({ type: "error", text: "Failed to approve contact message." });
    } finally {
      setProcessingMessageId(null);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId) {
      setActionStatus({ type: "error", text: "Please select an organization." });
      return;
    }
    try {
      await platformAdminApi.inviteOrgAdmin({ email: newAdminEmail, orgId: selectedOrgId });
      setActionStatus({
        type: "success",
        text: `Invite sent to ${newAdminEmail}. They will receive an email with a link to set up their account.`,
      });
      setNewAdminEmail("");
      setSelectedOrgId("");
    } catch (err: any) {
      console.error(err);
      setActionStatus({ type: "error", text: err.response?.data?.message || "Failed to send invite." });
    }
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

        {/* Header Section */}
        <div className="w-full bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] px-8 py-6 mb-12 shadow-2xl relative overflow-hidden flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <h1 className="text-2xl font-black text-white tracking-tighter italic uppercase">Platform Admin Dashboard</h1>
          <button
            onClick={() => {
              removeTokens();
              router.push("/platform-admin/login");
            }}
            className="text-[10px] font-black px-8 py-4 bg-white/5 hover:bg-white/10 text-rose-400 hover:text-rose-300 rounded-2xl border border-white/10 shadow-sm hover:shadow-2xl transition-all uppercase tracking-[0.2em]"
          >
            Logout
          </button>
        </div>

        {/* Tabs Container */}
        <div className="flex gap-2 p-1.5 bg-white/5 backdrop-blur-3xl rounded-2xl border border-white/10 w-fit mb-12 shadow-inner">
          <nav className="flex space-x-1" aria-label="Tabs">
            {(["messages", "organizations", "create_admin"] as const).map((tab) => {
              const labels = { messages: "Contact Messages", organizations: "Organizations", create_admin: "Create Org Admin" };
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-8 py-3 rounded-xl text-[10px] font-black transition-all uppercase tracking-[0.2em] ${activeTab === tab
                      ? "bg-white text-slate-950 shadow-xl"
                      : "text-white/40 hover:text-white hover:bg-white/5"
                    }`}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="w-full">
          {/* Notifications */}
          {actionStatus && (
            <div
              className={`mb-10 p-6 rounded-[2rem] border backdrop-blur-3xl flex justify-between items-center shadow-2xl animate-in fade-in slide-in-from-top-4 ${actionStatus.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                }`}
            >
              <span className="text-xs font-black uppercase tracking-[0.1em]">{actionStatus.text}</span>
              <button className="text-2xl opacity-50 hover:opacity-100 transition-opacity text-white" onClick={() => setActionStatus(null)}>
                &times;
              </button>
            </div>
          )}

          {loading ? (
            <div className="text-center py-20 text-white/40 font-black uppercase tracking-[0.3em] text-xs animate-pulse">Loading...</div>
          ) : (
            <div className="w-full animate-in fade-in duration-500">

              {/* MESSAGES TAB */}
              {activeTab === "messages" && (
                <div className="bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[3rem] overflow-hidden shadow-2xl relative">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/5">
                          <th className="px-8 py-6 text-left text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Date</th>
                          <th className="px-8 py-6 text-left text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Name</th>
                          <th className="px-8 py-6 text-left text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Email</th>
                          <th className="px-8 py-6 text-left text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Message</th>
                          <th className="px-8 py-6 text-left text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Status</th>
                          <th className="px-8 py-6 text-right text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {messages.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-8 py-12 text-center text-white/40 italic text-sm">No messages found.</td>
                          </tr>
                        ) : (
                          messages.map((msg) => (
                            <tr
                              key={msg.id}
                              className={`hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 ${msg.approvedAt ? "bg-emerald-500/5" : ""}`}
                            >
                              <td className="px-8 py-6 whitespace-nowrap text-sm font-medium text-white/60">
                                {new Date(msg.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-8 py-6 whitespace-nowrap text-sm font-bold text-white italic">{msg.name}</td>
                              <td className="px-8 py-6 whitespace-nowrap text-sm font-medium text-white/60">{msg.email}</td>
                              <td className="px-8 py-6 text-sm text-white/80 max-w-xs truncate" title={msg.message}>{msg.message}</td>
                              <td className="px-8 py-6 whitespace-nowrap text-sm">
                                {msg.approvedAt ? (
                                  <span className="px-3 py-1 inline-flex text-[9px] font-black rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-widest">
                                    Approved
                                  </span>
                                ) : (
                                  <span className="px-3 py-1 inline-flex text-[9px] font-black rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-widest">
                                    Pending
                                  </span>
                                )}
                              </td>
                              <td className="px-8 py-6 whitespace-nowrap text-right text-sm">
                                <button
                                  onClick={() => handleApproveMessage(msg.id)}
                                  disabled={!!msg.approvedAt || processingMessageId === msg.id}
                                  className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all ${msg.approvedAt || processingMessageId === msg.id
                                      ? "text-white/20 cursor-not-allowed"
                                      : "text-indigo-400 hover:text-indigo-300"
                                    }`}
                                >
                                  {processingMessageId === msg.id ? "Approving..." : msg.approvedAt ? "Approved" : "Approve"}
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ORGANIZATIONS TAB */}
              {activeTab === "organizations" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
                  <div className="lg:col-span-2">
                    <h2 className="text-4xl lg:text-5xl font-black text-white tracking-tighter italic uppercase leading-none mb-8">
                      Existing Organizations
                    </h2>
                    <div className="bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[3rem] overflow-hidden shadow-2xl relative">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                      <table className="min-w-full">
                        <thead>
                          <tr className="border-b border-white/10 bg-white/5">
                            <th className="px-8 py-6 text-left text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Name</th>
                            <th className="px-8 py-6 text-left text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Status</th>
                            <th className="px-8 py-6 text-right text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {organizations.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="px-8 py-12 text-center text-white/40 italic text-sm">No organizations found.</td>
                            </tr>
                          ) : (
                            organizations.map((org) => (
                              <tr key={org.id} className="hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                                <td className="px-8 py-6 whitespace-nowrap text-sm font-bold text-white italic">{org.name}</td>
                                <td className="px-8 py-6 whitespace-nowrap text-sm">
                                  {org.isSuspended ? (
                                    <span className="px-3 py-1 inline-flex text-[9px] font-black rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase tracking-widest">
                                      Suspended
                                    </span>
                                  ) : (
                                    <span className="px-3 py-1 inline-flex text-[9px] font-black rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-widest">
                                      Active
                                    </span>
                                  )}
                                </td>
                                <td className="px-8 py-6 whitespace-nowrap text-right text-sm">
                                  <button
                                    onClick={() => handleToggleSuspension(org.id, org.isSuspended)}
                                    className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all ${org.isSuspended ? "text-emerald-400 hover:text-emerald-300" : "text-rose-400 hover:text-rose-300"
                                      }`}
                                  >
                                    {org.isSuspended ? "Unsuspend" : "Suspend"}
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="w-full">
                    <h2 className="text-4xl lg:text-5xl font-black text-white tracking-tighter italic uppercase leading-none mb-8">Management</h2>
                    <div className="bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[3rem] p-8 lg:p-10 shadow-2xl overflow-hidden relative">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                      <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-8 ml-1">Add Organization</h3>
                      <form onSubmit={handleCreateOrganization} className="space-y-6">
                        <div>
                          <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-white/40 mb-2 ml-1">Name</label>
                          <input
                            type="text"
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 focus:bg-white/[0.08] transition-all text-sm font-medium italic"
                            value={newOrgName}
                            onChange={(e) => setNewOrgName(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-white/40 mb-2 ml-1">Policies (JSON optional)</label>
                          <textarea
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 focus:bg-white/[0.08] transition-all text-sm font-medium italic h-32 resize-none"
                            value={newOrgPolicies}
                            onChange={(e) => setNewOrgPolicies(e.target.value)}
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full px-10 py-4 bg-white text-slate-950 text-[11px] font-black rounded-2xl hover:scale-105 active:scale-95 shadow-2xl shadow-white/10 transition-all uppercase tracking-[0.2em]"
                        >
                          Create Organization
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}

              {/* CREATE ADMIN TAB */}
              {activeTab === "create_admin" && (
                <div className="max-w-xl mx-auto py-4">
                  <div className="bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[3rem] p-8 lg:p-12 shadow-2xl overflow-hidden relative">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    <h2 className="text-xl font-black mb-8 text-white text-center tracking-tighter italic uppercase">
                      Create Organization Admin
                    </h2>
                    <form onSubmit={handleCreateAdmin} className="space-y-6">
                      <div>
                        <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-white/40 mb-2 ml-1">Organization</label>
                        <div className="relative">
                          <select
                            required
                            className="w-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.1em] text-white rounded-2xl pl-6 pr-10 py-4 focus:outline-none focus:ring-2 focus:ring-white/20 focus:bg-white/[0.08] transition-all cursor-pointer appearance-none shadow-sm"
                            value={selectedOrgId}
                            onChange={(e) => setSelectedOrgId(e.target.value)}
                          >
                            <option value="" className="bg-slate-900 text-white/60">Select an Organization...</option>
                            {organizations.map((org) => (
                              <option key={org.id} value={org.id} className="bg-slate-900 text-white">{org.name}</option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-white/40">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-white/40 mb-2 ml-1">Admin Email</label>
                        <input
                          type="email"
                          required
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 focus:bg-white/[0.08] transition-all text-sm font-medium italic"
                          value={newAdminEmail}
                          onChange={(e) => setNewAdminEmail(e.target.value)}
                        />
                        <p className="mt-4 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] leading-relaxed italic">
                          An invite email will be sent to the address above with a secure link to set up their name and password.
                        </p>
                      </div>
                      <button
                        type="submit"
                        className="w-full px-10 py-5 bg-white text-slate-950 text-[11px] font-black rounded-2xl hover:scale-105 active:scale-95 shadow-2xl shadow-white/10 transition-all uppercase tracking-[0.2em] mt-4"
                      >
                        Send Invite
                      </button>
                    </form>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}