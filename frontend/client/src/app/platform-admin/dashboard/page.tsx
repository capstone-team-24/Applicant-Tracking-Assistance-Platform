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

  const [loading, setLoading] = useState(true);
  const [actionStatus, setActionStatus] = useState<{ type: "success" | "error", text: string } | null>(null);

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

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId) {
      setActionStatus({ type: "error", text: "Please select an organization." });
      return;
    }
    try {
      await platformAdminApi.inviteOrgAdmin({ email: newAdminEmail, orgId: selectedOrgId });
      setActionStatus({ type: "success", text: `Invite sent to ${newAdminEmail}. They will receive an email with a link to set up their account.` });
      setNewAdminEmail("");
      setSelectedOrgId("");
    } catch (err: any) {
      console.error(err);
      setActionStatus({ type: "error", text: err.response?.data?.message || "Failed to send invite." });
    }
  };

  const renderTabs = () => (
    <div className="border-b border-gray-700">
      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
        <button
          onClick={() => setActiveTab("messages")}
          className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
            activeTab === "messages"
              ? "border-blue-500 text-blue-500"
              : "border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300"
          }`}
        >
          Contact Messages
        </button>
        <button
          onClick={() => setActiveTab("organizations")}
          className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
            activeTab === "organizations"
              ? "border-blue-500 text-blue-500"
              : "border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300"
          }`}
        >
          Organizations
        </button>
        <button
          onClick={() => setActiveTab("create_admin")}
          className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
            activeTab === "create_admin"
              ? "border-blue-500 text-blue-500"
              : "border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300"
          }`}
        >
          Create Org Admin
        </button>
      </nav>
    </div>
  );

 return (
    <div 
      className="min-h-screen w-full bg-cover bg-center bg-fixed relative flex flex-col items-center p-8 transition-all duration-500"
      style={{ backgroundImage: `url(/bk2.jpg)` }}
    >
      {/* Dynamic Overlay & Ambient Light */}
      <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-[2px]" />
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-7xl">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-8 px-2">
          <h1 className="text-3xl font-bold text-white tracking-tight">Platform Admin Dashboard</h1>
          <button 
            onClick={() => {
              removeTokens();
              router.push("/platform-admin/login");
            }}
            className="px-6 py-2 bg-red-600/20 border border-red-500/40 text-red-100 rounded-xl hover:bg-red-600 hover:text-white transition-all duration-300 font-medium backdrop-blur-md"
          >
            Logout
          </button>
        </div>

        {/* Tabs Container */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-1 backdrop-blur-xl mb-8 w-fit">
          <nav className="flex space-x-2" aria-label="Tabs">
            <button
              onClick={() => setActiveTab("messages")}
              className={`whitespace-nowrap py-2.5 px-6 rounded-xl font-medium text-sm transition-all duration-300 ${
                activeTab === "messages"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
              }`}
            >
              Contact Messages
            </button>
            <button
              onClick={() => setActiveTab("organizations")}
              className={`whitespace-nowrap py-2.5 px-6 rounded-xl font-medium text-sm transition-all duration-300 ${
                activeTab === "organizations"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
              }`}
            >
              Organizations
            </button>
            <button
              onClick={() => setActiveTab("create_admin")}
              className={`whitespace-nowrap py-2.5 px-6 rounded-xl font-medium text-sm transition-all duration-300 ${
                activeTab === "create_admin"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
              }`}
            >
              Create Org Admin
            </button>
          </nav>
        </div>

        <div className="mt-8">
          {/* Notifications */}
          {actionStatus && (
            <div className={`p-4 mb-6 rounded-2xl border backdrop-blur-2xl flex justify-between items-center animate-in fade-in slide-in-from-top-4 ${
              actionStatus.type === "success" 
                ? "bg-green-900/20 border-green-500/30 text-green-200" 
                : "bg-red-900/20 border-red-500/30 text-red-200"
            }`}>
              <span className="font-medium">{actionStatus.text}</span>
              <button className="text-2xl leading-none opacity-50 hover:opacity-100 px-2" onClick={() => setActionStatus(null)}>&times;</button>
            </div>
          )}

          {loading ? (
            <div className="text-center py-20 text-gray-400 font-medium animate-pulse">Loading...</div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 backdrop-blur-3xl shadow-2xl shadow-black/50">
              {/* MESSAGES TAB */}
              {activeTab === "messages" && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-white/10">
                    <thead>
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {messages.length === 0 ? (
                        <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500 italic">No messages found.</td></tr>
                      ) : (
                        messages.map((msg) => (
                          <tr key={msg.id} className="hover:bg-white/[0.03] transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{new Date(msg.createdAt).toLocaleDateString()}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-white">{msg.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{msg.email}</td>
                            <td className="px-6 py-4 text-sm text-gray-300 max-w-xs truncate" title={msg.message}>{msg.message}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ORGANIZATIONS TAB */}
              {activeTab === "organizations" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                  <div className="lg:col-span-2">
                    <h2 className="text-xl font-bold mb-6 text-white tracking-tight">Existing Organizations</h2>
                    <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/20">
                      <table className="min-w-full divide-y divide-white/10">
                        <thead className="bg-white/5">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Name</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Status</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {organizations.length === 0 ? (
                            <tr><td colSpan={3} className="px-6 py-12 text-center text-gray-500 italic">No organizations found.</td></tr>
                          ) : (
                            organizations.map((org) => (
                              <tr key={org.id} className="hover:bg-white/[0.03] transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{org.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  {org.isSuspended ? (
                                    <span className="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Suspended</span>
                                  ) : (
                                    <span className="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-green-500/20 text-green-400 border border-green-500/30">Active</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <button
                                    onClick={() => handleToggleSuspension(org.id, org.isSuspended)}
                                    className={`transition-colors font-bold hover:underline underline-offset-4 ${org.isSuspended ? 'text-green-400 hover:text-green-300' : 'text-red-400 hover:text-red-300'}`}
                                  >
                                    {org.isSuspended ? 'Unsuspend' : 'Suspend'}
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h2 className="text-xl font-bold text-white tracking-tight">Add Organization</h2>
                    <div className="bg-white/5 p-6 rounded-3xl border border-white/10 shadow-inner">
                      <form onSubmit={handleCreateOrganization} className="space-y-5">
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Name</label>
                          <input
                            type="text"
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                            value={newOrgName}
                            onChange={(e) => setNewOrgName(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Policies (JSON optional)</label>
                          <textarea
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all h-32 resize-none"
                            value={newOrgPolicies}
                            onChange={(e) => setNewOrgPolicies(e.target.value)}
                          />
                        </div>
                        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-blue-600/30 active:scale-95">
                          Create Organization
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}

              {/* CREATE ADMIN TAB */}
              {activeTab === "create_admin" && (
                <div className="max-w-xl mx-auto py-8">
                  <div className="bg-white/5 p-10 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full" />
                    <h2 className="text-2xl font-bold mb-8 text-white text-center">Create Organization Admin</h2>
                    <form onSubmit={handleCreateAdmin} className="space-y-6">
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Organization</label>
                        <select
                          required
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none cursor-pointer"
                          value={selectedOrgId}
                          onChange={(e) => setSelectedOrgId(e.target.value)}
                        >
                          <option value="" className="bg-slate-900">Select an Organization...</option>
                          {organizations.map(org => (
                            <option key={org.id} value={org.id} className="bg-slate-900">{org.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Admin Email</label>
                        <input
                          type="email"
                          required
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                          value={newAdminEmail}
                          onChange={(e) => setNewAdminEmail(e.target.value)}
                        />
                        <p className="mt-4 text-xs text-gray-400 leading-relaxed italic">
                          An invite email will be sent to the address above with a secure link
                          to set up their name and password.
                        </p>
                      </div>
                      <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-5 rounded-2xl transition-all shadow-xl shadow-blue-600/30 active:scale-95 mt-4">
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