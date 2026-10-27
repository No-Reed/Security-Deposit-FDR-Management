import React from 'react';
import { PageTitle } from '../components/common/PageTools';
export const AboutPage: React.FC = () => (
  <div className="space-y-5 max-w-4xl">
    <PageTitle
      eyebrow="PROJECT INFORMATION"
      title="About DepositDesk"
      description="Security Deposit & Fixed Deposit Receipt lifecycle management · AICTE problem statement 26265"
    />
    <section className="card-notion space-y-3">
      <h2>Prototype scope</h2>
      <p className="text-sm text-slate-600">
        DepositDesk demonstrates a centralized administrative lifecycle for
        institution deposits and FDRs: submission, evidence, scrutiny,
        corrections, date monitoring, replacement chains, release decisions and
        traceable history.
      </p>
      <p className="notice border-orange-200 bg-orange-50 text-orange-900">
        This is a prototype, not an official AICTE service. Demo institutions,
        financial instruments, verification evidence and completion records are
        synthetic.
      </p>
    </section>
    <section className="card-notion space-y-3">
      <h2>What the statuses mean</h2>
      <ul className="text-sm text-slate-600 list-disc pl-5 space-y-2">
        <li>
          Submitting or uploading an FDR does not establish independent bank
          confirmation.
        </li>
        <li>
          Document review, independent verification, dates, renewal and release
          progress are separate facts.
        </li>
        <li>
          Maturity or expiry is a date event; it does not authorize a refund or
          release.
        </li>
        <li>
          Approval records a competent-authority decision. Completion requires a
          separate evidence reference and date.
        </li>
        <li>
          Replacement instruments retain predecessor history and undergo their
          own review.
        </li>
      </ul>
    </section>
    <section className="card-notion space-y-3">
      <h2>Integrations and limitations</h2>
      <ul className="text-sm text-slate-600 list-disc pl-5 space-y-2">
        <li>
          No live bank or AICTE integration is connected. Synthetic evidence is
          labelled Demo simulated.
        </li>
        <li>
          No payment, bank instruction, actual discharge or financial release is
          executed.
        </li>
        <li>
          Notifications are delivered in-app. Outgoing email is not configured.
        </li>
        <li>
          Documents are stored privately on the local server. Malware scanning
          and external object storage are not configured; documents are labelled
          not scanned.
        </li>
        <li>
          CSV reporting is provided. PDF reports, OCR, external identity
          providers and a calendar view are optional extensions.
        </li>
        <li>
          Demo checklist requirements and date assumptions need validation by
          the responsible domain authority before production use.
        </li>
        <li>
          HTTPS, backups, retention, least-privilege deployment access and
          applicable regulatory obligations require deployment review. No
          compliance certification is claimed.
        </li>
      </ul>
    </section>
  </div>
);
