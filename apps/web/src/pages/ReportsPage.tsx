import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { PageTitle } from '../components/common/PageTools';
import { Download, FileSpreadsheet } from 'lucide-react';
export const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const reports = [
    [
      'instruments',
      'Instrument register',
      'All permitted records and their separate lifecycle, date, verification, renewal and release states.',
    ],
    ['active', 'Active by date', 'Instruments whose date status is active.'],
    [
      'maturities',
      'Upcoming deadlines',
      'Instruments inside the saved warning window.',
    ],
    [
      'matured',
      'Matured & expired',
      'Date events that need review; maturity does not establish release eligibility.',
    ],
    [
      'pending-verification',
      'Awaiting scrutiny',
      'Submitted, resubmitted and under-review instruments.',
    ],
    [
      'discrepancies',
      'Open discrepancies',
      'Instruments with unresolved observations or institution responses.',
    ],
    [
      'renewals',
      'Pending renewals',
      'Replacement actions required or in progress.',
    ],
    [
      'pending-actions',
      'Pending actions',
      'A consolidated list of instruments requiring follow-up.',
    ],
    [
      'release-requests',
      'Release requests',
      'Permitted requests across the release workflow.',
    ],
    [
      'completed-releases',
      'Completed releases',
      'Administrative completion records and evidence references.',
    ],
    [
      'institutions',
      'Institution summary',
      'Instrument counts and registered values, including history.',
    ],
    [
      'audit-events',
      'Audit activity',
      'Traceable actions within your authorized scope.',
    ],
  ];
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow="MANAGEMENT INFORMATION"
        title="Reports & exports"
        description="Download scoped CSV reports from current database records. Every export is recorded in the audit trail."
      />
      <label className="block text-sm max-w-md">
        Instrument / institution search (instrument reports)
        <input
          className="input-notion"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Optional filter for instrument-based reports"
        />
      </label>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {reports
          .filter(
            ([kind]) =>
              kind !== 'audit-events' || user?.role !== 'INSTITUTION_USER',
          )
          .map(([kind, title, description]) => (
            <article key={kind} className="card-notion flex flex-col">
              <FileSpreadsheet className="text-orange-600 mb-4" size={23} />
              <h2>{title}</h2>
              <p className="text-xs text-slate-500 mt-2 mb-5 flex-1">
                {description}
              </p>
              <a
                className="btn-outline self-start"
                href={`/api/v1/reports/${kind}.csv${search ? '?search=' + encodeURIComponent(search) : ''}`}
              >
                <Download size={14} />
                Export CSV
              </a>
            </article>
          ))}
      </div>
      <p className="text-xs text-slate-500">
        Exports contain only records permitted by your role and institution
        scope. Spreadsheet formula prefixes are neutralized. PDF reporting is
        outside this prototype's required CSV workflow.
      </p>
    </div>
  );
};
