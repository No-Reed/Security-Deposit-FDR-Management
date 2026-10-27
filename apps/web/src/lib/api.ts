import axios, { AxiosError } from 'axios';
import {
  Role,
  LifecycleStatus,
  IndependentVerificationStatus,
  DocumentReviewStatus,
  DateStatus,
  RenewalStatus,
  ReleaseStatus,
  ReleaseRequestStatus,
  DiscrepancySeverity,
  DiscrepancyStatus,
  DocumentCategory,
  InstrumentType,
} from '@depositdesk/shared';

// Create Axios client
export const apiClient = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let csrfToken: string | null = null;

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error))
    return error.response?.data?.error?.message || fallback;
  return fallback;
}

export function setCsrfToken(token: string | null) {
  csrfToken = token;
  if (token) {
    sessionStorage.setItem('dd_csrf_token', token);
  } else {
    sessionStorage.removeItem('dd_csrf_token');
  }
}

export function getCsrfToken(): string | null {
  if (!csrfToken) {
    csrfToken = sessionStorage.getItem('dd_csrf_token');
  }
  return csrfToken;
}

// Request interceptor to attach CSRF token and Request ID
apiClient.interceptors.request.use((config) => {
  const token = getCsrfToken();
  if (
    token &&
    !['get', 'head', 'options'].includes(config.method?.toLowerCase() || '')
  ) {
    config.headers['x-csrf-token'] = token;
  }
  config.headers['x-request-id'] = crypto.randomUUID();
  return config;
});

// Response interceptor to update CSRF token if returned in response
apiClient.interceptors.response.use(
  (response) => {
    if (response.data?.csrfToken) {
      setCsrfToken(response.data.csrfToken);
    }
    return response;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  },
);

// Types
export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  institutionId?: string | null;
  institution?: {
    id: string;
    name: string;
    aicteId?: string | null;
  } | null;
  lastLoginAt?: string | null;
}

export interface InstrumentSummary {
  id: string;
  referenceCode?: string;
  institutionId: string;
  institutionName?: string;
  aicteId?: string | null;
  instrumentType: InstrumentType;
  instrumentNumber: string;
  bankName: string;
  bankBranch: string;
  amount: string;
  currency: string;
  issueDate: string;
  maturityDate: string;
  validityEndDate?: string | null;
  purpose: string;
  lifecycleStatus: LifecycleStatus;
  independentVerificationStatus: IndependentVerificationStatus;
  documentReviewStatus: DocumentReviewStatus;
  dateStatus: DateStatus;
  renewalStatus: RenewalStatus;
  releaseStatus: ReleaseStatus;
  daysRemaining: number | null;
  predecessorInstrumentId?: string | null;
  successorInstrumentId?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  documentsCount?: number;
  openDiscrepanciesCount?: number;
}

export interface InstrumentDetail extends InstrumentSummary {
  institution: {
    id: string;
    name: string;
    aicteId?: string | null;
    state: string;
    contactEmail: string;
  };
  beneficiaryDetails?: string | null;
  submissionSnapshot?: any;
  snapshots?: Array<{
    id: string;
    submittedAt: string;
    payload: Record<string, any>;
  }>;
  predecessorInstrument?: {
    id: string;
    instrumentNumber: string;
    amount: string;
    maturityDate: string;
  } | null;
  successorInstrument?: {
    id: string;
    instrumentNumber: string;
    amount: string;
    maturityDate: string;
  } | null;
  documents: Array<{
    id: string;
    category: DocumentCategory;
    originalFilename: string;
    fileSizeBytes: number;
    version?: number;
    isSuperseded?: boolean;
    malwareScan?: string;
    mimeType: string;
    sha256Hash: string;
    createdAt: string;
    uploader: { id: string; name: string };
  }>;
  discrepancies: Array<{
    id: string;
    code: string;
    severity: DiscrepancySeverity;
    description: string;
    reason: string;
    status: DiscrepancyStatus;
    resolutionNotes?: string | null;
    resolvedAt?: string | null;
    createdAt: string;
    creator: { id: string; name: string };
    resolver?: { id: string; name: string } | null;
  }>;
  verificationRecords: Array<{
    id: string;
    independentVerificationStatus: IndependentVerificationStatus;
    documentReviewStatus: DocumentReviewStatus;
    sourceType?: string | null;
    sourceName?: string | null;
    referenceNumber?: string | null;
    result: string;
    notes?: string | null;
    verifiedAt: string;
    verifier: { id: string; name: string; role: Role };
  }>;
  releaseRequests: Array<{
    id: string;
    status: ReleaseRequestStatus;
    requestType: string;
    reason: string;
    createdAt: string;
  }>;
}

export interface DashboardSummary {
  totalInstruments: number;
  totalValue: string;
  activeCount: number;
  expiringSoonCount: number;
  maturedCount: number;
  expiredCount: number;
  pendingVerificationCount: number;
  discrepancyCount: number;
  renewalPendingCount: number;
  openReleaseRequestsCount: number;
  quality: {
    recordsWithEvidence: number;
    missingEvidence: number;
    unresolvedCases: number;
    reviewIntervalsHours: number[];
  };
  distribution: Record<string, number>;
  thresholds: number[];
  recentActivity: Array<{
    id: string;
    action: string;
    timestamp: string;
    reason?: string;
    actor?: { name: string };
  }>;
}
export interface UpcomingMaturities {
  buckets: Record<string, InstrumentSummary[]>;
  totals: Record<string, number>;
}
export interface ReleaseRequestDetail {
  id: string;
  referenceCode: string;
  instrumentId: string;
  institutionId: string;
  institution: { id: string; name: string };
  instrument: {
    id: string;
    referenceCode: string;
    instrumentNumber: string;
    bankName: string;
    amount: string;
    lifecycleStatus: LifecycleStatus;
  };
  requestType: string;
  reason: string;
  status: ReleaseRequestStatus;
  version: number;
  checklistSnapshot: Array<{
    id: string;
    label: string;
    isRequired: boolean;
    completed: boolean;
  }>;
  scrutinyNotes?: string;
  returnReason?: string;
  decisionReason?: string;
  decisionNotes?: string;
  decidedAt?: string;
  completionReference?: string;
  completionDate?: string;
  completionNotes?: string;
  completedAt?: string;
  submittedBy: { id: string; name: string };
  scrutinyOfficer?: { id: string; name: string };
  approvingAuthority?: { id: string; name: string };
  completedBy?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
  history: Array<{
    action: string;
    at: string;
    byUserId?: string;
    notes?: string;
  }>;
  documents: InstrumentDetail['documents'];
}
export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  linkUrl?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface AuditEventItem {
  id: string;
  actorUserId?: string | null;
  actorRole?: Role | null;
  actorName?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: any;
  ipAddress?: string | null;
  createdAt: string;
}

// API Methods
export const api = {
  // Auth
  auth: {
    environment: async (): Promise<{ demo: boolean }> => {
      const res = await apiClient.get('/health');
      return res.data;
    },
    login: async (email: string, password: string) => {
      const res = await apiClient.post('/auth/login', { email, password });
      if (res.data.csrfToken) setCsrfToken(res.data.csrfToken);
      return res.data;
    },
    logout: async () => {
      const res = await apiClient.post('/auth/logout');
      setCsrfToken(null);
      return res.data;
    },
    me: async () => {
      const res = await apiClient.get('/auth/me');
      if (res.data.csrfToken) setCsrfToken(res.data.csrfToken);
      return res.data.user as CurrentUser;
    },
    changePassword: async (currentPassword: string, newPassword: string) => {
      const res = await apiClient.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      return res.data;
    },
  },

  // Dashboard
  dashboard: {
    getSummary: async (): Promise<DashboardSummary> => {
      const res = await apiClient.get('/dashboard/summary');
      return res.data;
    },
    getUpcomingMaturities: async (): Promise<UpcomingMaturities> => {
      const res = await apiClient.get('/dashboard/upcoming-maturities');
      return res.data;
    },
  },

  // Instruments
  instruments: {
    list: async (
      params?: Record<string, any>,
    ): Promise<{
      data: InstrumentSummary[];
      total: number;
      page: number;
      pageSize: number;
    }> => {
      const res = await apiClient.get('/instruments', { params });
      return res.data;
    },
    getById: async (id: string): Promise<InstrumentDetail> => {
      const res = await apiClient.get(`/instruments/${id}`);
      return res.data;
    },
    create: async (data: any): Promise<InstrumentDetail> => {
      const res = await apiClient.post('/instruments', data);
      return res.data;
    },
    update: async (id: string, data: any): Promise<InstrumentDetail> => {
      const res = await apiClient.patch(`/instruments/${id}`, data);
      return res.data;
    },
    submit: async (id: string, version: number) => {
      const res = await apiClient.post(`/instruments/${id}/submit`, {
        version,
      });
      return res.data;
    },
    review: async (
      id: string,
      version: number,
      reason: string,
      notes?: string,
    ) => {
      const res = await apiClient.post(`/instruments/${id}/review`, {
        version,
        reason,
        notes,
      });
      return res.data;
    },
    verify: async (id: string, version: number, reason: string) => {
      const res = await apiClient.post(`/instruments/${id}/verify`, {
        version,
        reason,
      });
      return res.data;
    },
    requestCorrection: async (id: string, version: number, reason: string) => {
      return (
        await apiClient.post(`/instruments/${id}/action-required`, {
          version,
          reason,
        })
      ).data;
    },
    history: async (
      id: string,
    ): Promise<{
      auditEvents: Array<{
        id: string;
        action: string;
        timestamp: string;
        reason?: string;
        actor?: { name: string };
      }>;
      snapshots: Array<{
        id: string;
        submittedAt: string;
        payload: Record<string, any>;
      }>;
    }> => {
      return (await apiClient.get(`/instruments/${id}/history`)).data;
    },
    reject: async (id: string, version: number, reason: string) => {
      const res = await apiClient.post(`/instruments/${id}/reject`, {
        version,
        reason,
      });
      return res.data;
    },
    resubmit: async (id: string, version: number, corrections: string) => {
      const res = await apiClient.post(`/instruments/${id}/resubmit`, {
        version,
        corrections,
      });
      return res.data;
    },
    close: async (id: string, version: number, reason: string) => {
      const res = await apiClient.post(`/instruments/${id}/close`, {
        version,
        reason,
      });
      return res.data;
    },
    createRenewal: async (
      predecessorId: string,
      data: any,
    ): Promise<InstrumentDetail> => {
      const res = await apiClient.post(
        `/instruments/${predecessorId}/renewal`,
        data,
      );
      return res.data;
    },
  },

  // Documents
  documents: {
    upload: async (formData: FormData): Promise<any> => {
      const res = await apiClient.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    downloadUrl: (id: string) => `/api/v1/documents/${id}/download`,
    delete: async (id: string) => {
      const res = await apiClient.delete(`/documents/${id}`);
      return res.data;
    },
  },

  // Verification
  verification: {
    record: async (instrumentId: string, data: any) => {
      const res = await apiClient.post(
        `/verification/instruments/${instrumentId}`,
        data,
      );
      return res.data;
    },
  },

  // Discrepancies
  discrepancies: {
    list: async (params?: Record<string, any>) => {
      const res = await apiClient.get('/discrepancies', { params });
      return res.data;
    },
    create: async (data: any) => {
      const res = await apiClient.post('/discrepancies', data);
      return res.data;
    },
    resolve: async (
      id: string,
      resolutionNotes: string,
      status: 'RESPONDED' | 'RESOLVED' | 'DISMISSED',
      version?: number,
    ) => {
      const res = await apiClient.patch(`/discrepancies/${id}/resolve`, {
        resolutionNotes,
        status,
        version,
      });
      return res.data;
    },
  },

  // Release Requests
  releaseRequests: {
    list: async (
      params?: Record<string, any>,
    ): Promise<{ data: ReleaseRequestDetail[]; total: number }> => {
      const res = await apiClient.get('/release-requests', { params });
      return res.data;
    },
    getById: async (id: string): Promise<ReleaseRequestDetail> => {
      const res = await apiClient.get(`/release-requests/${id}`);
      return res.data;
    },
    create: async (data: any) => {
      const res = await apiClient.post('/release-requests', data);
      return res.data;
    },
    submit: async (id: string, version: number) =>
      (await apiClient.post(`/release-requests/${id}/submit`, { version }))
        .data,
    checklist: async (
      id: string,
      itemId: string,
      completed: boolean,
      version: number,
    ) =>
      (
        await apiClient.patch(`/release-requests/${id}/checklist`, {
          itemId,
          completed,
          version,
        })
      ).data,
    update: async (id: string, reason: string, version: number) =>
      (await apiClient.patch(`/release-requests/${id}`, { reason, version }))
        .data,
    review: async (id: string, version: number, notes?: string) => {
      const res = await apiClient.post(`/release-requests/${id}/review`, {
        version,
        notes,
      });
      return res.data;
    },
    returnForInfo: async (
      id: string,
      version: number,
      reason: string,
      observations?: string,
    ) => {
      const res = await apiClient.post(`/release-requests/${id}/return`, {
        version,
        reason,
        observations,
      });
      return res.data;
    },
    forwardToAuthority: async (id: string, version: number, notes?: string) => {
      const res = await apiClient.post(`/release-requests/${id}/forward`, {
        version,
        notes,
      });
      return res.data;
    },
    resubmit: async (id: string, version: number, information: string) => {
      const res = await apiClient.post(`/release-requests/${id}/resubmit`, {
        version,
        information,
      });
      return res.data;
    },
    decide: async (
      id: string,
      action: 'APPROVE' | 'REJECT',
      decisionReason: string,
      version: number,
      notes?: string,
    ) => {
      const res = await apiClient.post(
        `/release-requests/${id}/${action === 'APPROVE' ? 'approve' : 'reject'}`,
        {
          action,
          decisionReason,
          version,
          notes,
        },
      );
      return res.data;
    },
    complete: async (
      id: string,
      completionReference: string,
      completionDate: string,
      version: number,
      notes?: string,
    ) => {
      const res = await apiClient.post(`/release-requests/${id}/complete`, {
        completionReference,
        completionDate,
        version,
        notes,
      });
      return res.data;
    },
  },

  // Notifications
  notifications: {
    list: async (): Promise<NotificationItem[]> => {
      const res = await apiClient.get('/notifications');
      return res.data.data.map((item: any) => ({
        ...item,
        userId: item.recipientUserId,
        isRead: Boolean(item.readAt),
        linkUrl:
          item.relatedEntityType === 'Instrument'
            ? `/instruments/${item.relatedEntityId}`
            : '/releases',
      }));
    },
    markRead: async (id: string) => {
      const res = await apiClient.post(`/notifications/${id}/read`);
      return res.data;
    },
    markAllRead: async () => {
      const res = await apiClient.post('/notifications/read-all');
      return res.data;
    },
  },

  // Audit
  audit: {
    list: async (
      params?: Record<string, any>,
    ): Promise<{ data: AuditEventItem[]; total: number }> => {
      const res = await apiClient.get('/audit-events', { params });
      return res.data;
    },
  },

  // Reports
  reports: {
    exportInstrumentsCsv: () => '/api/v1/reports/instruments.csv',
    exportMaturitiesCsv: () => '/api/v1/reports/maturities.csv',
    exportAuditEventsCsv: () => '/api/v1/reports/audit-events.csv',
  },

  // Admin
  admin: {
    getUsers: async () => {
      const res = await apiClient.get('/admin/users', {
        params: { pageSize: 100 },
      });
      return res.data;
    },
    createUser: async (data: any) => {
      const res = await apiClient.post('/admin/users', data);
      return res.data;
    },
    updateUser: async (id: string, data: any) => {
      const res = await apiClient.patch(`/admin/users/${id}`, data);
      return res.data;
    },
    getScope: async (id: string) =>
      (await apiClient.get(`/admin/institution-scope/${id}`)).data,
    addScope: async (userId: string, institutionId: string) =>
      (
        await apiClient.post('/admin/institution-scope', {
          userId,
          institutionId,
        })
      ).data,
    removeScope: async (userId: string, institutionId: string) =>
      (
        await apiClient.delete(
          `/admin/institution-scope/${userId}/${institutionId}`,
        )
      ).data,
    createChecklistItem: async (data: any) =>
      (await apiClient.post('/admin/release-checklist', data)).data,
    updateChecklistItem: async (id: string, data: any) =>
      (await apiClient.patch(`/admin/release-checklist/${id}`, data)).data,
    getInstitutions: async () => {
      const res = await apiClient.get('/institutions', {
        params: { pageSize: 100 },
      });
      return res.data;
    },
    createInstitution: async (data: any) => {
      const res = await apiClient.post('/institutions', data);
      return res.data;
    },
    getSystemSettings: async () => {
      const res = await apiClient.get('/admin/settings');
      return res.data;
    },
    updateSystemSetting: async (key: string, value: string) => {
      const res = await apiClient.patch('/admin/settings', { key, value });
      return res.data;
    },
    getChecklist: async () => {
      const res = await apiClient.get('/admin/release-checklist');
      return res.data;
    },
    triggerMaturityCheck: async () => {
      const res = await apiClient.post('/admin/maturity-check');
      return res.data;
    },
  },
};
