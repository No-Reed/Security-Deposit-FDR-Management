import React from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  PageTitle,
  Feedback,
  useRemote,
  money,
  formatDate,
} from '../components/common/PageTools';
import { StatusBadge } from '../components/common/StatusBadge';
import { ArrowUpRight, Clock3, FileCheck2, Landmark } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const state = useRemote(
    async () => ({
      summary: await api.dashboard.getSummary(),
      upcoming: await api.dashboard.getUpcomingMaturities(),
    }),
    [user?.id],
  );
  const summary = state.data?.summary;
  const cards = summary
    ? [
        ['Registered instruments', summary.totalInstruments, '/instruments'],
        [
          'Active by date',
          summary.activeCount,
          '/instruments?dateStatus=ACTIVE&monitoring=true',
        ],
        [
          'Approaching deadline',
          summary.expiringSoonCount,
          '/maturities?dateStatus=EXPIRING_SOON&monitoring=true',
        ],
        [
          'Matured / expired',
          summary.maturedCount + summary.expiredCount,
          '/maturities?overdue=true&monitoring=true',
        ],
        [
          'Awaiting scrutiny',
          summary.pendingVerificationCount,
          '/instruments?awaitingVerification=true',
        ],
        [
          'Open discrepancies',
          summary.discrepancyCount,
          '/discrepancies?status=UNRESOLVED',
        ],
        [
          'Renewal actions',
          summary.renewalPendingCount,
          '/renewals?renewals=pending',
        ],
        [
          'Pending releases',
          summary.openReleaseRequestsCount,
          '/releases?open=true',
        ],
      ]
    : [];
  return (
    <div className="space-y-6">
      <PageTitle
        eyebrow="WORKSPACE OVERVIEW"
        title="Deposit dashboard"
        description="A clear view of instruments, evidence and the next actions in your permitted scope."
      >
        {user?.role === 'INSTITUTION_USER' && (
          <Link className="btn-primary" to="/instruments/new">
            Register instrument
          </Link>
        )}
      </PageTitle>
      <Feedback state={state} />
      {summary && (
        <>
          <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {cards.map(([label, value, url]) => (
              <Link to={String(url)} key={label} className="metric-card group">
                <span className="flex justify-between text-xs font-medium text-slate-500">
                  {label}
                  <ArrowUpRight
                    size={15}
                    className="text-slate-300 group-hover:text-orange-600"
                  />
                </span>
                <strong className="block mt-3 text-3xl tracking-tight">
                  {value}
                </strong>
              </Link>
            ))}
          </section>
          <div className="flex flex-wrap items-center gap-3 text-sm bg-white border rounded-lg px-4 py-3">
            <Landmark className="text-orange-600" size={18} />
            <span className="text-slate-500">
              Registered value, including historical instruments
            </span>
            <strong>{money(summary.totalValue)}</strong>
            <span className="ml-auto text-xs text-slate-500">
              Reminder thresholds: {summary.thresholds.join(' / ')} days
            </span>
          </div>
          <div className="grid xl:grid-cols-[1.5fr_1fr] gap-5">
            <section className="card-notion">
              <div className="section-header">
                <h2 className="flex gap-2 items-center">
                  <Clock3 size={18} className="text-orange-600" />
                  Upcoming deadlines
                </h2>
                <Link className="text-sm text-orange-700" to="/maturities">
                  View all →
                </Link>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
                {Object.entries(state.data!.upcoming.totals).map(
                  ([bucket, count]) => (
                    <Link
                      key={bucket}
                      className="rounded border bg-slate-50 p-3 text-sm"
                      to={
                        ['matured', 'expired'].includes(bucket)
                          ? `/maturities?dateStatus=${bucket.toUpperCase()}&monitoring=true`
                          : `/maturities?daysFrom=${bucket.split('-')[0]}&daysTo=${bucket.split('-')[1]}&monitoring=true`
                      }
                    >
                      <span className="block text-xs text-slate-500">
                        {['matured', 'expired'].includes(bucket)
                          ? bucket
                          : bucket + ' days'}
                      </span>
                      <strong className="text-xl">{count}</strong>
                    </Link>
                  ),
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="table-notion">
                  <thead>
                    <tr>
                      <th>Instrument</th>
                      <th>Deadline</th>
                      <th>Date status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(state.data!.upcoming.buckets)
                      .flat()
                      .slice(0, 5)
                      .map((record) => (
                        <tr key={record.id}>
                          <td>
                            <Link
                              className="text-orange-700 font-medium"
                              to={`/instruments/${record.id}`}
                            >
                              {record.instrumentNumber}
                            </Link>
                            <p className="text-xs text-slate-500">
                              {record.institutionName}
                            </p>
                          </td>
                          <td>
                            {record.validityEndDate || record.maturityDate}
                          </td>
                          <td>
                            <StatusBadge
                              status={record.dateStatus}
                              type="date"
                            />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {!Object.values(state.data!.upcoming.buckets).flat().length && (
                <p className="empty-state">
                  No deadlines in the displayed window.
                </p>
              )}
            </section>
            <section className="card-notion">
              <h2 className="flex gap-2 items-center mb-4">
                <FileCheck2 size={18} className="text-orange-600" />
                Workflow distribution
              </h2>
              {Object.entries(summary.distribution).map(([status, count]) => (
                <div
                  key={status}
                  className="flex justify-between items-center py-2 border-b border-slate-100"
                >
                  <StatusBadge status={status} type="lifecycle" />
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </section>
          </div>
          <section className="card-notion">
            <h2 className="mb-3">Record quality & follow-up</h2>
            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              <p>
                <strong className="text-xl block">
                  {summary.quality.recordsWithEvidence}
                </strong>
                <span className="text-slate-500 text-xs">
                  Records with evidence
                </span>
              </p>
              <p>
                <strong className="text-xl block">
                  {summary.quality.missingEvidence}
                </strong>
                <span className="text-slate-500 text-xs">
                  Non-draft records missing evidence
                </span>
              </p>
              <p>
                <strong className="text-xl block">
                  {summary.quality.unresolvedCases}
                </strong>
                <span className="text-slate-500 text-xs">
                  Cases requiring follow-up
                </span>
              </p>
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Indicators are computed from stored records, including synthetic
              demo history. They do not claim a measured reduction against real
              administrative processing.
            </p>
          </section>
          <section className="card-notion">
            <div className="section-header">
              <h2>Recent activity</h2>
              {user?.role !== 'INSTITUTION_USER' && (
                <Link className="text-sm text-orange-700" to="/audit">
                  Audit trail →
                </Link>
              )}
            </div>
            <ol className="timeline">
              {summary.recentActivity.map((event) => (
                <li key={event.id}>
                  <p className="text-sm font-medium">
                    {event.action.split('_').join(' ').toLowerCase()}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {event.actor?.name || 'System'} ·{' '}
                    {formatDate(event.timestamp)}
                  </p>
                </li>
              ))}
            </ol>
            {!summary.recentActivity.length && (
              <p className="empty-state">No activity to display.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
};
