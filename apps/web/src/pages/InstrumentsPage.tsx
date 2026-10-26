import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Role,
  LifecycleStatus,
  DateStatus,
  IndependentVerificationStatus,
  InstrumentType,
} from '@depositdesk/shared';
import { useAuth } from '../context/AuthContext';
import { api, InstrumentSummary } from '../lib/api';
import { StatusBadge } from '../components/common/StatusBadge';
import {
  Search,
  Filter,
  Plus,
  ArrowUpDown,
  Building,
  Landmark,
  Calendar,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

// Demo fallback mock instruments
const MOCK_INSTRUMENTS: InstrumentSummary[] = [
  {
    id: 'fdr-101',
    institutionId: 'inst-1',
    institutionName: 'Delhi Institute of Engineering & Technology',
    aicteId: '1-10293847',
    instrumentType: InstrumentType.FDR,
    instrumentNumber: 'SBI-FDR-2023-8891',
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
    documentsCount: 3,
    openDiscrepanciesCount: 0,
  },
  {
    id: 'fdr-102',
    institutionId: 'inst-2',
    institutionName: 'Pune Technical Campus',
    aicteId: '1-20938475',
    instrumentType: InstrumentType.FDR,
    instrumentNumber: 'HDFC-FDR-2021-4412',
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
    documentsCount: 2,
    openDiscrepanciesCount: 0,
  },
  {
    id: 'fdr-103',
    institutionId: 'inst-3',
    institutionName: 'Bangalore Academy of Technology',
    aicteId: '1-30495821',
    instrumentType: InstrumentType.FDR,
    instrumentNumber: 'ICICI-FDR-2022-9011',
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
    dateStatus: DateStatus.EXPIRING_SOON,
    renewalStatus: 'NONE' as any,
    releaseStatus: 'NONE' as any,
    daysRemaining: 30,
    version: 1,
    createdAt: '2022-11-25',
    updatedAt: '2022-11-25',
    documentsCount: 2,
    openDiscrepanciesCount: 1,
  },
  {
    id: 'fdr-104',
    institutionId: 'inst-4',
    institutionName: 'National Institute of Pharmacy & Research',
    aicteId: '1-40918273',
    instrumentType: InstrumentType.FDR,
    instrumentNumber: 'PNB-FDR-2020-1122',
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
    documentsCount: 4,
    openDiscrepanciesCount: 0,
  },
  {
    id: 'fdr-105',
    institutionId: 'inst-1',
    institutionName: 'Delhi Institute of Engineering & Technology',
    aicteId: '1-10293847',
    instrumentType: InstrumentType.FDR,
    instrumentNumber: 'CAN-FDR-2024-5519',
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
    dateStatus: DateStatus.ACTIVE,
    renewalStatus: 'NONE' as any,
    releaseStatus: 'NONE' as any,
    daysRemaining: 477,
    version: 1,
    createdAt: '2024-02-15',
    updatedAt: '2024-02-15',
    documentsCount: 1,
    openDiscrepanciesCount: 0,
  },
  {
    id: 'fdr-106',
    institutionId: 'inst-5',
    institutionName: 'Hyderabad School of Applied Sciences',
    aicteId: '1-50192837',
    instrumentType: InstrumentType.FDR,
    instrumentNumber: 'AXIS-FDR-2023-7714',
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
    dateStatus: DateStatus.ACTIVE,
    renewalStatus: 'NONE' as any,
    releaseStatus: 'NONE' as any,
    daysRemaining: 663,
    version: 2,
    createdAt: '2023-08-20',
    updatedAt: '2023-09-01',
    documentsCount: 2,
    openDiscrepanciesCount: 1,
  },
];

export const InstrumentsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [instruments, setInstruments] = useState<InstrumentSummary[]>(MOCK_INSTRUMENTS);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [lifecycleFilter, setLifecycleFilter] = useState(searchParams.get('lifecycleStatus') || 'ALL');
  const [dateFilter, setDateFilter] = useState(searchParams.get('dateStatus') || 'ALL');
  const [bankFilter, setBankFilter] = useState(searchParams.get('bank') || 'ALL');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Attempt backend fetch
    setIsLoading(true);
    const params: Record<string, any> = {};
    if (search) params.search = search;
    if (lifecycleFilter !== 'ALL') params.lifecycleStatus = lifecycleFilter;
    if (dateFilter !== 'ALL') params.dateStatus = dateFilter;
    if (bankFilter !== 'ALL') params.bankName = bankFilter;

    api.instruments
      .list(params)
      .then((res) => {
        if (res.data && res.data.length > 0) {
          setInstruments(res.data);
        }
      })
      .catch(() => {
        // Fall back to filtered mock instruments
        let filtered = [...MOCK_INSTRUMENTS];
        if (user?.role === Role.INSTITUTION_USER && user.institutionId) {
          filtered = filtered.filter((i) => i.institutionId === user.institutionId);
        }
        if (search) {
          const q = search.toLowerCase();
          filtered = filtered.filter(
            (i) =>
              i.instrumentNumber.toLowerCase().includes(q) ||
              (i.institutionName && i.institutionName.toLowerCase().includes(q)) ||
              i.bankName.toLowerCase().includes(q)
          );
        }
        if (lifecycleFilter !== 'ALL') {
          filtered = filtered.filter((i) => i.lifecycleStatus === lifecycleFilter);
        }
        if (dateFilter !== 'ALL') {
          filtered = filtered.filter((i) => i.dateStatus === dateFilter);
        }
        if (bankFilter !== 'ALL') {
          filtered = filtered.filter((i) => i.bankName === bankFilter);
        }
        setInstruments(filtered);
      })
      .finally(() => setIsLoading(false));
  }, [search, lifecycleFilter, dateFilter, bankFilter, user]);

  const formatINR = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num);
  };

  const uniqueBanks = Array.from(new Set(MOCK_INSTRUMENTS.map((i) => i.bankName)));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">FDR & Security Deposit Registry</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Complete database of AICTE approval deposits, fixed deposit receipts, validity dates, and scrutiny states.
          </p>
        </div>

        {(user?.role === Role.INSTITUTION_USER || user?.role === Role.SYSTEM_ADMIN) && (
          <button
            onClick={() => navigate('/instruments/new')}
            className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5 shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Instrument</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="card-notion p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by instrument #, bank, or institution..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-notion pl-9 text-xs"
            />
          </div>

          {/* Lifecycle Status Filter */}
          <div>
            <select
              value={lifecycleFilter}
              onChange={(e) => setLifecycleFilter(e.target.value)}
              className="input-notion text-xs bg-white"
            >
              <option value="ALL">All Lifecycle Statuses</option>
              <option value={LifecycleStatus.DRAFT}>Draft</option>
              <option value={LifecycleStatus.SUBMITTED}>Submitted</option>
              <option value={LifecycleStatus.UNDER_REVIEW}>Under Review</option>
              <option value={LifecycleStatus.ACTION_REQUIRED}>Action Required</option>
              <option value={LifecycleStatus.RESUBMITTED}>Resubmitted</option>
              <option value={LifecycleStatus.VERIFIED}>Verified</option>
              <option value={LifecycleStatus.REJECTED}>Rejected</option>
              <option value={LifecycleStatus.CLOSED}>Closed</option>
            </select>
          </div>

          {/* Date Status Filter */}
          <div>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="input-notion text-xs bg-white"
            >
              <option value="ALL">All Date Statuses</option>
              <option value={DateStatus.ACTIVE}>Active</option>
              <option value={DateStatus.EXPIRING_SOON}>Expiring Soon (≤90d)</option>
              <option value={DateStatus.MATURED}>Matured</option>
              <option value={DateStatus.EXPIRED}>Expired</option>
            </select>
          </div>

          {/* Bank Filter */}
          <div>
            <select
              value={bankFilter}
              onChange={(e) => setBankFilter(e.target.value)}
              className="input-notion text-xs bg-white"
            >
              <option value="ALL">All Banks</option>
              {uniqueBanks.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filter Counters */}
        <div className="flex items-center justify-between text-2xs text-muted-foreground pt-1">
          <span>Showing {instruments.length} instruments</span>
          {(search || lifecycleFilter !== 'ALL' || dateFilter !== 'ALL' || bankFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearch('');
                setLifecycleFilter('ALL');
                setDateFilter('ALL');
                setBankFilter('ALL');
              }}
              className="text-blue-600 hover:underline font-medium"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Registry Table */}
      <div className="card-notion p-0 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="table-notion">
            <thead className="bg-slate-50/70">
              <tr>
                <th>Instrument Details</th>
                <th>Institution</th>
                <th>Principal Amount</th>
                <th>Maturity & Horizon</th>
                <th>Verification</th>
                <th>Lifecycle Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {instruments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-muted-foreground text-xs">
                    No instruments match the selected filters.
                  </td>
                </tr>
              ) : (
                instruments.map((inst) => (
                  <tr
                    key={inst.id}
                    onClick={() => navigate(`/instruments/${inst.id}`)}
                    className="cursor-pointer group"
                  >
                    {/* Instrument Number & Bank */}
                    <td>
                      <div className="space-y-0.5">
                        <span className="code-ref font-semibold text-blue-700">{inst.instrumentNumber}</span>
                        <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                          <Landmark className="w-3 h-3 text-slate-400" />
                          <span>
                            {inst.bankName} ({inst.bankBranch})
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Institution */}
                    <td>
                      <div className="space-y-0.5">
                        <p className="font-semibold text-foreground text-xs leading-snug">{inst.institutionName}</p>
                        {inst.aicteId && (
                          <p className="text-2xs text-muted-foreground font-mono">ID: {inst.aicteId}</p>
                        )}
                      </div>
                    </td>

                    {/* Amount */}
                    <td>
                      <span className="font-bold text-foreground text-xs">{formatINR(inst.amount)}</span>
                      <p className="text-2xs text-muted-foreground">{inst.currency}</p>
                    </td>

                    {/* Dates & Horizon */}
                    <td>
                      <div className="space-y-1">
                        <StatusBadge status={inst.dateStatus} type="date" />
                        <div className="flex items-center gap-1 text-2xs text-muted-foreground">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>Mat: {inst.maturityDate}</span>
                        </div>
                      </div>
                    </td>

                    {/* Verification Status */}
                    <td>
                      <StatusBadge status={inst.independentVerificationStatus} type="verification" />
                    </td>

                    {/* Lifecycle Status */}
                    <td>
                      <StatusBadge status={inst.lifecycleStatus} type="lifecycle" />
                    </td>

                    {/* Action Link */}
                    <td className="text-right">
                      <span className="text-xs text-blue-600 font-medium group-hover:underline inline-flex items-center gap-1">
                        View <ExternalLink className="w-3 h-3" />
                      </span>
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
