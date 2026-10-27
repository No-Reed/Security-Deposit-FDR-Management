import React, { useState } from 'react';
import { api, apiClient } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  PageTitle,
  Feedback,
  Pager,
  useRemote,
  formatDate,
} from '../components/common/PageTools';
const roleNames = [
  'INSTITUTION_USER',
  'SCRUTINY_OFFICER',
  'APPROVING_AUTHORITY',
  'SYSTEM_ADMIN',
];
export const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('Reminders'),
    [page, setPage] = useState(1),
    [staff, setStaff] = useState(''),
    [temporary, setTemporary] = useState(''),
    [job, setJob] = useState('');
  const [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [role, setRole] = useState('INSTITUTION_USER'),
    [institutionId, setInstitutionId] = useState('');
  const state = useRemote(
    async () => ({
      users: (
        await apiClient.get('/admin/users', { params: { page, pageSize: 20 } })
      ).data,
      institutions: await api.admin.getInstitutions(),
      settings: await api.admin.getSystemSettings(),
      checklist: await api.admin.getChecklist(),
    }),
    [page],
  );
  const scopes = useRemote(
    async () => (staff ? api.admin.getScope(staff) : []),
    [staff],
  );
  const [checkLabel, setCheckLabel] = useState('');
  const [edit, setEdit] = useState<any>(null);
  if (user?.role !== 'SYSTEM_ADMIN')
    return (
      <p role="alert">
        Administration requires a system administrator account.
      </p>
    );
  const settings = state.data?.settings || [];
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow="SYSTEM GOVERNANCE"
        title="Administration"
        description="Manage demo accounts, institution access, reminder thresholds and policy checklists. Business decisions remain with authorized officers."
      />
      <Feedback state={state} />
      <nav
        className="flex flex-wrap gap-2 border-b"
        aria-label="Administration sections"
      >
        {['Reminders', 'Users', 'Institution access', 'Release checklist'].map(
          (value) => (
            <button
              key={value}
              aria-pressed={tab === value}
              className={`px-3 py-2 text-sm border-b-2 ${tab === value ? 'border-orange-600 text-orange-700' : 'border-transparent text-slate-500'}`}
              onClick={() => setTab(value)}
            >
              {value}
            </button>
          ),
        )}
      </nav>
      {tab === 'Reminders' && (
        <div className="grid xl:grid-cols-[1.3fr_1fr] gap-5">
          <section className="card-notion space-y-4">
            <h2>Monitoring configuration</h2>
            {settings
              .filter((item: any) =>
                [
                  'maturityAlertDays',
                  'escalationDays',
                  'escalationRepeatDays',
                ].includes(item.key),
              )
              .map((item: any) => (
                <form
                  key={`${item.key}-${item.updatedAt}`}
                  className="flex flex-wrap gap-2 items-end"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const value = String(
                      new FormData(event.currentTarget).get('value'),
                    );
                    state.act(
                      () => api.admin.updateSystemSetting(item.key, value),
                      'Reminder setting saved. Future reads and job runs use the new value.',
                    );
                  }}
                >
                  <label className="text-sm flex-1">
                    {item.key === 'maturityAlertDays'
                      ? 'Reminder thresholds (days, comma separated)'
                      : item.key === 'escalationDays'
                        ? 'Escalate after overdue days'
                        : 'Repeat escalation every days'}
                    <input
                      className="input-notion"
                      name="value"
                      defaultValue={item.value}
                      required
                    />
                  </label>
                  <button className="btn-outline" disabled={state.busy}>
                    Save
                  </button>
                </form>
              ))}
            <p className="text-xs text-slate-500">
              Other deployment settings are read-only here. Timezone:
              Asia/Kolkata. Reminders go to institution users and scoped
              officers; overdue escalations go to scoped officers and
              authorities.
            </p>
          </section>
          <section className="card-notion space-y-4">
            <h2>Run monitoring check</h2>
            <p className="text-sm text-slate-500">
              Evaluate current deadlines now. Repeated runs use unique
              notification keys and do not duplicate the same reminder or
              escalation.
            </p>
            <button
              className="btn-primary"
              disabled={state.busy}
              onClick={() =>
                state.act(async () => {
                  const result = await api.admin.triggerMaturityCheck();
                  setJob(
                    `${result.checked} instruments checked · ${result.notificationsCreated} reminders · ${result.escalations} escalations created`,
                  );
                }, 'Monitoring check completed.')
              }
            >
              Run maturity check
            </button>
            {job && (
              <p role="status" className="notice notice-success">
                {job}
              </p>
            )}
            <p className="text-xs text-slate-400">
              The scheduled job runs daily at 06:00 in India. In-app delivery
              only.
            </p>
          </section>
        </div>
      )}
      {tab === 'Users' && (
        <div className="space-y-5">
          {edit && (
            <form
              className="card-notion space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (
                  window.confirm(
                    'Save this account role and institution mapping? Existing sessions immediately use the updated access.',
                  )
                )
                  state.act(async () => {
                    await api.admin.updateUser(edit.id, {
                      name: edit.name,
                      email: edit.email,
                      role: edit.role,
                      institutionId:
                        edit.role === 'INSTITUTION_USER'
                          ? edit.institutionId
                          : null,
                    });
                    setEdit(null);
                  }, 'Account details saved.');
              }}
            >
              <h2>Edit account</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <label>
                  Name
                  <input
                    className="input-notion"
                    required
                    minLength={2}
                    value={edit.name}
                    onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                  />
                </label>
                <label>
                  Email
                  <input
                    className="input-notion"
                    required
                    type="email"
                    value={edit.email}
                    onChange={(e) =>
                      setEdit({ ...edit, email: e.target.value })
                    }
                  />
                </label>
                <label>
                  Role
                  <select
                    className="input-notion"
                    value={edit.role}
                    disabled={edit.id === user.id}
                    onChange={(e) => setEdit({ ...edit, role: e.target.value })}
                  >
                    {roleNames.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                {edit.role === 'INSTITUTION_USER' && (
                  <label>
                    Institution
                    <select
                      className="input-notion"
                      required
                      value={edit.institutionId || ''}
                      onChange={(e) =>
                        setEdit({ ...edit, institutionId: e.target.value })
                      }
                    >
                      <option value="">Choose institution</option>
                      {state.data?.institutions.data
                        .filter((item: any) => item.isActive)
                        .map((item: any) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Staff institution access is managed in the Institution access
                section.
              </p>
              <div className="flex gap-2">
                <button className="btn-primary" disabled={state.busy}>
                  Save account
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setEdit(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          <form
            className="card-notion space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              state.act(async () => {
                const created = await api.admin.createUser({
                  name,
                  email,
                  role,
                  institutionId:
                    role === 'INSTITUTION_USER' ? institutionId : null,
                });
                setTemporary(created.temporaryPassword);
                setName('');
                setEmail('');
              }, 'User created. Copy the temporary password below.');
            }}
          >
            <h2>Create account</h2>
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <label className="text-sm">
                Name
                <input
                  required
                  minLength={2}
                  className="input-notion"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="text-sm">
                Email
                <input
                  required
                  type="email"
                  className="input-notion"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="text-sm">
                Role
                <select
                  className="input-notion"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  {roleNames.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              {role === 'INSTITUTION_USER' && (
                <label className="text-sm">
                  Institution
                  <select
                    required
                    className="input-notion"
                    value={institutionId}
                    onChange={(e) => setInstitutionId(e.target.value)}
                  >
                    <option value="">Choose institution</option>
                    {state.data?.institutions.data
                      .filter((item: any) => item.isActive)
                      .map((item: any) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                </label>
              )}
            </div>
            <button className="btn-primary" disabled={state.busy}>
              Create user
            </button>
          </form>
          {temporary && (
            <div
              role="status"
              className="notice border-amber-200 bg-amber-50 text-amber-900"
            >
              <p className="font-semibold">
                Temporary password — shown once in this view
              </p>
              <p className="font-mono break-all mt-2 select-all">{temporary}</p>
              <p className="text-xs mt-2">
                Share through your authorized local demo process. It is never
                written to audit records.
              </p>
              <button
                className="underline mt-2 text-xs"
                onClick={() => setTemporary('')}
              >
                Dismiss password
              </button>
            </div>
          )}
          <div className="card-notion overflow-x-auto p-0">
            <table className="table-notion">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role / institution</th>
                  <th>Last login</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {state.data?.users.data.map((item: any) => (
                  <tr key={item.id}>
                    <td>
                      {item.name}
                      <p className="text-xs text-slate-500">{item.email}</p>
                    </td>
                    <td>
                      {item.role.split('_').join(' ')}
                      <p className="text-xs text-slate-500">
                        {item.institution?.name || 'Staff access mapping'}
                      </p>
                    </td>
                    <td>{formatDate(item.lastLoginAt)}</td>
                    <td>{item.isActive ? 'Active' : 'Inactive'}</td>
                    <td>
                      <button
                        className="text-orange-700 mr-3"
                        onClick={() => setEdit({ ...item })}
                      >
                        Edit
                      </button>
                      <button
                        className="text-orange-700"
                        disabled={state.busy || item.id === user.id}
                        onClick={() => {
                          if (
                            window.confirm(
                              `${item.isActive ? 'Disable' : 'Activate'} this account?`,
                            )
                          )
                            state.act(
                              () =>
                                api.admin.updateUser(item.id, {
                                  isActive: !item.isActive,
                                }),
                              'Account status saved.',
                            );
                        }}
                      >
                        {item.isActive ? 'Disable' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager
            page={page}
            total={state.data?.users.total || 0}
            onChange={setPage}
            disabled={state.loading}
          />
        </div>
      )}
      {tab === 'Institution access' && (
        <section className="card-notion space-y-4">
          <h2>Staff institution scope</h2>
          <p className="text-xs text-slate-500">
            Only selected institutions are visible to this officer or authority.
            Institution users remain mapped to their own institution.
          </p>
          <label className="block text-sm">
            Staff account
            <select
              className="input-notion"
              value={staff}
              onChange={(e) => setStaff(e.target.value)}
            >
              <option value="">Choose staff account from this user page</option>
              {state.data?.users.data
                .filter((item: any) =>
                  ['SCRUTINY_OFFICER', 'APPROVING_AUTHORITY'].includes(
                    item.role,
                  ),
                )
                .map((item: any) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <Feedback state={scopes} />
          {staff &&
            state.data?.institutions.data.map((item: any) => (
              <label
                key={item.id}
                className="flex items-center gap-3 border-b py-2 text-sm"
              >
                <input
                  type="checkbox"
                  className="accent-orange-700"
                  checked={Boolean(
                    scopes.data?.some(
                      (scope: any) => scope.institutionId === item.id,
                    ),
                  )}
                  disabled={scopes.busy || scopes.loading}
                  onChange={(event) =>
                    scopes.act(
                      () =>
                        event.target.checked
                          ? api.admin.addScope(staff, item.id)
                          : api.admin.removeScope(staff, item.id),
                      'Institution access saved.',
                    )
                  }
                />
                {item.name}
              </label>
            ))}
        </section>
      )}
      {tab === 'Release checklist' && (
        <section className="space-y-4">
          <div className="notice border-orange-200 bg-orange-50 text-orange-900">
            Demo policy configuration. Changes apply to newly created requests;
            existing requests preserve their captured checklist.
          </div>
          <form
            className="card-notion flex flex-wrap gap-3 items-end"
            onSubmit={(event) => {
              event.preventDefault();
              state.act(async () => {
                await api.admin.createChecklistItem({
                  label: checkLabel,
                  isRequired: true,
                  isActive: true,
                  sortOrder: (state.data?.checklist.length || 0) + 1,
                });
                setCheckLabel('');
              }, 'Checklist item added.');
            }}
          >
            <label className="text-sm flex-1">
              New required item
              <input
                className="input-notion"
                required
                value={checkLabel}
                onChange={(e) => setCheckLabel(e.target.value)}
              />
            </label>
            <button
              className="btn-primary"
              disabled={state.busy || !checkLabel.trim()}
            >
              Add item
            </button>
          </form>
          {state.data?.checklist.map((item: any) => (
            <form
              key={`${item.id}-${item.updatedAt}`}
              className="card-notion flex flex-wrap gap-3 items-end"
              onSubmit={(event) => {
                event.preventDefault();
                const values = new FormData(event.currentTarget);
                state.act(
                  () =>
                    api.admin.updateChecklistItem(item.id, {
                      label: String(values.get('label')),
                      sortOrder: Number(values.get('sortOrder')),
                      isRequired: values.has('isRequired'),
                      isActive: values.has('isActive'),
                    }),
                  'Checklist item saved.',
                );
              }}
            >
              <label className="text-sm flex-1 min-w-[160px]">
                Label
                <input
                  className="input-notion"
                  name="label"
                  required
                  defaultValue={item.label}
                />
              </label>
              <label className="text-sm w-20">
                Order
                <input
                  className="input-notion"
                  type="number"
                  name="sortOrder"
                  required
                  defaultValue={item.sortOrder}
                />
              </label>
              <label className="text-sm flex gap-2 items-center py-2">
                <input
                  type="checkbox"
                  name="isRequired"
                  defaultChecked={item.isRequired}
                />
                Required
              </label>
              <label className="text-sm flex gap-2 items-center py-2">
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked={item.isActive}
                />
                Active
              </label>
              <button className="btn-outline" disabled={state.busy}>
                Save
              </button>
            </form>
          ))}
        </section>
      )}
    </div>
  );
};
