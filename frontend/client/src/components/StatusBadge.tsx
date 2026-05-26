"use client";

interface StatusBadgeProps {
  status: string;
  type?: "job" | "application" | "assessment" | "ranking";
}

// Map logical colors to glassmorphic styles
const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  // Positive / Active
  PUBLISHED: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  OFFERED: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  COMPLETED: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  ACTIVE: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },

  // Neutral / Pending
  DRAFT: { bg: "bg-white/5", text: "text-white/60", dot: "bg-white/10" },
  PENDING: { bg: "bg-white/5", text: "text-white/60", dot: "bg-white/10" },
  WITHDRAWN: { bg: "bg-white/5", text: "text-white/60", dot: "bg-white/10" },

  // Warning / Processing
  IN_PROGRESS: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  PROCESSING: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  OA_INVITED: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },

  // Info / Action
  APPLIED: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
  SCORED: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
  SCREENED: { bg: "bg-purple-500/10", text: "text-purple-400", dot: "bg-purple-400" },
  INTERVIEW_SCHEDULED: { bg: "bg-purple-500/10", text: "text-purple-400", dot: "bg-purple-400" },

  // Negative / Danger
  CLOSED: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
  REJECTED: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
  EXPIRED: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
  FAILED: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
};

const statusLabels: Record<string, string> = {
  OA_INVITED: "OA Invited",
  OA_COMPLETED: "OA Completed",
  INTERVIEW_INVITED: "Interview Invited",
  INTERVIEW_SCHEDULED: "Interview Scheduled",
  INTERVIEW_COMPLETED: "Interview Completed",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  // Default fallback if status isn't in the config
  const config = statusConfig[status] || { 
    bg: "bg-white/5", 
    text: "text-white/60", 
    dot: "bg-white/10" 
  };
  
  const displayStatus = statusLabels[status] || status.replace(/_/g, " ");

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/5 shadow-sm backdrop-blur-sm ${config.bg} ${config.text}`}
    >
      {/* Small Glowing Status Dot */}
      <span className={`w-1 h-1 rounded-full ${config.dot} shadow-[0_0_5px_currentColor]`} />
      {displayStatus}
    </span>
  );
}