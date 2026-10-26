import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Role, LifecycleStatus, DateStatus } from '@depositdesk/shared';
import { api, getApiErrorMessage, InstrumentSummary } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from './StatusBadge';

export function InstrumentList({ scrutiny = false }: { scrutiny?: boolean }) {
  const { user } = useAuth();
  const [query] = useSearchParams();
  const [search, setSearch] = useState(query.get('search') || '');
  const [status, setStatus] = useState(query.get('lifecycleStatus') || '');
  const [dateStatus, setDateStatus] = useState(query.get('dateStatus') || '');
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
    setPage(1);
  }, [search, status, dateStatus, bank, sortBy, sortOrder]);
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
  ]);
  const stages = scrutiny
    ? ['SUBMITTED', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'RESUBMITTED']
    : Object.values(LifecycleStatus);
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {scrutiny ? 'Scrutiny queue' : 'Security deposit / FDR registry'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {scrutiny
              ? 'Review submissions, document outcomes and requests for correction within your permitted scope.'
              : 'Search the institution records available to your account.'}
          </p>
        </div>
        {!scrutiny && user?.role === Role.INSTITUTION_USER && (
          <Link className="btn-primary" to="/instruments/new">
            Register instrument
          </Link>
        )}
      </header>
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
      <div className="card-notion overflow-x-auto">
        <table className="table-notion">
          <thead>
            <tr>
              <th>Instrument</th>
              <th>Institution</th>
              <th>Amount</th>
              <th>Maturity</th>
              <th>Lifecycle</th>
              <th>Independent verification</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} role="status">
                  Loading records…
                </td>
              </tr>
            ) : !records.length ? (
              <tr>
                <td colSpan={6}>
                  {error
                    ? 'Records unavailable.'
                    : 'No records match these filters.'}
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr key={record.id}>
                  <td>
                    <Link
                      className="text-blue-700 underline font-medium"
                      to={`/instruments/${record.id}`}
                    >
                      {record.instrumentNumber}
                    </Link>
                    <p className="text-xs text-slate-500">{record.bankName}</p>
                  </td>
                  <td>{record.institutionName}</td>
                  <td>INR {record.amount}</td>
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
                </tr>
              ))
            )}
          </tbody>
        </table>
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
