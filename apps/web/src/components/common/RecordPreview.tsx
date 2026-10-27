import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { X, FolderOpen } from 'lucide-react';
import { api } from '../../lib/api';
import { useRemote, Feedback, money, formatDate } from './PageTools';
import { StatusBadge } from './StatusBadge';
export function RecordPreview({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState('Details');
  const state = useRemote(
    async () => ({
      record: await api.instruments.getById(id),
      history: await api.instruments.history(id),
    }),
    [id],
  );
  const record = state.data?.record;
  return (
    <aside
      className="card-notion sticky top-4"
      aria-label="Selected instrument preview"
    >
      <div className="flex items-center justify-between gap-2 mb-4">
        <FolderOpen className="text-orange-600" size={18} />
        <h2 className="truncate flex-1">
          {record?.instrumentNumber || 'Instrument'}
        </h2>
        <button
          className="btn-ghost p-1"
          aria-label="Close preview"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex gap-3 border-b mb-4">
        {['Details', 'Timeline', 'Evidence'].map((value) => (
          <button
            key={value}
            className={`text-xs py-2 border-b-2 ${tab === value ? 'border-orange-600 text-orange-700' : 'border-transparent text-slate-500'}`}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {value}
          </button>
        ))}
      </div>
      <Feedback state={state} />
      {record && (
        <>
          {tab === 'Details' && (
            <div className="space-y-3 text-xs">
              <p className="text-slate-500">{record.institution.name}</p>
              <StatusBadge status={record.lifecycleStatus} type="lifecycle" />
              <dl className="grid grid-cols-2 gap-y-3">
                <dt className="text-slate-500">Bank</dt>
                <dd>{record.bankName}</dd>
                <dt className="text-slate-500">Amount</dt>
                <dd>{money(record.amount)}</dd>
                <dt className="text-slate-500">Maturity</dt>
                <dd>{record.maturityDate}</dd>
                <dt className="text-slate-500">Date status</dt>
                <dd>
                  <StatusBadge status={record.dateStatus} type="date" />
                </dd>
                <dt className="text-slate-500">Renewal</dt>
                <dd>{record.renewalStatus}</dd>
              </dl>
              <p className="text-slate-500">{record.purpose}</p>
            </div>
          )}
          {tab === 'Timeline' && (
            <ol className="timeline">
              {state.data?.history.auditEvents.slice(0, 6).map((event) => (
                <li key={event.id}>
                  <p className="text-xs font-medium">
                    {event.action.split('_').join(' ').toLowerCase()}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {formatDate(event.timestamp)}
                  </p>
                </li>
              ))}
            </ol>
          )}
          {tab === 'Evidence' && (
            <div className="space-y-3">
              {record.documents.map((doc) => (
                <div key={doc.id} className="text-xs border-b pb-2">
                  <a
                    className="text-orange-700 underline break-all"
                    href={api.documents.downloadUrl(doc.id)}
                  >
                    {doc.originalFilename}
                  </a>
                  <p className="text-slate-400 mt-1">
                    Version {doc.version || 1} ·{' '}
                    {doc.isSuperseded ? 'Superseded' : 'Current'}
                  </p>
                </div>
              ))}
              {!record.documents.length && (
                <p className="empty-state">No evidence attached.</p>
              )}
            </div>
          )}
          <Link to={`/instruments/${id}`} className="btn-primary w-full mt-5">
            Open full record
          </Link>
        </>
      )}
    </aside>
  );
}
