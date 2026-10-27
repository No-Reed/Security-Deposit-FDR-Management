import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, getApiErrorMessage } from '../lib/api';
import { StatusBadge } from '../components/common/StatusBadge';

export const DiscrepanciesPage: React.FC = () => {
  const [records, setRecords] = useState<any[]>([]);
  const [query] = useSearchParams();
  const [status, setStatus] = useState(query.get('status') || '');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    setRecords([]);
    api.discrepancies
      .list({ status: status || undefined, page, pageSize: 20 })
      .then((response) => {
        if (current) {
          setRecords(response.data);
          setTotal(response.total);
        }
      })
      .catch((error) => {
        if (current)
          setError(getApiErrorMessage(error, 'Could not load discrepancies.'));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [status, page, retry]);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Discrepancies</h1>
      <p className="text-sm text-slate-600">
        Open an instrument to respond to observations or record an officer
        resolution.
      </p>
      <label className="block text-sm">
        Status
        <select
          className="input-notion max-w-xs"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {['UNRESOLVED', 'OPEN', 'RESPONDED', 'RESOLVED', 'DISMISSED'].map(
            (value) => (
              <option key={value}>{value}</option>
            ),
          )}
        </select>
      </label>
      {error && (
        <p role="alert" className="text-red-800">
          {error}{' '}
          <button
            className="underline"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry
          </button>
        </p>
      )}
      {loading ? (
        <p role="status">Loading discrepancies…</p>
      ) : records.length ? (
        records.map((record) => (
          <article key={record.id} className="card-notion p-4 space-y-2">
            <div className="flex gap-2">
              <StatusBadge status={record.severity} type="severity" />
              <StatusBadge status={record.status} type="discrepancy" />
            </div>
            <h2 className="font-semibold">{record.description}</h2>
            <p className="text-sm">{record.reason}</p>
            <Link
              className="text-blue-700 underline text-sm"
              to={`/instruments/${record.instrumentId}`}
            >
              {record.instrument?.referenceCode} ·{' '}
              {record.instrument?.institution?.name}
            </Link>
          </article>
        ))
      ) : (
        <p>
          {error
            ? 'Records unavailable.'
            : 'No discrepancies match these filters.'}
        </p>
      )}
      <div className="flex gap-3 items-center text-sm">
        <button
          className="btn-outline"
          disabled={loading || page === 1}
          onClick={() => setPage((value) => value - 1)}
        >
          Previous
        </button>
        <span>Page {page}</span>
        <button
          className="btn-outline"
          disabled={loading || page * 20 >= total}
          onClick={() => setPage((value) => value + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
};
