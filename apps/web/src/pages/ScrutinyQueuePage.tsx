import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LifecycleStatus, IndependentVerificationStatus, Role } from '@depositdesk/shared';
import { useAuth } from '../context/AuthContext';
import { api, InstrumentSummary } from '../lib/api';
import { StatusBadge } from '../components/common/StatusBadge';
import {
  ClipboardCheck,
  Search,
  Clock,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Building,
  CheckCircle2,
  FileText,
} from 'lucide-react';

export const ScrutinyQueuePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [queue, setQueue] = useState<InstrumentSummary[]>([
    {
      id: 'fdr-105',
      institutionId: 'inst-1',
      institutionName: 'Delhi Institute of Engineering & Technology',
      aicteId: '1-10293847',
      instrumentNumber: 'CAN-FDR-2024-5519',
      instrumentType: 'FDR' as any,
      bankName: 'Canara Bank',
      bankBranch: 'Dwarka, New Delhi',
      amount: '8000000.00',
      currency: 'INR',
      issueDate: '2024-02-15',
      maturityDate: '2027-02-15',
      purpose: 'AICTE Additional Intake Security Deposit for AI & Data Science branch',
      lifecycleStatus: LifecycleStatus.SUBMITTED,
      independentVerificationStatus: IndependentVerificationStatus.NOT_CHECKED,
      documentReviewStatus: 'NOT_STARTED' as any,
      dateStatus: 'ACTIVE' as any,
      renewalStatus: 'NONE' as any,
      releaseStatus: 'NONE' as any,
      daysRemaining: 477,
      version: 1,
      createdAt: '2024-02-15',
      updatedAt: '2024-02-15',
    },
    {
      id: 'fdr-103',
      institutionId: 'inst-3',
      institutionName: 'Bangalore Academy of Technology',
      aicteId: '1-30495821',
      instrumentNumber: 'ICICI-FDR-2022-9011',
      instrumentType: 'FDR' as any,
      bankName: 'ICICI Bank',
      bankBranch: 'Koramangala, Bangalore',
      amount: '10000000.00',
      currency: 'INR',
      issueDate: '2022-11-25',
      maturityDate: '2026-11-25',
      purpose: 'AICTE Security Deposit for MBA department inauguration',
      lifecycleStatus: LifecycleStatus.UNDER_REVIEW,
      independentVerificationStatus: IndependentVerificationStatus.PENDING,
      documentReviewStatus: 'IN_PROGRESS' as any,
      dateStatus: 'EXPIRING_SOON' as any,
      renewalStatus: 'NONE' as any,
      releaseStatus: 'NONE' as any,
      daysRemaining: 30,
      version: 1,
      createdAt: '2022-11-25',
      updatedAt: '2022-11-25',
    },
    {
      id: 'fdr-106',
      institutionId: 'inst-5',
      institutionName: 'Hyderabad School of Applied Sciences',
      aicteId: '1-50192837',
      instrumentNumber: 'AXIS-FDR-2023-7714',
      instrumentType: 'FDR' as any,
      bankName: 'Axis Bank',
      bankBranch: 'HITEC City, Hyderabad',
      amount: '12000000.00',
      currency: 'INR',
      issueDate: '2023-08-20',
      maturityDate: '2028-08-20',
      purpose: 'AICTE Polytechnic Accreditation Security Deposit',
      lifecycleStatus: LifecycleStatus.ACTION_REQUIRED,
      independentVerificationStatus: IndependentVerificationStatus.DISCREPANCY_FOUND,
      documentReviewStatus: 'REQUIRES_RESUBMISSION' as any,
      dateStatus: 'ACTIVE' as any,
      renewalStatus: 'NONE' as any,
      releaseStatus: 'NONE' as any,
      daysRemaining: 663,
      version: 2,
      createdAt: '2023-08-20',
      updatedAt: '2023-09-01',
    },
  ]);

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    // Attempt backend query
    api.instruments
      .list({
        lifecycleStatus: statusFilter !== 'ALL' ? statusFilter : undefined,
        search: search || undefined,
      })
      .then((res) => {
        if (res.data && res.data.length > 0) {
          const queueItems = res.data.filter((i) =>
            [
              LifecycleStatus.SUBMITTED,
              LifecycleStatus.UNDER_REVIEW,
              LifecycleStatus.ACTION_REQUIRED,
              LifecycleStatus.RESUBMITTED,
            ].includes(i.lifecycleStatus)
          );
          if (queueItems.length > 0) setQueue(queueItems);
        }
      })
      .catch(() => {
        // Fall back to synthetic data
      });
  }, [statusFilter, search]);

  const formatINR = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num);
  };

  const pendingInitialCount = queue.filter((i) => i.lifecycleStatus === LifecycleStatus.SUBMITTED).length;
  const inReviewCount = queue.filter((i) => i.lifecycleStatus === LifecycleStatus.UNDER_REVIEW).length;
  const actionRequiredCount = queue.filter((i) => i.lifecycleStatus === LifecycleStatus.ACTION_REQUIRED).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Scrutiny & Verification Queue</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Priority queue for Scrutiny Officers and Approving Authorities to review deposits, verify bank confirmations, and check joint lien covenants.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-notion p-4 border-blue-200 bg-blue-50/20">
          <p className="text-2xs font-semibold uppercase text-blue-800">Pending Initial Scrutiny</p>
          <p className="text-2xl font-bold text-blue-900 mt-1">{pendingInitialCount}</p>
          <p className="text-2xs text-muted-foreground mt-0.5">Newly submitted by institutions</p>
        </div>

        <div className="card-notion p-4 border-amber-200 bg-amber-50/20">
          <p className="text-2xs font-semibold uppercase text-amber-800">Under Active Examination</p>
          <p className="text-2xl font-bold text-amber-900 mt-1">{inReviewCount}</p>
          <p className="text-2xs text-muted-foreground mt-0.5">Awaiting bank correspondence or letter check</p>
        </div>

        <div className="card-notion p-4 border-rose-200 bg-rose-50/20">
          <p className="text-2xs font-semibold uppercase text-rose-800">Deficiencies Flagged</p>
          <p className="text-2xl font-bold text-rose-900 mt-1">{actionRequiredCount}</p>
          <p className="text-2xs text-muted-foreground mt-0.5">Returned to institution for resubmission</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card-notion p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search queue..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-notion pl-9 text-xs"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-notion text-xs bg-white w-48"
          >
            <option value="ALL">All Scrutiny Stages</option>
            <option value={LifecycleStatus.SUBMITTED}>Submitted (New)</option>
            <option value={LifecycleStatus.UNDER_REVIEW}>Under Review</option>
            <option value={LifecycleStatus.ACTION_REQUIRED}>Action Required</option>
            <option value={LifecycleStatus.RESUBMITTED}>Resubmitted</option>
          </select>
        </div>
      </div>

      {/* Queue Table */}
      <div className="card-notion p-0 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="table-notion">
            <thead className="bg-slate-50/70">
              <tr>
                <th>FDR Particulars</th>
                <th>Institution Name & AICTE ID</th>
                <th>Principal Amount</th>
                <th>Verification State</th>
                <th>Lifecycle Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {queue.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                    No pending submissions in scrutiny queue. All instruments verified!
                  </td>
                </tr>
              ) : (
                queue.map((inst) => (
                  <tr
                    key={inst.id}
                    onClick={() => navigate(`/instruments/${inst.id}`)}
                    className="cursor-pointer group"
                  >
                    <td>
                      <div className="space-y-0.5">
                        <span className="code-ref font-semibold text-blue-700">{inst.instrumentNumber}</span>
                        <p className="text-2xs text-muted-foreground">
                          {inst.bankName} · {inst.bankBranch}
                        </p>
                      </div>
                    </td>

                    <td>
                      <div className="space-y-0.5">
                        <p className="font-semibold text-foreground text-xs">{inst.institutionName}</p>
                        {inst.aicteId && (
                          <p className="text-2xs text-muted-foreground font-mono">ID: {inst.aicteId}</p>
                        )}
                      </div>
                    </td>

                    <td>
                      <span className="font-bold text-foreground text-xs">{formatINR(inst.amount)}</span>
                    </td>

                    <td>
                      <StatusBadge status={inst.independentVerificationStatus} type="verification" />
                    </td>

                    <td>
                      <StatusBadge status={inst.lifecycleStatus} type="lifecycle" />
                    </td>

                    <td className="text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/instruments/${inst.id}`);
                        }}
                        className="btn-primary text-xs py-1 px-3 inline-flex items-center gap-1 shadow-sm"
                      >
                        <span>Examine</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
