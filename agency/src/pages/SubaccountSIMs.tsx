import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  FiRefreshCw, FiAlertTriangle, FiToggleLeft, FiUsers, FiX, FiRotateCcw
} from 'react-icons/fi';
import { Layout } from '../components/layout/Layout.tsx';
import { ToastContainer } from '../components/ui/ToastContainer.tsx';
import { useAgency } from '../context/AgencyContext.tsx';
import { useToast } from '../hooks/useToast.ts';
import {
  getSubaccounts,
  toggleSubaccount,
  setRateLimit,
  resetAttemptCount,
} from '../services/api.ts';

const POLL_MS = 10000;

// ─── Toggle Switch ──────────────────────────────────────────────────────────────
const ToggleSwitch = ({ id, checked, onChange, disabled }) => (
  <label className={`toggle-wrap${disabled ? ' loading' : ''}`} htmlFor={`toggle-${id}`}>
    <input
      id={`toggle-${id}`}
      type="checkbox"
      className="toggle-input"
      checked={checked}
      onChange={e => !disabled && onChange(e.target.checked)}
      disabled={disabled}
      aria-label={`Toggle SMS for subaccount ${id}`}
    />
    <span className="toggle-track" />
  </label>
);

// ─── Rate Limit Input ──────────────────────────────────────────────────────────
const RateLimitInput = ({ subaccountId, value, onSave, disabled }) => {
  const [local, setLocal] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setLocal(value); }, [value]);

  const handleBlur = async () => {
    const parsed = parseInt(local, 10);
    if (isNaN(parsed) || parsed < 1 || parsed === value) {
      setLocal(value); // Reset to saved value if invalid / unchanged
      return;
    }
    setSaving(true);
    await onSave(subaccountId, parsed);
    setSaving(false);
  };

  return (
    <input
      id={`rate-${subaccountId}`}
      type="number"
      className="rate-input"
      value={local}
      min={1}
      max={9999}
      onChange={e => setLocal(e.target.value)}
      onBlur={handleBlur}
      disabled={disabled || saving}
      title="Auto-saves on blur"
    />
  );
};

// ─── Reset Confirm Modal ───────────────────────────────────────────────────────
const ResetModal = ({ subaccount, onConfirm, onCancel, loading }) => (
  <div className="modal-overlay" onClick={onCancel}>
    <div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-title">Reset Attempt Counter?</div>
      <div className="modal-body">
        This will reset the send counter for <strong>{subaccount?.subaccount_name || subaccount?.subaccount_id}</strong> back
        to <strong>0</strong>. They will immediately be able to send up to their rate limit again.
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
        <button className="btn btn-danger" onClick={onConfirm} disabled={loading}>
          {loading ? 'Resetting…' : 'Yes, Reset'}
        </button>
      </div>
    </div>
  </div>
);

// ─── Skeleton Rows ─────────────────────────────────────────────────────────────
const SkeletonRows = ({ count = 5 }) => (
  <>
    {[...Array(count)].map((_, i) => (
      <tr key={i}>
        <td>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="skeleton skeleton-cell" style={{ width: 140, height: 14 }} />
            <div className="skeleton skeleton-cell" style={{ width: 90, height: 10 }} />
          </div>
        </td>
        <td><div className="skeleton skeleton-cell" style={{ width: 44, height: 24 }} /></td>
        <td><div className="skeleton skeleton-cell" style={{ width: 72, height: 30 }} /></td>
        <td><div className="skeleton skeleton-cell" style={{ width: 70, height: 26 }} /></td>
        <td><div className="skeleton skeleton-cell" style={{ width: 80, height: 30 }} /></td>
      </tr>
    ))}
  </>
);

// ─── Main Page ─────────────────────────────────────────────────────────────────
export const SubaccountSIMs = () => {
  const { agencyId } = useAgency();
  const { toasts, showToast, dismissToast } = useToast();

  const [subaccounts, setSubaccounts]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [error, setError]               = useState(null);
  const [toggleLoading, setToggleLoading] = useState({}); // { [id]: bool }
  const [resetModal, setResetModal]     = useState(null); // subaccount obj | null
  const [resetLoading, setResetLoading] = useState(false);
  const [lastPolled, setLastPolled]     = useState(null);

  const pollRef = useRef(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchSubaccounts = useCallback(async ({ silent = false } = {}) => {
    if (!agencyId) { setLoading(false); return; }
    if (!silent) setRefreshing(true);

    try {
      const data = await getSubaccounts(agencyId);
      setSubaccounts(data.subaccounts || []);
      setError(null);
      setLastPolled(new Date());
    } catch (e) {
      setError(e.message);
      if (!silent) showToast(`Failed to load subaccounts: ${e.message}`, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [agencyId]);

  // Initial load + polling
  useEffect(() => {
    fetchSubaccounts();
    pollRef.current = setInterval(() => fetchSubaccounts({ silent: true }), POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [fetchSubaccounts]);

  // ── Toggle ─────────────────────────────────────────────────────────────────
  const handleToggle = async (subaccountId, enabled) => {
    setToggleLoading(prev => ({ ...prev, [subaccountId]: true }));

    // Optimistic update
    setSubaccounts(prev =>
      prev.map(s => s.subaccount_id === subaccountId ? { ...s, toggle_enabled: enabled } : s)
    );

    try {
      await toggleSubaccount(agencyId, subaccountId, enabled);
      showToast(
        `SMS ${enabled ? 'enabled' : 'disabled'} for subaccount.`,
        enabled ? 'success' : 'info'
      );
    } catch (e) {
      // Rollback
      setSubaccounts(prev =>
        prev.map(s => s.subaccount_id === subaccountId ? { ...s, toggle_enabled: !enabled } : s)
      );
      showToast(`Toggle failed: ${e.message}`, 'error');
    } finally {
      setToggleLoading(prev => ({ ...prev, [subaccountId]: false }));
    }
  };

  // ── Rate Limit Save ────────────────────────────────────────────────────────
  const handleRateLimitSave = async (subaccountId, newLimit) => {
    try {
      await setRateLimit(agencyId, subaccountId, newLimit);
      setSubaccounts(prev =>
        prev.map(s => s.subaccount_id === subaccountId ? { ...s, rate_limit: newLimit } : s)
      );
      showToast('Rate limit updated.', 'success');
    } catch (e) {
      showToast(`Failed to update rate limit: ${e.message}`, 'error');
    }
  };

  // ── Reset Attempt Counter ──────────────────────────────────────────────────
  const handleResetConfirm = async () => {
    if (!resetModal) return;
    setResetLoading(true);
    try {
      await resetAttemptCount(agencyId, resetModal.subaccount_id);
      setSubaccounts(prev =>
        prev.map(s =>
          s.subaccount_id === resetModal.subaccount_id
            ? { ...s, attempt_count: 0 }
            : s
        )
      );
      showToast(`Counter reset for ${resetModal.subaccount_name || resetModal.subaccount_id}.`, 'success');
      setResetModal(null);
    } catch (e) {
      showToast(`Reset failed: ${e.message}`, 'error');
    } finally {
      setResetLoading(false);
    }
  };

  // ── Derived stats ──────────────────────────────────────────────────────────
  const total   = subaccounts.length;
  const active  = subaccounts.filter(s => s.toggle_enabled).length;
  const atLimit = subaccounts.filter(s => s.attempt_count >= s.rate_limit).length;

  return (
    <Layout
      title="Subaccount SIMs"
      subtitle="Control SMS access, rate limits, and attempt counters for each subaccount"
    >
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      {resetModal && (
        <ResetModal
          subaccount={resetModal}
          onConfirm={handleResetConfirm}
          onCancel={() => setResetModal(null)}
          loading={resetLoading}
        />
      )}

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Subaccount SIMs</h1>
          <p className="page-subtitle">
            Toggle SMS access, set rate limits, and reset send counters for each subaccount under your agency.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {lastPolled && (
            <span className="poll-badge">
              <span className="poll-dot" />
              Live · {lastPolled.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            className="btn btn-ghost"
            onClick={() => fetchSubaccounts()}
            disabled={refreshing}
            id="refresh-subaccounts-btn"
          >
            <FiRefreshCw style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      {/* No Agency ID warning */}
      {!agencyId && (
        <div className="card" style={{ borderColor: 'rgba(245,158,11,0.4)', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#f59e0b' }}>
            <FiAlertTriangle size={18} />
            <strong style={{ fontSize: 13 }}>Agency ID not configured.</strong>
          </div>
          <p style={{ fontSize: 12.5, marginTop: 8, color: 'var(--text-secondary)' }}>
            Set <code>VITE_AGENCY_ID</code> in <code>agency/.env</code> or append <code>?agency_id=YOUR_ID</code> to the URL.
          </p>
        </div>
      )}

      {/* Quick stats strip */}
      {!loading && total > 0 && (
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Total</div>
            <div className="stat-value accent">{total}</div>
            <div className="stat-sub">subaccounts</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">SMS Active</div>
            <div className="stat-value green">{active}</div>
            <div className="stat-sub">webhook enabled</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">At Limit</div>
            <div className="stat-value red">{atLimit}</div>
            <div className="stat-sub">need reset</div>
          </div>
        </div>
      )}

      {/* Main table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' }}>
          <div className="card-title">Subaccounts</div>
          <div className="card-desc">Changes take effect immediately. Rate limit auto-saves on blur.</div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Subaccount</th>
                <th>SMS Active</th>
                <th>Rate Limit</th>
                <th>Sends Used</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows count={5} />
              ) : subaccounts.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <FiUsers />
                      <div className="empty-state-title">No subaccounts found for your agency.</div>
                      <div className="empty-state-desc">
                        Subaccounts will appear here once they are registered in the <code>agency_subaccounts</code> Firestore collection.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                subaccounts.map(sub => {
                  const isAtLimit   = sub.attempt_count >= sub.rate_limit;
                  const isNearLimit = !isAtLimit && sub.attempt_count >= sub.rate_limit * 0.8;
                  const isBusy      = !!toggleLoading[sub.subaccount_id];

                  return (
                    <tr key={sub.subaccount_id}>
                      {/* Name */}
                      <td>
                        <div className="subaccount-name-cell">
                          <span className="subaccount-name">
                            {sub.subaccount_name || <em style={{ color: 'var(--text-muted)' }}>Unnamed</em>}
                          </span>
                          <span className="subaccount-id">{sub.subaccount_id}</span>
                        </div>
                      </td>

                      {/* Toggle */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <ToggleSwitch
                            id={sub.subaccount_id}
                            checked={!!sub.toggle_enabled}
                            onChange={enabled => handleToggle(sub.subaccount_id, enabled)}
                            disabled={isBusy}
                          />
                          <span style={{
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: sub.toggle_enabled ? 'var(--green)' : 'var(--text-muted)',
                          }}>
                            {sub.toggle_enabled ? 'ON' : 'OFF'}
                          </span>
                        </div>
                      </td>

                      {/* Rate Limit */}
                      <td>
                        <RateLimitInput
                          subaccountId={sub.subaccount_id}
                          value={sub.rate_limit ?? 5}
                          onSave={handleRateLimitSave}
                          disabled={!agencyId}
                        />
                      </td>

                      {/* Attempt Counter */}
                      <td>
                        <span className={`attempt-pill${isAtLimit ? ' at-limit' : isNearLimit ? ' near-limit' : ''}`}>
                          {sub.attempt_count ?? 0} / {sub.rate_limit ?? 5}
                        </span>
                      </td>

                      {/* Reset Button — only shown when at limit */}
                      <td>
                        {isAtLimit ? (
                          <button
                            className="btn btn-danger"
                            onClick={() => setResetModal(sub)}
                            id={`reset-btn-${sub.subaccount_id}`}
                            title="Reset attempt counter"
                          >
                            <FiRotateCcw />
                            Reset
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {isNearLimit ? '⚠ Near limit' : '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        {!loading && total > 0 && (
          <div style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: 'var(--text-muted)',
          }}>
            <span>{total} subaccount{total !== 1 ? 's' : ''}</span>
            <span style={{ marginLeft: 'auto' }}>
              Polling every {POLL_MS / 1000}s
            </span>
          </div>
        )}
      </div>

      {/* Inline spin keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </Layout>
  );
};
