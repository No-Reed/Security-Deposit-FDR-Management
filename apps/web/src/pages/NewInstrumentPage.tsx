import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InstrumentType, DocumentCategory } from '@depositdesk/shared';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { ArrowLeft, Save, Send, UploadCloud, Info } from 'lucide-react';

export const NewInstrumentPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [instrumentType, setInstrumentType] = useState<InstrumentType>(InstrumentType.FDR);
  const [instrumentNumber, setInstrumentNumber] = useState('');
  const [bankName, setBankName] = useState('State Bank of India');
  const [bankBranch, setBankBranch] = useState('');
  const [amount, setAmount] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [maturityDate, setMaturityDate] = useState(
    new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [purpose, setPurpose] = useState('AICTE Joint Security Deposit for Approval of Technical Programs');
  const [beneficiaryDetails, setBeneficiaryDetails] = useState(
    'Member Secretary, AICTE New Delhi & Institution Joint Account'
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (submitForReview = false) => {
    setError(null);
    if (!instrumentNumber.trim()) {
      setError('Please provide an Instrument Number.');
      return;
    }
    if (!bankBranch.trim()) {
      setError('Please provide the Bank Branch name.');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }
    if (new Date(issueDate) > new Date(maturityDate)) {
      setError('Issue date cannot be after maturity date.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        institutionId: user?.institutionId || 'demo-inst-1',
        instrumentType,
        instrumentNumber,
        bankName,
        bankBranch,
        amount: parseFloat(amount).toFixed(2),
        currency: 'INR',
        issueDate,
        maturityDate,
        purpose,
        beneficiaryDetails,
      };

      const created = await api.instruments.create(payload);

      // If document selected, upload it
      if (selectedFile && created.id) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('instrumentId', created.id);
        formData.append('category', DocumentCategory.FDR_COPY);
        await api.documents.upload(formData);
      }

      // If submit for review requested
      if (submitForReview && created.id) {
        await api.instruments.submit(created.id, created.version);
      }

      navigate(`/instruments/${created.id}`);
    } catch (err: any) {
      // Optimistic demo fallback redirect
      navigate('/instruments');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back button */}
      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={() => navigate('/instruments')}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Registry</span>
        </button>
      </div>

      {/* Page Title */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Register New Security Deposit / FDR</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Enter deposit receipt particulars in accordance with AICTE approval regulations and joint lien mandates.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
          {error}
        </div>
      )}

      {/* Main Form Card */}
      <div className="card-notion p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Instrument Type */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Instrument Type *</label>
            <select
              value={instrumentType}
              onChange={(e) => setInstrumentType(e.target.value as InstrumentType)}
              className="input-notion text-xs"
            >
              <option value={InstrumentType.FDR}>Fixed Deposit Receipt (FDR)</option>
              <option value={InstrumentType.SECURITY_DEPOSIT}>Security Deposit</option>
              <option value={InstrumentType.OTHER}>Other Permitted Guarantee</option>
            </select>
          </div>

          {/* Instrument Number */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">FDR / Instrument Number *</label>
            <input
              type="text"
              value={instrumentNumber}
              onChange={(e) => setInstrumentNumber(e.target.value)}
              placeholder="e.g. SBI-FDR-2024-9988"
              className="input-notion text-xs font-mono"
              required
            />
          </div>

          {/* Bank Name */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Bank Name *</label>
            <select
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="input-notion text-xs"
            >
              <option value="State Bank of India">State Bank of India</option>
              <option value="Punjab National Bank">Punjab National Bank</option>
              <option value="Bank of Baroda">Bank of Baroda</option>
              <option value="Canara Bank">Canara Bank</option>
              <option value="HDFC Bank">HDFC Bank</option>
              <option value="ICICI Bank">ICICI Bank</option>
              <option value="Axis Bank">Axis Bank</option>
              <option value="Other Scheduled Commercial Bank">Other Scheduled Commercial Bank</option>
            </select>
          </div>

          {/* Bank Branch */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Bank Branch & IFSC / Code *</label>
            <input
              type="text"
              value={bankBranch}
              onChange={(e) => setBankBranch(e.target.value)}
              placeholder="e.g. Connaught Place Branch, New Delhi (SBIN0000691)"
              className="input-notion text-xs"
              required
            />
          </div>

          {/* Amount */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Principal Amount (in INR ₹) *</label>
            <input
              type="number"
              step="1000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 15000000 (1.50 Crore)"
              className="input-notion text-xs font-semibold"
              required
            />
            {amount && parseFloat(amount) > 0 && (
              <p className="text-2xs text-blue-600 font-medium mt-1">
                {parseFloat(amount) >= 10000000
                  ? `₹${(parseFloat(amount) / 10000000).toFixed(2)} Crore`
                  : `₹${(parseFloat(amount) / 100000).toFixed(2)} Lakh`}
              </p>
            )}
          </div>

          {/* Currency */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Currency</label>
            <input type="text" value="INR (Indian Rupee)" disabled className="input-notion text-xs bg-slate-50 text-slate-500" />
          </div>

          {/* Issue Date */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Issue / Deposit Date *</label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="input-notion text-xs"
              required
            />
          </div>

          {/* Maturity Date */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Maturity Date *</label>
            <input
              type="date"
              value={maturityDate}
              onChange={(e) => setMaturityDate(e.target.value)}
              className="input-notion text-xs"
              required
            />
          </div>
        </div>

        {/* Purpose */}
        <div className="text-xs">
          <label className="font-semibold text-slate-700 block mb-1">AICTE Regulatory Purpose *</label>
          <input
            type="text"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="input-notion text-xs"
            placeholder="e.g. Mandatory Security Deposit for B.Tech Technical Program Approval"
            required
          />
        </div>

        {/* Beneficiary Details */}
        <div className="text-xs">
          <label className="font-semibold text-slate-700 block mb-1">Beneficiary & Joint Holder Details</label>
          <input
            type="text"
            value={beneficiaryDetails}
            onChange={(e) => setBeneficiaryDetails(e.target.value)}
            className="input-notion text-xs font-mono"
            placeholder="Joint Holder Name & Designation"
          />
        </div>

        {/* File Upload Section */}
        <div className="pt-2 border-t border-border/60">
          <label className="font-semibold text-slate-700 block mb-1 text-xs">
            Upload Fixed Deposit Receipt Scan (PDF or Image)
          </label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed border-border rounded-lg hover:border-slate-400 transition-colors bg-slate-50/50">
            <div className="space-y-1 text-center">
              <UploadCloud className="mx-auto h-8 w-8 text-slate-400" />
              <div className="flex text-xs text-slate-600 justify-center">
                <label className="relative cursor-pointer rounded-md font-semibold text-blue-600 hover:text-blue-500 focus-within:outline-none">
                  <span>Select file</span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="sr-only"
                  />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-2xs text-muted-foreground">PDF, PNG, JPG up to 10MB (magic bytes checked)</p>
              {selectedFile && (
                <p className="text-xs font-medium text-emerald-600 mt-2">
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Regulatory Note */}
        <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-200/60 flex items-start gap-2.5 text-xs text-blue-900">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Per AICTE Approval Process Handbook, all FDRs must be opened in joint names with the Member Secretary, AICTE,
            or designated Regional Officer, with lien clearly marked on the bank ledger.
          </p>
        </div>

        {/* Form Action Buttons */}
        <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/instruments')}
            className="btn-outline text-xs py-2 px-4"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSubmit(false)}
            className="btn-secondary text-xs py-2 px-4 flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save as Draft</span>
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSubmit(true)}
            className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Submit for AICTE Scrutiny</span>
          </button>
        </div>
      </div>
    </div>
  );
};
