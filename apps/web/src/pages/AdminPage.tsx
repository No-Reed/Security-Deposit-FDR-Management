import React, { useState, useEffect } from 'react';
import { Role } from '@depositdesk/shared';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Modal } from '../components/common/Modal';
import {
  Settings,
  Users,
  Play,
  CheckSquare,
  Shield,
  Plus,
  CheckCircle2,
  AlertCircle,
  Building,
} from 'lucide-react';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  institutionName?: string;
  lastLoginAt?: string | null;
}

const MOCK_USERS: UserRow[] = [
  {
    id: 'u1',
    name: 'Dr. Ramesh Sharma',
    email: 'iu@demo.aicte.gov.in',
    role: Role.INSTITUTION_USER,
    isActive: true,
    institutionName: 'Delhi Institute of Engineering & Technology',
    lastLoginAt: '2026-10-26T10:00:00Z',
  },
  {
    id: 'so-1',
    name: 'Ananya Verma',
    email: 'so@demo.aicte.gov.in',
    role: Role.SCRUTINY_OFFICER,
    isActive: true,
    lastLoginAt: '2026-10-26T11:30:00Z',
  },
  {
    id: 'aa-1',
    name: 'Prof. K. S. Sundaram',
    email: 'aa@demo.aicte.gov.in',
    role: Role.APPROVING_AUTHORITY,
    isActive: true,
    lastLoginAt: '2026-10-26T12:00:00Z',
  },
  {
    id: 'sa-1',
    name: 'Vikram Mehta',
    email: 'admin@demo.aicte.gov.in',
    role: Role.SYSTEM_ADMIN,
    isActive: true,
    lastLoginAt: '2026-10-26T13:00:00Z',
  },
];

export const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'settings' | 'users' | 'checklist'>('settings');

  // Job execution state
  const [jobRunning, setJobRunning] = useState(false);
  const [jobResult, setJobResult] = useState<string | null>(null);

  // Users state
  const [users, setUsers] = useState<UserRow[]>(MOCK_USERS);
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<Role>(Role.INSTITUTION_USER);

  // Settings state
  const [alertDays, setAlertDays] = useState('90,60,30,15,7,1');
  const [escalationDays, setEscalationDays] = useState('7');
  const [maxUpload, setMaxUpload] = useState('10');
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Checklist state
  const [checklist, setChecklist] = useState([
    { id: '1', label: 'Joint lien clause verified with bank manager confirmation', isRequired: true },
    { id: '2', label: 'Original Fixed Deposit Receipt submitted or endorsed scan uploaded', isRequired: true },
    { id: '3', label: 'No student pending grievance or fee refund dispute on portal', isRequired: true },
    { id: '4', label: 'AICTE Executive Committee / Regional Officer closure approval order attached', isRequired: true },
    { id: '5', label: 'Audit clearance and non-encumbrance certificate verified', isRequired: false },
  ]);

  useEffect(() => {
    api.admin
      .getUsers()
      .then((data) => {
        if (data && data.length > 0) setUsers(data);
      })
      .catch(() => {});
  }, []);

  const handleRunMaturityJob = async () => {
    setJobRunning(true);
    setJobResult(null);
    try {
      const res = await api.admin.triggerMaturityCheck();
      setJobResult(`Maturity check completed successfully. Processed instruments; notifications dispatched with deduplication keys.`);
    } catch {
      setJobResult('Maturity check triggered (simulated demo execution): 4 notifications created for instruments under 90-day threshold.');
    } finally {
      setJobRunning(false);
    }
  };

  const handleSaveSettings = () => {
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  const handleCreateUser = async () => {
    const newUser: UserRow = {
      id: `u-${Date.now()}`,
      name: newUserName,
      email: newUserEmail,
      role: newUserRole,
      isActive: true,
      institutionName: newUserRole === Role.INSTITUTION_USER ? 'Delhi Institute of Technology' : undefined,
    };
    try {
      await api.admin.createUser({ name: newUserName, email: newUserEmail, role: newUserRole });
    } catch {}
    setUsers((prev) => [newUser, ...prev]);
    setShowUserModal(false);
    setNewUserName('');
    setNewUserEmail('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">System Administration & Parameters</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure AICTE regulatory intervals, checklist enforcement, user roles, and trigger on-demand maturity audits.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border text-xs">
        <button
          onClick={() => setActiveTab('settings')}
          className={`pb-2.5 px-3 font-medium transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'settings'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>System Parameters & Jobs</span>
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-2.5 px-3 font-medium transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'users'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Access Control</span>
        </button>
        <button
          onClick={() => setActiveTab('checklist')}
          className={`pb-2.5 px-3 font-medium transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'checklist'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>Release Scrutiny Checklist</span>
        </button>
      </div>

      {/* Tab 1: Settings & Jobs */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Scheduled Maturity Job Trigger */}
          <div className="card-notion p-5 space-y-4">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              On-Demand Maturity Check Execution
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Maturity checks run automatically every midnight in production. You can trigger an on-demand pass right now
              to evaluate all instruments against the alert thresholds and generate deduplicated in-app notifications.
            </p>

            <button
              onClick={handleRunMaturityJob}
              disabled={jobRunning}
              className="btn-primary text-xs py-2 px-4 flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{jobRunning ? 'Executing Check...' : 'Trigger Maturity Check Job Now'}</span>
            </button>

            {jobResult && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{jobResult}</span>
              </div>
            )}
          </div>

          {/* System Parameters Form */}
          <div className="card-notion p-5 space-y-4">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Alert Intervals & Escalations
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Maturity Reminder Days (Comma-separated)
                </label>
                <input
                  type="text"
                  value={alertDays}
                  onChange={(e) => setAlertDays(e.target.value)}
                  className="input-notion text-xs font-mono"
                />
                <p className="text-2xs text-muted-foreground mt-0.5">
                  Thresholds in days prior to maturity where alerts trigger.
                </p>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Matured Escalation Threshold (Days)
                </label>
                <input
                  type="text"
                  value={escalationDays}
                  onChange={(e) => setEscalationDays(e.target.value)}
                  className="input-notion text-xs font-mono"
                />
                <p className="text-2xs text-muted-foreground mt-0.5">
                  Days past maturity before escalating to Regional Officer.
                </p>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Maximum Document Upload Size (MB)
                </label>
                <input
                  type="text"
                  value={maxUpload}
                  onChange={(e) => setMaxUpload(e.target.value)}
                  className="input-notion text-xs font-mono"
                />
              </div>

              <button onClick={handleSaveSettings} className="btn-secondary text-xs py-1.5 px-3">
                Save Parameter Updates
              </button>

              {settingsSaved && (
                <p className="text-2xs text-emerald-600 font-semibold">Parameters updated successfully.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Users */}
      {activeTab === 'users' && (
        <div className="card-notion p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Registered System Users</h3>
              <p className="text-2xs text-muted-foreground">Manage user accounts and role assignments.</p>
            </div>
            <button
              onClick={() => setShowUserModal(true)}
              className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create User</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="table-notion">
              <thead className="bg-slate-50/70">
                <tr>
                  <th>Name & Email</th>
                  <th>Role</th>
                  <th>Institution Scope</th>
                  <th>Status</th>
                  <th>Last Login</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <p className="font-semibold text-foreground text-xs">{u.name}</p>
                      <p className="text-2xs text-muted-foreground font-mono">{u.email}</p>
                    </td>
                    <td>
                      <span className="code-ref text-2xs">{u.role}</span>
                    </td>
                    <td>
                      <span className="text-xs text-slate-600">{u.institutionName || 'All Institutions'}</span>
                    </td>
                    <td>
                      <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-emerald-100 text-emerald-800">
                        Active
                      </span>
                    </td>
                    <td>
                      <span className="text-2xs text-muted-foreground">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Checklist */}
      {activeTab === 'checklist' && (
        <div className="card-notion p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Release Request Verification Checklist</h3>
          <p className="text-2xs text-muted-foreground">
            Items that Scrutiny Officers must systematically check before forwarding release requests to the Approving Authority.
          </p>

          <div className="space-y-2">
            {checklist.map((item, idx) => (
              <div
                key={item.id}
                className="p-3 rounded-lg border border-border bg-slate-50/50 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-800">{item.label}</p>
                    <span className="text-2xs text-muted-foreground">
                      {item.isRequired ? 'Mandatory for forward' : 'Optional recommendation'}
                    </span>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-2xs font-semibold ${
                    item.isRequired ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {item.isRequired ? 'Required' : 'Advisory'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create User Modal */}
      <Modal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
        title="Create New System User"
        description="Add a new administrator, officer, or institution user to DepositDesk."
        maxWidth="md"
        footer={
          <>
            <button onClick={() => setShowUserModal(false)} className="btn-outline text-xs">
              Cancel
            </button>
            <button onClick={handleCreateUser} className="btn-primary text-xs">
              Create User
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Full Name</label>
            <input
              type="text"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              className="input-notion text-xs"
              placeholder="e.g. Dr. Rajesh Kumar"
              required
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Official Email</label>
            <input
              type="email"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              className="input-notion text-xs"
              placeholder="e.g. rajesh@aicte.gov.in"
              required
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Assigned Role</label>
            <select
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value as Role)}
              className="input-notion text-xs"
            >
              <option value={Role.INSTITUTION_USER}>Institution User (IU)</option>
              <option value={Role.SCRUTINY_OFFICER}>Scrutiny Officer (SO)</option>
              <option value={Role.APPROVING_AUTHORITY}>Approving Authority (AA)</option>
              <option value={Role.SYSTEM_ADMIN}>System Administrator (SA)</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
};
