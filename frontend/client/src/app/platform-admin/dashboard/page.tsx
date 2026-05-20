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
  <div className="flex gap-1 p-1 bg-slate-200/50 backdrop-blur-md rounded-2xl border border-slate-200/60 w-fit mb-8 shadow-inner">
    <nav className="flex space-x-1" aria-label="Tabs">
      <button
        onClick={() => setActiveTab("messages")}
        className={`whitespace-nowrap px-6 py-2.5 rounded-xl text-xs font-bold transition-all uppercase tracking-widest ${
          activeTab === "messages"
            ? "bg-white text-indigo-600 shadow-md"
            : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
        }`}
      >
        Contact Messages
      </button>
      <button
        onClick={() => setActiveTab("organizations")}
        className={`whitespace-nowrap px-6 py-2.5 rounded-xl text-xs font-bold transition-all uppercase tracking-widest ${
          activeTab === "organizations"
            ? "bg-white text-indigo-600 shadow-md"
            : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
        }`}
      >
        Organizations
      </button>
      <button
        onClick={() => setActiveTab("create_admin")}
        className={`whitespace-nowrap px-6 py-2.5 rounded-xl text-xs font-bold transition-all uppercase tracking-widest ${
          activeTab === "create_admin"
            ? "bg-white text-indigo-600 shadow-md"
            : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
        }`}
      >
        Create Org Admin
      </button>
    </nav>
  </div>
);

 return (
  <div className="min-h-screen w-full bg-gradient-to-br from-indigo-50 via-white to-pink-50 relative flex flex-col items-center p-8 transition-all duration-500 text-slate-900">
    {/* Ambient light glow */}
    <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />

    <div className="relative z-10 w-full max-w-7xl">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-8 px-2">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight uppercase">Platform Admin Dashboard</h1>
        <button 
          onClick={() => {
            removeTokens();
            router.push("/platform-admin/login");
          }}
          className="px-6 py-2 bg-white/80 hover:bg-white text-rose-600 hover:text-rose-700 rounded-xl border border-slate-200 shadow-sm hover:shadow transition-all font-bold text-xs uppercase tracking-widest"
        >
          Logout
        </button>
      </div>

      {/* Tabs Container - Glass Pill */}
      <div className="bg-slate-200/50 border border-slate-200/60 rounded-2xl p-1 backdrop-blur-md mb-8 w-fit shadow-inner">
        <nav className="flex space-x-1" aria-label="Tabs">
          <button
            onClick={() => setActiveTab("messages")}
            className={`whitespace-nowrap py-2.5 px-6 rounded-xl font-bold text-xs transition-all uppercase tracking-widest ${
              activeTab === "messages"
                ? "bg-white text-indigo-600 shadow-md"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
            }`}
          >
            Contact Messages
          </button>
          <button
            onClick={() => setActiveTab("organizations")}
            className={`whitespace-nowrap py-2.5 px-6 rounded-xl font-bold text-xs transition-all uppercase tracking-widest ${
              activeTab === "organizations"
                ? "bg-white text-indigo-600 shadow-md"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
            }`}
          >
            Organizations
          </button>
          <button
            onClick={() => setActiveTab("create_admin")}
            className={`whitespace-nowrap py-2.5 px-6 rounded-xl font-bold text-xs transition-all uppercase tracking-widest ${
              activeTab === "create_admin"
                ? "bg-white text-indigo-600 shadow-md"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
            }`}
          >
            Create Org Admin
          </button>
        </nav>
      </div>

      <div className="mt-8">
        {/* Notifications - Floating Light Glass */}
        {actionStatus && (
          <div className={`p-4 mb-6 rounded-2xl border backdrop-blur-2xl flex justify-between items-center shadow-sm animate-in fade-in slide-in-from-top-4 ${
            actionStatus.type === "success" 
              ? "bg-emerald-50/80 border-emerald-200 text-emerald-800" 
              : "bg-rose-50/80 border-rose-200 text-rose-800"
          }`}>
            <span className="font-medium text-sm">{actionStatus.text}</span>
            <button className="text-2xl leading-none opacity-50 hover:opacity-100 px-2" onClick={() => setActionStatus(null)}>&times;</button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest text-xs animate-pulse">Loading...</div>
        ) : (
          /* Main Content - Reflective Light Glass Card */
          <div className="bg-white/70 border border-slate-200/80 rounded-[2rem] p-8 backdrop-blur-xl shadow-xl">
            
            {/* MESSAGES TAB */}
            {activeTab === "messages" && (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/70">
                    {messages.length === 0 ? (
                      <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic text-sm">No messages found.</td></tr>
                    ) : (
                      messages.map((msg) => (
                        <tr key={msg.id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{new Date(msg.createdAt).toLocaleDateString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">{msg.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{msg.email}</td>
                          <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate" title={msg.message}>{msg.message}</td>
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
                  <h2 className="text-xl font-bold mb-6 text-slate-900 tracking-tight">Existing Organizations</h2>
                  <div className="border border-slate-200/60 rounded-2xl overflow-hidden bg-slate-50/30 shadow-sm">
                    <table className="min-w-full">
                      <thead className="bg-slate-50/80 border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Name</th>
                          <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                          <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100/70">
                        {organizations.length === 0 ? (
                          <tr><td colSpan={3} className="px-6 py-12 text-center text-slate-400 italic text-sm">No organizations found.</td></tr>
                        ) : (
                          organizations.map((org) => (
                            <tr key={org.id} className="hover:bg-slate-50/40 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">{org.name}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {org.isSuspended ? (
                                  <span className="px-2.5 py-0.5 inline-flex text-[10px] font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200/60 uppercase tracking-wider">Suspended</span>
                                ) : (
                                  <span className="px-2.5 py-0.5 inline-flex text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 uppercase tracking-wider">Active</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                  onClick={() => handleToggleTransition(org.id, org.isSuspended)}
                                  className={`transition-colors font-bold uppercase text-xs tracking-wide ${org.isSuspended ? 'text-emerald-600 hover:text-emerald-700' : 'text-rose-600 hover:text-rose-700'}`}
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
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">Add Organization</h2>
                  <div className="bg-white/80 p-6 rounded-3xl border border-slate-200/80 shadow-inner">
                    <form onSubmit={handleCreateOrganization} className="space-y-5">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Name</label>
                        <input
                          type="text"
                          required
                          className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 focus:bg-white transition-all shadow-sm"
                          value={newOrgName}
                          onChange={(e) => setNewOrgName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Policies (JSON optional)</label>
                        <textarea
                          className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 focus:bg-white transition-all h-32 resize-none shadow-sm"
                          value={newOrgPolicies}
                          onChange={(e) => setNewOrgPolicies(e.target.value)}
                        />
                      </div>
                      <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl transition-all shadow-sm hover:shadow-md uppercase text-xs tracking-wider active:scale-95">
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
                <div className="bg-white/80 p-10 rounded-[2.5rem] border border-slate-200/80 shadow-inner relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full" />
                  <h2 className="text-2xl font-bold mb-8 text-slate-900 text-center tracking-tight">Create Organization Admin</h2>
                  <form onSubmit={handleCreateAdmin} className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Organization</label>
                      <div className="relative">
                        <select
                          required
                          className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 focus:bg-white transition-all appearance-none cursor-pointer shadow-sm text-sm font-semibold"
                          value={selectedOrgId}
                          onChange={(e) => setSelectedOrgId(e.target.value)}
                        >
                          <option value="" className="bg-white text-slate-700">Select an Organization...</option>
                          {organizations.map(org => (
                            <option key={org.id} value={org.id} className="bg-white text-slate-700">{org.name}</option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Admin Email</label>
                      <input
                        type="email"
                        required
                        className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 focus:bg-white transition-all shadow-sm"
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                      />
                      <p className="mt-4 text-xs text-slate-400 leading-relaxed italic">
                        An invite email will be sent to the address above with a secure link
                        to set up their name and password.
                      </p>
                    </div>
                    <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-5 rounded-2xl transition-all shadow-sm hover:shadow-md uppercase text-xs tracking-wider active:scale-95 mt-4">
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