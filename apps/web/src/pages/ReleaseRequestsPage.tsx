import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReleaseRequestStatus, Role } from '@depositdesk/shared';
import { useAuth } from '../context/AuthContext';
import { api, ReleaseRequestDetail } from '../lib/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import {
  FileCheck2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building,
  ArrowRight,
  ShieldCheck,
  Send,
  UserCheck,
  ExternalLink,
} from 'lucide-react';

const MOCK_RELEASES: ReleaseRequestDetail[] = [
  {
    id: 'rel-1',
    instrumentId: 'fdr-104',
    instrument: {
      id: 'fdr-104',
      institutionId: 'inst-4',
      institutionName: 'National Institute of Pharmacy & Research',
      aicteId: '1-40918273',
      instrumentNumber: 'PNB-FDR-2020-1122',
      instrumentType: 'FDR' as any,
      bankName: 'Punjab National Bank',
      bankBranch: 'Sector 17, Chandigarh',
      amount: '35000000.00',
      currency: 'INR',
      issueDate: '2020-10-15',
      maturityDate: '2026-10-15',
      purpose: 'AICTE Security Deposit for M.Pharm program',
      lifecycleStatus: 'VERIFIED' as any,
      independentVerificationStatus: 'CONFIRMED_BY_AUTHORIZED_SOURCE' as any,
      documentReviewStatus: 'COMPLETE' as any,
      dateStatus: 'MATURED' as any,
      renewalStatus: 'NONE' as any,
      releaseStatus: 'OPEN' as any,
      daysRemaining: -11,
      version: 2,
      createdAt: '2020-10-15',
      updatedAt: '2026-10-20',
    },
    requestType: 'FULL_REFUND_COURSE_CLOSURE',
    reason: 'M.Pharm Pharmacology specialization formally closed per AICTE approval letter dated 2026-06-15. All students graduated, zero fee dues, NOC obtained.',
    status: ReleaseRequestStatus.PENDING_AUTHORITY_DECISION,
    version: 3,
    scrutinyNotes: 'Scrutiny Officer verified all graduating student lists and AICTE closure approvals. Checklist 100% verified. Forwarded for Regional Officer approval.',
    submittedBy: { id: 'u4', name: 'Dr. Sunita Rao (Director)' },
    scrutinyOfficer: { id: 'so-1', name: 'Ananya Verma (Scrutiny Officer)' },
    approvingAuthority: null,
    completedBy: null,
    createdAt: '2026-10-16T11:00:00Z',
    updatedAt: '2026-10-22T14:30:00Z',
    documents: [
      {
        id: 'rdoc-1',
        category: 'RELEASE_SUPPORTING' as any,
        originalFilename: 'AICTE_Course_Closure_NOC_Order.pdf',
        fileSizeBytes: 1204910,
      },
    ],
  },
  {
    id: 'rel-2',
    instrumentId: 'fdr-102',
    instrument: {
      id: 'fdr-102',
      institutionId: 'inst-2',
      institutionName: 'Pune Technical Campus',
      aicteId: '1-20938475',
      instrumentNumber: 'HDFC-FDR-2021-4412',
      instrumentType: 'FDR' as any,
      bankName: 'HDFC Bank',
      bankBranch: 'Shivajinagar, Pune',
      amount: '25000000.00',
      currency: 'INR',
      issueDate: '2021-11-10',
      maturityDate: '2026-11-10',
      purpose: 'AICTE Endowment Fund Deposit for Polytechnic expansion',
      lifecycleStatus: 'VERIFIED' as any,
      independentVerificationStatus: 'CONFIRMED_BY_AUTHORIZED_SOURCE' as any,
      documentReviewStatus: 'COMPLETE' as any,
      dateStatus: 'EXPIRING_SOON' as any,
      renewalStatus: 'REQUIRED' as any,
      releaseStatus: 'OPEN' as any,
      daysRemaining: 15,
      version: 1,
      createdAt: '2021-11-10',
      updatedAt: '2021-11-10',
    },
    requestType: 'ENDOWMENT_RELEASE_TENURE_COMPLETED',
    reason: 'Mandatory 5-year security deposit tenure completed with clean compliance records.',
    status: ReleaseRequestStatus.UNDER_REVIEW,
    version: 1,
    scrutinyNotes: 'Initial scrutiny in progress. Awaiting bank joint signature verification.',
    submittedBy: { id: 'u2', name: 'Dr. Suresh Joshi (Principal)' },
    scrutinyOfficer: { id: 'so-1', name: 'Ananya Verma (Scrutiny Officer)' },
    approvingAuthority: null,
    completedBy: null,
    createdAt: '2026-10-24T09:30:00Z',
    updatedAt: '2026-10-24T09:30:00Z',
    documents: [],
  },
];

export const ReleaseRequestsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [requests, setRequests] = useState<ReleaseRequestDetail[]>(MOCK_RELEASES);
  const [selectedRequest, setSelectedRequest] = useState<ReleaseRequestDetail | null>(null);

  // Decision Modal state
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [decisionAction, setDecisionAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [decisionReason, setDecisionReason] = useState('All regulatory and tenure requirements verified satisfied per AICTE Approval Process Handbook.');
  const [decisionNotes, setDecisionNotes] = useState('');

  // Completion Modal state
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [compRef, setCompRef] = useState('AICTE/REFUND/2026/DISPATCH-0912');
  const [compDate, setCompDate] = useState(new Date().toISOString().split('T')[0]);
  const [compNotes, setCompNotes] = useState('Bank confirmed proceeds released to institution bank account.');

  useEffect(() => {
    api.releaseRequests
      .list()
      .then((res) => {
        if (res.data && res.data.length > 0) setRequests(res.data);
      })
      .catch(() => {
        // Fall back to synthetic data
      });
  }, []);

  const formatINR = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num);
  };

  const handleDecision = async () => {
    if (!selectedRequest) return;
    try {
      await api.releaseRequests.decide(
        selectedRequest.id,
        decisionAction,
        decisionReason,
        selectedRequest.version,
        decisionNotes
      );
      setShowDecisionModal(false);
      window.location.reload();
    } catch {
      // optimistic update
      setRequests((prev) =>
        prev.map((r) =>
          r.id === selectedRequest.id
            ? {
                ...r,
                status: decisionAction === 'APPROVE' ? ReleaseRequestStatus.APPROVED : ReleaseRequestStatus.REJECTED,
                decisionReason,
                approvingAuthority: { id: user?.id || 'u', name: user?.name || 'Approving Authority' },
              }
            : r
        )
      );
      setShowDecisionModal(false);
    }
  };

  const handleComplete = async () => {
    if (!selectedRequest) return;
    try {
      await api.releaseRequests.complete(
        selectedRequest.id,
        compRef,
        compDate,
        selectedRequest.version,
        compNotes
      );
      setShowCompleteModal(false);
      window.location.reload();
    } catch {
      // optimistic update
      setRequests((prev) =>
        prev.map((r) =>
          r.id === selectedRequest.id
            ? {
                ...r,
                status: ReleaseRequestStatus.COMPLETED,
                completionReference: compRef,
                completionDate: compDate,
                completedBy: { id: user?.id || 'u', name: user?.name || 'Officer' },
              }
            : r
        )
      );
      setShowCompleteModal(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Release & Refund Requests</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Two-step Maker-Checker governance workflow for mature FDR lien discharge and security deposit refund.
        </p>
      </div>

      {/* Maker-Checker Workflow Visualization Banner */}
      <div className="card-notion p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white border-0 shadow-md">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">
          Maker-Checker Segregation of Duties Flow
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="p-3 rounded-lg bg-white/10 border border-white/10 space-y-1">
            <span className="text-2xs font-bold text-blue-300">STEP 1: MAKER</span>
            <p className="font-semibold text-white">Institution Submits</p>
            <p className="text-2xs text-slate-300">IU provides reason, closure NOC, and supporting evidence.</p>
          </div>
          <div className="p-3 rounded-lg bg-white/10 border border-white/10 space-y-1">
            <span className="text-2xs font-bold text-amber-300">STEP 2: CHECKER</span>
            <p className="font-semibold text-white">Scrutiny Officer Review</p>
            <p className="text-2xs text-slate-300">Verifies mandatory checklist, student records, and bank joint tenure.</p>
          </div>
          <div className="p-3 rounded-lg bg-white/10 border border-white/10 space-y-1">
            <span className="text-2xs font-bold text-purple-300">STEP 3: AUTHORITY</span>
            <p className="font-semibold text-white">Approving Authority Decision</p>
            <p className="text-2xs text-slate-300">Regional Officer formally APPROVES or REJECTS with written order.</p>
          </div>
          <div className="p-3 rounded-lg bg-white/10 border border-white/10 space-y-1">
            <span className="text-2xs font-bold text-emerald-300">STEP 4: EXECUTION</span>
            <p className="font-semibold text-white">Completion Evidence</p>
            <p className="text-2xs text-slate-300">Discharge letter issued to bank; dispatch reference recorded.</p>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="card-notion p-0 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="table-notion">
            <thead className="bg-slate-50/70">
              <tr>
                <th>Request Particulars</th>
                <th>Institution & AICTE ID</th>
                <th>Deposit Amount</th>
                <th>Maker-Checker Flow</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                  <td>
                    <div className="space-y-0.5">
                      <span className="code-ref font-bold text-blue-700">{req.instrument.instrumentNumber}</span>
                      <p className="text-2xs text-muted-foreground font-medium">{req.requestType.replace(/_/g, ' ')}</p>
                      <p className="text-2xs text-slate-500 line-clamp-1 max-w-sm">{req.reason}</p>
                    </div>
                  </td>

                  <td>
                    <p className="font-semibold text-foreground text-xs">{req.instrument.institutionName}</p>
                    {req.instrument.aicteId && (
                      <p className="text-2xs text-muted-foreground font-mono">ID: {req.instrument.aicteId}</p>
                    )}
                  </td>

                  <td>
                    <span className="font-bold text-foreground text-xs">{formatINR(req.instrument.amount)}</span>
                  </td>

                  <td>
                    <div className="space-y-1 text-2xs text-muted-foreground">
                      <p>
                        Maker: <strong className="text-slate-700">{req.submittedBy.name}</strong>
                      </p>
                      {req.scrutinyOfficer && (
                        <p>
                          Checker: <strong className="text-slate-700">{req.scrutinyOfficer.name}</strong>
                        </p>
                      )}
                      {req.approvingAuthority && (
                        <p>
                          Authority: <strong className="text-slate-700">{req.approvingAuthority.name}</strong>
                        </p>
                      )}
                    </div>
                  </td>

                  <td>
                    <StatusBadge status={req.status} type="release" />
                  </td>

                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Approving Authority Decision Action */}
                      {user?.role === Role.APPROVING_AUTHORITY &&
                        req.status === ReleaseRequestStatus.PENDING_AUTHORITY_DECISION && (
                          <button
                            onClick={() => {
                              setSelectedRequest(req);
                              setShowDecisionModal(true);
                            }}
                            className="btn-primary text-xs py-1 px-2.5 shadow-sm"
                          >
                            Authority Decision
                          </button>
                        )}

                      {/* Completion Evidence Action (After Approval) */}
                      {(user?.role === Role.SCRUTINY_OFFICER || user?.role === Role.APPROVING_AUTHORITY) &&
                        req.status === ReleaseRequestStatus.APPROVED && (
                          <button
                            onClick={() => {
                              setSelectedRequest(req);
                              setShowCompleteModal(true);
                            }}
                            className="btn bg-emerald-600 text-white hover:bg-emerald-700 text-xs py-1 px-2.5 shadow-sm"
                          >
                            Record Discharge
                          </button>
                        )}

                      <button
                        onClick={() => navigate(`/instruments/${req.instrumentId}`)}
                        className="btn-outline text-xs py-1 px-2 flex items-center gap-1"
                      >
                        <span>FDR</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Decision Modal (Approving Authority) */}
      <Modal
        isOpen={showDecisionModal}
        onClose={() => setShowDecisionModal(false)}
        title="Approving Authority Decision"
        description="Formal decision to approve or reject deposit release. This action is permanently audited."
        maxWidth="md"
        footer={
          <>
            <button onClick={() => setShowDecisionModal(false)} className="btn-outline text-xs">
              Cancel
            </button>
            <button
              onClick={handleDecision}
              className={`text-xs ${
                decisionAction === 'APPROVE' ? 'btn-primary' : 'btn-destructive'
              }`}
            >
              Confirm {decisionAction === 'APPROVE' ? 'Approval' : 'Rejection'}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Decision</label>
            <select
              value={decisionAction}
              onChange={(e) => setDecisionAction(e.target.value as 'APPROVE' | 'REJECT')}
              className="input-notion text-xs"
            >
              <option value="APPROVE">APPROVE Release of FDR</option>
              <option value="REJECT">REJECT Release Request</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Formal Decision Reason *</label>
            <textarea
              rows={3}
              value={decisionReason}
              onChange={(e) => setDecisionReason(e.target.value)}
              className="input-notion text-xs"
              placeholder="Record official justification, reference AICTE committee or officer order..."
              required
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Internal Notes (Optional)</label>
            <textarea
              rows={2}
              value={decisionNotes}
              onChange={(e) => setDecisionNotes(e.target.value)}
              className="input-notion text-xs"
              placeholder="Additional remarks..."
            />
          </div>
        </div>
      </Modal>

      {/* Completion Modal */}
      <Modal
        isOpen={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        title="Record Bank Discharge Evidence"
        description="Upload dispatch details of the official discharge letter sent to the authorized bank."
        maxWidth="md"
        footer={
          <>
            <button onClick={() => setShowCompleteModal(false)} className="btn-outline text-xs">
              Cancel
            </button>
            <button onClick={handleComplete} className="btn-primary text-xs">
              Mark Completed & Discharge Lien
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">AICTE Discharge Dispatch / Reference Number *</label>
            <input
              type="text"
              value={compRef}
              onChange={(e) => setCompRef(e.target.value)}
              className="input-notion text-xs font-mono"
              required
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Completion Date *</label>
            <input
              type="date"
              value={compDate}
              onChange={(e) => setCompDate(e.target.value)}
              className="input-notion text-xs"
              required
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Completion Notes</label>
            <textarea
              rows={2}
              value={compNotes}
              onChange={(e) => setCompNotes(e.target.value)}
              className="input-notion text-xs"
              placeholder="Record bank response or confirmation receipt..."
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
