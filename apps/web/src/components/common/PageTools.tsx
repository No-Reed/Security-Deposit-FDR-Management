import React, { DependencyList, useEffect, useState } from 'react';
import { getApiErrorMessage } from '../../lib/api';

export function useRemote<T>(
  load: () => Promise<T>,
  dependencies: DependencyList = [],
) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [tick, setTick] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setData(null);
    setMessage('');
    setError('');
    load()
      .then((value) => {
        if (current) setData(value);
      })
      .catch((error) => {
        if (current)
          setError(getApiErrorMessage(error, 'Could not load these records.'));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [...dependencies, tick]);
  const reload = () => setTick((value) => value + 1);
  const act = async (
    operation: () => Promise<unknown>,
    success = 'Changes saved.',
  ) => {
    setBusy(true);
    setError('');
    setMessage('');
    let saved = false;
    try {
      await operation();
      saved = true;
      setData(await load());
      setMessage(success);
      return true;
    } catch (error) {
      setError(
        saved
          ? 'The action was saved, but refreshed data could not load. Refresh before another action.'
          : getApiErrorMessage(error, 'The action could not be completed.'),
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { data, setData, error, message, loading, busy, reload, act };
}
export function Feedback({
  state,
}: {
  state: {
    error: string;
    message?: string;
    loading: boolean;
    reload: () => void;
  };
}) {
  return (
    <>
      {state.error && (
        <div role="alert" className="notice notice-error">
          {state.error}{' '}
          <button className="underline" onClick={state.reload}>
            Retry
          </button>
        </div>
      )}
      {state.message && (
        <p role="status" className="notice notice-success">
          {state.message}
        </p>
      )}
      {state.loading && (
        <div role="status" className="space-y-2 py-2">
          <div className="skeleton h-4 w-2/3" />
          <div className="skeleton h-4 w-1/3" />
          <span className="sr-only">Loading records</span>
        </div>
      )}
    </>
  );
}
export function Pager({
  page,
  total,
  size = 20,
  onChange,
  disabled = false,
}: {
  page: number;
  total: number;
  size?: number;
  onChange: (page: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-between items-center gap-3 py-3 text-sm text-slate-600">
      <span>
        {total} records · Page {page} of {Math.max(1, Math.ceil(total / size))}
      </span>
      <div className="flex gap-2">
        <button
          className="btn-outline"
          disabled={disabled || page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </button>
        <button
          className="btn-outline"
          disabled={disabled || page * size >= total}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
export const formatDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—';
export const money = (value: string | number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value));
export function PageTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && (
          <p className="mt-2 text-sm text-slate-500 max-w-3xl">{description}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </header>
  );
}
