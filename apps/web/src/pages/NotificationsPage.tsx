import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiClient } from '../lib/api';
import {
  PageTitle,
  useRemote,
  Feedback,
  Pager,
  formatDate,
} from '../components/common/PageTools';
export const NotificationsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const state = useRemote(
    async () =>
      (
        await apiClient.get('/notifications', {
          params: { page, pageSize: 20 },
        })
      ).data,
    [page],
  );
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow="FOLLOW-UP"
        title="Notifications"
        description="Deadline reminders and escalations for your account. Delivery shown here is in-app only."
      >
        <button
          className="btn-outline"
          disabled={state.busy || !state.data?.unreadCount}
          onClick={() =>
            state.act(
              () => api.notifications.markAllRead(),
              'Notifications marked read.',
            )
          }
        >
          Mark all read
        </button>
      </PageTitle>
      <Feedback state={state} />
      <div className="space-y-3">
        {state.data?.data.map((item: any) => (
          <article
            key={item.id}
            className={`card-notion ${!item.readAt ? 'border-l-4 border-l-orange-500' : ''}`}
          >
            <div className="flex flex-wrap justify-between gap-3">
              <h2>
                {item.title}
                {!item.readAt && (
                  <span className="text-[10px] font-normal text-orange-700 ml-2">
                    Unread
                  </span>
                )}
              </h2>
              <span className="text-xs text-slate-400">
                {formatDate(item.createdAt)}
              </span>
            </div>
            <p className="text-sm mt-2 text-slate-600">{item.message}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              <span className="text-slate-400">
                {item.deliveryChannel === 'IN_APP' ? 'In-app' : 'Email'} ·{' '}
                {item.deliveryStatus.toLowerCase()}
              </span>
              {item.relatedEntityId && (
                <Link
                  className="text-orange-700"
                  to={
                    item.relatedEntityType === 'ReleaseRequest'
                      ? `/releases/${item.relatedEntityId}`
                      : `/instruments/${item.relatedEntityId}`
                  }
                >
                  Open record →
                </Link>
              )}
              {!item.readAt && (
                <button
                  className="ml-auto text-orange-700"
                  disabled={state.busy}
                  onClick={() =>
                    state.act(
                      () => api.notifications.markRead(item.id),
                      'Notification marked read.',
                    )
                  }
                >
                  Mark read
                </button>
              )}
            </div>
            {item.errorDetails && (
              <p className="text-xs text-red-700">{item.errorDetails}</p>
            )}
          </article>
        ))}
      </div>
      {!state.loading && !state.data?.data.length && (
        <p className="empty-state">No notifications yet.</p>
      )}
      <Pager
        page={page}
        total={state.data?.total || 0}
        onChange={setPage}
        disabled={state.loading}
      />
    </div>
  );
};
