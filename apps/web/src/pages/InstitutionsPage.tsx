import React, { useState } from 'react';
import { apiClient } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  PageTitle,
  useRemote,
  Feedback,
  Pager,
} from '../components/common/PageTools';
const blank = {
  name: '',
  aicteId: '',
  institutionType: '',
  address: '',
  state: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  isActive: true,
};
export const InstitutionsPage: React.FC = () => {
  const { user } = useAuth();
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(''),
    [edit, setEdit] = useState<string | null>(null),
    [show, setShow] = useState(false),
    [form, setForm] = useState(blank);
  const state = useRemote(
    async () =>
      (
        await apiClient.get('/institutions', {
          params: { page, pageSize: 20, search: search || undefined },
        })
      ).data,
    [page, search],
  );
  const canEdit = ['SCRUTINY_OFFICER', 'SYSTEM_ADMIN'].includes(
    user?.role || '',
  );
  if (user?.role === 'INSTITUTION_USER')
    return (
      <p role="alert">
        Institution management is available to authorized staff.
      </p>
    );
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      ...form,
      aicteId: form.aicteId.trim() || null,
      contactPhone: form.contactPhone || null,
    };
    const ok = await state.act(
      () =>
        edit
          ? apiClient.patch(`/institutions/${edit}`, payload)
          : apiClient.post('/institutions', payload),
      'Institution saved.',
    );
    if (ok) {
      setShow(false);
      setEdit(null);
      setForm(blank);
    }
  };
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow="INSTITUTION REGISTER"
        title="Institutions"
        description="Institution identities, contacts and account status within your authorized scope."
      >
        {canEdit && (
          <button
            className="btn-primary"
            onClick={() => {
              setEdit(null);
              setForm(blank);
              setShow(!show);
            }}
          >
            New institution
          </button>
        )}
      </PageTitle>
      <Feedback state={state} />
      {show && canEdit && (
        <form className="card-notion space-y-4" onSubmit={save}>
          <h2>{edit ? 'Edit institution' : 'Register institution'}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {(
              [
                ['name', 'Institution name'],
                ['aicteId', 'Institution identifier (optional)'],
                ['institutionType', 'Institution type'],
                ['address', 'Address'],
                ['state', 'State'],
                ['contactName', 'Authorized contact'],
                ['contactEmail', 'Contact email'],
                ['contactPhone', 'Phone (optional)'],
              ] as const
            ).map(([key, label]) => (
              <label className="text-sm" key={key}>
                {label}
                <input
                  required={!['aicteId', 'contactPhone'].includes(key)}
                  type={key === 'contactEmail' ? 'email' : 'text'}
                  className="input-notion"
                  value={form[key]}
                  onChange={(event) =>
                    setForm({ ...form, [key]: event.target.value })
                  }
                />
              </label>
            ))}
          </div>
          {edit && (
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) =>
                  setForm({ ...form, isActive: event.target.checked })
                }
              />
              Institution active
            </label>
          )}
          <div className="flex gap-2">
            <button className="btn-primary" disabled={state.busy}>
              Save institution
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={() => setShow(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      <label className="block text-sm max-w-md">
        Search
        <input
          className="input-notion"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Name or institution identifier"
        />
      </label>
      <div className="card-notion p-0 overflow-x-auto">
        <table className="table-notion">
          <thead>
            <tr>
              <th>Institution</th>
              <th>Type / state</th>
              <th>Contact</th>
              <th>Status</th>
              <th>Instruments</th>
              {canEdit && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {state.data?.data.map((item: any) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.name}</strong>
                  <p className="text-xs text-slate-500">
                    {item.aicteId || 'Identifier not provided'}
                  </p>
                </td>
                <td>
                  {item.institutionType}
                  <p className="text-xs text-slate-500">{item.state}</p>
                </td>
                <td>
                  {item.contactName}
                  <p className="text-xs text-slate-500">{item.contactEmail}</p>
                </td>
                <td>{item.isActive ? 'Active' : 'Inactive'}</td>
                <td>{item._count.instruments}</td>
                {canEdit && (
                  <td>
                    <button
                      className="text-orange-700"
                      onClick={() => {
                        setEdit(item.id);
                        setForm({
                          ...blank,
                          ...item,
                          aicteId: item.aicteId || '',
                          contactPhone: item.contactPhone || '',
                        });
                        setShow(true);
                      }}
                    >
                      Edit
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!state.loading && !state.data?.data.length && (
          <p className="empty-state">No institutions match this search.</p>
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
