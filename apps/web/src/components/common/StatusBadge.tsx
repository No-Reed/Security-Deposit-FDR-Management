import React from 'react';
import {
  LifecycleStatus,
  IndependentVerificationStatus,
  DocumentReviewStatus,
  DateStatus,
  RenewalStatus,
  ReleaseStatus,
  ReleaseRequestStatus,
  DiscrepancySeverity,
  DiscrepancyStatus,
} from '@depositdesk/shared';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  ShieldCheck,
  RefreshCw,
  Send,
  HelpCircle,
  Sparkles,
} from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  type?: 'lifecycle' | 'verification' | 'date' | 'renewal' | 'release' | 'severity' | 'discrepancy' | 'docReview';
  className?: string;
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  type = 'lifecycle',
  className = '',
  showIcon = true,
}) => {
  // Styles map: { bg, text, border, dot, icon, label }
  let config = {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
    icon: HelpCircle,
    label: status.replace(/_/g, ' '),
  };

  switch (status) {
    // Lifecycle
    case LifecycleStatus.DRAFT:
      config = {
        bg: 'bg-slate-50',
        text: 'text-slate-600',
        border: 'border-slate-200',
        dot: 'bg-slate-400',
        icon: FileText,
        label: 'Draft',
      };
      break;
    case LifecycleStatus.SUBMITTED:
      config = {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        dot: 'bg-blue-500',
        icon: Send,
        label: 'Submitted',
      };
      break;
    case LifecycleStatus.UNDER_REVIEW:
      config = {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        dot: 'bg-amber-500',
        icon: Clock,
        label: 'Under Review',
      };
      break;
    case LifecycleStatus.ACTION_REQUIRED:
      config = {
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        border: 'border-rose-200',
        dot: 'bg-rose-500',
        icon: AlertTriangle,
        label: 'Action Required',
      };
      break;
    case LifecycleStatus.RESUBMITTED:
      config = {
        bg: 'bg-indigo-50',
        text: 'text-indigo-700',
        border: 'border-indigo-200',
        dot: 'bg-indigo-500',
        icon: RefreshCw,
        label: 'Resubmitted',
      };
      break;
    case LifecycleStatus.VERIFIED:
      config = {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        dot: 'bg-emerald-500',
        icon: CheckCircle2,
        label: 'Verified',
      };
      break;
    case LifecycleStatus.REJECTED:
      config = {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        dot: 'bg-red-500',
        icon: XCircle,
        label: 'Rejected',
      };
      break;
    case LifecycleStatus.CLOSED:
      config = {
        bg: 'bg-zinc-100',
        text: 'text-zinc-600',
        border: 'border-zinc-300',
        dot: 'bg-zinc-400',
        icon: CheckCircle2,
        label: 'Closed',
      };
      break;

    // Independent Verification
    case IndependentVerificationStatus.CONFIRMED_BY_AUTHORIZED_SOURCE:
      config = {
        bg: 'bg-emerald-50',
        text: 'text-emerald-800',
        border: 'border-emerald-200',
        dot: 'bg-emerald-500',
        icon: ShieldCheck,
        label: 'Bank Confirmed',
      };
      break;
    case IndependentVerificationStatus.DEMO_SIMULATED:
      config = {
        bg: 'bg-purple-50',
        text: 'text-purple-700',
        border: 'border-purple-200',
        dot: 'bg-purple-500',
        icon: Sparkles,
        label: 'Demo Simulated',
      };
      break;
    case IndependentVerificationStatus.PENDING:
      config = {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        dot: 'bg-amber-500',
        icon: Clock,
        label: 'Verification Pending',
      };
      break;
    case IndependentVerificationStatus.DISCREPANCY_FOUND:
      config = {
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        border: 'border-rose-200',
        dot: 'bg-rose-500',
        icon: AlertTriangle,
        label: 'Discrepancy Found',
      };
      break;
    case IndependentVerificationStatus.NOT_CHECKED:
      config = {
        bg: 'bg-slate-50',
        text: 'text-slate-600',
        border: 'border-slate-200',
        dot: 'bg-slate-400',
        icon: HelpCircle,
        label: 'Not Checked',
      };
      break;

    // Date Status
    case DateStatus.ACTIVE:
      config = {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        dot: 'bg-emerald-500',
        icon: CheckCircle2,
        label: 'Active',
      };
      break;
    case DateStatus.EXPIRING_SOON:
      config = {
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        border: 'border-amber-300',
        dot: 'bg-amber-500',
        icon: Clock,
        label: 'Expiring Soon',
      };
      break;
    case DateStatus.MATURED:
      config = {
        bg: 'bg-orange-50',
        text: 'text-orange-700',
        border: 'border-orange-300',
        dot: 'bg-orange-500',
        icon: AlertTriangle,
        label: 'Matured',
      };
      break;
    case DateStatus.EXPIRED:
      config = {
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        border: 'border-rose-300',
        dot: 'bg-rose-500',
        icon: XCircle,
        label: 'Expired',
      };
      break;

    // Release Request Status
    case ReleaseRequestStatus.PENDING_AUTHORITY_DECISION:
      config = {
        bg: 'bg-violet-50',
        text: 'text-violet-700',
        border: 'border-violet-200',
        dot: 'bg-violet-500',
        icon: Clock,
        label: 'Pending AA Decision',
      };
      break;
    case ReleaseRequestStatus.RETURNED_FOR_INFORMATION:
      config = {
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        border: 'border-rose-200',
        dot: 'bg-rose-500',
        icon: AlertTriangle,
        label: 'Returned for Info',
      };
      break;
    case ReleaseRequestStatus.APPROVED:
      config = {
        bg: 'bg-teal-50',
        text: 'text-teal-700',
        border: 'border-teal-200',
        dot: 'bg-teal-500',
        icon: CheckCircle2,
        label: 'Approved',
      };
      break;
    case ReleaseRequestStatus.COMPLETED:
      config = {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        dot: 'bg-emerald-500',
        icon: CheckCircle2,
        label: 'Released & Completed',
      };
      break;

    // Severity
    case DiscrepancySeverity.CRITICAL:
      config = {
        bg: 'bg-red-100',
        text: 'text-red-800',
        border: 'border-red-300',
        dot: 'bg-red-600',
        icon: AlertTriangle,
        label: 'Critical',
      };
      break;
    case DiscrepancySeverity.HIGH:
      config = {
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        border: 'border-rose-200',
        dot: 'bg-rose-500',
        icon: AlertTriangle,
        label: 'High',
      };
      break;
    case DiscrepancySeverity.MEDIUM:
      config = {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        dot: 'bg-amber-500',
        icon: AlertTriangle,
        label: 'Medium',
      };
      break;
    case DiscrepancySeverity.LOW:
      config = {
        bg: 'bg-slate-100',
        text: 'text-slate-700',
        border: 'border-slate-200',
        dot: 'bg-slate-400',
        icon: HelpCircle,
        label: 'Low',
      };
      break;
  }

  const IconComponent = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.bg} ${config.text} ${config.border} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {showIcon && <IconComponent className="w-3 h-3 shrink-0" />}
      <span>{config.label}</span>
    </span>
  );
};
