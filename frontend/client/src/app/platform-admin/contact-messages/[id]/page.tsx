"use client";

import { useEffect, useState } from "react";
import { platformAdminApi } from "@/lib/api";
import { ContactMessage } from "@/lib/types";
import { useRouter, useParams } from "next/navigation";
import { getStoredUser } from "@/lib/auth";

function StatusBadge({ status }: { status: ContactMessage["status"] }) {
  const styles = {
    PENDING_APPROVAL: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    PENDING_RESPONSE: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    APPROVED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    REJECTED: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };
  const labels = {
    PENDING_APPROVAL: "Pending Approval",
    PENDING_RESPONSE: "Awaiting Org Response",
    APPROVED: "Approved",
    REJECTED: "Rejected",
  };
  return (
    <span className={`px-4 py-1.5 inline-flex text-[10px] font-black rounded-full border uppercase tracking-widest ${styles[status]}`}>
      {labels[status]}
    </span>
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
          autoFocus
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-sm h-32 resize-none"
          placeholder="What additional information do you need?"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-xs font-black uppercase tracking-widest">Cancel</button>
          <button
            disabled={!text.trim() || loading}
            onClick={async () => { setLoading(true); await onSubmit(text); setLoading(false); }}
            className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest disabled:opacity-40"
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
        <p className="text-white/40 text-xs mb-6">A rejection email will be sent. You may include an optional reason.</p>
        <textarea
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-rose-500/40 text-sm h-28 resize-none"
          placeholder="Reason for rejection (optional)..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-xs font-black uppercase tracking-widest">Cancel</button>
          <button
            disabled={loading}
            onClick={async () => { setLoading(true); await onSubmit(reason || undefined); setLoading(false); }}
            className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-widest disabled:opacity-40"
          >
            {loading ? "Rejecting..." : "Confirm Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">{label}</p>
      <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{value || <span className="text-white/20 italic">Not provided</span>}</p>
    </div>
  );
}

export default function ContactMessageDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [msg, setMsg] = useState<ContactMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showInquiry, setShowInquiry] = useState(false);
  const [showReject, setShowReject] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== "ADMIN") { router.push("/platform-admin/login"); return; }
    load();
  }, [id]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await platformAdminApi.getContactMessage(id);
      setMsg(data);
    } catch { router.push("/platform-admin/dashboard"); }
    finally { setLoading(false); }
  };

  const flash = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  };

  const handleApprove = async () => {
    setProcessing(true);
    try {
      await platformAdminApi.approveContactMessage(id);
      flash("success", "Organization approved — setup email sent.");
      load();
    } catch (err: any) {
      flash("error", err.response?.data?.message || "Failed to approve.");
    } finally { setProcessing(false); }
  };

  const handleReject = async (reason?: string) => {
    try {
      await platformAdminApi.rejectContactMessage(id, reason);
      flash("success", "Rejected — notification email sent.");
      setShowReject(false);
      load();
    } catch (err: any) {
      flash("error", err.response?.data?.message || "Failed to reject.");
      setShowReject(false);
    }
  };

  const handleInquiry = async (message: string) => {
    try {
      await platformAdminApi.sendInquiry(id, message);
      flash("success", "Inquiry sent — org will receive a revision link.");
      setShowInquiry(false);
      load();
    } catch (err: any) {
      flash("error", err.response?.data?.message || "Failed to send inquiry.");
      setShowInquiry(false);
    }
  };

  const blocked = msg?.status === "APPROVED" || msg?.status === "REJECTED";

  return (
    <div className="min-h-screen w-full bg-cover bg-center bg-fixed relative flex flex-col items-center py-12 px-4 text-white" style={{ backgroundImage: `url(/bk2.jpg)` }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" />
      <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      {showInquiry && <InquiryModal onClose={() => setShowInquiry(false)} onSubmit={handleInquiry} />}
      {showReject && <RejectModal onClose={() => setShowReject(false)} onSubmit={handleReject} />}

      <div className="relative z-10 w-full max-w-3xl">
        {/* Back */}
        <button
          onClick={() => router.push("/platform-admin/dashboard")}
          className="flex items-center gap-2 text-white/40 hover:text-white text-xs font-black uppercase tracking-widest mb-8 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </button>

        {loading ? (
          <div className="text-center py-20 text-white/40 font-black uppercase tracking-[0.3em] text-xs animate-pulse">Loading...</div>
        ) : msg && (
          <>
            {/* Toast */}
            {toast && (
              <div className={`mb-8 p-5 rounded-2xl border flex justify-between items-center ${toast.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"}`}>
                <span className="text-xs font-black uppercase tracking-widest">{toast.text}</span>
                <button onClick={() => setToast(null)} className="text-white/40 hover:text-white text-xl">&times;</button>
              </div>
            )}

            {/* Header card */}
            <div className="bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[2.5rem] p-8 mb-6 shadow-2xl">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-black text-white tracking-tighter italic uppercase">{msg.name}</h1>
                  <p className="text-white/50 text-sm mt-1">{msg.email}</p>
                  <p className="text-white/30 text-xs mt-1">Submitted {new Date(msg.createdAt).toLocaleString()}</p>
                </div>
                <StatusBadge status={msg.status} />
              </div>

              {/* Action buttons */}
              {!blocked && (
                <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t border-white/10">
                  <button
                    disabled={processing}
                    onClick={handleApprove}
                    className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest transition-all disabled:opacity-40 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    {processing ? "Approving..." : "Approve"}
                  </button>
                  <button
                    onClick={() => setShowInquiry(true)}
                    className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    Send Inquiry
                  </button>
                  <button
                    onClick={() => setShowReject(true)}
                    className="px-6 py-3 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    Reject
                  </button>
                </div>
              )}

              {/* Approved info */}
              {msg.status === "APPROVED" && msg.approvedAt && (
                <div className="mt-6 pt-6 border-t border-white/10 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <p className="text-xs text-emerald-400/80">Approved on {new Date(msg.approvedAt).toLocaleString()}</p>
                </div>
              )}

              {/* Rejected info */}
              {msg.status === "REJECTED" && msg.rejectedAt && (
                <div className="mt-6 pt-6 border-t border-white/10 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-rose-400" />
                  <p className="text-xs text-rose-400/80">Rejected on {new Date(msg.rejectedAt).toLocaleString()}</p>
                </div>
              )}
            </div>

            {/* Submission details */}
            <div className="bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[2.5rem] p-8 mb-6 shadow-2xl space-y-6">
              <h2 className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Submission Details</h2>
              <Field label="Company Name" value={msg.name} />
              <Field label="Business Email" value={msg.email} />
              <Field label="HR Admin Name" value={msg.hrAdminName} />
              <Field label="Company Details" value={msg.companyDetails} />
              <div>
                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2">Message</p>
                <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
                  <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                </div>
              </div>
            </div>

            {/* Inquiry sent */}
            {msg.inquiryMessage && (
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-[2.5rem] p-8 mb-6 shadow-2xl">
                <h2 className="text-[10px] font-black text-blue-400/60 uppercase tracking-[0.3em] mb-4">Inquiry Sent to Organization</h2>
                <p className="text-sm text-blue-200/80 leading-relaxed whitespace-pre-wrap">{msg.inquiryMessage}</p>
              </div>
            )}

            {/* Rejection reason */}
            {msg.rejectionReason && (
              <div className="bg-rose-500/5 border border-rose-500/20 rounded-[2.5rem] p-8 shadow-2xl">
                <h2 className="text-[10px] font-black text-rose-400/60 uppercase tracking-[0.3em] mb-4">Rejection Reason</h2>
                <p className="text-sm text-rose-200/80 leading-relaxed whitespace-pre-wrap">{msg.rejectionReason}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
