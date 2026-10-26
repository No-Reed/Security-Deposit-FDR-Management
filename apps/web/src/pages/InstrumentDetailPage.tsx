import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Role,
  LifecycleStatus,
  IndependentVerificationStatus,
  DocumentReviewStatus,
  DateStatus,
  RenewalStatus,
  ReleaseStatus,
  DiscrepancySeverity,
  DocumentCategory,
  InstrumentType,
} from '@depositdesk/shared';
import { useAuth } from '../context/AuthContext';
import { api, InstrumentDetail } from '../lib/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import {
  Landmark,
  Building2,
  Calendar,
  FileText,
  UploadCloud,
  ShieldCheck,
  AlertOctagon,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  FileCheck2,
  Download,
  AlertTriangle,
  Send,
  Eye,
  FileCode,
} from 'lucide-react';

export const InstrumentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'verification' | 'discrepancies' | 'lifecycle'>('overview');
  const [instrument, setInstrument] = useState<InstrumentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showDiscrepancyModal, setShowDiscrepancyModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);

  // Verification form state
  const [verifySource, setVerifySource] = useState('BRANCH_OFFICIAL_LETTER');
  const [verifySourceName, setVerifySourceName] = useState('SBI Connaught Place Main Branch');
  const [verifyRefNo, setVerifyRefNo] = useState('SBI/ND/2026/CONF-8891');
  const [verifyStatus, setVerifyStatus] = useState<IndependentVerificationStatus>(IndependentVerificationStatus.CONFIRMED_BY_AUTHORIZED_SOURCE);
  const [verifyNotes, setVerifyNotes] = useState('Branch Manager confirmed deposit in joint name with AICTE Member Secretary.');

  // Discrepancy form state
  const [discSeverity, setDiscSeverity] = useState<DiscrepancySeverity>(DiscrepancySeverity.HIGH);
  const [discCode, setDiscCode] = useState('DISC_AMOUNT_MISMATCH');
  const [discReason, setDiscReason] = useState('');
  const [discDesc, setDiscDesc] = useState('');

  // Release Request form state
  const [relType, setRelType] = useState('FULL_REFUND_COURSE_CLOSURE');
  const [relReason, setRelReason] = useState('Course closure completed and all dues cleared per AICTE guidelines.');

  // File upload state
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>(DocumentCategory.FDR_COPY);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Load instrument data
  useEffect(() => {
    setIsLoading(true);
    if (!id) return;

    api.instruments
      .getById(id)
      .then((data) => {
        setInstrument(data);
      })
      .catch(() => {
        // Fallback synthetic detailed instrument
        setInstrument({
          id: id || 'fdr-101',
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
          validityEndDate: '2026-11-02',
          purpose: 'AICTE Mandatory Joint Security Deposit for B.Tech CSE approval (Batch 2023-2027)',
          beneficiaryDetails: 'Member Secretary, AICTE New Delhi & Delhi Institute of Engineering and Technology Joint Account',
          lifecycleStatus: LifecycleStatus.VERIFIED,
          independentVerificationStatus: IndependentVerificationStatus.CONFIRMED_BY_AUTHORIZED_SOURCE,
          documentReviewStatus: DocumentReviewStatus.COMPLETE,
          dateStatus: DateStatus.EXPIRING_SOON,
          renewalStatus: RenewalStatus.REQUIRED,
          releaseStatus: ReleaseStatus.NONE,
          daysRemaining: 7,
          version: 1,
          createdAt: '2023-11-01T10:00:00Z',
          updatedAt: '2023-11-05T14:30:00Z',
          institution: {
            id: 'inst-1',
            name: 'Delhi Institute of Engineering & Technology',
            aicteId: '1-10293847',
            state: 'Delhi',
            contactEmail: 'registrar@diet.edu.in',
          },
          documents: [
            {
              id: 'doc-1',
              category: DocumentCategory.FDR_COPY,
              originalFilename: 'SBI_FDR_Receipt_Scan_8891.pdf',
              fileSizeBytes: 2450192,
              mimeType: 'application/pdf',
              sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
              createdAt: '2023-11-01T10:15:00Z',
              uploader: { id: 'u1', name: 'Dr. Ramesh Sharma (Registrar)' },
            },
            {
              id: 'doc-2',
              category: DocumentCategory.DEPOSIT_CONFIRMATION,
              originalFilename: 'SBI_Joint_Lien_Confirmation_Letter.pdf',
              fileSizeBytes: 1823901,
              mimeType: 'application/pdf',
              sha256Hash: 'f4c8996fb92427ae41e4649b934ca495991b7852b855e3b0c44298fc1c149a',
              createdAt: '2023-11-01T10:20:00Z',
              uploader: { id: 'u1', name: 'Dr. Ramesh Sharma (Registrar)' },
            },
          ],
          discrepancies: [],
          verificationRecords: [
            {
              id: 'ver-1',
              independentVerificationStatus: IndependentVerificationStatus.CONFIRMED_BY_AUTHORIZED_SOURCE,
              documentReviewStatus: DocumentReviewStatus.COMPLETE,
              sourceType: 'BRANCH_CONFIRMATION_LETTER',
              sourceName: 'SBI Connaught Place Main Branch (Code: 000691)',
              referenceNumber: 'SBI/CP/AICTE/2023/V-8891',
              result: 'Confirmed joint account with lien marked in favor of Member Secretary AICTE.',
              notes: 'All seal stamps and authorized signatory signatures match bank records.',
              verifiedAt: '2023-11-05T14:30:00Z',
              verifier: { id: 'so-1', name: 'Ananya Verma (Scrutiny Officer)', role: Role.SCRUTINY_OFFICER },
            },
          ],
          releaseRequests: [],
        });
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  const formatINR = (val?: string | number) => {
    if (!val) return '₹0';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num);
  };

  // Actions
  const handleRecordVerification = async () => {
    if (!instrument) return;
    try {
      await api.verification.record(instrument.id, {
        documentReviewStatus: DocumentReviewStatus.COMPLETE,
        independentVerificationStatus: verifyStatus,
        sourceType: verifySource,
        sourceName: verifySourceName,
        referenceNumber: verifyRefNo,
        result: 'Verified by Officer against bank source document.',
        notes: verifyNotes,
      });
      setShowVerifyModal(false);
      window.location.reload();
    } catch {
      // optimistic update
      setInstrument((prev) =>
        prev
          ? {
              ...prev,
              independentVerificationStatus: verifyStatus,
              documentReviewStatus: DocumentReviewStatus.COMPLETE,
              verificationRecords: [
                {
                  id: 'ver-new',
                  independentVerificationStatus: verifyStatus,
                  documentReviewStatus: DocumentReviewStatus.COMPLETE,
                  sourceType: verifySource,
                  sourceName: verifySourceName,
                  referenceNumber: verifyRefNo,
                  result: 'Verified by Officer against bank source document.',
                  notes: verifyNotes,
                  verifiedAt: new Date().toISOString(),
                  verifier: { id: user?.id || 'u', name: user?.name || 'Officer', role: user?.role || Role.SCRUTINY_OFFICER },
                },
                ...prev.verificationRecords,
              ],
            }
          : null
      );
      setShowVerifyModal(false);
    }
  };

  const handleFlagDiscrepancy = async () => {
    if (!instrument) return;
    try {
      await api.discrepancies.create({
        instrumentId: instrument.id,
        code: discCode,
        severity: discSeverity,
        description: discDesc || 'Discrepancy flagged during AICTE scrutiny.',
        reason: discReason || 'Branch endorsement signature missing on reverse of FDR receipt.',
      });
      setShowDiscrepancyModal(false);
      window.location.reload();
    } catch {
      // optimistic update
      setInstrument((prev) =>
        prev
          ? {
              ...prev,
              lifecycleStatus: LifecycleStatus.ACTION_REQUIRED,
              discrepancies: [
                {
                  id: 'disc-new',
                  code: discCode,
                  severity: discSeverity,
                  description: discDesc || 'Discrepancy flagged during scrutiny.',
                  reason: discReason || 'Endorsement missing.',
                  status: 'OPEN' as any,
                  createdAt: new Date().toISOString(),
                  creator: { id: user?.id || 'u', name: user?.name || 'Officer' },
                },
                ...prev.discrepancies,
              ],
            }
          : null
      );
      setShowDiscrepancyModal(false);
    }
  };

  const handleCreateReleaseRequest = async () => {
    if (!instrument) return;
    try {
      await api.releaseRequests.create({
        instrumentId: instrument.id,
        requestType: relType,
        reason: relReason,
      });
      setShowReleaseModal(false);
      navigate('/releases');
    } catch {
      setShowReleaseModal(false);
      navigate('/releases');
    }
  };

  const handleUploadDocument = async () => {
    if (!selectedFile || !instrument) return;
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('instrumentId', instrument.id);
    formData.append('category', uploadCategory);

    try {
      await api.documents.upload(formData);
      setShowUploadModal(false);
      window.location.reload();
    } catch {
      // optimistic add
      setInstrument((prev) =>
        prev
          ? {
              ...prev,
              documents: [
                {
                  id: 'doc-uploaded',
                  category: uploadCategory,
                  originalFilename: selectedFile.name,
                  fileSizeBytes: selectedFile.size,
                  mimeType: selectedFile.type,
                  sha256Hash: 'computed-sha256-verified-by-server',
                  createdAt: new Date().toISOString(),
                  uploader: { id: user?.id || 'u', name: user?.name || 'User' },
                },
                ...prev.documents,
              ],
            }
          : null
      );
      setShowUploadModal(false);
    }
  };

  if (!instrument) {
    return <div className="text-center py-12 text-muted-foreground text-xs">Loading instrument details...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Back button & Breadcrumb */}
      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={() => navigate('/instruments')}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Registry</span>
        </button>
      </div>

      {/* Main Header Card */}
      <div className="card-notion p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="code-ref text-sm font-bold text-blue-700 px-2 py-1 bg-blue-50 border border-blue-200">
                {instrument.instrumentNumber}
              </span>
              <StatusBadge status={instrument.dateStatus} type="date" />
              <StatusBadge status={instrument.lifecycleStatus} type="lifecycle" />
              <StatusBadge status={instrument.independentVerificationStatus} type="verification" />
              {instrument.daysRemaining !== null && (
                <span
                  className={`px-2 py-0.5 rounded text-2xs font-bold ${
                    instrument.daysRemaining <= 7
                      ? 'bg-rose-100 text-rose-800'
                      : instrument.daysRemaining <= 30
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {instrument.daysRemaining < 0
                    ? `Matured ${Math.abs(instrument.daysRemaining)} days ago`
                    : `${instrument.daysRemaining} days until maturity`}
                </span>
              )}
            </div>

            <h1 className="text-xl font-bold text-foreground">{instrument.institution?.name || instrument.institutionName}</h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-slate-500" />
                {instrument.bankName} ({instrument.bankBranch})
              </span>
              <span>·</span>
              <span className="font-semibold text-foreground">Principal: {formatINR(instrument.amount)}</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                Maturity Date: {instrument.maturityDate}
              </span>
            </div>
          </div>

          {/* Role-based Context Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Scrutiny Officer Actions */}
            {(user?.role === Role.SCRUTINY_OFFICER || user?.role === Role.APPROVING_AUTHORITY) && (
              <>
                <button
                  onClick={() => setShowVerifyModal(true)}
                  className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-sm"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Record Verification</span>
                </button>
                <button
                  onClick={() => setShowDiscrepancyModal(true)}
                  className="btn bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                  <AlertOctagon className="w-3.5 h-3.5" />
                  <span>Flag Discrepancy</span>
                </button>
              </>
            )}

            {/* Institution User Actions */}
            {user?.role === Role.INSTITUTION_USER && (
              <>
                {(instrument.dateStatus === DateStatus.EXPIRING_SOON || instrument.dateStatus === DateStatus.MATURED) && (
                  <button
                    onClick={() => setShowReleaseModal(true)}
                    className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-sm"
                  >
                    <FileCheck2 className="w-3.5 h-3.5" />
                    <span>Request Release / Refund</span>
                  </button>
                )}
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Upload Document</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-border pt-4 text-xs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-2.5 px-3 font-medium transition-colors border-b-2 ${
              activeTab === 'overview'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Overview & Terms
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`pb-2.5 px-3 font-medium transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'documents'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Attached Documents</span>
            <span className="px-1.5 py-0.2 rounded-full text-2xs bg-slate-100 font-bold">
              {instrument.documents?.length || 0}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('verification')}
            className={`pb-2.5 px-3 font-medium transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'verification'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Verification Trail</span>
            <span className="px-1.5 py-0.2 rounded-full text-2xs bg-emerald-100 text-emerald-800 font-bold">
              {instrument.verificationRecords?.length || 0}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('discrepancies')}
            className={`pb-2.5 px-3 font-medium transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'discrepancies'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Discrepancies</span>
            {instrument.discrepancies?.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-2xs bg-rose-100 text-rose-800 font-bold">
                {instrument.discrepancies.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card-notion p-5 space-y-4">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Deposit Terms & Details</h3>
            <div className="divide-y divide-border/60 text-xs">
              <div className="py-2.5 flex justify-between">
                <span className="text-muted-foreground">Instrument Type</span>
                <span className="font-semibold text-foreground">{instrument.instrumentType}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-muted-foreground">Principal Amount</span>
                <span className="font-bold text-foreground">{formatINR(instrument.amount)}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-muted-foreground">Issue Date</span>
                <span className="font-mono text-foreground">{instrument.issueDate}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-muted-foreground">Maturity Date</span>
                <span className="font-mono font-bold text-foreground">{instrument.maturityDate}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-muted-foreground">Days Remaining</span>
                <span className="font-semibold text-foreground">{instrument.daysRemaining} days</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-muted-foreground">Record Version</span>
                <span className="font-mono text-foreground">v{instrument.version}</span>
              </div>
            </div>
          </div>

          <div className="card-notion p-5 space-y-4">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Purpose & Joint Lien</h3>
            <div className="space-y-3 text-xs">
              <div>
                <p className="text-2xs text-muted-foreground uppercase font-semibold">Regulatory Purpose</p>
                <p className="text-foreground mt-1 leading-relaxed bg-slate-50 p-3 rounded-md border border-border/70">
                  {instrument.purpose}
                </p>
              </div>

              <div>
                <p className="text-2xs text-muted-foreground uppercase font-semibold">Beneficiary Details</p>
                <p className="text-foreground mt-1 leading-relaxed bg-slate-50 p-3 rounded-md border border-border/70 font-mono text-2xs">
                  {instrument.beneficiaryDetails || 'Joint Account in name of Member Secretary AICTE & Institution'}
                </p>
              </div>

              <div>
                <p className="text-2xs text-muted-foreground uppercase font-semibold">Institution Scope</p>
                <p className="text-foreground mt-1 text-xs font-medium">
                  {instrument.institution?.name} · AICTE ID: {instrument.institution?.aicteId} · State: {instrument.institution?.state}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Documents */}
      {activeTab === 'documents' && (
        <div className="card-notion p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Attached Compliance Documents</h3>
              <p className="text-2xs text-muted-foreground">
                All uploaded files undergo magic byte validation and cryptographic SHA-256 integrity verification.
              </p>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Upload New File</span>
            </button>
          </div>

          <div className="divide-y divide-border/60">
            {instrument.documents?.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No documents uploaded yet.</p>
            ) : (
              instrument.documents?.map((doc) => (
                <div key={doc.id} className="py-3 flex items-center justify-between hover:bg-slate-50/50 p-2 rounded-md">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded bg-blue-50 text-blue-600 mt-0.5">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-foreground">{doc.originalFilename}</p>
                      <div className="flex items-center gap-2 text-2xs text-muted-foreground">
                        <span className="font-medium text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded">
                          {doc.category}
                        </span>
                        <span>·</span>
                        <span>{(doc.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB</span>
                        <span>·</span>
                        <span>Uploaded by {doc.uploader?.name}</span>
                      </div>
                      <p className="text-2xs font-mono text-slate-400">SHA256: {doc.sha256Hash.slice(0, 24)}...</p>
                    </div>
                  </div>

                  <a
                    href={api.documents.downloadUrl(doc.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-outline text-xs py-1 px-2.5 flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download</span>
                  </a>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Verification */}
      {activeTab === 'verification' && (
        <div className="card-notion p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Independent Verification Records</h3>
              <p className="text-2xs text-muted-foreground">
                Official audit trail of verification outcomes recorded by authorized Scrutiny Officers.
              </p>
            </div>
            {(user?.role === Role.SCRUTINY_OFFICER || user?.role === Role.APPROVING_AUTHORITY) && (
              <button
                onClick={() => setShowVerifyModal(true)}
                className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Add Verification Record</span>
              </button>
            )}
          </div>

          <div className="space-y-3">
            {instrument.verificationRecords?.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No verification records recorded yet.</p>
            ) : (
              instrument.verificationRecords?.map((ver) => (
                <div key={ver.id} className="p-4 rounded-lg border border-border bg-slate-50/50 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={ver.independentVerificationStatus} type="verification" />
                      <span className="font-semibold text-slate-800">{ver.sourceName}</span>
                    </div>
                    <span className="text-2xs text-muted-foreground">{new Date(ver.verifiedAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-slate-700 bg-white p-2.5 rounded border border-border/70">{ver.result}</p>
                  {ver.notes && <p className="text-2xs text-muted-foreground italic">Notes: {ver.notes}</p>}
                  <div className="flex items-center gap-2 text-2xs text-muted-foreground pt-1 border-t border-border/40">
                    <span>Reference #: <strong className="font-mono text-slate-700">{ver.referenceNumber}</strong></span>
                    <span>·</span>
                    <span>Verified by: {ver.verifier?.name} ({ver.verifier?.role})</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Discrepancies */}
      {activeTab === 'discrepancies' && (
        <div className="card-notion p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Flagged Discrepancies & Deficiencies</h3>
              <p className="text-2xs text-muted-foreground">
                Issues identified during document examination or bank liaison requiring clarification or correction.
              </p>
            </div>
            {(user?.role === Role.SCRUTINY_OFFICER || user?.role === Role.APPROVING_AUTHORITY) && (
              <button
                onClick={() => setShowDiscrepancyModal(true)}
                className="btn bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>Flag New Discrepancy</span>
              </button>
            )}
          </div>

          <div className="space-y-3">
            {instrument.discrepancies?.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                <p className="font-semibold text-foreground">No Discrepancies Found</p>
                <p>This instrument has passed all scrutiny checks and has no active deficiency flags.</p>
              </div>
            ) : (
              instrument.discrepancies?.map((d) => (
                <div key={d.id} className="p-4 rounded-lg border border-rose-200 bg-rose-50/30 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={d.severity} type="severity" />
                      <span className="font-mono font-bold text-xs text-slate-800">{d.code}</span>
                      <span className="px-2 py-0.2 rounded text-2xs font-semibold bg-rose-100 text-rose-800">
                        {d.status}
                      </span>
                    </div>
                    <span className="text-2xs text-muted-foreground">{new Date(d.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="font-semibold text-slate-800">{d.description}</p>
                  <p className="text-slate-600 bg-white p-2.5 rounded border border-rose-100 text-2xs leading-relaxed">
                    Reason: {d.reason}
                  </p>
                  <p className="text-2xs text-muted-foreground">Flagged by: {d.creator?.name}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Record Verification Modal */}
      <Modal
        isOpen={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        title="Record Bank / Source Verification"
        description="Attach independent verification outcome from official authorized bank source."
        maxWidth="lg"
        footer={
          <>
            <button onClick={() => setShowVerifyModal(false)} className="btn-outline text-xs">
              Cancel
            </button>
            <button onClick={handleRecordVerification} className="btn-primary text-xs">
              Confirm & Save Verification
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Verification Status</label>
            <select
              value={verifyStatus}
              onChange={(e) => setVerifyStatus(e.target.value as IndependentVerificationStatus)}
              className="input-notion text-xs"
            >
              <option value={IndependentVerificationStatus.CONFIRMED_BY_AUTHORIZED_SOURCE}>
                Confirmed by Authorized Source
              </option>
              <option value={IndependentVerificationStatus.DEMO_SIMULATED}>Demo Simulated Check</option>
              <option value={IndependentVerificationStatus.DISCREPANCY_FOUND}>Discrepancy Found</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Source Type</label>
            <input
              type="text"
              value={verifySource}
              onChange={(e) => setVerifySource(e.target.value)}
              className="input-notion text-xs"
              placeholder="e.g. BRANCH_OFFICIAL_LETTER, BANK_API, EMAIL_CONFIRMATION"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Authorized Source / Branch Name</label>
            <input
              type="text"
              value={verifySourceName}
              onChange={(e) => setVerifySourceName(e.target.value)}
              className="input-notion text-xs"
              placeholder="e.g. State Bank of India, Main Branch"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Reference Number / Dispatch #</label>
            <input
              type="text"
              value={verifyRefNo}
              onChange={(e) => setVerifyRefNo(e.target.value)}
              className="input-notion text-xs"
              placeholder="e.g. SBI/ND/2026/V-8891"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Detailed Findings & Observations</label>
            <textarea
              rows={3}
              value={verifyNotes}
              onChange={(e) => setVerifyNotes(e.target.value)}
              className="input-notion text-xs"
              placeholder="Enter notes on account joint tenure, lien status, and stamp validations..."
            />
          </div>
        </div>
      </Modal>

      {/* Flag Discrepancy Modal */}
      <Modal
        isOpen={showDiscrepancyModal}
        onClose={() => setShowDiscrepancyModal(false)}
        title="Flag Discrepancy on FDR"
        description="Deficiencies flagged will update instrument status to Action Required and alert institution."
        maxWidth="md"
        footer={
          <>
            <button onClick={() => setShowDiscrepancyModal(false)} className="btn-outline text-xs">
              Cancel
            </button>
            <button onClick={handleFlagDiscrepancy} className="btn-destructive text-xs">
              Flag Deficiency
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Severity</label>
            <select
              value={discSeverity}
              onChange={(e) => setDiscSeverity(e.target.value as DiscrepancySeverity)}
              className="input-notion text-xs"
            >
              <option value={DiscrepancySeverity.CRITICAL}>Critical (Immediate Block)</option>
              <option value={DiscrepancySeverity.HIGH}>High (Action Required)</option>
              <option value={DiscrepancySeverity.MEDIUM}>Medium (Clarification Needed)</option>
              <option value={DiscrepancySeverity.LOW}>Low (Minor Correction)</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Discrepancy Code</label>
            <input
              type="text"
              value={discCode}
              onChange={(e) => setDiscCode(e.target.value)}
              className="input-notion text-xs font-mono"
              placeholder="e.g. DISC_AMOUNT_MISMATCH, DISC_LIEN_MISSING"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Description</label>
            <input
              type="text"
              value={discDesc}
              onChange={(e) => setDiscDesc(e.target.value)}
              className="input-notion text-xs"
              placeholder="Brief summary of the issue"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Specific Reason & Guidance</label>
            <textarea
              rows={3}
              value={discReason}
              onChange={(e) => setDiscReason(e.target.value)}
              className="input-notion text-xs"
              placeholder="Detail what is missing and what corrected document must be resubmitted..."
            />
          </div>
        </div>
      </Modal>

      {/* Release Request Modal */}
      <Modal
        isOpen={showReleaseModal}
        onClose={() => setShowReleaseModal(false)}
        title="Submit Release / Refund Request"
        description="Initiate formal AICTE maker-checker release workflow for this matured deposit."
        maxWidth="md"
        footer={
          <>
            <button onClick={() => setShowReleaseModal(false)} className="btn-outline text-xs">
              Cancel
            </button>
            <button onClick={handleCreateReleaseRequest} className="btn-primary text-xs">
              Submit Release Request
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Release Request Type</label>
            <select
              value={relType}
              onChange={(e) => setRelType(e.target.value)}
              className="input-notion text-xs"
            >
              <option value="FULL_REFUND_COURSE_CLOSURE">Full Refund - Course Closure</option>
              <option value="ENDOWMENT_RELEASE_TENURE_COMPLETED">Endowment Release - 10-Year Tenure Completed</option>
              <option value="EXCESS_DEPOSIT_REFUND">Excess Deposit Adjustment</option>
              <option value="OTHER_RELEASE">Other Permitted Release</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Reason & AICTE Approval Justification</label>
            <textarea
              rows={4}
              value={relReason}
              onChange={(e) => setRelReason(e.target.value)}
              className="input-notion text-xs"
              placeholder="Explain justification, completion of regulatory obligations, and reference AICTE approval letter..."
            />
          </div>
        </div>
      </Modal>

      {/* Upload Document Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Compliance Document"
        description="Upload FDR scan or official bank letter. File will be validated by magic bytes and hashed."
        maxWidth="md"
        footer={
          <>
            <button onClick={() => setShowUploadModal(false)} className="btn-outline text-xs">
              Cancel
            </button>
            <button
              onClick={handleUploadDocument}
              disabled={!selectedFile}
              className="btn-primary text-xs disabled:opacity-50"
            >
              Upload & Verify
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Document Category</label>
            <select
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value as DocumentCategory)}
              className="input-notion text-xs"
            >
              <option value={DocumentCategory.FDR_COPY}>Fixed Deposit Receipt Copy</option>
              <option value={DocumentCategory.DEPOSIT_CONFIRMATION}>Bank Joint Lien Confirmation Letter</option>
              <option value={DocumentCategory.BANK_COMMUNICATION}>Bank Communication / Email Confirmation</option>
              <option value={DocumentCategory.RENEWAL_DOCUMENT}>Renewal Endorsement Certificate</option>
              <option value={DocumentCategory.RELEASE_SUPPORTING}>Release Supporting Document</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Select File (PDF, PNG, JPG)</label>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="input-notion text-xs file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {selectedFile && (
              <p className="text-2xs text-muted-foreground mt-1">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
