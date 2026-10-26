import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Role, DateStatus, LifecycleStatus, InstrumentType, IndependentVerificationStatus } from '@depositdesk/shared';
import { useAuth } from '../context/AuthContext';
import { api, DashboardSummary, UpcomingMaturities, InstrumentSummary } from '../lib/api';
import { StatCard } from '../components/common/StatCard';
import { StatusBadge } from '../components/common/StatusBadge';
import {
  FileSpreadsheet,
  AlertTriangle,
  Clock,
  ShieldCheck,
  FileCheck2,
  Calendar,
  Building,
  ArrowRight,
  TrendingUp,
  Sparkles,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [summary, setSummary] = useState<DashboardSummary>({
    totalInstruments: 24,
    totalValue: 184500000, // 18.45 Cr
    activeCount: 18,
    expiringSoonCount: 4,
    maturedCount: 2,
    expiredCount: 0,
    pendingVerificationCount: 3,
    discrepancyCount: 2,
    openReleaseRequestsCount: 2,
  });

  const [upcoming, setUpcoming] = useState<UpcomingMaturities>({
    bucket7Days: [
      {
        id: 'inst-1',
        institutionId: 'inst-1',
        institutionName: 'Delhi Institute of Engineering & Technology',
        instrumentNumber: 'SBI-FDR-2023-8891',
        instrumentType: InstrumentType.FDR,
        bankName: 'State Bank of India',
        bankBranch: 'Connaught Place, New Delhi',
        amount: '15000000.00',
        currency: 'INR',
        issueDate: '2023-11-01',
        maturityDate: '2026-11-02',
        purpose: 'AICTE Mandatory Joint Security Deposit for B.Tech CSE approval',
        lifecycleStatus: LifecycleStatus.VERIFIED,
        independentVerificationStatus: IndependentVerificationStatus.CONFIRMED_BY_AUTHORIZED_SOURCE,
        documentReviewStatus: 'COMPLETE' as any,
        dateStatus: DateStatus.EXPIRING_SOON,
        renewalStatus: 'REQUIRED' as any,
        releaseStatus: 'NONE' as any,
        daysRemaining: 7,
        version: 1,
        createdAt: '2023-11-01',
        updatedAt: '2023-11-01',
      },
    ],
    bucket15Days: [
      {
        id: 'inst-2',
        institutionId: 'inst-2',
        institutionName: 'Pune Technical Campus',
        instrumentNumber: 'HDFC-FDR-2021-4412',
        instrumentType: InstrumentType.FDR,
        bankName: 'HDFC Bank',
        bankBranch: 'Shivajinagar, Pune',
        amount: '25000000.00',
        currency: 'INR',
        issueDate: '2021-11-10',
        maturityDate: '2026-11-10',
        purpose: 'AICTE Endowment Fund Deposit for Polytechnic expansion',
        lifecycleStatus: LifecycleStatus.VERIFIED,
        independentVerificationStatus: IndependentVerificationStatus.CONFIRMED_BY_AUTHORIZED_SOURCE,
        documentReviewStatus: 'COMPLETE' as any,
        dateStatus: DateStatus.EXPIRING_SOON,
        renewalStatus: 'REQUIRED' as any,
        releaseStatus: 'NONE' as any,
        daysRemaining: 15,
        version: 1,
        createdAt: '2021-11-10',
        updatedAt: '2021-11-10',
      },
    ],
    bucket30Days: [
      {
        id: 'inst-3',
        institutionId: 'inst-3',
        institutionName: 'Bangalore Academy of Technology',
        instrumentNumber: 'ICICI-FDR-2022-9011',
        instrumentType: InstrumentType.FDR,
        bankName: 'ICICI Bank',
        bankBranch: 'Koramangala, Bangalore',
        amount: '10000000.00',
        currency: 'INR',
        issueDate: '2022-11-25',
        maturityDate: '2026-11-25',
        purpose: 'AICTE Security Deposit for MBA department inauguration',
        lifecycleStatus: LifecycleStatus.VERIFIED,
        independentVerificationStatus: IndependentVerificationStatus.CONFIRMED_BY_AUTHORIZED_SOURCE,
        documentReviewStatus: 'COMPLETE' as any,
        dateStatus: DateStatus.EXPIRING_SOON,
        renewalStatus: 'REQUIRED' as any,
        releaseStatus: 'NONE' as any,
        daysRemaining: 30,
        version: 1,
        createdAt: '2022-11-25',
        updatedAt: '2022-11-25',
      },
    ],
    bucket60Days: [],
    bucket90Days: [],
    matured: [
      {
        id: 'inst-4',
        institutionId: 'inst-4',
        institutionName: 'National Institute of Pharmacy & Research',
        instrumentNumber: 'PNB-FDR-2020-1122',
        instrumentType: InstrumentType.FDR,
        bankName: 'Punjab National Bank',
        bankBranch: 'Sector 17, Chandigarh',
        amount: '35000000.00',
        currency: 'INR',
        issueDate: '2020-10-15',
        maturityDate: '2026-10-15',
        purpose: 'AICTE Security Deposit for M.Pharm program',
        lifecycleStatus: LifecycleStatus.VERIFIED,
        independentVerificationStatus: IndependentVerificationStatus.CONFIRMED_BY_AUTHORIZED_SOURCE,
        documentReviewStatus: 'COMPLETE' as any,
        dateStatus: DateStatus.MATURED,
        renewalStatus: 'IN_PROGRESS' as any,
        releaseStatus: 'OPEN' as any,
        daysRemaining: -11,
        version: 2,
        createdAt: '2020-10-15',
        updatedAt: '2026-10-20',
      },
    ],
  });

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Attempt backend query
    api.dashboard
      .getSummary()
      .then((data) => setSummary(data))
      .catch(() => {
        // Fall back to synthetic data already set in state
      });

    api.dashboard
      .getUpcomingMaturities()
      .then((data) => setUpcoming(data))
      .catch(() => {
        // Fall back to synthetic data already set in state
      });
  }, []);

  // Format currency in Indian numbering format (Lakhs / Crores)
  const formatINR = (val: number | string) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return '₹0';
    if (num >= 10000000) {
      return `₹${(num / 10000000).toFixed(2)} Cr`;
    }
    if (num >= 100000) {
      return `₹${(num / 100000).toFixed(2)} Lakh`;
    }
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-blue-500/30 text-blue-200 border border-blue-400/30">
              AICTE Compliance & FDR Lifecycle
            </span>
            <span className="text-xs text-slate-300">· Prototype System</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
            Welcome, {user?.name || 'Administrator'}
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Monitor real-time security deposits, fixed deposit receipts, automated maturity reminders, maker-checker
            scrutiny, and bank verification statuses across institutions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {user?.role === Role.INSTITUTION_USER && (
            <button
              onClick={() => navigate('/instruments/new')}
              className="btn bg-white text-slate-900 hover:bg-slate-100 text-xs font-semibold py-2 px-3 shadow-sm"
            >
              Submit New FDR
            </button>
          )}
          {(user?.role === Role.SCRUTINY_OFFICER || user?.role === Role.APPROVING_AUTHORITY) && (
            <button
              onClick={() => navigate('/scrutiny')}
              className="btn bg-blue-500 text-white hover:bg-blue-600 text-xs font-semibold py-2 px-3 shadow-sm"
            >
              Go to Scrutiny Queue
            </button>
          )}
          <button
            onClick={() => navigate('/instruments')}
            className="btn bg-white/10 hover:bg-white/20 text-white text-xs py-2 px-3 border border-white/20"
          >
            View All Registry
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Instruments"
          value={summary.totalInstruments}
          subtitle={`Total Value: ${formatINR(summary.totalValue)}`}
          icon={FileSpreadsheet}
          variant="default"
          onClick={() => navigate('/instruments')}
        />
        <StatCard
          title="Active & Compliant"
          value={summary.activeCount}
          subtitle="In regulatory validity"
          icon={ShieldCheck}
          variant="success"
          onClick={() => navigate('/instruments?dateStatus=ACTIVE')}
        />
        <StatCard
          title="Expiring Soon"
          value={summary.expiringSoonCount}
          subtitle="Within 90-day alert threshold"
          icon={Clock}
          variant="warning"
          onClick={() => navigate('/instruments?dateStatus=EXPIRING_SOON')}
        />
        <StatCard
          title="Matured / Action Req"
          value={summary.maturedCount}
          subtitle="Matured or renewal pending"
          icon={AlertTriangle}
          variant="danger"
          onClick={() => navigate('/instruments?dateStatus=MATURED')}
        />
        <StatCard
          title="Release Requests"
          value={summary.openReleaseRequestsCount}
          subtitle="Maker-checker workflow active"
          icon={FileCheck2}
          variant="primary"
          onClick={() => navigate('/releases')}
        />
      </div>

      {/* Two Column Layout: Upcoming Maturity Alerts + Scrutiny / Discrepancy Glance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Upcoming Maturity Horizon */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card-notion p-5">
            <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-semibold text-foreground">Maturity Horizon & Upcoming Expirations</h3>
              </div>
              <span className="text-2xs text-muted-foreground font-medium">Automatic Alerts: 90, 60, 30, 15, 7, 1 days</span>
            </div>

            {/* Maturity Bucket Horizon View */}
            <div className="space-y-3">
              {/* Critical: Matured & ≤7 Days */}
              {[...upcoming.matured, ...upcoming.bucket7Days].map((inst) => (
                <div
                  key={inst.id}
                  onClick={() => navigate(`/instruments/${inst.id}`)}
                  className="flex items-center justify-between p-3.5 rounded-lg border border-rose-200 bg-rose-50/50 hover:bg-rose-50 transition-all cursor-pointer"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-rose-900">{inst.instrumentNumber}</span>
                      <StatusBadge status={inst.dateStatus} type="date" />
                      {inst.daysRemaining !== null && (
                        <span className="px-2 py-0.5 rounded text-2xs font-bold bg-rose-200 text-rose-800">
                          {inst.daysRemaining < 0
                            ? `Matured ${Math.abs(inst.daysRemaining)} days ago`
                            : `Expires in ${inst.daysRemaining} days`}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 font-medium">{inst.institutionName}</p>
                    <p className="text-2xs text-muted-foreground">
                      {inst.bankName} · {inst.bankBranch} · Maturity: {inst.maturityDate}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-900">{formatINR(inst.amount)}</p>
                    <span className="text-2xs text-blue-600 hover:underline flex items-center gap-1 justify-end mt-1 font-medium">
                      Manage <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}

              {/* Bucket 15 & 30 Days */}
              {[...upcoming.bucket15Days, ...upcoming.bucket30Days].map((inst) => (
                <div
                  key={inst.id}
                  onClick={() => navigate(`/instruments/${inst.id}`)}
                  className="flex items-center justify-between p-3.5 rounded-lg border border-amber-200 bg-amber-50/40 hover:bg-amber-50 transition-all cursor-pointer"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-amber-900">{inst.instrumentNumber}</span>
                      <StatusBadge status={inst.dateStatus} type="date" />
                      <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-amber-200 text-amber-900">
                        Expires in {inst.daysRemaining} days
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium">{inst.institutionName}</p>
                    <p className="text-2xs text-muted-foreground">
                      {inst.bankName} · Maturity: {inst.maturityDate}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-900">{formatINR(inst.amount)}</p>
                    <span className="text-2xs text-blue-600 hover:underline flex items-center gap-1 justify-end mt-1 font-medium">
                      View <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: Quick Status & Workflow Guidance */}
        <div className="space-y-4">
          {/* AICTE Regulatory Workflow Card */}
          <div className="card-notion p-5 bg-gradient-to-b from-white to-slate-50 border-border">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">
              Standard FDR Lifecycle Flow
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-semibold flex items-center justify-center text-2xs shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <p className="font-semibold text-slate-800">FDR Submission & Magic Bytes</p>
                  <p className="text-2xs text-muted-foreground">
                    Institution uploads scan; SHA-256 hash & magic byte verification ensures genuine document.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 font-semibold flex items-center justify-center text-2xs shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <p className="font-semibold text-slate-800">Scrutiny & Bank Verification</p>
                  <p className="text-2xs text-muted-foreground">
                    Scrutiny Officer verifies against bank confirmation, authorized branch letter, or official source.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 font-semibold flex items-center justify-center text-2xs shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <p className="font-semibold text-slate-800">Maturity Alerts or Renewal</p>
                  <p className="text-2xs text-muted-foreground">
                    Automated reminders sent at 90, 60, 30, 15, 7, 1 days. Renewal chains link replacement FDRs.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-semibold flex items-center justify-center text-2xs shrink-0 mt-0.5">
                  4
                </span>
                <div>
                  <p className="font-semibold text-slate-800">Maker-Checker Release</p>
                  <p className="text-2xs text-muted-foreground">
                    Institution submits request → SO reviews checklist → Approving Authority decides → Completion evidence.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="card-notion p-5">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Quick Navigation</h3>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/instruments')}
                className="w-full text-left p-2.5 rounded-md hover:bg-slate-100 flex items-center justify-between text-xs font-medium text-slate-700 transition-colors"
              >
                <span>Search FDR Registry</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              <button
                onClick={() => navigate('/reports')}
                className="w-full text-left p-2.5 rounded-md hover:bg-slate-100 flex items-center justify-between text-xs font-medium text-slate-700 transition-colors"
              >
                <span>Export Audit & Maturity CSV</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              <button
                onClick={() => navigate('/releases')}
                className="w-full text-left p-2.5 rounded-md hover:bg-slate-100 flex items-center justify-between text-xs font-medium text-slate-700 transition-colors"
              >
                <span>Check Release Requests</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
