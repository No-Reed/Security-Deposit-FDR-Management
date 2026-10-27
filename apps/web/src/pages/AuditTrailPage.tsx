import React, { useState } from 'react';
import { apiClient } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  PageTitle,
  useRemote,
  Feedback,
  Pager,
  formatDate,
} from '../components/common/PageTools';
export const AuditTrailPage: React.FC = () => {
  const { user } = useAuth();
  const [action, setAction] = useState(''),
    [entity, setEntity] = useState(''),
    [page, setPage] = useState(1);
  const state = useRemote(
    async () =>
      (
        await apiClient.get('/audit-events', {
          params: {
            page,
            pageSize: 20,
            action: action || undefined,
            entityType: entity || undefined,
          },
        })
      ).data,
    [page, action, entity, user?.id],
  );
  if (user?.role === 'INSTITUTION_USER')
    return (
      <p role="alert">
        Global audit records are available to authorized staff. Use an
        instrument's history for your own cases.
      </p>
    );
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow="TRACEABILITY"
        title="Audit trail"
        description="Append-only history of authorized actions. Staff results are restricted to their current institution scope."
      >
        <a className="btn-outline" href="/api/v1/reports/audit-events.csv">
          Export CSV
        </a>
      </PageTitle>
      <Feedback state={state} />
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm">
          Action
          <input
            className="input-notion"
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setPage(1);
            }}
            placeholder="Search action name"
          />
        </label>
        <label className="text-sm">
          Record type
          <select
            className="input-notion"
            value={entity}
            onChange={(event) => {
              setEntity(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All types</option>
            {[
              'Instrument',
              'Document',
              'Verification',
              'Discrepancy',
              'ReleaseRequest',
              'Institution',
              'User',
              'SystemSetting',
              'Report',
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
              <th>Time (India)</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Record type</th>
              <th>Reason / changes</th>
            </tr>
          </thead>
          <tbody>
            {state.data?.data.map((event: any) => (
              <tr key={event.id}>
                <td className="whitespace-nowrap">
                  {formatDate(event.timestamp)}
                </td>
                <td>{event.actor?.name || 'System'}</td>
                <td className="font-medium">
                  {event.action.split('_').join(' ').toLowerCase()}
                </td>
                <td>{event.entityType}</td>
                <td>
                  <p>{event.reason || '—'}</p>
                  {event.changedFields && (
                    <details className="mt-1">
                      <summary className="text-orange-700 cursor-pointer text-xs">
                        Change details
                      </summary>
                      <dl className="text-xs space-y-1 mt-2">
                        {Object.entries(event.changedFields).map(
                          ([key, value]) => (
                            <div key={key}>
                              <dt className="text-slate-500">{key}</dt>
                              <dd className="break-all">
                                {typeof value === 'object'
                                  ? JSON.stringify(value)
                                  : String(value ?? '')}
                              </dd>
                            </div>
                          ),
                        )}
                      </dl>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!state.loading && !state.data?.data.length && (
          <p className="empty-state">No matching audit events.</p>
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
};
