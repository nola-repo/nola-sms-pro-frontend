import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FiCreditCard, FiRefreshCw, FiZap, FiPlus, FiGift,
  FiInbox, FiCheck, FiX, FiChevronDown, FiAlertTriangle,
  FiArrowUpRight, FiArrowDownLeft, FiClock, FiSend,
} from 'react-icons/fi';
import { AgencyLayout } from '../components/layout/AgencyLayout.tsx';
import { useAgency } from '../context/AgencyContext.tsx';
import { useToast } from '../hooks/useToast.ts';
import { ToastContainer } from '../components/ui/ToastContainer.tsx';

// ─── Constants ────────────────────────────────────────────────────────────────
const AGENCY_ID = 'O0YXPGWM9ep2l37dgxAo';
const API_BASE = import.meta.env.VITE_API_BASE || 'https://smspro-api.nolacrm.io';
// Shared API secret — must match WEBHOOK_SECRET env var on the backend
const WEBHOOK_SECRET = import.meta.env.VITE_WEBHOOK_SECRET || 'f7RkQ2pL9zV3tX8cB1nS4yW6';
const AUTH_HEADERS = { 'Content-Type': 'application/json', 'X-Webhook-Secret': WEBHOOK_SECRET };

const RECHARGE_AMOUNTS = [100, 250, 500, 1000, 2000, 5000];
const RECHARGE_THRESHOLDS = [25, 50, 100, 200, 500];

// ─── Types ────────────────────────────────────────────────────────────────────
interface AgencyWallet {
  balance: number;
  auto_recharge_enabled: boolean;
  auto_recharge_amount: number;
  auto_recharge_threshold: number;
  enforce_master_balance_lock: boolean;
  updated_at?: string;
}

interface Transaction {
  id: string;
  type: 'top_up' | 'gift_sent' | 'gift_received' | 'auto_recharge' | 'request_approved' | 'credit_distribution';
  amount: number;
  balance_after: number;
  description: string;
  timestamp: string;
  location_name?: string;
}

interface CreditRequest {
  request_id: string;
  location_id: string;
  location_name: string;
  amount: number;
  note: string;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
}

interface Subaccount {
  location_id: string;
  location_name: string;
  credit_balance: number;
}

interface CreditPackage {
  credits: number;
  price: number;
  link: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  } catch { return iso; }
}

function txIcon(type: string) {
  switch (type) {
    case 'top_up': case 'auto_recharge': return { icon: <FiArrowDownLeft />, color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
    case 'gift_sent': case 'credit_distribution': return { icon: <FiGift />, color: 'text-purple-500', bg: 'bg-purple-500/10' };
    case 'gift_received': return { icon: <FiGift />, color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
    case 'request_approved': return { icon: <FiCheck />, color: 'text-blue-500', bg: 'bg-blue-500/10' };
    default: return { icon: <FiArrowUpRight />, color: 'text-amber-500', bg: 'bg-amber-500/10' };
  }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse rounded-lg bg-gray-200 dark:bg-white/5 ${className}`} />
);

// ─── Gift Credits Modal ───────────────────────────────────────────────────────
const GiftCreditsModal: React.FC<{
  subaccounts: Subaccount[];
  agencyBalance: number;
  onClose: () => void;
  onSuccess: (locationId: string, amount: number) => void;
}> = ({ subaccounts, agencyBalance, onClose, onSuccess }) => {
  const [selectedId, setSelectedId] = useState('');
  const [amount, setAmount] = useState(100);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) { setError('Please select a subaccount'); return; }
    if (amount <= 0) { setError('Amount must be greater than 0'); return; }
    if (amount > agencyBalance) { setError('Insufficient agency balance'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/billing/agency_wallet.php`, {
        method: 'POST',
        headers: AUTH_HEADERS,
        credentials: 'include',
        body: JSON.stringify({ action: 'gift', location_id: selectedId, amount, note, agency_id: AGENCY_ID }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Gift failed');
      onSuccess(selectedId, amount);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] animate-[fadeIn_0.15s_ease]" onClick={onClose}>
      <div className="bg-white dark:bg-[#141618] border border-[rgba(0,0,0,0.07)] dark:border-[rgba(255,255,255,0.07)] rounded-2xl shadow-2xl p-7 w-full max-w-[440px] mx-4 animate-[scaleIn_0.2s_ease]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
            <FiGift className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[16px] font-bold text-[#111111] dark:text-white">Gift Credits</div>
            <div className="text-[12px] text-[#6b7280] dark:text-[#9aa0a9]">Transfer credits to a subaccount wallet</div>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg text-[#9aa0a9] hover:text-[#111111] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5">
            <FiX className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Subaccount selector */}
          <div>
            <label className="block text-[11px] font-bold text-[#9aa0a6] uppercase tracking-wider mb-1.5">Subaccount</label>
            <div className="relative">
              <select
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] border border-[#e0e0e0] dark:border-[#ffffff0a] text-[13px] text-[#111111] dark:text-[#ececf1] focus:outline-none focus:ring-2 focus:ring-purple-500/30 appearance-none pr-9"
              >
                <option value="">Select a subaccount…</option>
                {subaccounts.map(s => (
                  <option key={s.location_id} value={s.location_id}>
                    {s.location_name} ({(s.credit_balance || 0).toLocaleString()} credits)
                  </option>
                ))}
              </select>
              <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9aa0a6] pointer-events-none" />
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-[11px] font-bold text-[#9aa0a6] uppercase tracking-wider mb-1.5">Credits to Gift</label>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[50, 100, 250, 500].map(n => (
                <button key={n} type="button" onClick={() => setAmount(n)}
                  className={`py-2 rounded-xl text-[12px] font-bold border-2 transition-all ${amount === n ? 'border-purple-500 bg-purple-500/5 text-purple-600' : 'border-[#e0e0e0] dark:border-[#2a2b32] text-[#6e6e73] dark:text-[#9aa0a9] hover:border-purple-400'}`}>
                  {n.toLocaleString()}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={1}
              max={agencyBalance}
              value={amount}
              onChange={e => setAmount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-4 py-2.5 rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] border border-[#e0e0e0] dark:border-[#ffffff0a] text-[13px] text-[#111111] dark:text-[#ececf1] focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              placeholder="Custom amount…"
            />
            <div className="flex justify-between text-[11px] text-[#9aa0a6] mt-1">
              <span>Agency balance after: <strong className="text-[#111111] dark:text-white">{Math.max(0, agencyBalance - amount).toLocaleString()}</strong></span>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-[11px] font-bold text-[#9aa0a6] uppercase tracking-wider mb-1.5">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="E.g. Monthly allocation…"
              className="w-full px-4 py-2.5 rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] border border-[#e0e0e0] dark:border-[#ffffff0a] text-[13px] text-[#111111] dark:text-[#ececf1] focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 text-red-500 text-[12.5px]">
              <FiAlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          <div className="flex gap-2.5 pt-1">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-semibold bg-[#f0f2f8] dark:bg-[#1c1e21] text-[#6b7280] dark:text-[#9aa0a9] border border-[rgba(0,0,0,0.07)] dark:border-[rgba(255,255,255,0.07)] hover:bg-black/5 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading || !selectedId || amount <= 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors shadow-md shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiGift className="w-4 h-4" />}
              {loading ? 'Sending…' : 'Gift Credits'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Top Up Modal ─────────────────────────────────────────────────────────────
const TopUpModal: React.FC<{
  agencyId: string;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ agencyId, onClose, onSuccess }) => {
  const [topUpAmount, setTopUpAmount] = useState(500);
  const [submitted, setSubmitted] = useState(false);
  const popupPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const packages: CreditPackage[] = [
    { credits: 10, price: 10, link: "https://sms.nolawebsolutions.com/nola-sms-pro---500-credits-page-8465-657955" },
    { credits: 500, price: 500, link: "https://sms.nolawebsolutions.com/nola-sms-pro---500-credits-page-8465" },
    { credits: 1100, price: 1000, link: "https://sms.nolawebsolutions.com/nola-sms-pro---1000-credits" },
    { credits: 2750, price: 2500, link: "https://sms.nolawebsolutions.com/nola-sms-pro-2750-credits" },
    { credits: 6000, price: 5000, link: "https://sms.nolawebsolutions.com/nola-sms-pro-6000-credits" },
  ];

  const handleTopUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pkg = packages.find(p => p.credits === topUpAmount);
    if (!pkg) return;

    const separator = pkg.link.includes('?') ? '&' : '?';
    const checkoutUrl = `${pkg.link}${separator}agency_id=${encodeURIComponent(agencyId)}&scope=agency`;

    const width = 600, height = 850;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);

    const popup = window.open(
      checkoutUrl, 'AgencyTopUp',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );

    if (!popup) {
      alert("Popup blocked! Please allow popups for this site.");
      return;
    }

    setSubmitted(true);
    if (popupPollRef.current) clearInterval(popupPollRef.current);

    popupPollRef.current = setInterval(() => {
      try {
        if (popup && popup.closed) {
          if (popupPollRef.current) clearInterval(popupPollRef.current);
          setSubmitted(false);
          onSuccess();
          onClose();
        }
      } catch (e) {
        // cross-origin DOM exception logic
      }
    }, 500);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000]" onClick={onClose}>
      <div className="bg-white dark:bg-[#141618] border border-[rgba(0,0,0,0.07)] dark:border-[rgba(255,255,255,0.07)] rounded-2xl shadow-2xl p-7 w-full max-w-[480px] mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
            <FiZap className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[16px] font-bold text-[#111111] dark:text-white">Top Up Agency Balance</div>
            <div className="text-[12px] text-[#6b7280] dark:text-[#9aa0a9]">Select a package and proceed to checkout</div>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg text-[#9aa0a9] hover:text-[#111111] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5">
            <FiX className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleTopUpSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {packages.map(pkg => (
              <button
                key={pkg.credits}
                type="button"
                onClick={() => setTopUpAmount(pkg.credits)}
                className={`flex flex-col items-center py-3 rounded-xl border-2 transition-all ${topUpAmount === pkg.credits
                  ? 'border-[#2b83fa] bg-[#2b83fa]/5'
                  : 'border-[#e0e0e0] dark:border-[#2a2b32] hover:border-[#2b83fa]/40'
                }`}
              >
                <span className={`text-[16px] font-black ${topUpAmount === pkg.credits ? 'text-[#2b83fa]' : 'text-[#111111] dark:text-white'}`}>
                  {pkg.credits.toLocaleString()}
                </span>
                <span className="text-[11px] text-[#9aa0a6]">credits</span>
                <span className={`text-[12px] font-bold mt-1 ${topUpAmount === pkg.credits ? 'text-[#2b83fa]' : 'text-[#6e6e73]'}`}>
                  ₱{pkg.price}
                </span>
              </button>
            ))}
          </div>
          
          {submitted ? (
             <div className="flex flex-col items-center justify-center gap-2 py-4">
               <div className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-600 dark:text-emerald-400 font-semibold text-[13px]">
                   <FiCheck className="w-4 h-4" /> Checkout window opened
               </div>
               <button type="button" onClick={() => setSubmitted(false)} className="text-[12px] text-[#9aa0a6] underline decoration-dashed hover:text-[#111111]">
                   Window didn't open or you closed it? Refresh.
               </button>
             </div>
          ) : (
            <div className="flex gap-2.5 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-semibold bg-[#f0f2f8] dark:bg-[#1c1e21] text-[#6b7280] dark:text-[#9aa0a9] border border-[rgba(0,0,0,0.07)] dark:border-[rgba(255,255,255,0.07)] hover:bg-black/5 transition-colors">
                Cancel
              </button>
              <button type="submit"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold bg-[#2b83fa] hover:bg-[#1d6bd4] text-white transition-colors shadow-md shadow-blue-500/20">
                <FiZap className="w-4 h-4" /> Buy {topUpAmount.toLocaleString()} Credits
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

// ─── Billing Page ─────────────────────────────────────────────────────────────
export const Billing: React.FC = () => {
  const { agencyId } = useAgency();
  const { toasts, showToast, dismissToast } = useToast();
  const mountedRef = useRef(true);

  const [tab, setTab] = useState<'wallet' | 'requests'>('wallet');
  const [txTab, setTxTab] = useState<'summary' | 'detailed'>('summary');

  // Wallet state
  const [wallet, setWallet] = useState<AgencyWallet | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);

  // Auto-recharge config (local edits)
  const [arEnabled, setArEnabled] = useState(false);
  const [arAmount, setArAmount] = useState(500);
  const [arThreshold, setArThreshold] = useState(100);
  const [arSaving, setArSaving] = useState(false);

  // Master balance lock (optional feature)
  const [masterLock, setMasterLock] = useState(false);
  const [masterLockSaving, setMasterLockSaving] = useState(false);

  // Transactions
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [txMonth, setTxMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Credit requests
  const [requests, setRequests] = useState<CreditRequest[]>([]);
  const [reqLoading, setReqLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // Subaccounts (for gift modal)
  const [subaccounts, setSubaccounts] = useState<Subaccount[]>([]);
  const [giftModalOpen, setGiftModalOpen] = useState(false);
  const [topUpModalOpen, setTopUpModalOpen] = useState(false);

  const effectiveAgencyId = agencyId || AGENCY_ID;

  // ── Fetch wallet ────────────────────────────────────────────────────────────
  const fetchWallet = useCallback(async () => {
    setWalletLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/billing/agency_wallet.php?agency_id=${effectiveAgencyId}`, { credentials: 'include', headers: { 'X-Webhook-Secret': WEBHOOK_SECRET } });
      const data = await res.json();
      if (!mountedRef.current) return;
      setWallet(data);
      setArEnabled(data.auto_recharge_enabled ?? false);
      setArAmount(data.auto_recharge_amount ?? 500);
      setArThreshold(data.auto_recharge_threshold ?? 100);
    } catch {
      if (!mountedRef.current) return;
      // Use mock data when endpoint isn't live yet
      setWallet({ balance: 0, auto_recharge_enabled: false, auto_recharge_amount: 500, auto_recharge_threshold: 100, enforce_master_balance_lock: false });
    } finally {
      if (mountedRef.current) setWalletLoading(false);
    }
  }, [effectiveAgencyId]);

  // ── Fetch transactions ──────────────────────────────────────────────────────
  const fetchTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/billing/transactions.php?scope=agency&agency_id=${effectiveAgencyId}&month=${txMonth}`, { credentials: 'include', headers: { 'X-Webhook-Secret': WEBHOOK_SECRET } });
      const data = await res.json();
      if (!mountedRef.current) return;
      setTransactions(data.transactions || []);
    } catch {
      if (!mountedRef.current) return;
      setTransactions([]);
    } finally {
      if (mountedRef.current) setTxLoading(false);
    }
  }, [effectiveAgencyId, txMonth]);

  // ── Fetch credit requests ───────────────────────────────────────────────────
  const fetchRequests = useCallback(async () => {
    setReqLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/billing/credit_requests.php?agency_id=${effectiveAgencyId}`, { credentials: 'include', headers: { 'X-Webhook-Secret': WEBHOOK_SECRET } });
      const data = await res.json();
      if (!mountedRef.current) return;
      const reqs: CreditRequest[] = data.requests || [];
      setRequests(reqs);
      setPendingCount(reqs.filter(r => r.status === 'pending').length);
    } catch {
      if (!mountedRef.current) return;
      setRequests([]);
    } finally {
      if (mountedRef.current) setReqLoading(false);
    }
  }, [effectiveAgencyId]);

  // ── Fetch subaccounts for gift modal ────────────────────────────────────────
  const fetchSubaccounts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/agency/get_subaccounts.php?agency_id=${effectiveAgencyId}`, { credentials: 'include', headers: { 'X-Webhook-Secret': WEBHOOK_SECRET, 'X-Agency-ID': effectiveAgencyId } });
      const data = await res.json();
      if (!mountedRef.current) return;
      setSubaccounts(data.subaccounts || []);
    } catch {
      if (!mountedRef.current) return;
    }
  }, [effectiveAgencyId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchWallet();
    fetchRequests();
    fetchSubaccounts();
    return () => { mountedRef.current = false; };
  }, [fetchWallet, fetchRequests, fetchSubaccounts]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  // ── Save auto-recharge ──────────────────────────────────────────────────────
  const saveAutoRecharge = async () => {
    setArSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/billing/agency_wallet.php`, {
        method: 'POST',
        headers: AUTH_HEADERS,
        credentials: 'include',
        body: JSON.stringify({ action: 'set_auto_recharge', agency_id: effectiveAgencyId, enabled: arEnabled, amount: arAmount, threshold: arThreshold }),
      });
      const data = await res.json();
      if (data.success) showToast('Auto-recharge settings saved.', 'success');
      else throw new Error(data.error);
    } catch {
      showToast('Failed to save auto-recharge settings.', 'error');
    } finally {
      setArSaving(false);
    }
  };

  // ── Save master balance lock ────────────────────────────────────────────────
  const saveMasterLock = async (val: boolean) => {
    setMasterLock(val);
    setMasterLockSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/billing/agency_wallet.php`, {
        method: 'POST',
        headers: AUTH_HEADERS,
        credentials: 'include',
        body: JSON.stringify({ action: 'set_master_lock', agency_id: effectiveAgencyId, enabled: val }),
      });
      const data = await res.json();
      if (data.success) showToast(val ? 'Master balance lock enabled.' : 'Master balance lock disabled.', 'info');
      else throw new Error(data.error);
    } catch {
      showToast('Failed to update master balance lock.', 'error');
      setMasterLock(v => !v); // revert
    } finally {
      setMasterLockSaving(false);
    }
  };

  // ── Top up modal trigger ────────────────────────────────────────────────────
  const handleTopUp = () => {
    setTopUpModalOpen(true);
  };

  // ── Approve / deny request ──────────────────────────────────────────────────
  const handleRequestAction = async (requestId: string, action: 'approve' | 'deny') => {
    setActionLoading(prev => ({ ...prev, [requestId]: true }));
    try {
      const res = await fetch(`${API_BASE}/api/billing/credit_requests.php`, {
        method: 'POST',
        headers: AUTH_HEADERS,
        credentials: 'include',
        body: JSON.stringify({ action, request_id: requestId, agency_id: effectiveAgencyId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Action failed');
      showToast(action === 'approve' ? 'Credits sent to subaccount.' : 'Request denied.', action === 'approve' ? 'success' : 'info');
      fetchRequests();
      if (action === 'approve') fetchWallet();
    } catch (e: any) {
      showToast(`Failed: ${e.message}`, 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, [requestId]: false }));
    }
  };

  // ── Months for selector ─────────────────────────────────────────────────────
  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
    return { val, label };
  });

  const balance = wallet?.balance ?? 0;
  const isLow = balance < 100;

  return (
    <AgencyLayout title="Credits & Billing" subtitle="Agency funding wallet — distribute credits to subaccounts and manage top-ups">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {topUpModalOpen && (
        <TopUpModal 
          agencyId={effectiveAgencyId}
          onClose={() => setTopUpModalOpen(false)}
          onSuccess={() => {
             showToast('Top up flow completed. Verifying balance...', 'info');
             fetchWallet();
             fetchTransactions();
          }}
        />
      )}

      {giftModalOpen && (
        <GiftCreditsModal
          subaccounts={subaccounts}
          agencyBalance={balance}
          onClose={() => setGiftModalOpen(false)}
          onSuccess={(locId, amt) => {
            showToast(`Gifted ${amt.toLocaleString()} credits successfully.`, 'success');
            setGiftModalOpen(false);
            fetchWallet();
            fetchTransactions();
          }}
        />
      )}

      {/* ── Page Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 mb-6 border-b border-[#e5e5e5] dark:border-white/5">
        {[
          { id: 'wallet', label: 'Wallet & Transactions' },
          { id: 'requests', label: 'Credit Requests', badge: pendingCount },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`relative flex items-center gap-2 px-4 py-3 text-[13.5px] font-semibold transition-all border-b-2 -mb-[2px] ${tab === t.id
              ? 'border-[#2b83fa] text-[#2b83fa]'
              : 'border-transparent text-[#6e6e73] dark:text-[#9aa0a9] hover:text-[#111111] dark:hover:text-white'}`}
          >
            {t.label}
            {!!t.badge && (
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════ WALLET TAB ══════════════════════════════════════ */}
      {tab === 'wallet' && (
        <div className="space-y-5">
          {/* Low-balance informational nudge (non-blocking by default) */}
          {!walletLoading && balance < 100 && !masterLock && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-600 dark:text-amber-400 animate-in fade-in slide-in-from-top-2 duration-300">
              <FiAlertTriangle className="w-5 h-5 flex-shrink-0" />
              <div>
                <div className="text-[13px] font-bold">Agency wallet is running low</div>
                <div className="text-[12px] opacity-80 mt-0.5">Subaccounts can still send SMS. Top up or distribute credits to stay ahead.</div>
              </div>
              <button onClick={handleTopUp} className="ml-auto flex-shrink-0 px-4 py-2 rounded-lg bg-amber-500 text-white text-[12.5px] font-bold hover:bg-amber-600 transition-colors shadow-sm">
                Add Balance
              </button>
            </div>
          )}
          {/* Wallet Card */}
          <div className="bg-white/70 dark:bg-[#121415]/80 backdrop-blur-2xl border border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.05)] rounded-2xl p-6 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-[12px] font-semibold text-[#6e6e73] dark:text-[#9aa0a9] uppercase tracking-wider mb-2">Agency Funding Wallet</div>
                {walletLoading ? (
                  <Skeleton className="h-10 w-36" />
                ) : (
                  <div className="flex items-center gap-3">
                    <span className={`text-[42px] font-black leading-none tracking-tight ${isLow ? 'text-red-500' : 'text-[#111111] dark:text-white'}`}>
                      {balance.toLocaleString()}
                    </span>
                    <span className="text-[14px] font-semibold text-[#6e6e73] dark:text-[#9aa0a9] mt-3">credits</span>
                    {isLow && (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 text-[11px] font-bold mt-2">
                        <FiAlertTriangle className="w-3 h-3" /> Low
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={fetchWallet} title="Refresh" className="p-2 rounded-xl bg-[#f7f7f7] dark:bg-white/5 border border-[#e0e0e0] dark:border-white/5 text-[#6e6e73] hover:text-[#111111] dark:hover:text-white transition-all">
                  <FiRefreshCw className={`w-4 h-4 ${walletLoading ? 'animate-spin' : ''}`} />
                </button>
                <button onClick={handleTopUp}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2b83fa] hover:bg-[#1d6bd4] text-white text-[13px] font-bold shadow-md shadow-[#2b83fa]/25 transition-all hover:shadow-[#2b83fa]/40">
                  <FiPlus className="w-4 h-4" /> Add Balance
                </button>
              </div>
            </div>

            {/* Auto-recharge row */}
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-[#f0f0f0] dark:border-white/5">
              <button
                onClick={() => setArEnabled(v => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 focus:outline-none ${arEnabled ? 'bg-[#2b83fa]' : 'bg-gray-200 dark:bg-[#3a3b3f]'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${arEnabled ? 'translate-x-[18px]' : 'translate-x-1'}`} />
              </button>
              <span className="text-[13px] text-[#6e6e73] dark:text-[#9aa0a9] font-medium">Auto recharge with</span>
              <div className="relative">
                <select
                  value={arAmount}
                  onChange={e => setArAmount(Number(e.target.value))}
                  disabled={!arEnabled}
                  className="pl-3 pr-7 py-1.5 rounded-lg bg-[#f0f2f8] dark:bg-[#1c1e21] border border-[rgba(0,0,0,0.07)] dark:border-[rgba(255,255,255,0.07)] text-[13px] font-bold text-[#111111] dark:text-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 disabled:opacity-50"
                >
                  {RECHARGE_AMOUNTS.map(v => <option key={v} value={v}>{v.toLocaleString()} credits</option>)}
                </select>
                <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#9aa0a6] pointer-events-none" />
              </div>
              <span className="text-[13px] text-[#6e6e73] dark:text-[#9aa0a9] font-medium">when balance is lower than</span>
              <div className="relative">
                <select
                  value={arThreshold}
                  onChange={e => setArThreshold(Number(e.target.value))}
                  disabled={!arEnabled}
                  className="pl-3 pr-7 py-1.5 rounded-lg bg-[#f0f2f8] dark:bg-[#1c1e21] border border-[rgba(0,0,0,0.07)] dark:border-[rgba(255,255,255,0.07)] text-[13px] font-bold text-[#111111] dark:text-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 disabled:opacity-50"
                >
                  {RECHARGE_THRESHOLDS.map(v => <option key={v} value={v}>{v.toLocaleString()} credits</option>)}
                </select>
                <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#9aa0a6] pointer-events-none" />
              </div>
              <button onClick={saveAutoRecharge} disabled={arSaving}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#f0f2f8] dark:bg-[#1c1e21] border border-[rgba(0,0,0,0.07)] dark:border-[rgba(255,255,255,0.07)] text-[12.5px] font-semibold text-[#6e6e73] dark:text-[#9aa0a9] hover:text-[#111111] dark:hover:text-white transition-colors disabled:opacity-50">
                {arSaving ? <FiRefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FiCheck className="w-3.5 h-3.5" />}
                Save
              </button>
            </div>
          </div>

          {/* ── Gift Credits Card ──────────────────────────────────────────────── */}
          <div className="bg-white/70 dark:bg-[#121415]/80 backdrop-blur-2xl border border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.05)] rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 flex-shrink-0">
                  <FiGift className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[13.5px] font-bold text-[#111111] dark:text-white">Gift Credits to Subaccount</div>
                  <div className="text-[12px] text-[#6e6e73] dark:text-[#9aa0a9] mt-0.5">Transfer credits directly from your agency wallet to any subaccount.</div>
                </div>
              </div>
              <button onClick={() => setGiftModalOpen(true)}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[13px] font-bold shadow-md shadow-purple-500/20 hover:shadow-purple-500/40 transition-all">
                <FiGift className="w-4 h-4" /> Gift Credits
              </button>
            </div>
          </div>

          {/* Master balance lock (optional) */}
          {!walletLoading && (
            <div className="bg-white/70 dark:bg-[#121415]/80 backdrop-blur-2xl border border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.05)] rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[13.5px] font-bold text-[#111111] dark:text-white">Master Balance Lock</div>
                  <div className="text-[12px] text-[#6e6e73] dark:text-[#9aa0a9] mt-1">
                    When enabled, sending is blocked for all subaccounts when this agency wallet reaches 0. Off by default — subaccounts use only their own balances.
                  </div>
                </div>
                <button
                  onClick={() => saveMasterLock(!masterLock)}
                  disabled={masterLockSaving}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none mt-0.5 disabled:opacity-50 ${
                    masterLock ? 'bg-red-500' : 'bg-gray-200 dark:bg-[#3a3b3f]'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${masterLock ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              {masterLock && balance === 0 && (
                <div className="mt-3 flex items-center gap-2 text-[12px] text-red-500 font-semibold">
                  <FiAlertTriangle className="w-3.5 h-3.5" />
                  Master lock is ON and wallet is empty — all subaccounts are currently blocked from sending.
                </div>
              )}
            </div>
          )}

          {/* Wallet Transactions */}
          <div className="bg-white/70 dark:bg-[#121415]/80 backdrop-blur-2xl border border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.05)] rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#e5e5e5] dark:border-white/5 flex items-center justify-between flex-wrap gap-3">
              <div className="text-[15px] font-bold text-[#111111] dark:text-white">Wallet Transactions</div>
              <div className="flex items-center gap-3">
                {/* Month selector */}
                <div className="relative">
                  <select value={txMonth} onChange={e => setTxMonth(e.target.value)}
                    className="pl-3 pr-8 py-1.5 rounded-lg bg-[#f0f2f8] dark:bg-[#1c1e21] border border-[rgba(0,0,0,0.07)] dark:border-[rgba(255,255,255,0.07)] text-[12.5px] font-semibold text-[#111111] dark:text-white appearance-none focus:outline-none">
                    {monthOptions.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                  </select>
                  <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#9aa0a6] pointer-events-none" />
                </div>
                <button onClick={fetchTransactions} className="p-1.5 rounded-lg text-[#6e6e73] hover:text-[#111111] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all">
                  <FiRefreshCw className={`w-4 h-4 ${txLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex border-b border-[#e5e5e5] dark:border-white/5 px-6">
              {[{ id: 'summary', label: 'Summary' }, { id: 'detailed', label: 'Detailed Transactions' }].map(t => (
                <button key={t.id} onClick={() => setTxTab(t.id as any)}
                  className={`px-1 py-3 mr-6 text-[13px] font-semibold border-b-2 -mb-[2px] transition-colors ${txTab === t.id ? 'border-[#2b83fa] text-[#2b83fa]' : 'border-transparent text-[#6e6e73] dark:text-[#9aa0a9] hover:text-[#111111] dark:hover:text-white'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {txLoading ? (
                <div className="space-y-3">{[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
                    <div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-3/4" /><Skeleton className="h-2.5 w-1/3" /></div>
                    <Skeleton className="h-3 w-16 flex-shrink-0" />
                  </div>
                ))}</div>
              ) : transactions.length === 0 ? (
                <div className="flex flex-col items-center py-10 gap-2 text-center">
                  <div className="w-12 h-12 rounded-xl bg-[#2b83fa]/10 flex items-center justify-center"><FiCreditCard className="w-6 h-6 text-[#2b83fa]/50" /></div>
                  <div className="text-[14px] font-semibold text-[#6e6e73] dark:text-[#9aa0a9]">No transactions this month</div>
                  <div className="text-[12px] text-[#9aa0a6]">Activity will appear here once credits are added or used.</div>
                </div>
              ) : txTab === 'summary' ? (
                /* Summary view */
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Credits Added', value: transactions.filter(t => ['top_up', 'auto_recharge'].includes(t.type)).reduce((s, t) => s + Math.abs(t.amount), 0), color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: <FiArrowDownLeft /> },
                    { label: 'Distributed Out', value: transactions.filter(t => ['gift_sent', 'credit_distribution', 'request_approved'].includes(t.type)).reduce((s, t) => s + Math.abs(t.amount), 0), color: 'text-purple-500', bg: 'bg-purple-500/10', icon: <FiGift /> },
                    { label: 'Auto-Recharged', value: transactions.filter(t => t.type === 'auto_recharge').reduce((s, t) => s + Math.abs(t.amount), 0), color: 'text-blue-500', bg: 'bg-blue-500/10', icon: <FiRefreshCw /> },
                  ].map(s => (
                    <div key={s.label} className="bg-[#f7f7f7] dark:bg-white/[0.03] rounded-xl p-4">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2.5 ${s.bg} ${s.color}`}>{s.icon}</div>
                      <div className={`text-[24px] font-black ${s.color}`}>{s.value.toLocaleString()}</div>
                      <div className="text-[11px] text-[#9aa0a6] mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Detailed list */
                <div className="space-y-0">
                  {transactions.map(tx => {
                    const { icon, color, bg } = txIcon(tx.type);
                    const isPos = ['top_up', 'auto_recharge', 'gift_received', 'request_approved'].includes(tx.type);
                    return (
                      <div key={tx.id} className="flex items-center gap-3 py-3 border-b border-[#f0f0f0] dark:border-white/5 last:border-0 hover:bg-black/[0.015] dark:hover:bg-white/[0.015] px-2 rounded-xl transition-colors">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-[14px] ${bg} ${color}`}>{icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium text-[#111111] dark:text-[#ececf1] truncate">{tx.description}</div>
                          <div className="text-[11px] text-[#9aa0a6]">{fmtDate(tx.timestamp)}</div>
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0">
                          <span className={`text-[13px] font-bold ${isPos ? 'text-emerald-500' : 'text-red-500'}`}>
                            {isPos ? '+' : '−'}{Math.abs(tx.amount).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-[#9aa0a6]">bal: {tx.balance_after?.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ REQUESTS TAB ════════════════════════════════════ */}
      {tab === 'requests' && (
        <div className="bg-white/70 dark:bg-[#121415]/80 backdrop-blur-2xl border border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.05)] rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e5e5e5] dark:border-white/5 flex items-center justify-between gap-3">
            <div>
              <div className="text-[15px] font-bold text-[#111111] dark:text-white">Credit Requests</div>
              <div className="text-[12.5px] text-[#6e6e73] dark:text-[#9aa0a9] mt-0.5">Subaccounts requesting credit top-ups from your agency wallet</div>
            </div>
            <button onClick={fetchRequests} className="p-1.5 rounded-lg text-[#6e6e73] hover:text-[#111111] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all">
              <FiRefreshCw className={`w-4 h-4 ${reqLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 px-6 py-3 border-b border-[#e5e5e5] dark:border-white/5">
            {['all', 'pending', 'approved', 'denied'].map(f => {
              const count = f === 'all' ? requests.length : requests.filter(r => r.status === f).length;
              return (
                <button key={f} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-[#f0f2f8] dark:bg-[#1c1e21] text-[#6e6e73] dark:text-[#9aa0a9] hover:text-[#111111] dark:hover:text-white transition-colors capitalize">
                  {f} <span className="text-[10px] font-bold">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="p-6">
            {reqLoading ? (
              <div className="space-y-4">{[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-[#e5e5e5] dark:border-white/5">
                  <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-48" /><Skeleton className="h-2.5 w-32" /></div>
                  <Skeleton className="h-8 w-20 rounded-lg" />
                  <Skeleton className="h-8 w-20 rounded-lg" />
                </div>
              ))}</div>
            ) : requests.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-3 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#2b83fa]/10 flex items-center justify-center"><FiInbox className="w-7 h-7 text-[#2b83fa]/50" /></div>
                <div className="text-[15px] font-semibold text-[#6e6e73] dark:text-[#9aa0a9]">No credit requests yet</div>
                <div className="text-[12.5px] text-[#9aa0a6] max-w-xs">When subaccounts request credits, they'll appear here for you to approve or deny.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map(req => {
                  const isPending = req.status === 'pending';
                  const isLoading = !!actionLoading[req.request_id];
                  return (
                    <div key={req.request_id} className="flex items-center gap-4 p-4 rounded-xl border border-[#e5e5e5] dark:border-white/5 bg-[#f7f7f7]/50 dark:bg-white/[0.02] hover:bg-white dark:hover:bg-white/[0.04] transition-colors">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' : req.status === 'denied' ? 'bg-red-500/10 text-red-500' : 'bg-[#2b83fa]/10 text-[#2b83fa]'}`}>
                        {req.status === 'approved' ? <FiCheck className="w-5 h-5" /> : req.status === 'denied' ? <FiX className="w-5 h-5" /> : <FiClock className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] font-semibold text-[#111111] dark:text-white">{req.location_name}</div>
                        <div className="text-[12px] text-[#6e6e73] dark:text-[#9aa0a9]">
                          Requesting <strong className="text-[#2b83fa]">{req.amount.toLocaleString()} credits</strong>
                          {req.note && <> · <span className="italic">"{req.note}"</span></>}
                        </div>
                        <div className="text-[11px] text-[#9aa0a6] mt-0.5">{fmtDate(req.created_at)}</div>
                      </div>
                      {isPending ? (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleRequestAction(req.request_id, 'deny')}
                            disabled={isLoading}
                            className="px-3.5 py-1.5 rounded-lg text-[12.5px] font-bold text-[#6e6e73] dark:text-[#9aa0a9] bg-[#f0f2f8] dark:bg-[#1c1e21] border border-[rgba(0,0,0,0.07)] dark:border-[rgba(255,255,255,0.07)] hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-500 transition-all disabled:opacity-50"
                          >
                            Deny
                          </button>
                          <button
                            onClick={() => handleRequestAction(req.request_id, 'approve')}
                            disabled={isLoading || req.amount > balance}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12.5px] font-bold text-white bg-emerald-500 hover:bg-emerald-600 transition-all shadow-sm shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isLoading ? <FiRefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FiCheck className="w-3.5 h-3.5" />}
                            Approve
                          </button>
                        </div>
                      ) : (
                        <span className={`px-3 py-1 rounded-full text-[11.5px] font-bold flex-shrink-0 ${req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-500'}`}>
                          {req.status === 'approved' ? 'Approved' : 'Denied'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </AgencyLayout>
  );
};
