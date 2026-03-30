import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiToggleLeft, FiUsers, FiCheckCircle, FiAlertTriangle, FiArrowRight } from 'react-icons/fi';
import { Layout } from '../components/layout/Layout.tsx';
import { useAgency } from '../context/AgencyContext.tsx';
import { getSubaccounts } from '../services/api.ts';

const POLL_MS = 10000;

export const Dashboard = () => {
  const { agencyId } = useAgency();
  const navigate = useNavigate();

  const [subaccounts, setSubaccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  const fetchData = async () => {
    if (!agencyId) return;
    try {
      const data = await getSubaccounts(agencyId);
      setSubaccounts(data.subaccounts || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, POLL_MS);
    return () => clearInterval(id);
  }, [agencyId]);

  const total   = subaccounts.length;
  const active  = subaccounts.filter(s => s.toggle_enabled).length;
  const atLimit = subaccounts.filter(s => s.attempt_count >= s.rate_limit).length;
  const totalSends = subaccounts.reduce((sum, s) => sum + (s.attempt_count || 0), 0);

  return (
    <Layout title="Dashboard" subtitle="Agency overview and quick stats">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Real-time overview of your subaccounts and SMS activity.</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/subaccount-sims')}>
          Manage SIMs <FiArrowRight />
        </button>
      </div>

      {!agencyId && (
        <div className="card" style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#f59e0b' }}>
            <FiAlertTriangle size={18} />
            <strong style={{ fontSize: 13 }}>No Agency ID configured.</strong>
          </div>
          <p style={{ fontSize: 12.5, marginTop: 8, color: 'var(--text-secondary)' }}>
            Set <code>VITE_AGENCY_ID</code> in your <code>.env</code> file or pass <code>?agency_id=…</code> as a URL query param.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Subaccounts</div>
          <div className="stat-value accent">{loading ? '—' : total}</div>
          <div className="stat-sub">registered under your agency</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active (SMS ON)</div>
          <div className="stat-value green">{loading ? '—' : active}</div>
          <div className="stat-sub">webhook enabled</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Inactive (SMS OFF)</div>
          <div className="stat-value">{loading ? '—' : total - active}</div>
          <div className="stat-sub">hidden from main admin</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">At Rate Limit</div>
          <div className="stat-value red">{loading ? '—' : atLimit}</div>
          <div className="stat-sub">blocked until reset</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Sends</div>
          <div className="stat-value">{loading ? '—' : totalSends}</div>
          <div className="stat-sub">across all subaccounts</div>
        </div>
      </div>

      {/* Recent subaccounts at limit */}
      {!loading && atLimit > 0 && (
        <div className="card" style={{ borderColor: 'var(--red)', borderWidth: 1 }}>
          <div className="card-header">
            <div>
              <div className="card-title" style={{ color: 'var(--red)' }}>
                ⚠ Subaccounts at Rate Limit ({atLimit})
              </div>
              <div className="card-desc">These subaccounts are blocked. Reset their counters to re-enable sending.</div>
            </div>
            <button className="btn btn-danger" onClick={() => navigate('/subaccount-sims')}>
              Review &amp; Reset <FiArrowRight />
            </button>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Subaccount</th>
                  <th>Attempts</th>
                  <th>Limit</th>
                </tr>
              </thead>
              <tbody>
                {subaccounts
                  .filter(s => s.attempt_count >= s.rate_limit)
                  .map(s => (
                    <tr key={s.subaccount_id}>
                      <td>
                        <div className="subaccount-name-cell">
                          <span className="subaccount-name">{s.subaccount_name || 'Unnamed'}</span>
                          <span className="subaccount-id">{s.subaccount_id}</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--red)', fontWeight: 700 }}>{s.attempt_count}</td>
                      <td>{s.rate_limit}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All subaccounts summary */}
      {!loading && total > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <div>
              <div className="card-title">All Subaccounts</div>
              <div className="card-desc">Summary of all subaccounts under your agency.</div>
            </div>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Subaccount</th>
                  <th>Status</th>
                  <th>Sends Used</th>
                  <th>Limit</th>
                </tr>
              </thead>
              <tbody>
                {subaccounts.map(s => (
                  <tr key={s.subaccount_id}>
                    <td>
                      <div className="subaccount-name-cell">
                        <span className="subaccount-name">{s.subaccount_name || 'Unnamed'}</span>
                        <span className="subaccount-id">{s.subaccount_id}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className={`status-dot ${s.toggle_enabled ? 'on' : 'off'}`} />
                        <span style={{ fontSize: 12, color: s.toggle_enabled ? 'var(--green)' : 'var(--text-muted)', fontWeight: 600 }}>
                          {s.toggle_enabled ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`attempt-pill ${s.attempt_count >= s.rate_limit ? 'at-limit' : s.attempt_count >= s.rate_limit * 0.8 ? 'near-limit' : ''}`}>
                        {s.attempt_count} / {s.rate_limit}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{s.rate_limit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading && (
        <div className="card">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton-row">
              <div className="skeleton skeleton-cell" style={{ width: 160 }} />
              <div className="skeleton skeleton-cell" style={{ width: 70 }} />
              <div className="skeleton skeleton-cell" style={{ width: 60 }} />
            </div>
          ))}
        </div>
      )}

      {!loading && total === 0 && !error && (
        <div className="card">
          <div className="empty-state">
            <FiUsers />
            <div className="empty-state-title">No subaccounts found</div>
            <div className="empty-state-desc">No subaccounts are registered under your agency ID yet.</div>
          </div>
        </div>
      )}
    </Layout>
  );
};
