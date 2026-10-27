import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Role } from '@depositdesk/shared';
import { useAuth } from '../context/AuthContext';
import { api, InstrumentDetail, getApiErrorMessage } from '../lib/api';
import { InstrumentForm } from '../components/common/InstrumentForm';

export const NewInstrumentPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const renewalFrom = params.get('renewFrom');
  const copyFrom = params.get('copyFrom') || renewalFrom;
  const [predecessor, setPredecessor] = useState<{
    id: string;
    version: number;
  }>();
  const [template, setTemplate] = useState<InstrumentDetail>();
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    if (copyFrom)
      api.instruments
        .getById(copyFrom)
        .then((record) => {
          if (current) {
            if (renewalFrom) {
              setPredecessor({ id: record.id, version: record.version });
              setTemplate({
                ...record,
                instrumentNumber: '',
                issueDate: new Intl.DateTimeFormat('en-CA', {
                  timeZone: 'Asia/Kolkata',
                }).format(new Date()),
                maturityDate: '',
                validityEndDate: null,
              });
            } else setTemplate(record);
          }
        })
        .catch((error) => {
          if (current)
            setError(
              getApiErrorMessage(error, 'Could not load the original details.'),
            );
        });
    return () => {
      current = false;
    };
  }, [copyFrom]);
  if (user?.role !== Role.INSTITUTION_USER)
    return <p role="alert">Only institution users can create instruments.</p>;
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <button className="btn-outline" onClick={() => navigate('/instruments')}>
        Back to registry
      </button>
      <h1 className="text-xl font-semibold">
        {renewalFrom
          ? 'Create renewal / replacement'
          : 'Register a security deposit / FDR'}
      </h1>
      <p className="text-sm text-slate-600">
        Save a draft, attach supporting evidence, then submit for scrutiny.
      </p>
      {copyFrom && (
        <p className="text-sm">
          Starting a new record from existing details. Review the reference
          number and attach new evidence; the original record stays unchanged.
        </p>
      )}
      {error ? (
        <p role="alert">{error}</p>
      ) : copyFrom && !template ? (
        <p role="status">Loading original details…</p>
      ) : (
        <InstrumentForm
          template={template}
          predecessor={predecessor}
          onSaved={(id) => navigate(`/instruments/${id}`)}
        />
      )}
    </div>
  );
};
