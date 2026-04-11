import React, { useState, useEffect } from 'react';
import { FiSettings, FiCopy, FiCheck, FiUser, FiInfo, FiSave } from 'react-icons/fi';
import { AgencyLayout } from '../components/layout/AgencyLayout.tsx';
import { useAgency } from '../context/AgencyContext.tsx';
import { linkCompany } from '../services/agencyAuthHelper';
import { useToast } from '../hooks/useToast';
import { safeStorage } from '../utils/safeStorage';
import { ToastContainer } from '../components/ui/ToastContainer.tsx';

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

  const userName = agencySession?.user
    ? `${agencySession.user.firstName} ${agencySession.user.lastName}`.trim()
    : 'Agency Owner';

  return (
    <AgencyLayout
      title="Settings"
      subtitle="Manage your agency account settings and view system information"
    >
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />


      <div className={`grid grid-cols-1 gap-6 ${!isGhlFrame ? 'md:grid-cols-2' : 'max-w-2xl'}`}>
        {/* Profile Card - Hidden in GHL Iframe */}
        {!isGhlFrame && (
          <div className="bg-white/70 dark:bg-[#121415]/80 backdrop-blur-2xl border border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.05)] rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.05)]">
              <div className="w-10 h-10 rounded-full bg-[#2b83fa]/10 flex items-center justify-center">
                <FiUser className="w-5 h-5 text-[#2b83fa]" />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-[#111111] dark:text-white">Profile Details</h2>
                <p className="text-[12px] text-[#6e6e73] dark:text-[#9aa0a6]">Your NOLA SMS Pro account</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11.5px] font-semibold uppercase tracking-widest text-[#6e6e73] dark:text-[#9aa0a6] mb-1.5">Full Name</label>
                <div className="px-4 py-2.5 rounded-xl border border-[rgba(0,0,0,0.07)] dark:border-[rgba(255,255,255,0.07)] bg-[#f7f7f7] dark:bg-[#1c1e21] text-[14px] text-[#111111] dark:text-white font-medium">
                  {userName}
                </div>
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold uppercase tracking-widest text-[#6e6e73] dark:text-[#9aa0a6] mb-1.5">Email Address</label>
                <div className="px-4 py-2.5 rounded-xl border border-[rgba(0,0,0,0.07)] dark:border-[rgba(255,255,255,0.07)] bg-[#f7f7f7] dark:bg-[#1c1e21] text-[14px] text-[#111111] dark:text-white font-medium">
                  {agencySession?.user?.email || 'N/A'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Integration Card */}
        <div className="bg-white/70 dark:bg-[#121415]/80 backdrop-blur-2xl border border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.05)] rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.05)]">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <FiSettings className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#111111] dark:text-white">GoHighLevel Integration</h2>
              <p className="text-[12px] text-[#6e6e73] dark:text-[#9aa0a6]">Connection status and identifier</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[11.5px] font-semibold uppercase tracking-widest text-[#6e6e73] dark:text-[#9aa0a6] mb-1.5 flex items-center gap-2">
                Agency / Company ID
              </label>
              
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={localCompanyId}
                  onChange={(e) => setLocalCompanyId(e.target.value)}
                  placeholder="Enter GHL Company ID"
                  className={`flex-1 px-4 py-2.5 rounded-xl border text-[14px] font-mono placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/50 transition-all ${
                    isGhlFrame 
                      ? 'border-transparent bg-[#f0f2f8] dark:bg-[#1c1e21] text-[#6e6e73]' 
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-[#121415] text-[#111111] dark:text-[#ececf1] shadow-inner hover:border-[#2b83fa]/50'
                  }`}
                  disabled={isGhlFrame} 
                />
                {!isGhlFrame && localCompanyId !== agencyId && (
                  <button
                    onClick={handleSaveCompanyId}
                    disabled={saving || !localCompanyId.trim()}
                    className="shrink-0 px-4 py-2.5 rounded-xl bg-[#2b83fa] text-white hover:bg-[#1d6bd4] transition-all shadow-sm flex items-center gap-2 font-semibold disabled:opacity-50 text-[14px]"
                    title="Save Company ID"
                  >
                    {saving ? 'Saving...' : <><FiSave className="w-4 h-4" /> Save</>}
                  </button>
                )}
                {agencyId && localCompanyId === agencyId && (
                  <button
                    onClick={handleCopyId}
                    className="shrink-0 p-3 rounded-xl border border-[rgba(0,0,0,0.07)] dark:border-[rgba(255,255,255,0.07)] bg-white dark:bg-[#25282c] text-[#6e6e73] dark:text-[#9aa0a6] hover:text-[#2b83fa] transition-all shadow-sm"
                    title="Copy Company ID"
                  >
                    {copiedId ? <FiCheck className="w-4 h-4 text-emerald-500" /> : <FiCopy className="w-4 h-4" />}
                  </button>
                )}
              </div>
              <p className="text-[11px] text-[#9ca3af] mt-2">
                This ID uniquely identifies your GoHighLevel agency. It is required by NOLA SMS Pro to link your subaccounts.
              </p>
            </div>

            <div className="pt-4">
              <div className="flex items-start justify-between gap-4 p-4 bg-[#f0f2f8] dark:bg-white/5 rounded-xl border border-[rgba(0,0,0,0.05)] dark:border-white/5 flex-wrap">
                <div className="flex items-start gap-3">
                  <FiInfo className="w-5 h-5 text-[#2b83fa] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-[13px] font-bold text-[#111111] dark:text-white">Environment Status</h4>
                    <p className="text-[12px] text-[#6e6e73] dark:text-[#9aa0a6] mt-1 leading-relaxed">
                      You are currently logged in via <strong>{isGhlFrame ? 'the GoHighLevel iframe auto-login' : 'the standalone NOLA SMS Pro portal'}</strong>.
                    </p>
                  </div>
                </div>
                {!isGhlFrame && (
                  <button
                    onClick={() => {
                        if (agencyId) {
                            disconnectGhl();
                        } else {
                            window.location.href = '/login'; // Or whatever connects GHL
                        }
                    }}
                    className={`shrink-0 px-4 py-2 rounded-lg text-[13px] font-bold transition-all shadow-sm ${
                      agencyId 
                      ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-500 hover:text-white dark:bg-red-500/10 dark:border-red-500/20' 
                      : 'bg-[#2b83fa] text-white hover:bg-[#1d6bd4]'
                    }`}
                  >
                    {agencyId ? 'Disconnect' : 'Connect GHL'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AgencyLayout>
  );
};
