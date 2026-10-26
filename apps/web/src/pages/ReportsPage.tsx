import React from 'react';
import { api } from '../lib/api';
import {
  FileSpreadsheet,
  Download,
  ShieldCheck,
  Calendar,
  History,
  FileCheck2,
  Lock,
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const reports = [
    {
      title: 'Complete FDR & Deposit Registry',
      description: 'Full dump of all registered instruments, institutions, bank branches, principal amounts, and current compliance states.',
      icon: FileSpreadsheet,
      endpoint: api.reports.exportInstrumentsCsv(),
      format: 'CSV (.csv)',
      fields: 'Instrument #, Type, Institution, Bank, Branch, Amount, Currency, Issue Date, Maturity Date, Lifecycle Status, Date Status, Verification Status',
    },
    {
      title: 'Maturity Alert & Expiration Schedule',
      description: 'Schedule of upcoming maturities categorized into 90, 60, 30, 15, 7, and 1 day alert thresholds, plus matured instruments.',
      icon: Calendar,
      endpoint: api.reports.exportMaturitiesCsv(),
      format: 'CSV (.csv)',
      fields: 'Instrument #, Institution, Bank, Amount, Maturity Date, Days Remaining, Action Required',
    },
    {
      title: 'Audit Trail & Compliance Events Log',
      description: 'Complete append-only audit trail capturing all user logins, scrutiny outcomes, state changes, and administrative actions.',
      icon: History,
      endpoint: api.reports.exportAuditEventsCsv(),
      format: 'CSV (.csv)',
      fields: 'Event ID, Timestamp, Actor Name, Actor Role, Action, Entity Type, Entity ID, IP Address',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Compliance Reports & Export Center</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Generate sanitized CSV reports with built-in spreadsheet formula injection defense (RFC 4180 compliant).
        </p>
      </div>

      {/* Security Note Banner */}
      <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/60 flex items-start gap-3 text-xs text-blue-900">
        <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-blue-950">Formula Injection Neutralization Active</p>
          <p className="leading-relaxed text-blue-800">
            Per OWASP & AICTE specifications, all exported string values beginning with symbols (=, +, -, @, \t, \r) are
            automatically sanitized with leading apostrophes to protect spreadsheet viewers from CSV command execution attacks.
          </p>
        </div>
      </div>

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <div
              key={report.title}
              className="card-notion p-5 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow"
            >
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{report.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{report.description}</p>
                </div>

                <div className="pt-2 border-t border-border/60 space-y-1 text-2xs text-muted-foreground">
                  <p className="font-semibold text-slate-700">Included Fields:</p>
                  <p className="line-clamp-2 leading-relaxed">{report.fields}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-between">
                <span className="text-2xs font-mono font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  {report.format}
                </span>
                <a
                  href={report.endpoint}
                  download
                  className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download CSV</span>
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
