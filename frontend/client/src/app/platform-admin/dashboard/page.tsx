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
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Platform Admin Dashboard</h1>
          <button 
            onClick={() => {
              removeTokens();
              router.push("/platform-admin/login");
            }}
            className="px-4 py-2 bg-red-600 rounded hover:bg-red-700"
          >
            Logout
          </button>
        </div>

        {renderTabs()}

        <div className="mt-8">
          {actionStatus && (
            <div className={`p-4 mb-6 rounded ${actionStatus.type === "success" ? "bg-green-800 text-green-100" : "bg-red-800 text-red-100"}`}>
              {actionStatus.text}
              <button className="float-right font-bold" onClick={() => setActionStatus(null)}>&times;</button>
            </div>
          )}

          {loading ? (
            <div className="text-center py-10">Loading...</div>
          ) : (
            <>
              {/* MESSAGES TAB */}
              {activeTab === "messages" && (
                <div className="overflow-x-auto bg-gray-800 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {messages.length === 0 ? (
                        <tr><td colSpan={4} className="px-6 py-4 text-center text-gray-400">No messages found.</td></tr>
                      ) : (
                        messages.map((msg) => (
                          <tr key={msg.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{new Date(msg.createdAt).toLocaleDateString()}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{msg.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{msg.email}</td>
                            <td className="px-6 py-4 text-sm max-w-xs truncate" title={msg.message}>{msg.message}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ORGANIZATIONS TAB */}
              {activeTab === "organizations" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-2">
                    <h2 className="text-xl font-semibold mb-4">Existing Organizations</h2>
                    <div className="bg-gray-800 rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-700">
                        <thead className="bg-gray-700">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                          {organizations.length === 0 ? (
                            <tr><td colSpan={3} className="px-6 py-4 text-center text-gray-400">No organizations found.</td></tr>
                          ) : (
                            organizations.map((org) => (
                              <tr key={org.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{org.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  {org.isSuspended ? (
                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Suspended</span>
                                  ) : (
                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Active</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <button
                                    onClick={() => handleToggleSuspension(org.id, org.isSuspended)}
                                    className={`${org.isSuspended ? 'text-green-400 hover:text-green-300' : 'text-red-400 hover:text-red-300'}`}
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

                  <div>
                    <h2 className="text-xl font-semibold mb-4">Add Organization</h2>
                    <div className="bg-gray-800 p-6 rounded-lg">
                      <form onSubmit={handleCreateOrganization}>
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
                          <input
                            type="text"
                            required
                            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                            value={newOrgName}
                            onChange={(e) => setNewOrgName(e.target.value)}
                          />
                        </div>
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-300 mb-1">Policies (JSON optional)</label>
                          <textarea
                            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 h-24"
                            value={newOrgPolicies}
                            onChange={(e) => setNewOrgPolicies(e.target.value)}
                          />
                        </div>
                        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded">
                          Create Organization
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}

              {/* CREATE ADMIN TAB */}
              {activeTab === "create_admin" && (
                <div className="max-w-md mx-auto bg-gray-800 p-8 rounded-lg shadow-xl">
                  <h2 className="text-2xl font-semibold mb-6">Create Organization Admin</h2>
                  <form onSubmit={handleCreateAdmin}>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-300 mb-1">Organization</label>
                      <select
                        required
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                        value={selectedOrgId}
                        onChange={(e) => setSelectedOrgId(e.target.value)}
                      >
                        <option value="">Select an Organization...</option>
                        {organizations.map(org => (
                          <option key={org.id} value={org.id}>{org.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-300 mb-1">Admin Email</label>
                      <input
                        type="email"
                        required
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                      />
                      <p className="mt-2 text-xs text-gray-400">
                        An invite email will be sent to the address above with a secure link
                        to set up their name and password.
                      </p>
                    </div>
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded">
                      Send Invite
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
