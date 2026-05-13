import React, { useState } from 'react';
import { FiEye, FiEyeOff, FiAlertTriangle, FiCheck } from 'react-icons/fi';
// @ts-ignore
import defaultLogo from '../../assets/NOLA SMS PRO Logo.png';

interface AdminLoginProps {
  onLogin: (username: string, token?: string) => void;
  darkMode?: boolean;
  toggleDarkMode?: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin, darkMode, toggleDarkMode }) => {
  const [view, setView] = useState<'login' | 'forgot'>('login');
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const primaryColor = '#3b82f6';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
        const res = await fetch('/api/admin_auth.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const json = await res.json();
        
        if (res.ok && json.status === 'success') {
            // Pass any token the backend returns so it can be stored securely
            onLogin(username, json.token ?? undefined);
        } else {
            setError(json.message || 'Incorrect username or password.');
        }
    } catch (err) {
        setError('Connection error. Please check your backend.');
    } finally {
        setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      try {
          await fetch('/api/admin_forgot_password.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: forgotUsername })
          });
          setForgotSuccess(true);
      } catch (err) {
          setForgotSuccess(true);
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center relative overflow-hidden bg-gray-50 dark:bg-[#0a0a0b] transition-colors duration-300 ${darkMode ? 'dark' : ''}`}>

      {/* Background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] opacity-20 dark:opacity-10 pointer-events-none" style={{ background: primaryColor }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] opacity-20 dark:opacity-10 pointer-events-none" style={{ background: primaryColor }} />

      {/* Theme toggle */}
      {toggleDarkMode && (
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
      )}

      <div className="w-full max-w-md p-8 md:p-10 rounded-3xl bg-white/70 dark:bg-[#1a1b1e]/70 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.05)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] z-10 animate-in zoom-in-95 fade-in duration-300">
        
        <div className="flex flex-col items-center mb-8">
          <img src={defaultLogo} alt="NOLA SMS Pro" className="h-[72px] object-contain mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1 tracking-tight">Admin Portal</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
             {view === 'login' ? 'Sign in to management dashboard' : 'Reset your password'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 text-sm border border-red-100 dark:border-red-500/20 flex items-start gap-2 animate-in slide-in-from-top-2 fade-in">
            <FiAlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {view === 'forgot' ? (
          <form onSubmit={handleForgotSubmit} className="space-y-5 animate-in fade-in duration-300">
            {forgotSuccess ? (
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <FiCheck className="w-6 h-6 text-emerald-400" />
                    </div>
                    <p className="text-[14px] text-gray-600 dark:text-gray-400">
                        If an admin with that identifier exists, a secure password reset link has been dispatched to the registered email address.
                    </p>
                    <button
                        type="button"
                        onClick={() => { setView('login'); setForgotSuccess(false); setForgotUsername(''); }}
                        className="mt-4 text-[14px] font-bold text-[#2b83fa] hover:text-[#1d6bd4] transition-colors"
                    >
                        Back to Log In
                    </button>
                </div>
            ) : (
                <>
                  <p className="text-[13px] text-gray-500 dark:text-gray-400 text-center mb-4">
                      Enter your admin username or email and we'll send you a link to reset your password.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 ml-1">Username or Email</label>
                    <input
                      type="text"
                      autoFocus
                      required
                      value={forgotUsername}
                      onChange={(e) => { setForgotUsername(e.target.value); if (error) setError(null); }}
                      className="w-full px-4 py-3.5 rounded-xl bg-gray-100 dark:bg-black/40 border border-transparent dark:border-white/5 focus:border-transparent focus:ring-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none transition-all"
                      style={{ '--tw-ring-color': primaryColor } as any}
                      placeholder="e.g. admin"
                    />
                  </div>

                  <div className="flex flex-col gap-3 pt-4">
                      <button
                          type="submit"
                          disabled={!forgotUsername.trim() || loading}
                          className="w-full py-3.5 px-4 rounded-xl text-white font-bold shadow-md hover:shadow-lg focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center transition-all bg-gradient-to-r from-[#2b83fa] to-[#1d6bd4] active:scale-[0.98]"
                      >
                          {loading ? (
                             <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                             </svg>
                          ) : 'Send Reset Link'}
                      </button>
                      <button
                          type="button"
                          onClick={() => { setView('login'); setError(null); }}
                          className="w-full py-3 text-[14px] font-bold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
                      >
                          Cancel
                      </button>
                  </div>
                </>
            )}
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-5 animate-in fade-in duration-300">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 ml-1">Username</label>
              <input
                type="text"
                autoFocus
                required
                value={username}
                onChange={(e) => { setUsername(e.target.value); if (error) setError(null); }}
                className="w-full px-4 py-3.5 rounded-xl bg-gray-100 dark:bg-black/40 border border-transparent dark:border-white/5 focus:border-transparent focus:ring-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none transition-all"
                style={{ '--tw-ring-color': primaryColor } as any}
                placeholder="e.g. admin"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5 ml-1 pr-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                <button 
                  type="button" 
                  onClick={() => { setView('forgot'); setError(null); }}
                  className="text-xs font-medium hover:underline transition-all" 
                  style={{ color: primaryColor }}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (error) setError(null); }}
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
              disabled={loading || !username.trim() || !password.trim()}
              className="w-full py-3.5 px-4 mt-2 rounded-xl text-white font-bold shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-[#1a1b1e] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center relative overflow-hidden bg-gradient-to-r from-[#2b83fa] to-[#1d6bd4] active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #1d6bd4 0%, #2b83fa 50%, #1d6bd4 100%)', backgroundSize: '200% 200%' }}
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
                ) : 'Log In'}
              </span>
            </button>
            
          </form>
        )}

      </div>
    </div>
  );
};
