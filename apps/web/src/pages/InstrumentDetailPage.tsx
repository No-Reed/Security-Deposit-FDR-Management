import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Role,
  DocumentCategory,
  IndependentVerificationStatus,
  DocumentReviewStatus,
  DiscrepancySeverity,
} from '@depositdesk/shared';
import { api, InstrumentDetail, getApiErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { InstrumentForm } from '../components/common/InstrumentForm';

const formatTime = (value: string) =>
  new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
export const InstrumentDetailPage: React.FC = () => {
  const { id } = useParams();
  const { user, isDemoMode } = useAuth();
  const [instrument, setInstrument] = useState<InstrumentDetail | null>(null);
  const [history, setHistory] = useState<Awaited<
    ReturnType<typeof api.instruments.history>
  > | null>(null);
  const [tab, setTab] = useState('Overview');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<DocumentCategory>(
    DocumentCategory.FDR_COPY,
  );
  const [supersedes, setSupersedes] = useState('');
  const [source, setSource] = useState('');
  const [reference, setReference] = useState('');
  const [outcome, setOutcome] = useState<IndependentVerificationStatus>(
    IndependentVerificationStatus.DEMO_SIMULATED,
  );
  const [severity, setSeverity] = useState<DiscrepancySeverity>(
    DiscrepancySeverity.HIGH,
  );
  const [description, setDescription] = useState('');
  const load = useCallback(async () => {
    if (!id) return;
    const [record, log] = await Promise.all([
      api.instruments.getById(id),
      api.instruments.history(id),
    ]);
    setInstrument(record);
    setHistory(log);
  }, [id]);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    setInstrument(null);
    load()
      .catch((error) => {
        if (current)
          setError(getApiErrorMessage(error, 'Could not load this record.'));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [load]);
  useEffect(() => {
    setOutcome(
      isDemoMode
        ? IndependentVerificationStatus.DEMO_SIMULATED
        : IndependentVerificationStatus.UNAVAILABLE,
    );
  }, [isDemoMode]);
  const run = async (operation: () => Promise<unknown>, message: string) => {
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      await operation();
      await load();
      setSuccess(message);
      setNotes('');
    } catch (error) {
      setError(
        getApiErrorMessage(
          error,
          'The action could not be completed. Refresh the record and retry.',
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  if (loading)
    return (
      <p role="status" className="p-6">
        Loading instrument…
      </p>
    );
  if (!instrument)
    return (
      <div role="alert" className="space-y-3">
        <p>{error || 'Instrument unavailable.'}</p>
        <button
          className="btn-outline"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
        <Link className="block text-blue-700" to="/instruments">
          Back to registry
        </Link>
      </div>
    );
  const own = user?.role === Role.INSTITUTION_USER;
  const officer = user?.role === Role.SCRUTINY_OFFICER;
  const state = instrument.lifecycleStatus;
  const canEdit = own && ['DRAFT', 'ACTION_REQUIRED'].includes(state);
  const canUpload =
    canEdit ||
    ((officer || user?.role === Role.APPROVING_AUTHORITY) &&
      state === 'UNDER_REVIEW');
  const needsNotes = !notes.trim();
  const upload = async () => {
    if (!file) return;
    const data = new FormData();
    data.append('file', file);
    data.append('instrumentId', instrument.id);
    data.append('category', category);
    data.append('version', String(instrument.version));
    if (supersedes) data.append('supersedesDocumentId', supersedes);
    await api.documents.upload(data);
    setFile(null);
    setSupersedes('');
  };
  return (
    <div className="space-y-4">
      <Link to="/instruments" className="text-sm text-blue-700">
        ← Registry
      </Link>
      <header className="card-notion p-5 space-y-3">
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">{instrument.referenceCode}</p>
            <h1 className="text-xl font-semibold">
              {instrument.instrumentNumber}
            </h1>
            <p className="text-sm text-slate-600">
              {instrument.institution.name}
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <StatusBadge status={state} type="lifecycle" />
            <StatusBadge status={instrument.dateStatus} type="date" />
          </div>
        </div>
        <p className="text-sm">
          {instrument.bankName} · {instrument.bankBranch} · INR{' '}
          {instrument.amount}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-outline"
            disabled={busy}
            onClick={() => run(load, 'Record refreshed.')}
          >
            Refresh
          </button>
          {canEdit && (
            <button
              className="btn-secondary"
              onClick={() => setEditing(!editing)}
            >
              {editing ? 'Cancel editing' : 'Edit details'}
            </button>
          )}
          {own && state === 'DRAFT' && (
            <button
              className="btn-primary"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    'Submit these details and documents for scrutiny?',
                  )
                )
                  run(
                    () =>
                      api.instruments.submit(instrument.id, instrument.version),
                    'Submission saved.',
                  );
              }}
            >
              Submit for scrutiny
            </button>
          )}
          {officer && ['SUBMITTED', 'RESUBMITTED'].includes(state) && (
            <button
              className="btn-primary"
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    api.instruments.review(
                      instrument.id,
                      instrument.version,
                      '',
                    ),
                  'Record opened for review.',
                )
              }
            >
              Start review
            </button>
          )}
        </div>
      </header>
      {error && (
        <p role="alert" className="bg-red-50 text-red-800 p-3 rounded">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="bg-green-50 text-green-800 p-3 rounded">
          {success}
        </p>
      )}
      {editing && canEdit && (
        <InstrumentForm
          key={instrument.version}
          initial={instrument}
          onSaved={() => {
            setEditing(false);
            run(load, 'Changes saved.');
          }}
        />
      )}
      {own && state === 'REJECTED' && (
        <Link
          className="btn-outline inline-block"
          to={`/instruments/new?copyFrom=${instrument.id}`}
        >
          Create corrected copy
        </Link>
      )}
      <nav
        aria-label="Instrument sections"
        className="flex flex-wrap border-b gap-2"
      >
        {[
          'Overview',
          'Documents',
          'Verification',
          'Discrepancies',
          'History',
          'Related records',
        ].map((name) => (
          <button
            key={name}
            aria-pressed={tab === name}
            className={`px-3 py-2 text-sm border-b-2 ${tab === name ? 'border-orange-600 text-orange-800' : 'border-transparent'}`}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </nav>
      {tab === 'Overview' && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <section className="card-notion p-4 space-y-2">
              <h2 className="font-semibold">Institution-submitted details</h2>
              <p className="text-sm">
                Issue: {instrument.issueDate}
                <br />
                Maturity: {instrument.maturityDate}
                <br />
                Validity end: {instrument.validityEndDate || 'Not specified'}
              </p>
              <p className="text-sm">{instrument.purpose}</p>
              <p className="text-sm">
                Beneficiary: {instrument.beneficiaryDetails || 'Not specified'}
              </p>
              <p className="text-xs text-slate-500">
                Original submissions are preserved under History.
              </p>
            </section>
            <section className="card-notion p-4 space-y-2">
              <h2 className="font-semibold">Document review</h2>
              <StatusBadge
                status={instrument.documentReviewStatus}
                type="docReview"
              />
              <p className="text-xs text-slate-500">
                An officer's review of submitted evidence.
              </p>
            </section>
            <section className="card-notion p-4 space-y-2">
              <h2 className="font-semibold">Independent verification</h2>
              <StatusBadge
                status={instrument.independentVerificationStatus}
                type="verification"
              />
              <p className="text-xs text-slate-500">
                Document upload and review do not establish bank confirmation.
                No live bank service is connected.
              </p>
            </section>
          </div>
          {own && state === 'ACTION_REQUIRED' && (
            <section className="card-notion p-4 space-y-3">
              <h2 className="font-semibold">Respond and resubmit</h2>
              <p className="text-sm">
                Review the discrepancies and history, save corrected details or
                replacement evidence, then describe your corrections.
              </p>
              <label className="block text-sm">
                Correction summary
                <textarea
                  className="input-notion mt-1"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>
              <button
                className="btn-primary"
                disabled={busy || needsNotes}
                onClick={() => {
                  if (
                    window.confirm(
                      'Resubmit the corrected record for officer review?',
                    )
                  )
                    run(
                      () =>
                        api.instruments.resubmit(
                          instrument.id,
                          instrument.version,
                          notes,
                        ),
                      'Corrections resubmitted.',
                    );
                }}
              >
                Resubmit corrections
              </button>
            </section>
          )}
          {officer && state === 'UNDER_REVIEW' && (
            <section className="card-notion p-4 space-y-3">
              <h2 className="font-semibold">Scrutiny decision</h2>
              <label className="block text-sm">
                Observation / decision reason
                <textarea
                  className="input-notion mt-1"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn-outline"
                  disabled={busy || needsNotes}
                  onClick={() =>
                    run(
                      () =>
                        api.instruments.requestCorrection(
                          instrument.id,
                          instrument.version,
                          notes,
                        ),
                      'Corrections requested.',
                    )
                  }
                >
                  Request correction
                </button>
                <button
                  className="btn-primary"
                  disabled={busy || needsNotes}
                  onClick={() => {
                    if (
                      window.confirm(
                        'Finish scrutiny using the recorded review outcome?',
                      )
                    )
                      run(
                        () =>
                          api.instruments.verify(
                            instrument.id,
                            instrument.version,
                            notes,
                          ),
                        'Scrutiny completed. Independent verification remains separately recorded.',
                      );
                  }}
                >
                  Finish scrutiny
                </button>
                <button
                  className="btn-outline text-red-700"
                  disabled={busy || needsNotes}
                  onClick={() => {
                    if (
                      window.confirm(
                        'Reject this instrument? A rejected record cannot be reopened.',
                      )
                    )
                      run(
                        () =>
                          api.instruments.reject(
                            instrument.id,
                            instrument.version,
                            notes,
                          ),
                        'Instrument rejected.',
                      );
                  }}
                >
                  Reject instrument
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Finishing requires a completed review outcome and no unresolved
                discrepancies.
              </p>
            </section>
          )}
        </div>
      )}
      {tab === 'Documents' && (
        <section className="space-y-4">
          {canUpload && (
            <fieldset disabled={busy} className="card-notion p-4 space-y-3">
              <legend className="font-semibold">Add supporting evidence</legend>
              <label className="block text-sm">
                Category
                <select
                  className="input-notion"
                  value={category}
                  onChange={(event) => {
                    setCategory(event.target.value as DocumentCategory);
                    setSupersedes('');
                  }}
                >
                  {Object.values(DocumentCategory).map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Replace an earlier document (optional)
                <select
                  className="input-notion"
                  value={supersedes}
                  onChange={(event) => setSupersedes(event.target.value)}
                >
                  <option value="">Add another document</option>
                  {instrument.documents
                    .filter(
                      (doc) => !doc.isSuperseded && doc.category === category,
                    )
                    .map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.originalFilename}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block text-sm">
                Receipt or supporting file
                <input
                  className="block mt-2"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </label>
              <button
                className="btn-primary"
                disabled={!file || busy}
                onClick={() => run(upload, 'Evidence saved.')}
              >
                Upload document
              </button>
            </fieldset>
          )}
          {!instrument.documents.length && (
            <p className="text-sm">No documents attached.</p>
          )}
          {instrument.documents.map((doc) => (
            <article key={doc.id} className="card-notion p-4 space-y-2">
              <div className="flex flex-wrap justify-between gap-2">
                <h2 className="font-semibold break-all">
                  {doc.originalFilename}
                </h2>
                <a
                  className="text-blue-700 underline text-sm"
                  href={api.documents.downloadUrl(doc.id)}
                >
                  Download
                </a>
              </div>
              <p className="text-xs">
                {doc.category} · Version {doc.version || 1} ·{' '}
                {doc.isSuperseded ? 'Superseded (retained)' : 'Current'} ·{' '}
                {doc.fileSizeBytes} bytes
              </p>
              <p className="text-xs">
                Uploaded by {doc.uploader?.name || 'Unknown'} ·{' '}
                {formatTime(doc.createdAt)} · Malware: not scanned
              </p>
              <p className="text-xs break-all text-slate-500">
                SHA-256: {doc.sha256Hash}
              </p>
            </article>
          ))}
        </section>
      )}
      {tab === 'Verification' && (
        <section className="space-y-4">
          {officer && state === 'UNDER_REVIEW' && (
            <fieldset disabled={busy} className="card-notion p-4 space-y-3">
              <legend className="font-semibold">Record review outcome</legend>
              <p className="text-sm text-slate-600">
                This records a manual review. Demo evidence must be labelled
                simulated.
              </p>
              <label className="block text-sm">
                Independent verification outcome
                <select
                  className="input-notion"
                  value={outcome}
                  onChange={(event) =>
                    setOutcome(
                      event.target.value as IndependentVerificationStatus,
                    )
                  }
                >
                  {(isDemoMode
                    ? [
                        'DEMO_SIMULATED',
                        'UNAVAILABLE',
                        'PENDING',
                        'DISCREPANCY_FOUND',
                      ]
                    : [
                        'UNAVAILABLE',
                        'PENDING',
                        'DISCREPANCY_FOUND',
                        'CONFIRMED_BY_AUTHORIZED_SOURCE',
                      ]
                  ).map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Source name (where available)
                <input
                  className="input-notion"
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                />
              </label>
              <label className="block text-sm">
                Source reference (where available)
                <input
                  className="input-notion"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                />
              </label>
              <label className="block text-sm">
                Review result and notes
                <textarea
                  className="input-notion"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>
              <button
                className="btn-primary"
                disabled={busy || needsNotes}
                onClick={() =>
                  run(
                    () =>
                      api.verification.record(instrument.id, {
                        version: instrument.version,
                        documentReviewStatus: DocumentReviewStatus.COMPLETE,
                        independentVerificationStatus: outcome,
                        sourceType: 'MANUAL_REVIEW',
                        sourceName: source,
                        referenceNumber: reference,
                        result: notes,
                        notes,
                      }),
                    'Review outcome recorded. Finish scrutiny separately when ready.',
                  )
                }
              >
                Save review outcome
              </button>
            </fieldset>
          )}
          {!instrument.verificationRecords.length && (
            <p>No review outcomes recorded.</p>
          )}
          {instrument.verificationRecords.map((record) => (
            <article className="card-notion p-4 space-y-2" key={record.id}>
              <StatusBadge
                status={record.independentVerificationStatus}
                type="verification"
              />
              <p className="text-sm">{record.result}</p>
              <p className="text-xs">
                Source: {record.sourceName || 'Unavailable'} · Reference:{' '}
                {record.referenceNumber || 'None'}
              </p>
              <p className="text-xs">
                {record.verifier?.name || 'System'} ·{' '}
                {record.verifiedAt ? formatTime(record.verifiedAt) : ''}
              </p>
            </article>
          ))}
        </section>
      )}
      {tab === 'Discrepancies' && (
        <section className="space-y-4">
          {officer && ['UNDER_REVIEW', 'ACTION_REQUIRED'].includes(state) && (
            <fieldset disabled={busy} className="card-notion p-4 space-y-3">
              <legend className="font-semibold">
                Flag discrepancy and request correction
              </legend>
              <label className="block text-sm">
                Severity
                <select
                  className="input-notion"
                  value={severity}
                  onChange={(event) =>
                    setSeverity(event.target.value as DiscrepancySeverity)
                  }
                >
                  {Object.values(DiscrepancySeverity).map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Description
                <input
                  className="input-notion"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              <label className="block text-sm">
                Reason / required correction
                <textarea
                  className="input-notion"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>
              <button
                className="btn-primary"
                disabled={busy || needsNotes || !description.trim()}
                onClick={() =>
                  run(
                    () =>
                      api.discrepancies.create({
                        instrumentId: instrument.id,
                        version: instrument.version,
                        code: 'MANUAL_SCRUTINY',
                        severity,
                        description,
                        reason: notes,
                      }),
                    'Discrepancy recorded; institution corrections requested.',
                  )
                }
              >
                Flag discrepancy
              </button>
            </fieldset>
          )}
          {!instrument.discrepancies.length && (
            <p>No discrepancies recorded.</p>
          )}
          {instrument.discrepancies.map((item) => (
            <article key={item.id} className="card-notion p-4 space-y-2">
              <div className="flex gap-2">
                <StatusBadge status={item.severity} type="severity" />
                <StatusBadge status={item.status} type="discrepancy" />
              </div>
              <h2 className="font-semibold">{item.description}</h2>
              <p className="text-sm">{item.reason}</p>
              {item.resolutionNotes && (
                <p className="text-sm">
                  Latest response: {item.resolutionNotes}
                </p>
              )}
              {['OPEN', 'RESPONDED'].includes(item.status) &&
                (officer || (own && state === 'ACTION_REQUIRED')) && (
                  <div className="space-y-2">
                    <label className="block text-sm">
                      Response / resolution notes
                      <textarea
                        className="input-notion"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                      />
                    </label>
                    <div className="flex gap-2">
                      {(officer
                        ? ['RESOLVED', 'DISMISSED']
                        : ['RESPONDED']
                      ).map((status) => (
                        <button
                          key={status}
                          className="btn-outline"
                          disabled={busy || needsNotes}
                          onClick={() =>
                            run(
                              () =>
                                api.discrepancies.resolve(
                                  item.id,
                                  notes,
                                  status as
                                    | 'RESOLVED'
                                    | 'DISMISSED'
                                    | 'RESPONDED',
                                  instrument.version,
                                ),
                              'Discrepancy updated.',
                            )
                          }
                        >
                          {status === 'RESPONDED'
                            ? 'Send response'
                            : status === 'RESOLVED'
                              ? 'Resolve'
                              : 'Dismiss'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
            </article>
          ))}
        </section>
      )}
      {tab === 'History' && (
        <section className="space-y-4">
          <h2 className="font-semibold">Submission snapshots</h2>
          {history?.snapshots.map((snapshot) => (
            <details className="card-notion p-4" key={snapshot.id}>
              <summary className="cursor-pointer text-sm">
                Submitted {formatTime(snapshot.submittedAt)}
              </summary>
              <dl className="mt-3 grid sm:grid-cols-2 gap-3 text-sm">
                {Object.entries({
                  'Instrument number': snapshot.payload.instrumentNumber,
                  'Issuing bank': snapshot.payload.bankName,
                  'Bank branch': snapshot.payload.bankBranch,
                  'Amount in INR': snapshot.payload.amount,
                  'Issue date': snapshot.payload.issueDate,
                  'Maturity date': snapshot.payload.maturityDate,
                  'Validity end': snapshot.payload.validityEndDate,
                  Purpose: snapshot.payload.purpose,
                  Beneficiary: snapshot.payload.beneficiaryDetails,
                  'Correction summary': snapshot.payload.corrections,
                }).map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd>{String(value ?? 'Not specified')}</dd></div>)}
              </dl>
              <ul className="mt-3 space-y-1 text-sm">
                {(snapshot.payload.documents || []).map((evidence: any) => <li key={evidence.id}><a className="text-blue-700 underline" href={api.documents.downloadUrl(evidence.id)}>Evidence: {instrument.documents.find(doc => doc.id === evidence.id)?.originalFilename || evidence.category} · Version {evidence.version}</a></li>)}
              </ul>
            </details>
          ))}
          <h2 className="font-semibold">Action history</h2>
          {history?.auditEvents.map((event) => (
            <article className="card-notion p-3 text-sm" key={event.id}>
              <p className="font-medium">{event.action.split('_').join(' ')}</p>
              <p>{event.reason}</p>
              <p className="text-xs text-slate-500">
                {event.actor?.name || 'System'} · {formatTime(event.timestamp)}
              </p>
            </article>
          ))}
        </section>
      )}
      {tab === 'Related records' && (
        <section className="card-notion p-4 space-y-3">
          <h2 className="font-semibold">Renewal / replacement chain</h2>
          {instrument.predecessorInstrument ? (
            <Link
              className="text-blue-700 block"
              to={`/instruments/${instrument.predecessorInstrument.id}`}
            >
              Previous: {instrument.predecessorInstrument.instrumentNumber}
            </Link>
          ) : (
            <p className="text-sm">No predecessor.</p>
          )}
          {instrument.successorInstrument ? (
            <Link
              className="text-blue-700 block"
              to={`/instruments/${instrument.successorInstrument.id}`}
            >
              Replacement: {instrument.successorInstrument.instrumentNumber}
            </Link>
          ) : (
            <p className="text-sm">No replacement linked.</p>
          )}
          <h2 className="font-semibold">Release requests</h2>
          {instrument.releaseRequests.map((request) => (
            <p key={request.id} className="text-sm">
              {request.requestType}: {request.status}
            </p>
          ))}
          <Link to="/releases" className="block text-blue-700">
            Open release requests
          </Link>
        </section>
      )}
    </div>
  );
};
