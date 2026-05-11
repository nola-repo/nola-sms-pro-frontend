import React, { useState, useEffect } from 'react';
import {
  FiSettings, FiCopy, FiCheck, FiUser, FiInfo, FiSave,
  FiMapPin, FiBriefcase, FiShield, FiPhone, FiMail
} from 'react-icons/fi';
import { AgencyLayout } from '../components/layout/AgencyLayout.tsx';
import { useAgency } from '../context/AgencyContext.tsx';
import { linkCompany } from '../services/agencyAuthHelper';
import { useToast } from '../hooks/useToast';
import { safeStorage } from '../utils/safeStorage';
import { ToastContainer } from '../components/ui/ToastContainer.tsx';

// ─── Reusable sub-components (mirrors user/src/pages/Settings.tsx) ──────────

const SectionHeader: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div className="mb-6">
    <h2 className="text-[18px] font-bold text-[#111111] dark:text-white tracking-tight">{title}</h2>
    {subtitle && <p className="text-[13px] text-[#6e6e73] dark:text-[#94959b] mt-0.5">{subtitle}</p>}
  </div>
);

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white dark:bg-[#1a1b1e] border border-[#e5e5e5] dark:border-white/5 rounded-2xl p-5 ${className}`}>
    {children}
  </div>
);

const FieldRow: React.FC<{ label: string; value: string | null | undefined; mono?: boolean }> = ({
  label, value, mono,
}) => (
  <div>
    <label className="block text-[11px] font-bold text-[#9aa0a6] uppercase tracking-wider mb-1.5">
      {label}
    </label>
    <div
      className={`px-4 py-2.5 rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] border border-[#e0e0e0] dark:border-[#ffffff0a] text-[13px] text-[#111111] dark:text-[#ececf1] font-semibold ${mono ? 'font-mono' : ''}`}
    >
      {value || <span className="text-[#9aa0a6] font-normal">N/A</span>}
    </div>
  </div>
);

// ─── Main Settings Page ──────────────────────────────────────────────────────

export const Settings = () => {
  const { agencyId, agencySession, isGhlFrame, disconnectGhl } = useAgency();
  const [copiedId, setCopiedId] = useState(false);
  const [localCompanyId, setLocalCompanyId] = useState(agencyId || '');
  const [saving, setSaving] = useState(false);
  const { toasts, showToast, dismissToast } = useToast();

  useEffect(() => {
    if (agencyId) setLocalCompanyId(agencyId);
  }, [agencyId]);

  const handleSaveCompanyId = async () => {
    if (!localCompanyId.trim()) return;
    setSaving(true);
    try {
      await linkCompany(localCompanyId.trim());
      safeStorage.setItem('nola_agency_id', localCompanyId.trim());
      showToast('Company ID successfully updated!', 'success');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      showToast(err.message || 'Failed to save Company ID', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyId = () => {
    if (!agencyId) return;
    navigator.clipboard.writeText(agencyId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Derived profile values from session
  const user = agencySession?.user;
  const firstName  = user?.firstName ?? '';
  const lastName   = user?.lastName  ?? '';
  const fullName   = (firstName + ' ' + lastName).trim() || user?.name || null;
  const email      = user?.email       ?? null;
  const phone      = user?.phone       ?? null;
  const companyName= user?.company_name ?? null;
  const role       = user?.role        ?? 'agency';

  return (
    <AgencyLayout
      title="Settings"
      subtitle="Manage your agency account settings and view system information"
    >
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="space-y-5 max-w-3xl">
        <SectionHeader
          title="Account Details"
          subtitle="View your agency profile and GoHighLevel company information."
        />

        {/* ── Profile Details Card ── */}
        {!isGhlFrame && (
          <Card>
            {/* Card header */}
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-[#2b83fa]/10 flex items-center justify-center text-[#2b83fa]">
                <FiUser className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-[15px] font-bold text-[#111111] dark:text-[#ececf1]">
                  {fullName || 'Agency Owner'}
                </h3>
                <p className="text-[12px] text-[#9aa0a6]">{email || 'agency@example.com'}</p>
              </div>
              {/* Role badge */}
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#2b83fa]/10 text-[#2b83fa]">
                <FiShield className="w-3 h-3" />
                {role}
              </span>
            </div>

            {/* Fields */}
            <div className="space-y-3.5 pt-4 border-t border-[#f0f0f0] dark:border-[#ffffff05]">
              <FieldRow label="Full Name"     value={fullName} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <FieldRow label="Email Address" value={email} />
                <FieldRow label="Phone Number"  value={phone} />
              </div>
            </div>
          </Card>
        )}

        {/* ── Company / GHL Card ── */}
        <Card>
          {/* Card header */}
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <FiBriefcase className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-[15px] font-bold text-[#111111] dark:text-[#ececf1]">
                {companyName || 'GoHighLevel Agency'}
              </h3>
              <p className="text-[12px] text-[#9aa0a6]">Company connection &amp; identifier</p>
            </div>
          </div>

          <div className="space-y-3.5 pt-4 border-t border-[#f0f0f0] dark:border-[#ffffff05]">
            {/* Company Name (read-only if resolved) */}
            {companyName && (
              <FieldRow label="Company Name" value={companyName} />
            )}

            {/* Company ID – editable outside iframe */}
            <div>
              <label className="flex text-[11px] font-bold text-[#9aa0a6] uppercase tracking-wider mb-1.5 items-center justify-between gap-2">
                <span>Agency / Company ID</span>
              </label>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={localCompanyId}
                  onChange={(e) => setLocalCompanyId(e.target.value)}
                  placeholder="Enter GHL Company ID"
                  className={`flex-1 px-4 py-2.5 rounded-xl border text-[13px] font-mono placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/50 transition-all ${
                    isGhlFrame
                      ? 'border-transparent bg-[#f7f7f7] dark:bg-[#0d0e10] text-[#6e6e73] dark:text-[#9aa0a6]'
                      : 'border-[#e0e0e0] dark:border-[#ffffff0a] bg-[#f7f7f7] dark:bg-[#0d0e10] text-[#111111] dark:text-[#ececf1] shadow-inner hover:border-[#2b83fa]/50'
                  }`}
                  disabled={isGhlFrame}
                />

                {/* Save button – only when value changed */}
                {!isGhlFrame && localCompanyId !== agencyId && (
                  <button
                    onClick={handleSaveCompanyId}
                    disabled={saving || !localCompanyId.trim()}
                    className="shrink-0 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#2b83fa] to-[#1d6bd4] text-white hover:shadow-[0_8px_25px_rgba(43,131,250,0.4)] transition-all shadow-md flex items-center gap-2 font-semibold disabled:opacity-50 text-[13px]"
                    title="Save Company ID"
                  >
                    {saving ? 'Saving…' : <><FiSave className="w-4 h-4" /> Save</>}
                  </button>
                )}

                {/* Copy button – when value matches saved */}
                {agencyId && localCompanyId === agencyId && (
                  <button
                    onClick={handleCopyId}
                    className="shrink-0 p-3 rounded-xl border border-[#e0e0e0] dark:border-[#ffffff0a] bg-white dark:bg-[#25282c] text-[#6e6e73] dark:text-[#9aa0a6] hover:text-[#2b83fa] transition-all shadow-sm"
                    title="Copy Company ID"
                  >
                    {copiedId ? <FiCheck className="w-4 h-4 text-emerald-500" /> : <FiCopy className="w-4 h-4" />}
                  </button>
                )}
              </div>

              <p className="text-[11px] text-[#9ca3af] mt-2">
                This ID uniquely identifies your GoHighLevel agency and is required to link subaccounts.
              </p>
            </div>
          </div>
        </Card>

        {/* ── Environment / Session Card ── */}
        <Card>
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
              <FiSettings className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-[#111111] dark:text-[#ececf1]">Environment Status</h3>
              <p className="text-[12px] text-[#9aa0a6]">Session and connection info</p>
            </div>
          </div>

          <div className="space-y-3.5 pt-4 border-t border-[#f0f0f0] dark:border-[#ffffff05]">
            <div className="flex items-start justify-between gap-4 p-4 bg-[#f7f7f7] dark:bg-white/[0.03] rounded-xl border border-[#e0e0e0] dark:border-[#ffffff0a] flex-wrap">
              <div className="flex items-start gap-3">
                <FiInfo className="w-5 h-5 text-[#2b83fa] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-[13px] font-bold text-[#111111] dark:text-white">Login Method</h4>
                  <p className="text-[12px] text-[#6e6e73] dark:text-[#9aa0a6] mt-1 leading-relaxed">
                    You are logged in via{' '}
                    <strong>{isGhlFrame ? 'GoHighLevel iframe auto-login' : 'the standalone NOLA SMS Pro portal'}</strong>.
                  </p>
                </div>
              </div>

              {!isGhlFrame && (
                <button
                  onClick={() => {
                    if (agencyId) disconnectGhl();
                    else window.location.href = '/login';
                  }}
                  className={`shrink-0 px-4 py-2 rounded-xl text-[13px] font-bold transition-all shadow-sm ${
                    agencyId
                      ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-500 hover:text-white dark:bg-red-500/10 dark:border-red-500/20'
                      : 'bg-[#2b83fa] text-white hover:bg-[#1d6bd4]'
                  }`}
                >
                  {agencyId ? 'Disconnect GHL' : 'Connect GHL'}
                </button>
              )}
            </div>

            {/* Contact row (quick summary) */}
            {!isGhlFrame && (email || phone) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {email && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] border border-[#e0e0e0] dark:border-[#ffffff0a]">
                    <FiMail className="w-4 h-4 text-[#9aa0a6] shrink-0" />
                    <span className="text-[12px] text-[#111111] dark:text-[#ececf1] font-medium truncate">{email}</span>
                  </div>
                )}
                {phone && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] border border-[#e0e0e0] dark:border-[#ffffff0a]">
                    <FiPhone className="w-4 h-4 text-[#9aa0a6] shrink-0" />
                    <span className="text-[12px] text-[#111111] dark:text-[#ececf1] font-medium">{phone}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Info note */}
        {!isGhlFrame && (
          <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20">
            <p className="text-[12px] text-blue-700 dark:text-blue-300 leading-relaxed">
              <strong>Note:</strong> Profile information is sourced from your NOLA SMS Pro agency account. To update your name, email, or phone, contact the administrator.
            </p>
          </div>
        )}
      </div>
    </AgencyLayout>
  );
};
