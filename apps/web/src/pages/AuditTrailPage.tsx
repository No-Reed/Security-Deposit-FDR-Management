import React, { useState, useEffect } from 'react';
import { Role } from '@depositdesk/shared';
import { api, AuditEventItem } from '../lib/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import {
  History,
  Shield,
  Search,
  Filter,
  Lock,
  Calendar,
  FileCode,
  User,
  ArrowRight,
} from 'lucide-react';

const MOCK_AUDIT_EVENTS: AuditEventItem[] = [
  {
    id: 'evt-1',
    actorUserId: 'u3',
    actorRole: Role.APPROVING_AUTHORITY,
    actorName: 'Prof. K. S. Sundaram (Regional Officer)',
    action: 'RELEASE_REQUEST_APPROVED',
    entityType: 'ReleaseRequest',
    entityId: 'rel-1',
    details: { reason: 'Tenure satisfied and student completion records verified.' },
    ipAddress: '192.168.1.104',
    createdAt: '2026-10-22T14:30:00Z',
  },
  {
    id: 'evt-2',
    actorUserId: 'so-1',
    actorRole: Role.SCRUTINY_OFFICER,
    actorName: 'Ananya Verma (Scrutiny Officer)',
    action: 'VERIFICATION_RECORDED',
    entityType: 'Instrument',
    entityId: 'fdr-101',
    details: {
      status: 'CONFIRMED_BY_AUTHORIZED_SOURCE',
      sourceName: 'SBI Connaught Place',
      referenceNumber: 'SBI/CP/AICTE/2023/V-8891',
    },
    ipAddress: '192.168.1.112',
    createdAt: '2026-10-20T11:15:00Z',
  },
  {
    id: 'evt-3',
    actorUserId: 'so-1',
    actorRole: Role.SCRUTINY_OFFICER,
    actorName: 'Ananya Verma (Scrutiny Officer)',
    action: 'DISCREPANCY_FLAGGED',
    entityType: 'Instrument',
    entityId: 'fdr-106',
    details: { code: 'DISC_LIEN_MISSING', severity: 'CRITICAL' },
    ipAddress: '192.168.1.112',
    createdAt: '2026-10-20T14:00:00Z',
  },
  {
    id: 'evt-4',
    actorUserId: 'u1',
    actorRole: Role.INSTITUTION_USER,
    actorName: 'Dr. Ramesh Sharma (Registrar)',
    action: 'INSTRUMENT_SUBMITTED',
    entityType: 'Instrument',
    entityId: 'fdr-105',
    details: { amount: '8000000.00', instrumentNumber: 'CAN-FDR-2024-5519' },
    ipAddress: '10.0.0.45',
    createdAt: '2026-10-18T09:40:00Z',
  },
  {
    id: 'evt-5',
    actorUserId: 'u1',
    actorRole: Role.INSTITUTION_USER,
    actorName: 'Dr. Ramesh Sharma (Registrar)',
    action: 'AUTH_LOGIN_SUCCESS',
    entityType: 'User',
    entityId: 'u1',
    details: { authMethod: 'session_cookie', mfa: 'exempt_demo' },
    ipAddress: '10.0.0.45',
    createdAt: '2026-10-18T09:35:00Z',
  },
];

export const AuditTrailPage: React.FC = () => {
  const [events, setEvents] = useState<AuditEventItem[]>(MOCK_AUDIT_EVENTS);
  const [selectedEvent, setSelectedEvent] = useState<AuditEventItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  useEffect(() => {
    api.audit
      .list()
      .then((res) => {
        if (res.data && res.data.length > 0) setEvents(res.data);
      })
      .catch(() => {
        // Fall back to synthetic data
      });
  }, []);

  const filtered = events.filter((e) => {
    if (actionFilter !== 'ALL' && e.action !== actionFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        e.action.toLowerCase().includes(q) ||
        (e.actorName && e.actorName.toLowerCase().includes(q)) ||
        e.entityType.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Immutable Audit Trail</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Tamper-evident system log capturing all authentication, verification, and workflow state transitions.
        </p>
      </div>

      {/* Security Immutability Alert */}
      <div className="p-4 rounded-xl bg-slate-900 text-white flex items-start gap-3 shadow-sm text-xs">
        <Lock className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-white">Database-Enforced Immutability</p>
          <p className="text-slate-300 leading-relaxed text-2xs">
            Audit events are written in the same database transaction as business operations.
            Records are append-only; update and delete operations are prohibited at both application and database engine levels.
          </p>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="card-notion p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search audit trail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-notion pl-9 text-xs"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="input-notion text-xs bg-white w-48"
          >
            <option value="ALL">All Actions</option>
            <option value="AUTH_LOGIN_SUCCESS">Login Success</option>
            <option value="INSTRUMENT_SUBMITTED">Instrument Submitted</option>
            <option value="VERIFICATION_RECORDED">Verification Recorded</option>
            <option value="DISCREPANCY_FLAGGED">Discrepancy Flagged</option>
            <option value="RELEASE_REQUEST_APPROVED">Release Approved</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card-notion p-0 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="table-notion">
            <thead className="bg-slate-50/70">
              <tr>
                <th>Timestamp (IST)</th>
                <th>Actor & Role</th>
                <th>Action</th>
                <th>Entity Affected</th>
                <th>IP Address</th>
                <th className="text-right">Payload</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((evt) => (
                <tr key={evt.id} className="hover:bg-slate-50/60 transition-colors">
                  <td>
                    <span className="font-mono text-xs text-muted-foreground">
                      {new Date(evt.createdAt).toLocaleString()}
                    </span>
                  </td>

                  <td>
                    <div className="space-y-0.5">
                      <p className="font-semibold text-foreground text-xs">{evt.actorName || 'System Process'}</p>
                      {evt.actorRole && (
                        <span className="code-ref text-2xs">{evt.actorRole}</span>
                      )}
                    </div>
                  </td>

                  <td>
                    <span className="font-mono font-bold text-xs text-slate-800">{evt.action}</span>
                  </td>

                  <td>
                    <span className="text-xs text-muted-foreground">
                      {evt.entityType} ({evt.entityId?.slice(0, 8)}...)
                    </span>
                  </td>

                  <td>
                    <span className="font-mono text-2xs text-slate-500">{evt.ipAddress || '127.0.0.1'}</span>
                  </td>

                  <td className="text-right">
                    <button
                      onClick={() => {
                        setSelectedEvent(evt);
                        setShowModal(true);
                      }}
                      className="btn-outline text-xs py-1 px-2.5"
                    >
                      View JSON
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details JSON Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Audit Event Payload Details"
        description={`Event ID: ${selectedEvent?.id}`}
        maxWidth="lg"
        footer={
          <button onClick={() => setShowModal(false)} className="btn-primary text-xs">
            Close
          </button>
        }
      >
        <div className="space-y-2">
          <pre className="p-4 bg-slate-950 text-emerald-400 font-mono text-xs rounded-lg overflow-x-auto leading-relaxed border border-slate-800">
            {JSON.stringify(selectedEvent, null, 2)}
          </pre>
        </div>
      </Modal>
    </div>
  );
};
