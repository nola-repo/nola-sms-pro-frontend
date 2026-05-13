import React, { useState, useEffect } from 'react';
import {
  FiCopy, FiCheck, FiUser, FiSave,
  FiBriefcase, FiShield
} from 'react-icons/fi';
import { AgencyLayout } from '../components/layout/AgencyLayout.tsx';
import { useAgency } from '../context/AgencyContext.tsx';
import { fetchAgencyProfile, linkCompany, type AgencyAuthUser } from '../services/agencyAuthHelper';
import { useToast } from '../hooks/useToast';
import { safeStorage } from '../utils/safeStorage';
import { ToastContainer } from '../components/ui/ToastContainer.tsx';

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

export const Settings = () => {
  const { agencyId, agencySession, isGhlFrame } = useAgency();
  const [copiedId, setCopiedId] = useState(false);
  const [localCompanyId, setLocalCompanyId] = useState(agencyId || '');
  const [freshProfile, setFreshProfile] = useState<AgencyAuthUser | null>(null);
  const [saving, setSaving] = useState(false);
  const { toasts, showToast, dismissToast } = useToast();

  useEffect(() => {
    if (agencyId) setLocalCompanyId(agencyId);
  }, [agencyId]);

  useEffect(() => {
    if (!agencySession?.token || isGhlFrame) return;

    let isMounted = true;

    fetchAgencyProfile()
      .then(profile => {
        if (!isMounted || !profile) return;
        setFreshProfile(profile);
        if (profile.company_id) setLocalCompanyId(profile.company_id);
      })
      .catch(() => {
        // Cached login/session data remains the fallback if the profile endpoint is unavailable.
      });

    return () => { isMounted = false; };
  }, [agencySession?.token, agencyId, isGhlFrame]);

  const user = {
    ...(agencySession?.user ?? {}),
    ...(freshProfile ?? {}),
  };

  const firstName = user?.firstName ?? '';
  const lastName = user?.lastName ?? '';
  const fullName = (firstName + ' ' + lastName).trim() || user?.name || null;
  const email = user?.email ?? null;
  const phone = user?.phone ?? null;
  const companyName = user?.company_name ?? null;
  const savedCompanyId = user?.company_id ?? agencyId ?? '';
  const role = user?.role ?? 'agency';

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
    if (!savedCompanyId) return;
    navigator.clipboard.writeText(savedCompanyId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <AgencyLayout
      title="Settings"
      subtitle="Manage your agency account settings and view system information"
    >
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="space-y-5 w-full max-w-[672px] mx-auto">
        <SectionHeader
          title="Account Details"
          subtitle="View your agency profile and GoHighLevel company information."
        />

        <Card>
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-[#2b83fa]/10 flex items-center justify-center text-[#2b83fa]">
              <FiUser className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[15px] font-bold text-[#111111] dark:text-[#ececf1] truncate">
                {fullName || 'Agency Owner'}
              </h3>
              <p className="text-[12px] text-[#9aa0a6] truncate">{email || 'agency@example.com'}</p>
            </div>
          </div>

          <div className="space-y-3.5 pt-4 border-t border-[#f0f0f0] dark:border-[#ffffff05]">
            <FieldRow label="Full Name" value={fullName} />
            <FieldRow label="Email Address" value={email} />
            <FieldRow label="Phone Number" value={phone} />
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <FiBriefcase className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[15px] font-bold text-[#111111] dark:text-[#ececf1] truncate">
                {companyName || 'GoHighLevel Agency'}
              </h3>
              <p className="text-[12px] text-[#9aa0a6]">Company connection &amp; identifier</p>
            </div>
          </div>

          <div className="space-y-3.5 pt-4 border-t border-[#f0f0f0] dark:border-[#ffffff05]">
            <FieldRow label="Company Name" value={companyName} />

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

                {!isGhlFrame && localCompanyId !== savedCompanyId && (
                  <button
                    onClick={handleSaveCompanyId}
                    disabled={saving || !localCompanyId.trim()}
                    className="shrink-0 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#2b83fa] to-[#1d6bd4] text-white hover:shadow-[0_8px_25px_rgba(43,131,250,0.4)] transition-all shadow-md flex items-center gap-2 font-semibold disabled:opacity-50 text-[13px]"
                    title="Save Company ID"
                  >
                    {saving ? 'Saving...' : <><FiSave className="w-4 h-4" /> Save</>}
                  </button>
                )}

                {savedCompanyId && localCompanyId === savedCompanyId && (
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
      </div>
    </AgencyLayout>
  );
};
