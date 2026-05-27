"use client";

import { useEffect, useState, useRef } from "react";
import { platformAdminApi } from "@/lib/api";
import { ContactMessage, Organization, OrgAdminUser } from "@/lib/types";
import { useRouter } from "next/navigation";
import { getStoredUser, removeTokens } from "@/lib/auth";

type Tab = "messages" | "organizations" | "org_admins" | "create_admin";

function StatusBadge({ status }: { status: ContactMessage["status"] }) {
  const map = {
    PENDING_APPROVAL: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    PENDING_RESPONSE: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    APPROVED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    REJECTED: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };
  const labels = {
    PENDING_APPROVAL: "Pending",
    PENDING_RESPONSE: "Awaiting Response",
    APPROVED: "Approved",
    REJECTED: "Rejected",
  };
  return (
    <span className={`px-3 py-1 inline-flex text-[9px] font-black rounded-full border uppercase tracking-widest ${map[status]}`}>
      {labels[status]}
    </span>
  );
}

function ActionDropdown({
  msg,
  onApprove,
  onReject,
  onInquiry,
  onView,
  processing,
}: {
  msg: ContactMessage;
  onApprove: () => void;
  onReject: () => void;
  onInquiry: () => void;
  onView: () => void;
  processing: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const blocked = msg.status === "APPROVED" || msg.status === "REJECTED";

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 hover:text-indigo-300 transition-all px-3 py-1.5 rounded-lg hover:bg-white/5 flex items-center gap-1.5"
      >
        Actions
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-44 bg-slate-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
          <button onClick={() => { setOpen(false); onView(); }}
            className="w-full text-left px-4 py-2.5 text-xs font-semibold text-white/80 hover:bg-white/5 transition-colors">
            View Details
          </button>
          <div className="h-px bg-white/5" />
          <button onClick={() => { setOpen(false); onApprove(); }}
            disabled={blocked || processing}
            className="w-full text-left px-4 py-2.5 text-xs font-semibold text-emerald-400 hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            Approve
          </button>
          <button onClick={() => { setOpen(false); onInquiry(); }}
            disabled={blocked}
            className="w-full text-left px-4 py-2.5 text-xs font-semibold text-blue-400 hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            Send Inquiry
          </button>
          <div className="h-px bg-white/5" />
          <button onClick={() => { setOpen(false); onReject(); }}
            disabled={blocked}
            className="w-full text-left px-4 py-2.5 text-xs font-semibold text-rose-400 hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

function InquiryModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (msg: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 w-full max-w-lg shadow-2xl">
        <h3 className="text-lg font-black text-white tracking-tighter uppercase mb-2">Send Inquiry</h3>
        <p className="text-white/40 text-xs mb-6">The organization will receive an email with a link to update their submission.</p>
        <textarea
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-sm h-32 resize-none"
          placeholder="What additional information do you need from this organization?"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-xs font-black uppercase tracking-widest transition-all">Cancel</button>
          <button
            disabled={!text.trim() || loading}
            onClick={async () => { setLoading(true); await onSubmit(text); setLoading(false); }}
            className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest transition-all disabled:opacity-40"
          >
            {loading ? "Sending..." : "Send Inquiry"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (reason?: string) => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 w-full max-w-lg shadow-2xl">
        <h3 className="text-lg font-black text-white tracking-tighter uppercase mb-2">Reject Registration</h3>
        <p className="text-white/40 text-xs mb-6">The organization will receive a rejection email. You can optionally include a reason.</p>
        <textarea
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-rose-500/40 text-sm h-28 resize-none"
          placeholder="Reason for rejection (optional)..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-xs font-black uppercase tracking-widest transition-all">Cancel</button>
          <button
            disabled={loading}
            onClick={async () => { setLoading(true); await onSubmit(reason || undefined); setLoading(false); }}
            className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-widest transition-all disabled:opacity-40"
          >
            {loading ? "Rejecting..." : "Confirm Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditOrgModal({ org, onClose, onSave }: { org: Organization; onClose: () => void; onSave: (name: string) => Promise<void> }) {
  const [name, setName] = useState(org.name);
  const [loading, setLoading] = useState(false);
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 w-full max-w-lg shadow-2xl">
        <h3 className="text-lg font-black text-white tracking-tighter uppercase mb-6">Edit Organization</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-white/40 mb-2">Name</label>
            <input className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white focus:outline-none focus:ring-2 focus:ring-white/20 text-sm" value={name} onChange={e => setName(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-xs font-black uppercase tracking-widest transition-all">Cancel</button>
          <button disabled={!name.trim() || loading} onClick={async () => { setLoading(true); await onSave(name); setLoading(false); }} className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest transition-all disabled:opacity-40">{loading ? "Saving..." : "Save Changes"}</button>
        </div>
      </div>
    </div>
  );
}

export default function PlatformAdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("messages");
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgAdmins, setOrgAdmins] = useState<OrgAdminUser[]>([]);
  const [newOrgName, setNewOrgName] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [processingMessageId, setProcessingMessageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionStatus, setActionStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [inquiryTarget, setInquiryTarget] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [editOrgTarget, setEditOrgTarget] = useState<Organization | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== "ADMIN") { router.push("/platform-admin/login"); return; }
    loadData();
  }, [router]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === "messages") {
        const res = await platformAdminApi.getContactMessages();
        setMessages(res.content);
      } else if (activeTab === "org_admins") {
        const [adminsData, orgsData] = await Promise.all([
          platformAdminApi.getOrgAdmins(),
          platformAdminApi.getOrganizations({ size: 1000 }),
        ]);
        setOrgAdmins(adminsData);
        setOrganizations(orgsData.content);
      } else {
        const res = await platformAdminApi.getOrganizations();
        setOrganizations(res.content);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [activeTab]);

  const flash = (type: "success" | "error", text: string) => {
    setActionStatus({ type, text });
    setTimeout(() => setActionStatus(null), 5000);
  };

  const handleApprove = async (id: string) => {
    setProcessingMessageId(id);
    try {
      await platformAdminApi.approveContactMessage(id);
      flash("success", "Organization approved — setup email sent to the HR admin.");
      await loadData();
    } catch (err: any) {
      flash("error", err.response?.data?.message || "Failed to approve.");
    } finally { setProcessingMessageId(null); }
  };

  const handleReject = async (id: string, reason?: string) => {
    try {
      await platformAdminApi.rejectContactMessage(id, reason);
      flash("success", "Registration rejected — rejection email sent.");
      setRejectTarget(null);
      await loadData();
    } catch (err: any) {
      flash("error", err.response?.data?.message || "Failed to reject.");
      setRejectTarget(null);
    }
  };

  const handleInquiry = async (id: string, message: string) => {
    try {
      await platformAdminApi.sendInquiry(id, message);
      flash("success", "Inquiry sent — the organization will receive an email with a revision link.");
      setInquiryTarget(null);
      await loadData();
    } catch (err: any) {
      flash("error", err.response?.data?.message || "Failed to send inquiry.");
      setInquiryTarget(null);
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await platformAdminApi.createOrganization({ name: newOrgName });
      flash("success", "Organization created successfully.");
      setNewOrgName(""); loadData();
    } catch { flash("error", "Failed to create organization."); }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId) { flash("error", "Please select an organization."); return; }
    try {
      await platformAdminApi.inviteOrgAdmin({ email: newAdminEmail, orgId: selectedOrgId });
      flash("success", `Invite sent to ${newAdminEmail}.`);
      setNewAdminEmail(""); setSelectedOrgId("");
    } catch (err: any) { flash("error", err.response?.data?.message || "Failed to send invite."); }
  };

  const cardClass = "bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[3rem] overflow-hidden shadow-2xl relative";

  return (
    <div className="min-h-screen w-full bg-cover bg-center bg-fixed relative flex flex-col items-center py-12 px-4 text-white" style={{ backgroundImage: `url(/bk2.jpg)` }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" />
      <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      {inquiryTarget && (
        <InquiryModal
          onClose={() => setInquiryTarget(null)}
          onSubmit={(msg) => handleInquiry(inquiryTarget, msg)}
        />
      )}
      {rejectTarget && (
        <RejectModal
          onClose={() => setRejectTarget(null)}
          onSubmit={(reason) => handleReject(rejectTarget, reason)}
        />
      )}
      {editOrgTarget && (
        <EditOrgModal
          org={editOrgTarget}
          onClose={() => setEditOrgTarget(null)}
          onSave={async (name) => {
            try {
              await platformAdminApi.updateOrganization(editOrgTarget.id, { name });
              flash("success", "Organization updated.");
              setEditOrgTarget(null);
              loadData();
            } catch { flash("error", "Failed to update organization."); }
          }}
        />
      )}

      <div className="relative z-10 w-full max-w-7xl">
        {/* Header */}
        <div className="w-full bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] px-8 py-6 mb-12 shadow-2xl flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <h1 className="text-2xl font-black text-white tracking-tighter italic uppercase">Platform Admin Dashboard</h1>
          <button
            onClick={() => { removeTokens(); router.push("/platform-admin/login"); }}
            className="text-[10px] font-black px-8 py-4 bg-white/5 hover:bg-white/10 text-rose-400 hover:text-rose-300 rounded-2xl border border-white/10 transition-all uppercase tracking-[0.2em]"
          >Logout</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-1.5 bg-white/5 backdrop-blur-3xl rounded-2xl border border-white/10 w-fit mb-12 shadow-inner">
          <nav className="flex space-x-1">
            {(["messages", "organizations", "org_admins", "create_admin"] as Tab[]).map((tab) => {
              const labels: Record<Tab, string> = { messages: "Contact Messages", organizations: "Organizations", org_admins: "Org Admins", create_admin: "Create Org Admin" };
              return (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-8 py-3 rounded-xl text-[10px] font-black transition-all uppercase tracking-[0.2em] ${activeTab === tab ? "bg-white text-slate-950 shadow-xl" : "text-white/40 hover:text-white hover:bg-white/5"}`}>
                  {labels[tab]}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Toast */}
        {actionStatus && (
          <div className={`mb-10 p-6 rounded-[2rem] border backdrop-blur-3xl flex justify-between items-center shadow-2xl ${actionStatus.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"}`}>
            <span className="text-xs font-black uppercase tracking-[0.1em]">{actionStatus.text}</span>
            <button className="text-2xl opacity-50 hover:opacity-100 text-white" onClick={() => setActionStatus(null)}>&times;</button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-white/40 font-black uppercase tracking-[0.3em] text-xs animate-pulse">Loading...</div>
        ) : (
          <div className="w-full animate-in fade-in duration-500">

            {/* MESSAGES TAB */}
            {activeTab === "messages" && (
              <div className={cardClass}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5">
                        {["Date", "Company", "Email", "HR Admin", "Status", "Actions"].map((h) => (
                          <th key={h} className={`px-6 py-5 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] ${h === "Actions" ? "text-right" : "text-left"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {messages.length === 0 ? (
                        <tr><td colSpan={6} className="px-8 py-12 text-center text-white/40 italic text-sm">No messages found.</td></tr>
                      ) : messages.map((msg) => (
                        <tr
                          key={msg.id}
                          onClick={() => router.push(`/platform-admin/contact-messages/${msg.id}`)}
                          className="hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 cursor-pointer"
                        >
                          <td className="px-6 py-5 whitespace-nowrap text-sm text-white/60">{new Date(msg.createdAt).toLocaleDateString()}</td>
                          <td className="px-6 py-5 whitespace-nowrap text-sm font-bold text-white italic">{msg.name}</td>
                          <td className="px-6 py-5 whitespace-nowrap text-sm text-white/60">{msg.email}</td>
                          <td className="px-6 py-5 whitespace-nowrap text-sm text-white/60">{msg.hrAdminName || <span className="text-white/20 italic">—</span>}</td>
                          <td className="px-6 py-5 whitespace-nowrap"><StatusBadge status={msg.status} /></td>
                          <td className="px-6 py-5 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                            <ActionDropdown
                              msg={msg}
                              processing={processingMessageId === msg.id}
                              onView={() => router.push(`/platform-admin/contact-messages/${msg.id}`)}
                              onApprove={() => handleApprove(msg.id)}
                              onInquiry={() => setInquiryTarget(msg.id)}
                              onReject={() => setRejectTarget(msg.id)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ORGANIZATIONS TAB */}
            {activeTab === "organizations" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
                <div className="lg:col-span-2">
                  <h2 className="text-4xl font-black text-white tracking-tighter italic uppercase mb-8">Existing Organizations</h2>
                  <div className={cardClass}>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/5">
                          {["Name", "Status", "Actions"].map((h) => (
                            <th key={h} className={`px-8 py-6 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] ${h === "Actions" ? "text-right" : "text-left"}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {organizations.length === 0 ? (
                          <tr><td colSpan={3} className="px-8 py-12 text-center text-white/40 italic text-sm">No organizations found.</td></tr>
                        ) : organizations.map((org) => (
                          <tr key={org.id} className="hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                            <td className="px-8 py-6 whitespace-nowrap text-sm font-bold text-white italic">{org.name}</td>
                            <td className="px-8 py-6">
                              <span className={`px-3 py-1 inline-flex text-[9px] font-black rounded-full border uppercase tracking-widest ${org.isSuspended ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"}`}>
                                {org.isSuspended ? "Suspended" : "Active"}
                              </span>
                            </td>
                            <td className="px-8 py-6 text-right">
                              <div className="flex items-center justify-end gap-4">
                                <button onClick={() => router.push(`/platform-admin/organizations/${org.id}`)} className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 hover:text-indigo-300 transition-all">View</button>
                                <button onClick={() => setEditOrgTarget(org)} className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 hover:text-blue-300 transition-all">Edit</button>
                                <button onClick={() => platformAdminApi.toggleSuspension(org.id, !org.isSuspended).then(() => loadData())} className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all ${org.isSuspended ? "text-emerald-400 hover:text-emerald-300" : "text-rose-400 hover:text-rose-300"}`}>{org.isSuspended ? "Unsuspend" : "Suspend"}</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <h2 className="text-4xl font-black text-white tracking-tighter italic uppercase mb-8">Add Org</h2>
                  <div className="bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[3rem] p-8 shadow-2xl">
                    <form onSubmit={handleCreateOrg} className="space-y-6">
                      <div>
                        <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-white/40 mb-2">Name</label>
                        <input type="text" required className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-all text-sm italic" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} />
                      </div>
                      <button type="submit" className="w-full py-4 bg-white text-slate-950 text-[11px] font-black rounded-2xl hover:scale-105 active:scale-95 shadow-2xl transition-all uppercase tracking-[0.2em]">Create Organization</button>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* ORG ADMINS TAB */}
            {activeTab === "org_admins" && (
              <div className={cardClass}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5">
                        {["Name", "Email", "Organization", "Status", "Actions"].map((h) => (
                          <th key={h} className={`px-6 py-5 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] ${h === "Actions" ? "text-right" : "text-left"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {orgAdmins.length === 0 ? (
                        <tr><td colSpan={5} className="px-8 py-12 text-center text-white/40 italic text-sm">No org admins found.</td></tr>
                      ) : orgAdmins.map((admin) => {
                        const organization = organizations.find((org) => org.id === admin.orgId);
                        return (
                          <tr key={admin.id} className="hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                            <td className="px-6 py-5 whitespace-nowrap text-sm font-bold text-white italic">{admin.firstName} {admin.lastName}</td>
                            <td className="px-6 py-5 whitespace-nowrap text-sm text-white/60">{admin.email}</td>
                            <td className="px-6 py-5 whitespace-nowrap text-sm text-white/60">
                              <button onClick={() => router.push(`/platform-admin/organizations/${admin.orgId}`)} className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-all">{organization?.name || admin.orgId}</button>
                            </td>
                            <td className="px-6 py-5">
                              <span className={`px-3 py-1 inline-flex text-[9px] font-black rounded-full border uppercase tracking-widest ${admin.isSuspended ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"}`}>{admin.isSuspended ? "Suspended" : "Active"}</span>
                            </td>
                            <td className="px-6 py-5 text-right">
                              <button onClick={() => platformAdminApi.suspendOrgAdmin(admin.id, !admin.isSuspended).then(() => loadData())} className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all ${admin.isSuspended ? "text-emerald-400 hover:text-emerald-300" : "text-rose-400 hover:text-rose-300"}`}>{admin.isSuspended ? "Unsuspend" : "Suspend"}</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* CREATE ADMIN TAB */}
            {activeTab === "create_admin" && (
              <div className="max-w-xl mx-auto py-4">
                <div className="bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[3rem] p-8 lg:p-12 shadow-2xl">
                  <h2 className="text-xl font-black mb-8 text-white text-center tracking-tighter italic uppercase">Create Organization Admin</h2>
                  <form onSubmit={handleCreateAdmin} className="space-y-6">
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-white/40 mb-2">Organization</label>
                      <div className="relative">
                        <select required className="w-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.1em] text-white rounded-2xl pl-6 pr-10 py-4 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all cursor-pointer appearance-none" value={selectedOrgId} onChange={(e) => setSelectedOrgId(e.target.value)}>
                          <option value="" className="bg-slate-900">Select an Organization...</option>
                          {organizations.map((org) => (
                            <option key={org.id} value={org.id} className="bg-slate-900">{org.name}</option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-white/40">
                          <svg className="fill-current h-4 w-4" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-white/40 mb-2">Admin Email</label>
                      <input type="email" required className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-all text-sm italic" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} />
                      <p className="mt-3 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] leading-relaxed italic">An invite email will be sent with a secure link to set up their account.</p>
                    </div>
                    <button type="submit" className="w-full py-5 bg-white text-slate-950 text-[11px] font-black rounded-2xl hover:scale-105 active:scale-95 shadow-2xl transition-all uppercase tracking-[0.2em] mt-4">Send Invite</button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
