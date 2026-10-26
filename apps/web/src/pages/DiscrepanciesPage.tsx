import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DiscrepancySeverity, DiscrepancyStatus, Role } from '@depositdesk/shared';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import {
  AlertOctagon,
  Search,
  Filter,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  Building,
  Landmark,
} from 'lucide-react';

interface DiscrepancyRow {
  id: string;
  instrumentId: string;
  instrumentNumber: string;
  institutionName: string;
  bankName: string;
  code: string;
  severity: DiscrepancySeverity;
  description: string;
  reason: string;
  status: DiscrepancyStatus;
  resolutionNotes?: string | null;
  createdAt: string;
  creatorName: string;
}

const MOCK_DISCREPANCIES: DiscrepancyRow[] = [
  {
    id: 'disc-1',
    instrumentId: 'fdr-106',
    instrumentNumber: 'AXIS-FDR-2023-7714',
    institutionName: 'Hyderabad School of Applied Sciences',
    bankName: 'Axis Bank',
    code: 'DISC_LIEN_MISSING',
    severity: DiscrepancySeverity.CRITICAL,
    description: 'Joint lien clause not endorsed on FDR receipt reverse side.',
    reason: 'FDR receipt shows single institution ownership without joint endorsement with AICTE Member Secretary.',
    status: DiscrepancyStatus.OPEN,
    createdAt: '2026-10-20T14:00:00Z',
    creatorName: 'Ananya Verma (Scrutiny Officer)',
  },
  {
    id: 'disc-2',
    instrumentId: 'fdr-103',
    instrumentNumber: 'ICICI-FDR-2022-9011',
    institutionName: 'Bangalore Academy of Technology',
    bankName: 'ICICI Bank',
    code: 'DISC_BRANCH_STAMP_FADED',
    severity: DiscrepancySeverity.MEDIUM,
    description: 'Bank branch seal is illegible on scanned PDF copy.',
    reason: 'Official round seal of Koramangala branch is faded. Requires clear re-scan or official letter.',
    status: DiscrepancyStatus.OPEN,
    createdAt: '2026-10-22T10:15:00Z',
    creatorName: 'Ananya Verma (Scrutiny Officer)',
  },
];

export const DiscrepanciesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [discrepancies, setDiscrepancies] = useState<DiscrepancyRow[]>(MOCK_DISCREPANCIES);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Resolve Modal state
  const [selectedDisc, setSelectedDisc] = useState<DiscrepancyRow | null>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveStatus, setResolveStatus] = useState<'RESOLVED' | 'DISMISSED'>('RESOLVED');
  const [resolutionNotes, setResolutionNotes] = useState('Satisfactory revised document verified and bank endorsement confirmed.');

  useEffect(() => {
    api.discrepancies
      .list()
      .then((data) => {
        if (data && data.length > 0) setDiscrepancies(data);
      })
      .catch(() => {
        // Fall back to synthetic data
      });
  }, []);

  const handleResolve = async () => {
    if (!selectedDisc) return;
    try {
      await api.discrepancies.resolve(selectedDisc.id, resolutionNotes, resolveStatus);
      setShowResolveModal(false);
      window.location.reload();
    } catch {
      // optimistic update
      setDiscrepancies((prev) =>
        prev.map((d) =>
          d.id === selectedDisc.id
            ? {
                ...d,
                status: resolveStatus === 'RESOLVED' ? DiscrepancyStatus.RESOLVED : DiscrepancyStatus.DISMISSED,
                resolutionNotes,
              }
            : d
        )
      );
      setShowResolveModal(false);
    }
  };

  const filtered = discrepancies.filter((d) => {
    if (severityFilter !== 'ALL' && d.severity !== severityFilter) return false;
    if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        d.instrumentNumber.toLowerCase().includes(q) ||
        d.institutionName.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Deficiency & Discrepancy Tracking</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Audited log of compliance discrepancies flagged during scrutiny, required remedial actions, and resolutions.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="card-notion p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search discrepancies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-notion pl-9 text-xs"
            />
          </div>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="input-notion text-xs bg-white w-40"
          >
            <option value="ALL">All Severities</option>
            <option value={DiscrepancySeverity.CRITICAL}>Critical</option>
            <option value={DiscrepancySeverity.HIGH}>High</option>
            <option value={DiscrepancySeverity.MEDIUM}>Medium</option>
            <option value={DiscrepancySeverity.LOW}>Low</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-notion text-xs bg-white w-36"
          >
            <option value="ALL">All Statuses</option>
            <option value={DiscrepancyStatus.OPEN}>Open</option>
            <option value={DiscrepancyStatus.RESOLVED}>Resolved</option>
            <option value={DiscrepancyStatus.DISMISSED}>Dismissed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card-notion p-0 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="table-notion">
            <thead className="bg-slate-50/70">
              <tr>
                <th>Discrepancy Details</th>
                <th>Instrument & Institution</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Flagged By</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                    No discrepancies found.
                  </td>
                </tr>
              ) : (
                filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/60 transition-colors">
                    <td>
                      <div className="space-y-0.5">
                        <span className="font-mono font-bold text-xs text-rose-800">{d.code}</span>
                        <p className="text-xs font-semibold text-foreground">{d.description}</p>
                        <p className="text-2xs text-slate-500 max-w-md">{d.reason}</p>
                        {d.resolutionNotes && (
                          <p className="text-2xs text-emerald-700 bg-emerald-50 p-1.5 rounded mt-1">
                            Resolution: {d.resolutionNotes}
                          </p>
                        )}
                      </div>
                    </td>

                    <td>
                      <div className="space-y-0.5">
                        <span className="code-ref font-bold text-blue-700">{d.instrumentNumber}</span>
                        <p className="text-xs font-medium text-foreground">{d.institutionName}</p>
                        <p className="text-2xs text-muted-foreground">{d.bankName}</p>
                      </div>
                    </td>

                    <td>
                      <StatusBadge status={d.severity} type="severity" />
                    </td>

                    <td>
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-2xs font-semibold ${
                          d.status === DiscrepancyStatus.OPEN
                            ? 'bg-rose-100 text-rose-800'
                            : d.status === DiscrepancyStatus.RESOLVED
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>

                    <td>
                      <span className="text-2xs text-muted-foreground">{d.creatorName}</span>
                    </td>

                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {(user?.role === Role.SCRUTINY_OFFICER || user?.role === Role.APPROVING_AUTHORITY) &&
                          d.status === DiscrepancyStatus.OPEN && (
                            <button
                              onClick={() => {
                                setSelectedDisc(d);
                                setShowResolveModal(true);
                              }}
                              className="btn-primary text-xs py-1 px-2.5 shadow-sm"
                            >
                              Resolve
                            </button>
                          )}

                        <button
                          onClick={() => navigate(`/instruments/${d.instrumentId}`)}
                          className="btn-outline text-xs py-1 px-2 flex items-center gap-1"
                        >
                          <span>View FDR</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resolve Modal */}
      <Modal
        isOpen={showResolveModal}
        onClose={() => setShowResolveModal(false)}
        title="Resolve / Dismiss Discrepancy"
        description="Record resolution findings after examining institution responses or rectified scans."
        maxWidth="md"
        footer={
          <>
            <button onClick={() => setShowResolveModal(false)} className="btn-outline text-xs">
              Cancel
            </button>
            <button onClick={handleResolve} className="btn-primary text-xs">
              Confirm Resolution
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Resolution Outcome</label>
            <select
              value={resolveStatus}
              onChange={(e) => setResolveStatus(e.target.value as 'RESOLVED' | 'DISMISSED')}
              className="input-notion text-xs"
            >
              <option value="RESOLVED">RESOLVED (Deficiency rectified by institution)</option>
              <option value="DISMISSED">DISMISSED (Exception granted or false flag)</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Resolution Notes *</label>
            <textarea
              rows={3}
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              className="input-notion text-xs"
              placeholder="Record basis of resolution, revised document hash, or authorized confirmation..."
              required
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
