"use client";

import { useEffect, useState } from "react";
import { platformAdminApi } from "@/lib/api";
import { Organization, OrgMember } from "@/lib/types";
import { useRouter, useParams } from "next/navigation";
import { getStoredUser, removeTokens } from "@/lib/auth";

type MemberTab = "admins" | "recruiters";

function SuspendBadge({ suspended }: { suspended: boolean }) {
  return (
    <span className={`px-3 py-1 inline-flex text-[9px] font-black rounded-full border uppercase tracking-widest ${suspended ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"}`}>
      {suspended ? "Suspended" : "Active"}
    </span>
  );
}

export default function OrgDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orgId = params.id as string;

  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [memberTab, setMemberTab] = useState<MemberTab>("admins");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== "ADMIN") { router.push("/platform-admin/login"); return; }
    loadAll();
  }, [orgId]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [orgData, membersData] = await Promise.all([
        platformAdminApi.getOrganization(orgId),
        platformAdminApi.getOrgMembers(orgId),
      ]);
      setOrg(orgData);
      setEditName(orgData.name);
      setMembers(membersData);
    } catch (err) {
      console.error(err);
      showFlash("error", "Failed to load organization data.");
    } finally {
      setLoading(false);
    }
  };

  const showFlash = (type: "success" | "error", text: string) => {
    setFlash({ type, text });
    setTimeout(() => setFlash(null), 5000);
  };

  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org) return;
    setSaving(true);
    try {
      const updated = await platformAdminApi.updateOrganization(org.id, { name: editName });
      setOrg(updated);
      setEditMode(false);
      showFlash("success", "Organization updated successfully.");
    } catch {
      showFlash("error", "Failed to update organization.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSuspendOrg = async () => {
    if (!org) return;
    try {
      const updated = await platformAdminApi.toggleSuspension(org.id, !org.isSuspended);
      setOrg(updated);
      showFlash("success", `Organization ${updated.isSuspended ? "suspended" : "unsuspended"}.`);
    } catch {
      showFlash("error", "Failed to update organization status.");
    }
  };

  const handleToggleMember = async (member: OrgMember) => {
    try {
      await platformAdminApi.suspendOrgMember(member.id, !member.isSuspended);
      showFlash("success", `${member.firstName} ${member.lastName} ${member.isSuspended ? "unsuspended" : "suspended"}.`);
      const fresh = await platformAdminApi.getOrgMembers(orgId);
      setMembers(fresh);
    } catch {
      showFlash("error", "Failed to update member status.");
    }
  };

  const admins = members.filter(m => m.role === "ORG_ADMIN");
  const recruiters = members.filter(m => m.role === "RECRUITER");

  const cardClass = "bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[3rem] overflow-hidden shadow-2xl relative";

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-cover bg-center bg-fixed relative flex items-center justify-center" style={{ backgroundImage: "url(/bk2.jpg)" }}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" />
        <p className="relative z-10 text-white/40 font-black uppercase tracking-[0.3em] text-xs animate-pulse">Loading...</p>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <p className="text-white/40">Organization not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-cover bg-center bg-fixed relative flex flex-col items-center py-12 px-4 text-white" style={{ backgroundImage: "url(/bk2.jpg)" }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" />
      <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-7xl">
        {/* Header */}
        <div className="w-full bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] px-8 py-6 mb-10 shadow-2xl flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/platform-admin/dashboard")} className="text-white/40 hover:text-white transition-colors text-xs font-black uppercase tracking-[0.2em]">
              ← Back
            </button>
            <div className="w-px h-6 bg-white/10" />
            <h1 className="text-2xl font-black text-white tracking-tighter italic uppercase">{org.name}</h1>
            <SuspendBadge suspended={org.isSuspended} />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => removeTokens()} className="text-[10px] font-black px-6 py-3 bg-white/5 hover:bg-white/10 text-rose-400 rounded-2xl border border-white/10 transition-all uppercase tracking-[0.2em]">Logout</button>
          </div>
        </div>

        {/* Flash */}
        {flash && (
          <div className={`mb-8 p-5 rounded-[2rem] border backdrop-blur-3xl flex justify-between items-center shadow-2xl ${flash.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"}`}>
            <span className="text-xs font-black uppercase tracking-[0.1em]">{flash.text}</span>
            <button onClick={() => setFlash(null)} className="text-2xl opacity-50 hover:opacity-100 text-white">&times;</button>
          </div>
        )}

        {/* Org Info Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mb-10 items-start">
          <div className="lg:col-span-2">
            {editMode ? (
              <div className="bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[3rem] p-8 shadow-2xl">
                <h2 className="text-xl font-black text-white tracking-tighter uppercase mb-6">Edit Organization</h2>
                <form onSubmit={handleSaveOrg} className="space-y-5">
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-white/40 mb-2">Name</label>
                    <input required className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-white/20 text-sm italic" value={editName} onChange={e => setEditName(e.target.value)} />
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setEditMode(false)} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-xs font-black uppercase tracking-widest transition-all">Cancel</button>
                    <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest transition-all disabled:opacity-40">{saving ? "Saving..." : "Save Changes"}</button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[3rem] p-8 shadow-2xl space-y-5">
                <h2 className="text-xl font-black text-white tracking-tighter uppercase mb-2">Organization Details</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-2xl p-5">
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">Name</p>
                    <p className="text-white font-bold italic">{org.name}</p>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-5">
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">Created</p>
                    <p className="text-white/60 text-sm">{new Date(org.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-5 col-span-2">
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">Status</p>
                    <SuspendBadge suspended={org.isSuspended} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="space-y-4">
            <div className="bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[3rem] p-8 shadow-2xl">
              <h2 className="text-sm font-black text-white tracking-tighter uppercase mb-6">Quick Actions</h2>
              <div className="space-y-3">
                <button onClick={() => setEditMode(true)} className="w-full py-3 px-5 rounded-2xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 text-xs font-black uppercase tracking-[0.2em] transition-all border border-indigo-500/20 text-left">✎ Edit Organization</button>
                <button onClick={handleToggleSuspendOrg} className={`w-full py-3 px-5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all border text-left ${org.isSuspended ? "bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border-emerald-500/20" : "bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border-rose-500/20"}`}>{org.isSuspended ? "✓ Unsuspend Organization" : "⊘ Suspend Organization"}</button>
              </div>
              <div className="mt-6 pt-6 border-t border-white/10 space-y-2">
                <div className="flex justify-between text-xs"><span className="text-white/40 font-black uppercase tracking-widest">Admins</span><span className="text-white font-bold">{admins.length}</span></div>
                <div className="flex justify-between text-xs"><span className="text-white/40 font-black uppercase tracking-widest">Recruiters</span><span className="text-white font-bold">{recruiters.length}</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Members Section */}
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter italic uppercase mb-6">Members</h2>

          {/* Member Tabs */}
          <div className="flex gap-2 p-1.5 bg-white/5 backdrop-blur-3xl rounded-2xl border border-white/10 w-fit mb-8 shadow-inner">
            {(["admins", "recruiters"] as MemberTab[]).map(tab => (
              <button key={tab} onClick={() => setMemberTab(tab)} className={`px-8 py-3 rounded-xl text-[10px] font-black transition-all uppercase tracking-[0.2em] ${memberTab === tab ? "bg-white text-slate-950 shadow-xl" : "text-white/40 hover:text-white hover:bg-white/5"}`}>
                {tab === "admins" ? `Admins (${admins.length})` : `Recruiters (${recruiters.length})`}
              </button>
            ))}
          </div>

          <div className={cardClass}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    {["Name", "Email", "Status", "Actions"].map(h => (
                      <th key={h} className={`px-6 py-5 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] ${h === "Actions" ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(memberTab === "admins" ? admins : recruiters).length === 0 ? (
                    <tr><td colSpan={4} className="px-8 py-12 text-center text-white/40 italic text-sm">No {memberTab} found.</td></tr>
                  ) : (memberTab === "admins" ? admins : recruiters).map(member => (
                    <tr key={member.id} className="hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                      <td className="px-6 py-5 whitespace-nowrap text-sm font-bold text-white italic">{member.firstName} {member.lastName}</td>
                      <td className="px-6 py-5 whitespace-nowrap text-sm text-white/60">{member.email}</td>
                      <td className="px-6 py-5"><SuspendBadge suspended={member.isSuspended} /></td>
                      <td className="px-6 py-5 text-right">
                        <button onClick={() => handleToggleMember(member)} className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all ${member.isSuspended ? "text-emerald-400 hover:text-emerald-300" : "text-rose-400 hover:text-rose-300"}`}>
                          {member.isSuspended ? "Unsuspend" : "Suspend"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
