import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Role, LifecycleStatus, DateStatus } from '@depositdesk/shared';
import { api, getApiErrorMessage, InstrumentSummary } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from './StatusBadge';
import { PageTitle } from './PageTools';
import { RecordPreview } from './RecordPreview';

export function InstrumentList({
  scrutiny = false,
  mode,
}: {
  scrutiny?: boolean;
  mode?: 'maturities' | 'renewals';
}) {
  const { user } = useAuth();
  const [query] = useSearchParams();
  const [selected, setSelected] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [verification, setVerification] = useState('');
  const [renewal, setRenewal] = useState('');
  const [release, setRelease] = useState('');
  const [issueFrom, setIssueFrom] = useState(''),
    [issueTo, setIssueTo] = useState('');
  const [maturityFrom, setMaturityFrom] = useState(''),
    [maturityTo, setMaturityTo] = useState('');
  const [search, setSearch] = useState(query.get('search') || '');
  const [status, setStatus] = useState(query.get('lifecycleStatus') || '');
  const [dateStatus, setDateStatus] = useState(
    query.get('dateStatus') ||
      (mode === 'maturities' && !query.get('overdue') && !query.get('daysTo')
        ? 'EXPIRING_SOON'
        : ''),
  );
  const [bank, setBank] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState<InstrumentSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setSearch(query.get('search') || '');
    setStatus(query.get('lifecycleStatus') || '');
    setDateStatus(
      query.get('dateStatus') ||
        (mode === 'maturities' && !query.get('overdue') && !query.get('daysTo')
          ? 'EXPIRING_SOON'
          : ''),
    );
    setPage(1);
  }, [query.toString(), mode]);
  useEffect(() => {
    setPage(1);
  }, [
    search,
    status,
    dateStatus,
    bank,
    sortBy,
    sortOrder,
    verification,
    renewal,
    release,
    issueFrom,
    issueTo,
    maturityFrom,
    maturityTo,
  ]);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    setRecords([]);
    api.instruments
      .list({
        search: search || undefined,
        lifecycleStatus: status || undefined,
        dateStatus: dateStatus || undefined,
        bankName: bank || undefined,
        sortBy,
        sortOrder,
        page,
        pageSize: 20,
        verificationStatus: verification || undefined,
        renewalStatus: renewal || undefined,
        releaseStatus: release || undefined,
        issueDateFrom: issueFrom || undefined,
        issueDateTo: issueTo || undefined,
        maturityDateFrom: maturityFrom || undefined,
        maturityDateTo: maturityTo || undefined,
        monitoring: query.get('monitoring') || undefined,
        overdue: query.get('overdue') || undefined,
        awaitingVerification: query.get('awaitingVerification') || undefined,
        daysFrom: query.get('daysFrom') || undefined,
        daysTo: query.get('daysTo') || undefined,
        renewals:
          mode === 'renewals' ? query.get('renewals') || 'all' : undefined,
        queue: scrutiny ? 'true' : undefined,
      })
      .then((response) => {
        if (current) {
          setRecords(response.data);
          setTotal(response.total);
        }
      })
      .catch((error) => {
        if (current) {
          setTotal(0);
          setError(getApiErrorMessage(error, 'Could not load records.'));
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [
    search,
    status,
    dateStatus,
    bank,
    sortBy,
    sortOrder,
    page,
    retry,
    scrutiny,
    user?.id,
    verification,
    renewal,
    release,
    issueFrom,
    issueTo,
    maturityFrom,
    maturityTo,
    query.toString(),
    mode,
  ]);
  const stages = scrutiny
    ? ['SUBMITTED', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'RESUBMITTED']
    : Object.values(LifecycleStatus);
  return (
    <div className="space-y-4" key={mode}>
      <PageTitle
        eyebrow={
          scrutiny
            ? 'OFFICER WORKSPACE'
            : mode === 'maturities'
              ? 'DEADLINE MONITORING'
              : mode === 'renewals'
                ? 'REPLACEMENT TRACKING'
                : 'CENTRAL REGISTER'
        }
        title={
          mode === 'maturities'
            ? 'Maturity monitoring'
            : mode === 'renewals'
              ? 'Renewals & replacements'
              : scrutiny
                ? 'Scrutiny queue'
                : 'Instrument registry'
        }
        description={
          scrutiny
            ? 'Review evidence, record observations and track corrections within your scope.'
            : mode === 'renewals'
              ? 'Track replacements without losing earlier instruments, documents or review history.'
              : 'Search, filter and inspect institution records in one place.'
        }
      >
        {!scrutiny && user?.role === 'INSTITUTION_USER' && (
          <Link className="btn-primary" to="/instruments/new">
            Register instrument
          </Link>
        )}
      </PageTitle>
      <div className="card-notion p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <label className="text-sm">
          Search
          <input
            className="input-notion"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Reference, instrument, institution or bank"
          />
        </label>
        <label className="text-sm">
          Lifecycle
          <select
            className="input-notion"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All stages</option>
            {stages.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Date status
          <select
            className="input-notion"
            value={dateStatus}
            onChange={(event) => setDateStatus(event.target.value)}
          >
            <option value="">All date statuses</option>
            {Object.values(DateStatus).map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Bank
          <input
            className="input-notion"
            value={bank}
            onChange={(event) => setBank(event.target.value)}
          />
        </label>
        <label className="text-sm">
          Sort by
          <select
            className="input-notion"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
          >
            <option value="createdAt">Created</option>
            <option value="maturityDate">Maturity</option>
            <option value="amount">Amount</option>
            <option value="instrumentNumber">Instrument number</option>
          </select>
        </label>
        <label className="text-sm">
          Order
          <select
            className="input-notion"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </label>
      </div>
      {error && (
        <div role="alert" className="p-3 bg-red-50 text-red-800">
          {error}{' '}
          <button
            className="underline"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      )}
      <button
        className="btn-outline"
        aria-expanded={advanced}
        onClick={() => setAdvanced(!advanced)}
      >
        {advanced ? 'Hide' : 'More'} filters
      </button>
      {advanced && (
        <section className="card-notion grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <label className="text-sm">
            Verification
            <select
              className="input-notion"
              value={verification}
              onChange={(e) => setVerification(e.target.value)}
            >
              <option value="">All verification states</option>
              {[
                'NOT_CHECKED',
                'PENDING',
                'DEMO_SIMULATED',
                'CONFIRMED_BY_AUTHORIZED_SOURCE',
                'UNAVAILABLE',
                'DISCREPANCY_FOUND',
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Renewal
            <select
              className="input-notion"
              value={renewal}
              onChange={(e) => setRenewal(e.target.value)}
            >
              <option value="">All renewal states</option>
              {['NONE', 'REQUIRED', 'IN_PROGRESS', 'COMPLETED'].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Release
            <select
              className="input-notion"
              value={release}
              onChange={(e) => setRelease(e.target.value)}
            >
              <option value="">All release states</option>
              {['NONE', 'OPEN', 'APPROVED', 'COMPLETED', 'REJECTED'].map(
                (value) => (
                  <option key={value}>{value}</option>
                ),
              )}
            </select>
          </label>
          {(
            [
              ['Issue from', issueFrom, setIssueFrom],
              ['Issue to', issueTo, setIssueTo],
              ['Maturity from', maturityFrom, setMaturityFrom],
              ['Maturity to', maturityTo, setMaturityTo],
            ] as const
          ).map(([label, value, setter]) => (
            <label className="text-sm" key={label}>
              {label}
              <input
                type="date"
                className="input-notion"
                value={value}
                onChange={(e) => setter(e.target.value)}
              />
            </label>
          ))}
        </section>
      )}
      <div
        className={`grid gap-4 items-start ${selected ? 'xl:grid-cols-[minmax(0,1fr)_330px]' : ''}`}
      >
        <div className="card-notion overflow-x-auto">
          <table className="table-notion min-w-[1050px]">
            <thead>
              <tr>
                <th>Instrument</th>
                <th>Institution</th>
                <th>Amount</th>
                <th>Maturity</th>
                <th>Lifecycle</th>
                <th>Independent verification</th>
                <th>Renewal</th>
                <th>Release</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} role="status">
                    Loading records…
                  </td>
                </tr>
              ) : !records.length ? (
                <tr>
                  <td colSpan={8}>
                    {error
                      ? 'Records unavailable.'
                      : 'No records match these filters.'}
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr
                    key={record.id}
                    className={selected === record.id ? 'bg-orange-50/50' : ''}
                  >
                    <td className="min-w-[160px]">
                      <Link
                        className="text-blue-700 underline font-medium"
                        to={`/instruments/${record.id}`}
                      >
                        {record.instrumentNumber}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {record.bankName}
                      </p>{' '}
                      <button
                        className="btn-ghost text-orange-700"
                        aria-label={`Inspect ${record.instrumentNumber}`}
                        onClick={() => setSelected(record.id)}
                      >
                        Inspect
                      </button>
                    </td>
                    <td className="min-w-[160px] max-w-[180px]">
                      {record.institutionName}
                    </td>
                    <td className="whitespace-nowrap">INR {record.amount}</td>
                    <td>
                      {record.maturityDate}
                      <br />
                      <StatusBadge status={record.dateStatus} type="date" />
                    </td>
                    <td>
                      <StatusBadge
                        status={record.lifecycleStatus}
                        type="lifecycle"
                      />
                    </td>
                    <td>
                      <StatusBadge
                        status={record.independentVerificationStatus}
                        type="verification"
                      />
                    </td>
                    <td>
                      <StatusBadge
                        status={record.renewalStatus}
                        type="renewal"
                      />
                    </td>
                    <td>
                      <StatusBadge
                        status={record.releaseStatus}
                        type="release"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {selected && (
          <RecordPreview id={selected} onClose={() => setSelected(null)} />
        )}
      </div>
      <footer className="flex flex-wrap justify-between items-center gap-3 text-sm">
        <p>
          {loading
            ? 'Loading…'
            : `${total} matching records · Page ${page} of ${Math.max(1, Math.ceil(total / 20))}`}
        </p>
        <div className="flex gap-2">
          <button
            className="btn-outline"
            disabled={page <= 1 || loading}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </button>
          <button
            className="btn-outline"
            disabled={page * 20 >= total || loading}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      </footer>
    </div>
  );
}
