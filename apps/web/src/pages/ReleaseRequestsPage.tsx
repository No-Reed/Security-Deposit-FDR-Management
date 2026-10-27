import React, { useEffect, useState } from 'react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { api, ReleaseRequestDetail } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  PageTitle,
  Feedback,
  Pager,
  useRemote,
  formatDate,
  money,
} from '../components/common/PageTools';
import { StatusBadge } from '../components/common/StatusBadge';

export const ReleaseRequestsPage: React.FC = () => {
  const { id } = useParams();
  return id ? <ReleaseDetail id={id} /> : <ReleaseList />;
};
function ReleaseList() {
  const { user } = useAuth(),
    navigate = useNavigate();
  const [query] = useSearchParams();
  const [status, setStatus] = useState(''),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [show, setShow] = useState(Boolean(query.get('instrumentId')));
  const [instrumentId, setInstrumentId] = useState(
      query.get('instrumentId') || '',
    ),
    [reason, setReason] = useState(''),
    [type, setType] = useState('RELEASE');
  const state = useRemote(
    () =>
      api.releaseRequests.list({
        page,
        pageSize: 20,
        status: status || undefined,
        search: search || undefined,
        open: query.get('open') || undefined,
      }),
    [page, status, search, query.toString()],
  );
  const options = useRemote(async () => {
    const selected = query.get('instrumentId');
    if (selected) return [await api.instruments.getById(selected)];
    return (
      await api.instruments.list({ lifecycleStatus: 'VERIFIED', pageSize: 100 })
    ).data;
  }, [user?.id, query.toString()]);
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow="AUTHORIZED WORKFLOW"
        title="Release requests"
        description="Review requests, track checklist evidence and record decisions separately from completion."
      >
        {user?.role === 'INSTITUTION_USER' && (
          <button className="btn-primary" onClick={() => setShow(!show)}>
            {show ? 'Close form' : 'New request'}
          </button>
        )}
      </PageTitle>
      <Feedback state={state} />
      {show && user?.role === 'INSTITUTION_USER' && (
        <form
          className="card-notion space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            state.act(async () => {
              const created = await api.releaseRequests.create({
                instrumentId,
                requestType: type,
                reason,
              });
              navigate(`/releases/${created.id}`);
            }, 'Draft created.');
          }}
        >
          <h2>New release / discharge / refund request</h2>
          <p className="text-xs text-slate-500">
            A matured instrument is not automatically eligible. Checklist
            content is demo policy configuration. This portal sends no payment
            or bank instruction.
          </p>
          <Feedback state={options} />
          <div className="grid md:grid-cols-2 gap-4">
            <label className="text-sm">
              Verified instrument
              <select
                required
                className="input-notion"
                value={instrumentId}
                onChange={(event) => setInstrumentId(event.target.value)}
              >
                <option value="">Choose an instrument</option>
                {options.data?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.instrumentNumber} · {money(item.amount)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Request type
              <select
                className="input-notion"
                value={type}
                onChange={(event) => setType(event.target.value)}
              >
                {['RELEASE', 'DISCHARGE', 'REFUND'].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-sm">
            Reason
            <textarea
              required
              className="input-notion"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <button
            className="btn-primary"
            disabled={state.busy || !reason.trim() || !instrumentId}
          >
            Create draft request
          </button>
        </form>
      )}
      <div className="flex flex-wrap gap-3">
        <label className="text-sm flex-1 min-w-[180px]">
          Search
          <input
            className="input-notion"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Request, instrument or institution"
          />
        </label>
        <label className="text-sm">
          Status
          <select
            className="input-notion"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {[
              'DRAFT',
              'SUBMITTED',
              'UNDER_REVIEW',
              'RETURNED_FOR_INFORMATION',
              'RESUBMITTED',
              'PENDING_AUTHORITY_DECISION',
              'APPROVED',
              'REJECTED',
              'COMPLETED',
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="card-notion p-0 overflow-x-auto">
        <table className="table-notion">
          <thead>
            <tr>
              <th>Request / instrument</th>
              <th>Institution</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {state.data?.data.map((item) => (
              <tr key={item.id}>
                <td>
                  <Link
                    className="text-orange-700 font-medium"
                    to={`/releases/${item.id}`}
                  >
                    {item.referenceCode}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {item.instrument.instrumentNumber}
                  </p>
                </td>
                <td>{item.institution.name}</td>
                <td>{item.requestType}</td>
                <td>{money(item.instrument.amount)}</td>
                <td>
                  <StatusBadge status={item.status} type="release" />
                </td>
                <td>{formatDate(item.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!state.loading && !state.data?.data.length && (
          <p className="empty-state">
            No release requests match these filters.
          </p>
        )}
      </div>
      <Pager
        page={page}
        total={state.data?.total || 0}
        onChange={setPage}
        disabled={state.loading}
      />
    </div>
  );
}
function ReleaseDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const state = useRemote(() => api.releaseRequests.getById(id), [id]);
  const record = state.data;
  const [notes, setNotes] = useState(''),
    [decisionNotes, setDecisionNotes] = useState(''),
    [file, setFile] = useState<File | null>(null),
    [supersedes, setSupersedes] = useState('');
  const [completionReference, setCompletionReference] = useState(''),
    [completionDate, setCompletionDate] = useState(
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
        new Date(),
      ),
    );
  const [reason, setReason] = useState('');
  useEffect(() => {
    setReason(record?.reason || '');
  }, [record?.id, record?.reason]);
  const own = user?.role === 'INSTITUTION_USER',
    officer = user?.role === 'SCRUTINY_OFFICER',
    authority = user?.role === 'APPROVING_AUTHORITY';
  const review =
    officer &&
    record?.scrutinyOfficer?.id === user?.id &&
    record.status === 'UNDER_REVIEW';
  const decide =
    authority &&
    record?.status === 'PENDING_AUTHORITY_DECISION' &&
    record.scrutinyOfficer?.id !== user?.id &&
    record.submittedBy.id !== user?.id;
  const uploadAllowed =
    (own &&
      ['DRAFT', 'RETURNED_FOR_INFORMATION'].includes(record?.status || '')) ||
    review;
  const run = (operation: () => Promise<unknown>, message: string) =>
    state.act(operation, message);
  const action = (
    name: string,
    operation: () => Promise<unknown>,
    message: string,
  ) => {
    if (window.confirm(name)) run(operation, message);
  };
  return (
    <div className="space-y-5">
      <Link className="text-sm text-orange-700" to="/releases">
        ← Release requests
      </Link>
      <Feedback state={state} />
      {record && (
        <>
          <PageTitle
            eyebrow="RELEASE CASE"
            title={record.referenceCode}
            description={`${record.institution.name} · ${record.requestType}`}
          >
            <StatusBadge status={record.status} type="release" />
            <button className="btn-outline" onClick={state.reload}>
              Refresh
            </button>
          </PageTitle>
          <p className="notice border-orange-200 bg-orange-50 text-orange-900">
            Demo administrative workflow. Approval and completion are separate
            records. No payment, discharge instruction or real-world release is
            executed.
          </p>
          <div className="grid xl:grid-cols-[1fr_340px] gap-5 items-start">
            <div className="space-y-5">
              <section className="card-notion space-y-3">
                <h2>Request details</h2>
                <Link
                  className="text-sm text-orange-700"
                  to={`/instruments/${record.instrumentId}`}
                >
                  {record.instrument.instrumentNumber}
                </Link>
                <p className="text-sm">{record.reason}</p>
                <div className="grid sm:grid-cols-2 gap-3 text-xs text-slate-500">
                  <p>Requested by {record.submittedBy.name}</p>
                  <p>Amount: {money(record.instrument.amount)}</p>
                  <p>
                    Reviewer: {record.scrutinyOfficer?.name || 'Not assigned'}
                  </p>
                  <p>
                    Decision authority:{' '}
                    {record.approvingAuthority?.name || 'Pending'}
                  </p>
                </div>
                {own &&
                  ['DRAFT', 'RETURNED_FOR_INFORMATION'].includes(
                    record.status,
                  ) && (
                    <div className="space-y-2 border-t pt-3">
                      <label className="block text-sm">
                        Update reason
                        <textarea
                          className="input-notion"
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                        />
                      </label>
                      <button
                        className="btn-outline"
                        disabled={state.busy || !reason.trim()}
                        onClick={() =>
                          run(
                            () =>
                              api.releaseRequests.update(
                                record.id,
                                reason,
                                record.version,
                              ),
                            'Request reason saved.',
                          )
                        }
                      >
                        Save reason
                      </button>
                    </div>
                  )}
                {record.returnReason && (
                  <p className="notice border-amber-200 bg-amber-50 text-amber-900">
                    Returned for information: {record.returnReason}
                  </p>
                )}
                {record.scrutinyNotes && (
                  <p className="text-sm">
                    <strong>Scrutiny notes:</strong> {record.scrutinyNotes}
                  </p>
                )}
                {record.decisionReason && (
                  <p className="text-sm">
                    <strong>Decision reason:</strong> {record.decisionReason}
                  </p>
                )}
                {record.decisionNotes && (
                  <p className="text-sm">
                    Decision notes: {record.decisionNotes}
                  </p>
                )}
                {record.status === 'COMPLETED' && (
                  <div className="notice notice-success">
                    Completion reference: {record.completionReference}
                    <br />
                    Evidence date: {record.completionDate}
                    <br />
                    Recorded by {record.completedBy?.name} at{' '}
                    {formatDate(record.completedAt)}
                    {record.completionNotes && <p>{record.completionNotes}</p>}
                  </div>
                )}
              </section>
              <section className="card-notion space-y-3">
                <h2>Eligibility checklist</h2>
                <p className="text-xs text-slate-500">
                  Demo policy configuration captured when this request was
                  created. Required items block forwarding and approval; there
                  is no override.
                </p>
                {record.checklistSnapshot.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-start gap-3 py-2 text-sm border-b last:border-0"
                  >
                    <input
                      type="checkbox"
                      checked={item.completed}
                      disabled={!review || state.busy}
                      onChange={(event) =>
                        run(
                          () =>
                            api.releaseRequests.checklist(
                              record.id,
                              item.id,
                              event.target.checked,
                              record.version,
                            ),
                          'Checklist saved.',
                        )
                      }
                      className="mt-1 accent-orange-700"
                    />
                    <span>
                      {item.label}
                      {item.isRequired && (
                        <span className="block text-xs text-orange-700">
                          Required
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </section>
              <section className="card-notion space-y-3">
                <h2>Supporting evidence</h2>
                {record.documents.map((doc) => (
                  <div key={doc.id} className="border-b pb-2 text-sm">
                    <a
                      className="text-orange-700 underline break-all"
                      href={api.documents.downloadUrl(doc.id)}
                    >
                      {doc.originalFilename}
                    </a>
                    <p className="text-xs text-slate-500 mt-1">
                      Version {doc.version || 1} ·{' '}
                      {doc.isSuperseded ? 'Superseded' : 'Current'} · Malware
                      not scanned
                    </p>
                  </div>
                ))}
                {!record.documents.length && (
                  <p className="text-sm text-slate-500">
                    Attach evidence before submitting.
                  </p>
                )}
                {uploadAllowed && (
                  <fieldset disabled={state.busy} className="space-y-3 pt-2">
                    <label className="block text-sm">
                      Replace evidence (optional)
                      <select
                        className="input-notion"
                        value={supersedes}
                        onChange={(event) => setSupersedes(event.target.value)}
                      >
                        <option value="">Add another document</option>
                        {record.documents
                          .filter((doc) => !doc.isSuperseded)
                          .map((doc) => (
                            <option value={doc.id} key={doc.id}>
                              {doc.originalFilename}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="block text-sm">
                      Supporting PDF / JPG / PNG
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="block mt-2 text-xs"
                        onChange={(event) =>
                          setFile(event.target.files?.[0] || null)
                        }
                      />
                    </label>
                    <button
                      className="btn-outline"
                      disabled={!file || state.busy}
                      onClick={() =>
                        run(async () => {
                          const data = new FormData();
                          data.append('file', file!);
                          data.append('releaseRequestId', record.id);
                          data.append('version', String(record.version));
                          data.append('category', 'RELEASE_SUPPORTING');
                          if (supersedes)
                            data.append('supersedesDocumentId', supersedes);
                          await api.documents.upload(data);
                          setFile(null);
                          setSupersedes('');
                        }, 'Evidence uploaded.')
                      }
                    >
                      Upload evidence
                    </button>
                  </fieldset>
                )}
              </section>
            </div>
            <aside className="space-y-5">
              <section className="card-notion space-y-3">
                <h2>Next action</h2>
                {own && record.status === 'DRAFT' && (
                  <button
                    className="btn-primary w-full"
                    disabled={state.busy}
                    onClick={() =>
                      action(
                        'Submit this release request and evidence?',
                        () =>
                          api.releaseRequests.submit(record.id, record.version),
                        'Request submitted.',
                      )
                    }
                  >
                    Submit request
                  </button>
                )}
                {officer &&
                  ['SUBMITTED', 'RESUBMITTED'].includes(record.status) && (
                    <button
                      className="btn-primary w-full"
                      disabled={state.busy}
                      onClick={() =>
                        run(
                          () =>
                            api.releaseRequests.review(
                              record.id,
                              record.version,
                            ),
                          'Review started.',
                        )
                      }
                    >
                      Start review
                    </button>
                  )}
                {(review ||
                  decide ||
                  (own && record.status === 'RETURNED_FOR_INFORMATION')) && (
                  <label className="block text-sm">
                    {decide
                      ? 'Decision reason'
                      : review
                        ? 'Scrutiny notes / return reason'
                        : 'Information supplied'}
                    <textarea
                      className="input-notion mt-1"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                    />
                  </label>
                )}
                {review && (
                  <>
                    <button
                      className="btn-outline w-full"
                      disabled={state.busy || !notes.trim()}
                      onClick={() =>
                        action(
                          'Return this request for additional information?',
                          () =>
                            api.releaseRequests.returnForInfo(
                              record.id,
                              record.version,
                              notes,
                              notes,
                            ),
                          'Request returned.',
                        )
                      }
                    >
                      Return for information
                    </button>
                    <button
                      className="btn-primary w-full"
                      disabled={
                        state.busy ||
                        !notes.trim() ||
                        record.checklistSnapshot.some(
                          (item) => item.isRequired && !item.completed,
                        )
                      }
                      onClick={() =>
                        action(
                          'Forward this complete checklist for authority decision?',
                          () =>
                            api.releaseRequests.forwardToAuthority(
                              record.id,
                              record.version,
                              notes,
                            ),
                          'Forwarded to authority.',
                        )
                      }
                    >
                      Forward for decision
                    </button>
                  </>
                )}
                {own && record.status === 'RETURNED_FOR_INFORMATION' && (
                  <button
                    className="btn-primary w-full"
                    disabled={state.busy || !notes.trim()}
                    onClick={() =>
                      action(
                        'Resubmit this request with the supplied information?',
                        () =>
                          api.releaseRequests.resubmit(
                            record.id,
                            record.version,
                            notes,
                          ),
                        'Request resubmitted.',
                      )
                    }
                  >
                    Resubmit request
                  </button>
                )}
                {decide && (
                  <>
                    <label className="block text-sm">
                      Additional decision notes
                      <textarea
                        className="input-notion"
                        value={decisionNotes}
                        onChange={(event) =>
                          setDecisionNotes(event.target.value)
                        }
                      />
                    </label>
                    {(['APPROVE', 'REJECT'] as const).map((value) => (
                      <button
                        key={value}
                        className={
                          value === 'APPROVE'
                            ? 'btn-primary w-full'
                            : 'btn-outline w-full text-red-700'
                        }
                        disabled={state.busy || !notes.trim()}
                        onClick={() =>
                          action(
                            `${value === 'APPROVE' ? 'Approve' : 'Reject'} this request with the recorded reason?`,
                            () =>
                              api.releaseRequests.decide(
                                record.id,
                                value,
                                notes,
                                record.version,
                                decisionNotes,
                              ),
                            'Decision recorded.',
                          )
                        }
                      >
                        {value === 'APPROVE'
                          ? 'Approve request'
                          : 'Reject request'}
                      </button>
                    ))}
                  </>
                )}
                {(officer || authority) && record.status === 'APPROVED' && (
                  <>
                    <p className="text-xs text-slate-500">
                      Record completion evidence after the authorized external
                      procedure. This action does not send a bank instruction.
                    </p>
                    <label className="block text-sm">
                      Completion reference
                      <input
                        className="input-notion"
                        value={completionReference}
                        onChange={(event) =>
                          setCompletionReference(event.target.value)
                        }
                      />
                    </label>
                    <label className="block text-sm">
                      Evidence date
                      <input
                        type="date"
                        className="input-notion"
                        value={completionDate}
                        onChange={(event) =>
                          setCompletionDate(event.target.value)
                        }
                      />
                    </label>
                    <label className="block text-sm">
                      Completion notes
                      <textarea
                        className="input-notion"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                      />
                    </label>
                    <button
                      className="btn-primary w-full"
                      disabled={
                        state.busy ||
                        !completionReference.trim() ||
                        !completionDate
                      }
                      onClick={() =>
                        action(
                          'Record completion evidence as a separate final step?',
                          () =>
                            api.releaseRequests.complete(
                              record.id,
                              completionReference,
                              completionDate,
                              record.version,
                              notes,
                            ),
                          'Completion evidence recorded.',
                        )
                      }
                    >
                      Record completion
                    </button>
                  </>
                )}
                {!review &&
                  !decide &&
                  !(
                    own &&
                    ['DRAFT', 'RETURNED_FOR_INFORMATION'].includes(
                      record.status,
                    )
                  ) &&
                  !(
                    officer &&
                    ['SUBMITTED', 'RESUBMITTED'].includes(record.status)
                  ) &&
                  !((officer || authority) && record.status === 'APPROVED') && (
                    <p className="text-sm text-slate-500">
                      No action is assigned to your account at this stage.
                    </p>
                  )}
              </section>
              <section className="card-notion">
                <h2 className="mb-4">Case timeline</h2>
                <ol className="timeline">
                  {record.history.map((event, index) => (
                    <li key={index}>
                      <p className="text-xs font-medium">
                        {event.action.split('_').join(' ')}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        {formatDate(event.at)}
                      </p>
                      {event.notes && (
                        <p className="text-xs mt-1 text-slate-600">
                          {event.notes}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
                {!record.history.length && (
                  <p className="text-xs text-slate-500">
                    Draft created {formatDate(record.createdAt)}
                  </p>
                )}
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
