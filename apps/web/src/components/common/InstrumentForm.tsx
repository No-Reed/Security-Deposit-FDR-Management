import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CreateInstrumentSchema,
  InstrumentType,
  DocumentCategory,
} from '@depositdesk/shared';
import { api, getApiErrorMessage, InstrumentDetail } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

export function InstrumentForm({
  initial,
  onSaved,
  template,
  predecessor,
}: {
  initial?: InstrumentDetail;
  template?: InstrumentDetail;
  predecessor?: { id: string; version: number };
  onSaved: (id: string) => void;
}) {
  const { user } = useAuth();
  const defaults = initial ?? template;
  const [fields, setFields] = useState({
    instrumentType: defaults?.instrumentType ?? InstrumentType.FDR,
    instrumentNumber: defaults?.instrumentNumber ?? '',
    bankName: defaults?.bankName ?? '',
    bankBranch: defaults?.bankBranch ?? '',
    amount: defaults?.amount ?? '',
    issueDate:
      defaults?.issueDate?.slice(0, 10) ??
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
        new Date(),
      ),
    maturityDate: defaults?.maturityDate?.slice(0, 10) ?? '',
    validityEndDate: defaults?.validityEndDate?.slice(0, 10) ?? '',
    purpose: defaults?.purpose ?? '',
    beneficiaryDetails: defaults?.beneficiaryDetails ?? '',
  });
  const [record, setRecord] = useState<{ id: string; version: number } | null>(
    initial ?? null,
  );
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const change = (name: keyof typeof fields, value: string) =>
    setFields((previous) => ({ ...previous, [name]: value }));
  const save = async (submit: boolean) => {
    setError('');
    setErrors({});
    const parsed = CreateInstrumentSchema.safeParse({
      ...fields,
      validityEndDate: fields.validityEndDate || null,
      currency: 'INR',
      institutionId: user?.institutionId,
    });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            issue.path.join('.'),
            issue.message,
          ]),
        ),
      );
      return;
    }
    if (submit && !file && !record) {
      setError(
        'Attach a supporting document before submitting. You can also save a draft.',
      );
      return;
    }
    setBusy(true);
    try {
      const { institutionId, ...editable } = parsed.data;
      let saved = record
        ? await api.instruments.update(record.id, {
            ...editable,
            version: record.version,
          })
        : predecessor
          ? await api.instruments.createRenewal(predecessor.id, {
              ...parsed.data,
              version: predecessor.version,
            })
          : await api.instruments.create(parsed.data);
      setRecord(saved);
      if (file) {
        const data = new FormData();
        data.append('file', file);
        data.append('instrumentId', saved.id);
        data.append(
          'category',
          predecessor
            ? DocumentCategory.RENEWAL_DOCUMENT
            : DocumentCategory.FDR_COPY,
        );
        data.append('version', String(saved.version));
        await api.documents.upload(data);
        setFile(null);
        saved = await api.instruments.getById(saved.id);
        setRecord(saved);
      }
      if (submit) await api.instruments.submit(saved.id, saved.version);
      onSaved(saved.id);
    } catch (error) {
      setError(
        getApiErrorMessage(
          error,
          'Could not finish saving. Your entered values are still here; check the connection and retry.',
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  const labels: Array<[keyof typeof fields, string, string]> = [
    ['instrumentNumber', 'Instrument number', 'text'],
    ['bankName', 'Issuing bank', 'text'],
    ['bankBranch', 'Bank branch', 'text'],
    ['amount', 'Amount in INR', 'text'],
    ['issueDate', 'Issue date', 'date'],
    ['maturityDate', 'Maturity date', 'date'],
    ['validityEndDate', 'Validity end date (optional)', 'date'],
    ['purpose', 'Purpose', 'text'],
    ['beneficiaryDetails', 'Beneficiary details (optional)', 'text'],
  ];
  return (
    <div className="card-notion p-5 space-y-4">
      {error && (
        <p role="alert" className="text-sm text-red-800 bg-red-50 p-3 rounded">
          {error}
        </p>
      )}
      {record && !initial && (
        <p className="text-sm text-slate-600">
          Draft saved.{' '}
          <Link
            className="text-blue-700 underline"
            to={`/instruments/${record.id}`}
          >
            Open saved draft
          </Link>{' '}
          if you need to continue later.
        </p>
      )}
      <fieldset
        disabled={busy}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <label className="text-sm">
          Instrument type
          <select
            className="input-notion mt-1"
            value={fields.instrumentType}
            onChange={(event) => change('instrumentType', event.target.value)}
          >
            {Object.values(InstrumentType).map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        {labels.map(([name, label, type]) => (
          <label className="text-sm" key={name}>
            {label}
            <input
              className="input-notion mt-1"
              type={type}
              value={fields[name]}
              onChange={(event) => change(name, event.target.value)}
              aria-invalid={Boolean(errors[name])}
              aria-describedby={errors[name] ? `error-${name}` : undefined}
            />
            {errors[name] && (
              <span
                id={`error-${name}`}
                className="block text-xs text-red-700 mt-1"
              >
                {errors[name]}
              </span>
            )}
          </label>
        ))}
        <label className="text-sm md:col-span-2">
          Supporting receipt (PDF, JPG or PNG)
          <input
            className="block mt-2 text-sm"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
      </fieldset>
      <p className="text-xs text-slate-600">
        Enter the details from the instrument. Uploading a receipt does not
        establish bank confirmation. Applicable deposit conditions require
        authorized review.
      </p>
      <div className="flex flex-wrap gap-2 justify-end">
        <button
          className="btn-secondary"
          disabled={busy}
          onClick={() => save(false)}
        >
          {busy ? 'Saving…' : initial ? 'Save changes' : 'Save draft'}
        </button>
        {!initial && (
          <button
            className="btn-primary"
            disabled={busy}
            onClick={() => save(true)}
          >
            Save and submit
          </button>
        )}
      </div>
    </div>
  );
}
