import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { login as authLogin } from '../services/authService';
import defaultLogo from '../assets/NOLA SMS PRO Logo.png';

interface SharedLoginProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

interface WebLabelData {
  logo_url?: string;
  company_name?: string;
  primary_color?: string;
}

const SharedLogin: React.FC<SharedLoginProps> = ({ darkMode, toggleDarkMode }) => {
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [whitelabel, setWhitelabel] = useState<WebLabelData | null>(null);
  const [isBrandingLoading, setIsBrandingLoading] = useState(true);

  const navigate = useNavigate();

  // Welcome-back / bulk-install banners (triggered by query params from callback redirects)
  const [searchParams] = useSearchParams();
  const isWelcomeBack  = searchParams.get('welcome_back') === '1';
  const locationName   = searchParams.get('name') ?? null;
  const isBulkInstall  = searchParams.get('bulk_install') === '1';
  const bulkCount      = searchParams.get('count') ?? '';

  useEffect(() => {
    // Fetch custom domain branding with a 5-second hard timeout.
    // The `finally` block ALWAYS clears the loading state so the page
    // never appears blank when the whitelabel API is slow or unreachable.
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 5000);

    fetch(`https://smspro-api.nolacrm.io/api/public/whitelabel?domain=${encodeURIComponent(window.location.hostname)}`, {
      signal: controller.signal,
    })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Non-OK response');
      })
      .then(data => {
        // API returns { status, branding: { ... } } — unwrap the nested object
        setWhitelabel(data.branding ?? data);
      })
      .catch(() => {
        // Timeout or network error — fall back to default NOLA branding silently
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setIsBrandingLoading(false); // ALWAYS unblock rendering
      });

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await authLogin(email, password);

      if (data.role === 'agency') {
        // Agency accounts belong at the agency portal — redirect automatically.
        // Clear any stale token from the user app first.
        localStorage.clear();
        setError('Agency account detected. Redirecting to your portal…');
        setTimeout(() => {
          window.location.href = 'https://agency.nolasmspro.com';
        }, 800);
        return;
      } else {
        // Persist full user profile for checkout pre-fill and dashboard display
        if (data.user) {
          localStorage.setItem('nola_user', JSON.stringify({
            name:          data.user.name          ?? '',
            email:         data.user.email         ?? email,
            phone:         (data.user.phone        ?? '').replace(/\s+/g, ''),
            location_id:   data.location_id        ?? null,
            company_id:    data.company_id         ?? null,
            location_name: data.user.location_name ?? null,
            company_name:  data.user.company_name  ?? null,
          }));
        }
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const primaryColor = whitelabel?.primary_color || '#3b82f6'; // fallback to standard blue
  const companyName = whitelabel?.company_name || 'NOLA SMS Pro';

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gray-50 dark:bg-[#0a0a0b] transition-colors duration-300">
      
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] opacity-20 dark:opacity-10 pointer-events-none" style={{ background: primaryColor }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] opacity-20 dark:opacity-10 pointer-events-none" style={{ background: primaryColor }} />

      {/* Theme Toggle mapped for Login screen since we hid the global one */}
      <button
        onClick={toggleDarkMode}
        className="absolute top-6 right-6 p-2.5 rounded-xl bg-white/50 dark:bg-black/50 backdrop-blur-md border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 shadow-sm hover:bg-white dark:hover:bg-white/10 transition-all z-50"
      >
         {darkMode ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
      </button>

      {/* ── Bulk-install banner (shown above the card when ?bulk_install=1) ── */}
      {isBulkInstall && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="w-full max-w-md mb-4 z-10"
        >
          <div className="flex items-start gap-3 px-5 py-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40">
            <svg
              width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="flex-shrink-0 mt-0.5"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <p className="text-[13.5px] font-bold text-amber-800 dark:text-amber-300 mb-1">
                Agency Bulk Installation
                {bulkCount
                  ? ` — ${bulkCount} sub-account${Number(bulkCount) !== 1 ? 's' : ''} provisioned`
                  : ''}
              </p>
              <p className="text-[12.5px] text-amber-700 dark:text-amber-400 leading-relaxed">
                Your agency installation is complete! Each sub-account admin must
                <strong className="font-semibold"> open NOLA SMS Pro from within their own GHL sub-account</strong> to
                complete their individual registration and activate settings.
              </p>
              <p className="text-[11.5px] text-amber-600 dark:text-amber-500 mt-1.5 leading-relaxed">
                If you are a sub-account admin, ask your agency owner to resend access
                or open the app directly from your GHL sidebar.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md p-8 md:p-10 rounded-3xl bg-white/70 dark:bg-[#1a1b1e]/70 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.05)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <img
            src={(whitelabel?.logo_url) ? whitelabel.logo_url : defaultLogo}
            alt={whitelabel?.company_name || 'NOLA SMS Pro'}
            className="h-[72px] object-contain mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1 tracking-tight">
            Welcome back
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Sign in to your {companyName} account
          </p>
        </div>

        {/* Welcome-back banner (shown after re-install redirect) */}
        {isWelcomeBack && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-blue-50 dark:bg-[#2b83fa]/10 border border-blue-100 dark:border-[#2b83fa]/20 text-sm"
          >
            <p className="font-bold text-[#2b83fa] mb-0.5">
              {locationName ? `Welcome back! ${locationName} has been reinstalled.` : 'Welcome back!'}
            </p>
            <p className="text-blue-600/80 dark:text-blue-400/80">
              Please sign in to continue to your dashboard.
            </p>
          </motion.div>
        )}

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 text-sm border border-red-100 dark:border-red-500/20"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 ml-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3.5 rounded-xl bg-gray-100 dark:bg-black/40 border border-transparent dark:border-white/5 focus:border-transparent focus:ring-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none transition-all"
              style={{ paddingRight: '1rem', '--tw-ring-color': primaryColor } as any}
              placeholder="you@company.com"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5 ml-1 pr-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <a href="#" className="text-xs font-medium hover:underline transition-all" style={{ color: primaryColor }}>
                Forgot password?
              </a>
            </div>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 pr-11 rounded-xl bg-gray-100 dark:bg-black/40 border border-transparent dark:border-white/5 focus:border-transparent focus:ring-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none transition-all"
                style={{ '--tw-ring-color': primaryColor } as any}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                tabIndex={-1}
              >
                {showPw ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl text-white font-bold shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-[#1a1b1e] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center relative overflow-hidden group btn-new-message"
          >
            <span className="relative z-10 flex items-center">
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </span>
            </button>

        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-white/5 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default SharedLogin;
