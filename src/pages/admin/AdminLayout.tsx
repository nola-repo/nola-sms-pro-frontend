import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as THREE from 'three';
import { FiUsers, FiSend, FiSettings, FiLogOut, FiLock, FiAlertCircle, FiEye, FiEyeOff, FiCheck, FiX, FiRefreshCw, FiKey, FiChevronDown, FiChevronUp, FiHome, FiClock, FiActivity, FiMessageSquare, FiCreditCard } from 'react-icons/fi';
import logoUrl from '../../assets/NOLA SMS PRO Logo.png';

const ADMIN_API = '/api/admin_sender_requests.php';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SenderRequest {
    id: string;
    location_id: string;
    requested_id: string;
    purpose?: string;
    sample_message?: string;
    status: 'pending' | 'approved' | 'rejected';
    rejection_note?: string;
    created_at?: string;
    location_name?: string;
}

interface Account {
    id: string;
    location_id: string;
    location_name?: string;
    approved_sender_id?: string;
    nola_pro_api_key?: string;
    credits?: number;
    credit_balance?: number;
    free_usage_count?: number;
}

interface AdminLayoutProps {
    darkMode: boolean;
    toggleDarkMode: () => void;
}

// ─── Admin Login ─────────────────────────────────────────────────────────────

const AdminLogin: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Antigravity background effect
    useEffect(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 50;

        const count = 300;
        const magnetRadius = 6;
        const ringRadius = 7;
        const waveSpeed = 0.4;
        const waveAmplitude = 1;
        const particleSize = 1.5;
        const lerpSpeed = 0.05;
        const autoAnimate = true;
        const particleVariance = 1;
        const rotationSpeed = 0;
        const depthFactor = 1;
        const pulseSpeed = 3;
        const fieldStrength = 10;
        const color = '#2b83fa';

        const geometry = new THREE.CapsuleGeometry(0.1, 0.4, 4, 8);
        const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color) });
        const mesh = new THREE.InstancedMesh(geometry, material, count);
        scene.add(mesh);

        const dummy = new THREE.Object3D();
        const particles: any[] = [];
        
        const initParticles = () => {
            const aspect = window.innerWidth / window.innerHeight;
            const h = 2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
            const w = h * aspect;

            for (let i = 0; i < count; i++) {
                const x = (Math.random() - 0.5) * w;
                const y = (Math.random() - 0.5) * h;
                const z = (Math.random() - 0.5) * 20;
                particles.push({
                    t: Math.random() * 100,
                    speed: 0.01 + Math.random() / 200,
                    mx: x, my: y, mz: z,
                    cx: x, cy: y, cz: z,
                    randomRadiusOffset: (Math.random() - 0.5) * 2
                });
            }
        };
        initParticles();

        let mouse = new THREE.Vector2(0, 0);
        let virtualMouse = new THREE.Vector2(0, 0);
        let lastMouseMoveTime = 0;

        const onMouseMove = (e: MouseEvent) => {
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            lastMouseMoveTime = Date.now();
        };
        window.addEventListener('mousemove', onMouseMove);

        const onResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', onResize);

        let animationFrameId: number;
        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            const time = performance.now() / 1000;
            
            const aspect = window.innerWidth / window.innerHeight;
            const vh = 2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
            const vw = vh * aspect;

            let destX = (mouse.x * vw) / 2;
            let destY = (mouse.y * vh) / 2;

            if (autoAnimate && Date.now() - lastMouseMoveTime > 2000) {
                destX = Math.sin(time * 0.5) * (vw / 4);
                destY = Math.cos(time * 0.5 * 2) * (vh / 4);
            }

            virtualMouse.x += (destX - virtualMouse.x) * 0.05;
            virtualMouse.y += (destY - virtualMouse.y) * 0.05;

            const globalRotation = time * rotationSpeed;

            for (let i = 0; i < count; i++) {
                const p = particles[i];
                p.t += p.speed / 2;

                const projectionFactor = 1 - p.cz / 50;
                const pTargetX = virtualMouse.x * projectionFactor;
                const pTargetY = virtualMouse.y * projectionFactor;

                const dx = p.mx - pTargetX;
                const dy = p.my - pTargetY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                let targetX = p.mx;
                let targetY = p.my;
                let targetZ = p.mz * depthFactor;

                if (dist < magnetRadius) {
                    const angle = Math.atan2(dy, dx) + globalRotation;
                    const wave = Math.sin(p.t * waveSpeed + angle) * (0.5 * waveAmplitude);
                    const deviation = p.randomRadiusOffset * (5 / (fieldStrength + 0.1));
                    const currentRingRadius = ringRadius + wave + deviation;

                    targetX = pTargetX + currentRingRadius * Math.cos(angle);
                    targetY = pTargetY + currentRingRadius * Math.sin(angle);
                    targetZ = p.mz * depthFactor + Math.sin(p.t) * (1 * waveAmplitude * depthFactor);
                }

                p.cx += (targetX - p.cx) * lerpSpeed;
                p.cy += (targetY - p.cy) * lerpSpeed;
                p.cz += (targetZ - p.cz) * lerpSpeed;

                dummy.position.set(p.cx, p.cy, p.cz);
                dummy.lookAt(pTargetX, pTargetY, p.cz);
                dummy.rotateX(Math.PI / 2);

                const currentDist = Math.sqrt(Math.pow(p.cx - pTargetX, 2) + Math.pow(p.cy - pTargetY, 2));
                const distFromRing = Math.abs(currentDist - ringRadius);
                let scaleFactor = Math.max(0, Math.min(1, 1 - distFromRing / 10));
                const finalScale = scaleFactor * (0.8 + Math.sin(p.t * pulseSpeed) * 0.2 * particleVariance) * particleSize;
                
                dummy.scale.set(finalScale, finalScale, finalScale);
                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);
            }

            mesh.instanceMatrix.needsUpdate = true;
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('resize', onResize);
            cancelAnimationFrame(animationFrameId);
            renderer.dispose();
        };
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (username === 'admin' && password === 'admin123') {
            onLogin();
            setError(false);
        } else {
            setError(true);
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center p-4 bg-[#f0f4f8] dark:bg-[#0a0a0a] overflow-hidden">
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none opacity-40 dark:opacity-30" />
            
            <div className="relative z-10 w-full max-w-md bg-white/80 dark:bg-[#1a1b1e]/80 backdrop-blur-3xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_60px_-15px_rgba(43,131,250,0.1)] border border-white/50 dark:border-white/5 p-10 animate-in zoom-in-95 duration-500">
                <div className="flex flex-col items-center mb-10">
                    <div className="w-20 h-20 mb-6 bg-white dark:bg-[#222428] rounded-2xl shadow-sm border border-black/5 dark:border-white/5 flex items-center justify-center p-2">
                        <img src={logoUrl} alt="NOLA SMS Pro Logo" className="w-full h-full object-contain drop-shadow-sm" />
                    </div>
                    <h2 className="text-2xl font-black text-[#111111] dark:text-white tracking-tight mb-2">Admin Portal</h2>
                    <p className="text-[13px] text-[#6e6e73] dark:text-[#9aa0a6] text-center font-medium px-4">
                        Platform management & unified activity oversight.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 animate-in slide-in-from-top-2 duration-300">
                            <FiAlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            <p className="text-[12px] font-bold text-red-600 dark:text-red-400">Incorrect credentials.</p>
                        </div>
                    )}
                    <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold text-[#5f6368] dark:text-[#8aa0a6] uppercase tracking-widest pl-1">Username</label>
                        <input
                            type="text"
                            autoFocus
                            value={username}
                            onChange={(e) => { setUsername(e.target.value); if (error) setError(false); }}
                            placeholder="e.g. admin"
                            className="w-full px-4 py-3.5 rounded-2xl text-[14px] font-medium bg-black/[0.03] dark:bg-white/[0.03] border-2 border-transparent focus:bg-white dark:focus:bg-[#0d0e10] focus:border-[#2b83fa]/30 text-[#111111] dark:text-[#ececf1] placeholder-black/30 dark:placeholder-white/20 transition-all outline-none"
                        />
                    </div>
                    <div className="space-y-1.5 pt-1">
                        <label className="block text-[11px] font-bold text-[#5f6368] dark:text-[#8aa0a6] uppercase tracking-widest pl-1">Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); if (error) setError(false); }}
                                placeholder="••••••••"
                                className="w-full px-4 py-3.5 rounded-2xl text-[14px] font-medium bg-black/[0.03] dark:bg-white/[0.03] border-2 border-transparent focus:bg-white dark:focus:bg-[#0d0e10] focus:border-[#2b83fa]/30 text-[#111111] dark:text-[#ececf1] placeholder-black/30 dark:placeholder-white/20 transition-all outline-none pr-12"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-full text-[#6e6e73] dark:text-[#9aa0a6] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[#111111] dark:hover:text-white transition-all"
                            >
                                {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={!username.trim() || !password.trim()}
                        className="w-full flex items-center justify-center gap-2 mt-8 py-3.5 bg-gradient-to-r from-[#2b83fa] to-[#1d6bd4] hover:from-[#1d6bd4] hover:to-[#175bb8] text-white rounded-2xl font-bold text-[14px] transition-all shadow-[0_8px_25px_rgba(43,131,250,0.3)] hover:shadow-[0_12px_30px_rgba(43,131,250,0.5)] disabled:opacity-50 disabled:shadow-none hover:-translate-y-0.5"
                    >
                        Secure Login
                    </button>
                </form>
            </div>
        </div>
    );
};

// ─── Admin Layout Shell ───────────────────────────────────────────────────────

export const AdminLayout: React.FC<AdminLayoutProps> = ({ darkMode }) => {
    // Initialize isAuthenticated from localStorage
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
        return localStorage.getItem('nola_admin_auth') === 'true';
    });
    const [activeTab, setActiveTab] = useState<'dashboard' | 'accounts' | 'requests' | 'settings'>('dashboard');

    const handleLogin = () => {
        setIsAuthenticated(true);
        localStorage.setItem('nola_admin_auth', 'true');
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        localStorage.removeItem('nola_admin_auth');
    };

    if (!isAuthenticated) {
        return <AdminLogin onLogin={handleLogin} />;
    }

    return (
        <div className={`h-screen flex overflow-hidden bg-[#f7f7f7] dark:bg-[#111111] ${darkMode ? 'dark' : ''}`}>
            {/* Admin Sidebar */}
            <div className="w-64 bg-white/70 dark:bg-[#121415]/80 backdrop-blur-2xl border-r border-[#0000000a] dark:border-[#ffffff0a] shadow-[1px_0_0_rgba(0,0,0,0.05)] flex flex-col z-20">
                <div className="p-6">
                    <h1 className="text-xl font-black text-[#111111] dark:text-white tracking-tight flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#2b83fa] to-[#60a5fa] shadow-sm flex items-center justify-center">
                            <FiLock className="w-3.5 h-3.5 text-white" />
                        </div>
                        NOLA Admin
                    </h1>
                </div>

                <nav className="flex-1 px-4 py-2 space-y-1.5">
                    {[
                        { id: 'dashboard', label: 'Dashboard', icon: <FiHome /> },
                        { id: 'requests', label: 'Sender Requests', icon: <FiSend /> },
                        { id: 'accounts', label: 'All Accounts', icon: <FiUsers /> },
                        { id: 'settings', label: 'System Settings', icon: <FiSettings /> },
                    ].map(tab => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[14px] font-medium transition-all group ${
                                    isActive
                                        ? 'bg-[#2b83fa]/10 dark:bg-[#2b83fa]/15 text-[#2b83fa]'
                                        : 'text-[#6e6e73] dark:text-[#94959b] hover:bg-black/[0.03] dark:hover:bg-white/[0.03] hover:text-[#111111] dark:hover:text-[#ececf1]'
                                }`}
                            >
                                <span className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110 group-hover:text-[#2b83fa]'}`}>{tab.icon}</span>
                                <span className={isActive ? 'font-bold' : ''}>{tab.label}</span>
                            </button>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-[#00000005] dark:border-[#ffffff05]">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-bold text-[#6e6e73] dark:text-[#94959b] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                    >
                        <FiLogOut /> Logout
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <header className="px-8 py-5 bg-white/70 dark:bg-[#121415]/80 backdrop-blur-2xl border-b border-[#0000000a] dark:border-[#ffffff0a] flex-shrink-0 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-[#111111] dark:text-white capitalize tracking-tight">
                            {activeTab === 'dashboard' ? 'Dashboard' : activeTab === 'requests' ? 'Sender Requests' : activeTab === 'accounts' ? 'All Accounts' : 'System Settings'}
                        </h2>
                        <p className="text-[12px] text-[#6e6e73] dark:text-[#9aa0a6] mt-0.5">
                            {activeTab === 'dashboard' ? 'Platform-wide overview of all accounts and activity.' : 'Management overview and administrative actions.'}
                        </p>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div className="max-w-6xl mx-auto">
                        {activeTab === 'dashboard' && <AdminDashboard onNavigate={setActiveTab} />}
                        {activeTab === 'requests' && <AdminSenderRequests />}
                        {activeTab === 'accounts' && <AdminAccounts />}
                        {activeTab === 'settings' && <AdminSettings />}
                    </div>
                </main>
            </div>
        </div>
    );
};

// ─── Admin Dashboard View ────────────────────────────────────────────────────

const AdminDashboard: React.FC<{ onNavigate: (tab: any) => void }> = ({ onNavigate }) => {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [requests, setRequests] = useState<SenderRequest[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        Promise.all([
            fetch(`${ADMIN_API}?action=accounts`).then(r => r.json()).catch(() => ({ status: 'error', data: [] })),
            fetch(`${ADMIN_API}?action=logs`).then(r => r.json()).catch(() => ({ status: 'error', data: [] })),
            fetch(ADMIN_API).then(r => r.json()).catch(() => ({ status: 'error', data: [] }))
        ]).then(([accJson, logsJson, reqJson]) => {
            if (cancelled) return;
            if (accJson.status === 'success') {
                const mapped = (accJson.data || []).map((item: any) => item.data ? { id: item.id, ...item.data } : item)
                    .filter((acc: any) => acc.id !== 'ghl' && acc.location_id);
                setAccounts(mapped);
            }
            if (reqJson.status === 'success') {
                setRequests(reqJson.data || []);
            }
            if (logsJson.status === 'success') {
                setLogs(logsJson.data || []);
            }
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, []);

    const totalAccounts = accounts.length;
    const pendingRequests = requests.filter(r => r.status === 'pending').length;
    const approvedSenders = accounts.filter(a => a.approved_sender_id).length;
    const freeTierAccounts = accounts.filter(a => !a.approved_sender_id).length;
    const recentRequests = [...requests].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 6);

    const StatCard = ({ label, value, color, icon }: { label: string; value: number | string; color: string; icon: React.ReactNode }) => (
        <div className={`relative p-6 rounded-3xl bg-gradient-to-br ${color} shadow-lg overflow-hidden group`}>
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500 text-white">
                <div className="w-20 h-20">{icon}</div>
            </div>
            <div className="relative z-10">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white mb-4">
                    {icon}
                </div>
                <p className="text-[12px] font-bold text-white/70 uppercase tracking-widest mb-1">{label}</p>
                <h2 className="text-3xl font-black text-white">
                    {loading ? <span className="inline-block w-10 h-8 bg-white/20 animate-pulse rounded-lg" /> : value}
                </h2>
            </div>
        </div>
    );

    return (
        <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                <StatCard label="Total Accounts" value={totalAccounts} color="from-[#2b83fa] to-[#60a5fa]" icon={<FiUsers className="w-full h-full" />} />
                <StatCard label="Pending Requests" value={pendingRequests} color={pendingRequests > 0 ? 'from-amber-500 to-orange-500' : 'from-slate-400 to-slate-500'} icon={<FiClock className="w-full h-full" />} />
                <StatCard label="Approved Senders" value={approvedSenders} color="from-emerald-500 to-teal-600" icon={<FiCheck className="w-full h-full" />} />
                <StatCard label="Free Tier Only" value={freeTierAccounts} color="from-purple-500 to-indigo-600" icon={<FiActivity className="w-full h-full" />} />
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Quick Actions */}
                <div className="bg-white dark:bg-[#1a1b1e] border border-[#e5e5e5] dark:border-white/5 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-[14px] font-bold text-[#111111] dark:text-white uppercase tracking-wider mb-5">Quick Actions</h3>
                    <div className="space-y-3">
                        {[
                            { tab: 'requests', label: 'Review Sender Requests', desc: `${pendingRequests} pending approval`, color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20', icon: <FiSend className="w-5 h-5" />, badge: pendingRequests },
                            { tab: 'accounts', label: 'View All Accounts', desc: `${totalAccounts} total installed subaccounts`, color: 'text-[#2b83fa] bg-blue-50 dark:bg-blue-900/20', icon: <FiUsers className="w-5 h-5" />, badge: 0 },
                            { tab: 'settings', label: 'System Settings', desc: 'Global sender ID and free tier config', color: 'text-slate-500 bg-slate-50 dark:bg-slate-900/20', icon: <FiSettings className="w-5 h-5" />, badge: 0 },
                        ].map(item => (
                            <button key={item.tab} onClick={() => onNavigate(item.tab)}
                                className="w-full flex items-center gap-4 p-4 rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] hover:bg-[#efefef] dark:hover:bg-[#161718] transition-colors text-left group">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.color}`}>
                                    {item.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-bold text-[#111111] dark:text-white">{item.label}</p>
                                    <p className="text-[11px] text-[#6e6e73] dark:text-[#9aa0a6]">{item.desc}</p>
                                </div>
                                {item.badge > 0 && (
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500 text-white text-[11px] font-black flex items-center justify-center animate-pulse">{item.badge}</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Platform Activity Logs */}
                <div className="bg-white dark:bg-[#1a1b1e] border border-[#e5e5e5] dark:border-white/5 rounded-2xl p-6 shadow-sm flex flex-col h-[400px]">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-[14px] font-bold text-[#111111] dark:text-white uppercase tracking-wider flex items-center gap-2">
                            <FiActivity className="w-4 h-4 text-[#2b83fa]" /> Platform Activity
                        </h3>
                    </div>
                    <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1 pr-2">
                        {loading ? (
                            [1,2,3,4].map(i => <div key={i} className="h-14 rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] animate-pulse" />)
                        ) : logs.length === 0 ? (
                            <div className="py-10 text-center">
                                <FiMessageSquare className="w-8 h-8 mx-auto mb-2 text-[#d0d0d0] dark:text-[#3a3b3f]" />
                                <p className="text-[13px] text-[#9aa0a6]">No logs recorded yet.</p>
                            </div>
                        ) : logs.map(log => {
                            // Determine type based on explicit type or fallback properties
                            const type = log.type || (
                                log.requested_id ? 'sender_request' :
                                log.amount ? 'credit_purchase' :
                                'message'
                            );
                            
                            // Get unified timestamp
                            const timestamp = log.timestamp || log.date_created || log.created_at;
                            const timeString = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                            
                            // Message Event
                            if (type === 'message') {
                                const isSent = log.status === 'sent' || log.status === 'delivered';
                                return (
                                    <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-[#f7f7f7] dark:hover:bg-[#0d0e10] transition-colors border border-transparent hover:border-[#e5e5e5] dark:hover:border-white/5 group">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[14px] flex-shrink-0 ${
                                            isSent ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600'
                                            : log.status === 'failed' ? 'bg-red-50 dark:bg-red-900/20 text-red-600'
                                            : 'bg-blue-50 dark:bg-blue-900/20 text-[#2b83fa]'
                                        }`}>
                                            <FiMessageSquare className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <p className="text-[13px] font-bold text-[#111111] dark:text-white truncate pr-2">Message to <span className="font-mono text-[12px] opacity-90">{log.number || log.to || 'Unknown'}</span></p>
                                                <span className="text-[10px] uppercase font-bold text-[#9aa0a6] tracking-wider whitespace-nowrap">{timeString}</span>
                                            </div>
                                            <p className="text-[12px] text-[#6e6e73] dark:text-[#9aa0a6] truncate mb-1.5">{log.message || 'No content'}</p>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                                    isSent ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-800/30' :
                                                    log.status === 'failed' ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/10 dark:text-red-400 dark:border-red-800/30' :
                                                    'bg-blue-50 text-[#2b83fa] border-blue-200 dark:bg-blue-900/10 dark:text-blue-400 dark:border-blue-800/30'
                                                }`}>{log.status || 'unknown'}</span>
                                                {log.sendername && <span className="text-[10px] font-mono text-gray-500 bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded">Via: {log.sendername}</span>}
                                                {log.location_id && <span className="text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded">Loc: {log.location_id.substring(0,8)}...</span>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            // Sender Request Event
                            if (type === 'sender_request') {
                                const isPending = log.status === 'pending';
                                return (
                                    <div key={log.id} onClick={() => onNavigate('requests')} className="flex items-start gap-3 p-3 rounded-xl hover:bg-[#f7f7f7] dark:hover:bg-[#0d0e10] transition-colors border border-transparent hover:border-[#e5e5e5] dark:hover:border-white/5 cursor-pointer group">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[14px] flex-shrink-0 ${
                                            isPending ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600'
                                            : log.status === 'approved' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600'
                                            : 'bg-red-50 dark:bg-red-900/20 text-red-600'
                                        }`}>
                                            <FiSend className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <p className="text-[13px] font-bold text-[#111111] dark:text-white truncate pr-2">Sender ID Request</p>
                                                <span className="text-[10px] uppercase font-bold text-[#9aa0a6] tracking-wider whitespace-nowrap">{timeString}</span>
                                            </div>
                                            <p className="text-[12px] text-[#6e6e73] dark:text-[#9aa0a6] truncate mb-1.5">
                                                Registration for <span className="font-mono font-bold">{log.requested_id}</span>
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                                    isPending ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/10 dark:text-amber-400 dark:border-amber-800/30' :
                                                    log.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-800/30' :
                                                    'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/10 dark:text-red-400 dark:border-red-800/30'
                                                }`}>{log.status}</span>
                                                {log.location_id && <span className="text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded">Loc: {log.location_id.substring(0,8)}...</span>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            // Credit Purchase Event
                            if (type === 'credit_purchase') {
                                return (
                                    <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-[#f7f7f7] dark:hover:bg-[#0d0e10] transition-colors border border-transparent hover:border-[#e5e5e5] dark:hover:border-white/5 group">
                                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[14px] flex-shrink-0 bg-purple-50 dark:bg-purple-900/20 text-purple-600">
                                            <FiCreditCard className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <p className="text-[13px] font-bold text-[#111111] dark:text-white truncate pr-2">Credits Purchased</p>
                                                <span className="text-[10px] uppercase font-bold text-[#9aa0a6] tracking-wider whitespace-nowrap">{timeString}</span>
                                            </div>
                                            <p className="text-[12px] text-[#6e6e73] dark:text-[#9aa0a6] truncate mb-1.5">
                                                Added <span className="font-bold text-purple-600 dark:text-purple-400">+{log.amount?.toLocaleString()}</span> credits
                                            </p>
                                            <div className="flex items-center gap-2">
                                                 <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/10 dark:text-purple-400 dark:border-purple-800/30">
                                                    {log.status === 'completed' ? 'Paid' : log.status}
                                                </span>
                                                {log.location_id && <span className="text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded">Loc: {log.location_id.substring(0,8)}...</span>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            return null;
                        })}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Sender Requests */}
                <div className="bg-white dark:bg-[#1a1b1e] border border-[#e5e5e5] dark:border-white/5 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-[14px] font-bold text-[#111111] dark:text-white uppercase tracking-wider">Recent Requests</h3>
                        <button onClick={() => onNavigate('requests')} className="text-[11px] font-bold text-[#2b83fa] hover:underline">See All</button>
                    </div>
                    <div className="space-y-2">
                        {loading ? (
                            [1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] animate-pulse" />)
                        ) : recentRequests.length === 0 ? (
                            <div className="py-10 text-center">
                                <FiSend className="w-8 h-8 mx-auto mb-2 text-[#d0d0d0] dark:text-[#3a3b3f]" />
                                <p className="text-[13px] text-[#9aa0a6]">No requests yet.</p>
                            </div>
                        ) : recentRequests.map(req => (
                            <div key={req.id} onClick={() => onNavigate('requests')}
                                className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#f7f7f7] dark:hover:bg-[#0d0e10] transition-colors cursor-pointer">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-[12px] font-black flex-shrink-0 ${
                                    req.status === 'pending' ? 'bg-amber-500' : req.status === 'approved' ? 'bg-emerald-500' : 'bg-red-500'
                                }`}>
                                    {req.requested_id?.charAt(0).toUpperCase() || '?'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-bold text-[#111111] dark:text-white font-mono truncate">{req.requested_id}</p>
                                    <p className="text-[11px] text-[#6e6e73] dark:text-[#9aa0a6] truncate">{req.location_name || req.location_id}</p>
                                </div>
                                <span className={`flex-shrink-0 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                    req.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/10 dark:text-amber-400 dark:border-amber-800/30' :
                                    req.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/10 dark:text-green-400 dark:border-green-800/30' :
                                    'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/10 dark:text-red-400 dark:border-red-800/30'
                                }`}>{req.status}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Accounts Overview Table */}
            <div className="bg-white dark:bg-[#1a1b1e] border border-[#e5e5e5] dark:border-white/5 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-[14px] font-bold text-[#111111] dark:text-white uppercase tracking-wider">Accounts Overview</h3>
                    <button onClick={() => onNavigate('accounts')} className="text-[11px] font-bold text-[#2b83fa] hover:underline">View All</button>
                </div>
                {loading ? (
                    <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] animate-pulse" />)}</div>
                ) : accounts.length === 0 ? (
                    <div className="py-8 text-center"><p className="text-[13px] text-[#9aa0a6]">No accounts yet.</p></div>
                ) : (
                    <div className="space-y-2">
                        {accounts.slice(0, 8).map(acc => (
                            <div key={acc.id} className="flex items-center gap-4 px-4 py-3 rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10]">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#2b83fa] to-[#60a5fa] flex items-center justify-center text-white text-[12px] font-black flex-shrink-0">
                                    {(acc.location_name || acc.location_id || '?').charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-bold text-[#111111] dark:text-white truncate">{acc.location_name || 'Unknown Location'}</p>
                                    <p className="text-[11px] text-[#6e6e73] font-mono truncate">{acc.location_id}</p>
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                    {acc.approved_sender_id ? (
                                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800/30 font-mono">{acc.approved_sender_id}</span>
                                    ) : (
                                        <span className="text-[11px] text-[#9aa0a6] italic">Free Tier</span>
                                    )}
                                    <span className="text-[12px] font-bold text-[#111111] dark:text-white w-16 text-right">{(acc.credits ?? acc.credit_balance ?? 0).toLocaleString()} cr</span>
                                </div>
                            </div>
                        ))}
                        {accounts.length > 8 && (
                            <button onClick={() => onNavigate('accounts')} className="w-full py-2.5 text-[12px] font-bold text-[#2b83fa] hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-xl transition-colors">
                                + {accounts.length - 8} more accounts
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Sender Requests View ─────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const styles: Record<string, string> = {
        pending: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/10 dark:text-yellow-400 dark:border-yellow-800/30',
        approved: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/10 dark:text-green-400 dark:border-green-800/30',
        rejected: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/10 dark:text-red-400 dark:border-red-800/30',
    };
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${styles[status] || styles.pending}`}>
            {status}
        </span>
    );
};

const AdminSenderRequests: React.FC = () => {
    const [requests, setRequests] = useState<SenderRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [rejectNote, setRejectNote] = useState('');
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(ADMIN_API);
            const json = await res.json();
            if (json.status === 'success') {
                setRequests(json.data || []);
            } else {
                setError(json.message || 'Failed to load requests.');
            }
        } catch {
            setError('Network error. Could not reach the backend.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchRequests(); }, [fetchRequests]);

    const doAction = async (action: string, requestId: string, extra: Record<string, string> = {}) => {
        setActionLoading(requestId + action);
        try {
            const res = await fetch(ADMIN_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ request_id: requestId, status: action, ...extra }),
            });
            const json = await res.json();
            if (json.status === 'success') {
                setSuccessMsg(json.message || 'Action completed.');
                setTimeout(() => setSuccessMsg(null), 3000);
                fetchRequests();
                setExpandedId(null);
                setRejectNote('');
                setApiKeyInput('');
            } else {
                setError(json.message || 'Action failed.');
            }
        } catch {
            setError('Network error.');
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="bg-white dark:bg-[#1a1b1e] border border-[#e5e5e5] dark:border-white/5 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-[16px] font-bold text-[#111111] dark:text-white">Pending Sender ID Requests</h3>
                    <p className="text-[13px] text-[#6e6e73] dark:text-[#9aa0a6] mt-0.5">Review, approve, or reject sender name registration requests.</p>
                </div>
                <button onClick={fetchRequests} className="p-2 rounded-xl text-[#6e6e73] hover:text-[#2b83fa] hover:bg-[#2b83fa]/10 transition-all">
                    <FiRefreshCw className="w-4 h-4" />
                </button>
            </div>

            {successMsg && (
                <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/30 text-green-700 dark:text-green-400 text-[13px] font-medium">
                    <FiCheck className="w-4 h-4 flex-shrink-0" /> {successMsg}
                </div>
            )}

            {error && (
                <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 text-red-600 dark:text-red-400 text-[13px] font-medium">
                    <FiAlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
            )}

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-16 rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] animate-pulse" />
                    ))}
                </div>
            ) : requests.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-[#e5e5e5] dark:border-[#3a3b3f] rounded-xl text-[#9aa0a6] bg-[#f7f7f7] dark:bg-[#0d0e10]">
                    <FiSend className="w-8 h-8 mx-auto mb-3 opacity-30" />
                    <p className="text-[14px] font-semibold">No sender requests found.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {requests.map(req => {
                        const isExpanded = expandedId === req.id;
                        const isActing = actionLoading?.startsWith(req.id);
                        return (
                            <div key={req.id} className="border border-[#e5e5e5] dark:border-white/5 rounded-xl overflow-hidden transition-all">
                                {/* Row Header */}
                                <div
                                    className="flex items-center gap-4 px-4 py-3 bg-[#fafafa] dark:bg-[#111214] cursor-pointer hover:bg-[#f0f0f0] dark:hover:bg-[#161718] transition-colors"
                                    onClick={() => setExpandedId(isExpanded ? null : req.id)}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-[14px] text-[#111111] dark:text-white font-mono">{req.requested_id}</span>
                                            <StatusBadge status={req.status} />
                                        </div>
                                        <p className="text-[11px] text-[#6e6e73] dark:text-[#9aa0a6] mt-0.5 truncate">{req.location_id}</p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {/* Approved: show masked key inline */}
                                        {req.status === 'approved' && (
                                            <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/30">
                                                <FiKey className="w-3 h-3 inline mr-1" />Active
                                            </span>
                                        )}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : req.id); }}
                                            className="p-1.5 rounded-lg text-[#6e6e73] hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                                        >
                                            {isExpanded ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded Panel */}
                                {isExpanded && (
                                    <div className="px-4 py-4 border-t border-[#e5e5e5] dark:border-white/5 bg-white dark:bg-[#1a1b1e] space-y-4">
                                        {/* Details: Purpose & Sample */}
                                        {req.purpose && (
                                            <div>
                                                <p className="text-[11px] font-semibold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-1">Purpose</p>
                                                <p className="text-[13px] text-[#37352f] dark:text-[#ececf1]">{req.purpose}</p>
                                            </div>
                                        )}
                                        {req.sample_message && (
                                            <div>
                                                <p className="text-[11px] font-semibold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-1">Sample Message</p>
                                                <p className="text-[13px] text-[#37352f] dark:text-[#ececf1] italic">"{req.sample_message}"</p>
                                            </div>
                                        )}
                                        {req.created_at && (
                                            <div>
                                                <p className="text-[11px] font-semibold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-1">Submitted</p>
                                                <p className="text-[12px] text-[#6e6e73] dark:text-[#9aa0a6]">{req.created_at}</p>
                                            </div>
                                        )}

                                        {/* ── Pending: Approve & Activate / Reject ── */}
                                        {req.status === 'pending' && (
                                            <div className="space-y-3 pt-2 border-t border-[#f0f0f0] dark:border-white/5">
                                                {/* API Key for Approval */}
                                                <div>
                                                    <p className="text-[11px] font-semibold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-1.5">Semaphore API Key</p>
                                                    <input
                                                        type="text"
                                                        value={apiKeyInput}
                                                        onChange={e => setApiKeyInput(e.target.value)}
                                                        placeholder="Paste the Semaphore API key for this sender..."
                                                        className="w-full px-3 py-2.5 text-[13px] border rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] border-[#e0e0e0] dark:border-[#ffffff0a] text-[#111111] dark:text-[#ececf1] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 transition-shadow font-mono"
                                                    />
                                                    <p className="text-[10px] text-[#9aa0a6] mt-1">Required. Register the sender on Semaphore first, then paste the API key here.</p>
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="flex gap-2">
                                                    <button
                                                        disabled={!apiKeyInput.trim() || !!isActing}
                                                        onClick={() => doAction('approved', req.id, { api_key: apiKeyInput.trim() })}
                                                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:shadow-[0_8px_25px_rgba(16,185,129,0.35)] text-white transition-all shadow-md shadow-emerald-500/20 disabled:opacity-40 disabled:shadow-none"
                                                    >
                                                        <FiCheck className="w-4 h-4" />
                                                        {isActing ? 'Processing...' : 'Approve & Activate'}
                                                    </button>
                                                    <button
                                                        disabled={!!isActing}
                                                        onClick={() => doAction('rejected', req.id, { rejection_note: rejectNote })}
                                                        className="px-4 py-2.5 rounded-xl text-[13px] font-bold bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/10 dark:text-red-400 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800/30 transition-all disabled:opacity-50"
                                                    >
                                                        <FiX className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                {/* Optional Rejection Note (shows inline) */}
                                                <div>
                                                    <p className="text-[11px] font-semibold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-1">Rejection Note (optional)</p>
                                                    <textarea
                                                        value={rejectNote}
                                                        onChange={e => setRejectNote(e.target.value)}
                                                        rows={2}
                                                        placeholder="Reason for rejection (visible to the user)..."
                                                        className="w-full px-3 py-2 text-[13px] border rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] border-[#e0e0e0] dark:border-[#ffffff0a] text-[#111111] dark:text-[#ececf1] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400/30 resize-none transition-shadow"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* ── Approved: show confirmation ── */}
                                        {req.status === 'approved' && (
                                            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30">
                                                <FiCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                                                <p className="text-[12px] text-emerald-700 dark:text-emerald-400 font-medium">
                                                    This sender ID is approved and active. The user can now send messages using <strong>{req.requested_id}</strong>.
                                                </p>
                                            </div>
                                        )}

                                        {/* ── Rejected: show note ── */}
                                        {req.status === 'rejected' && (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/30">
                                                    <FiX className="w-4 h-4 text-red-500 flex-shrink-0" />
                                                    <p className="text-[12px] text-red-600 dark:text-red-400 font-medium">This sender ID request was rejected.</p>
                                                </div>
                                                {req.rejection_note && (
                                                    <div>
                                                        <p className="text-[11px] font-semibold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-1">Reason</p>
                                                        <p className="text-[13px] text-red-500">{req.rejection_note}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ─── Accounts View ────────────────────────────────────────────────────────────

const AdminAccounts: React.FC = () => {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAccounts = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${ADMIN_API}?action=accounts`);
            const json = await res.json();
            if (json.status === 'success') {
                // Backend returns [{ id: "ghl_locId", data: { ... } }] or [{ location_id: "..." }]
                // We need to unwrap it and filter out the master "ghl" token doc if present
                const mappedAccounts = (json.data || []).map((item: any) => {
                    if (item.data) return { id: item.id, ...item.data };
                    return item;
                }).filter((acc: any) => acc.id !== 'ghl' && acc.location_id);
                
                setAccounts(mappedAccounts);
            } else {
                setError(json.message || 'Failed to load accounts.');
            }
        } catch {
            setError('Network error. Could not reach the backend.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

    return (
        <div className="bg-white dark:bg-[#1a1b1e] border border-[#e5e5e5] dark:border-white/5 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-[16px] font-bold text-[#111111] dark:text-white">All User Accounts</h3>
                    <p className="text-[13px] text-[#6e6e73] dark:text-[#9aa0a6] mt-0.5">Overview of all mapped GHL subaccounts, credits, and active Sender IDs.</p>
                </div>
                <button onClick={fetchAccounts} className="p-2 rounded-xl text-[#6e6e73] hover:text-[#2b83fa] hover:bg-[#2b83fa]/10 transition-all">
                    <FiRefreshCw className="w-4 h-4" />
                </button>
            </div>

            {error && (
                <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 text-red-600 dark:text-red-400 text-[13px] font-medium">
                    <FiAlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
            )}

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-14 rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] animate-pulse" />)}
                </div>
            ) : accounts.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-[#e5e5e5] dark:border-[#3a3b3f] rounded-xl text-[#9aa0a6] bg-[#f7f7f7] dark:bg-[#0d0e10]">
                    <FiUsers className="w-8 h-8 mx-auto mb-3 opacity-30" />
                    <p className="text-[14px] font-semibold">No accounts found.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-[#e5e5e5] dark:border-white/5">
                                <th className="pb-3 pr-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">Account / Location ID</th>
                                <th className="pb-3 pr-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">Sender ID</th>
                                <th className="pb-3 pr-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">API Key</th>
                                <th className="pb-3 pr-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">Credits</th>
                                <th className="pb-3 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">Free Used</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f0f0f0] dark:divide-white/[0.03]">
                            {accounts.map(acc => (
                                <tr key={acc.id} className="hover:bg-[#f7f7f7] dark:hover:bg-white/[0.015] transition-colors">
                                    <td className="py-3 pr-4">
                                        <p className="font-semibold text-[13px] text-[#111111] dark:text-white">{acc.location_name || '—'}</p>
                                        <p className="text-[11px] text-[#6e6e73] dark:text-[#9aa0a6] font-mono truncate max-w-[200px]">{acc.location_id}</p>
                                    </td>
                                    <td className="py-3 pr-4">
                                        {acc.approved_sender_id
                                            ? <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400 text-[12px] font-bold border border-green-200 dark:border-green-800/30">{acc.approved_sender_id}</span>
                                            : <span className="text-[12px] text-[#9aa0a6]">—</span>}
                                    </td>
                                    <td className="py-3 pr-4">
                                        {acc.nola_pro_api_key
                                            ? <span className="text-[11px] text-[#6e6e73] dark:text-[#9aa0a6] font-mono">{acc.nola_pro_api_key.substring(0, 8)}••••</span>
                                            : <span className="text-[12px] text-[#9aa0a6]">Not set</span>}
                                    </td>
                                    <td className="py-3 pr-4">
                                        <span className="text-[13px] font-semibold text-[#111111] dark:text-white">{acc.credits ?? '—'}</span>
                                    </td>
                                    <td className="py-3">
                                        <span className={`text-[13px] font-semibold ${(acc.free_usage_count ?? 0) >= 10 ? 'text-red-500' : 'text-[#111111] dark:text-white'}`}>
                                            {acc.free_usage_count ?? 0} / 10
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// ─── System Settings View ─────────────────────────────────────────────────────

const AdminSettings: React.FC = () => (
    <div className="bg-white dark:bg-[#1a1b1e] border border-[#e5e5e5] dark:border-white/5 rounded-2xl p-6 shadow-sm">
        <h3 className="text-[16px] font-bold text-[#111111] dark:text-white mb-2">System Configurations</h3>
        <p className="text-[13px] text-[#6e6e73] dark:text-[#9aa0a6] mb-6">
            Global settings like the master fallback Sender ID and free tier limits.
        </p>

        <div className="space-y-5 max-w-md">
            <div>
                <label className="block text-[12px] font-semibold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-2">System Default Sender ID</label>
                <input className="w-full px-4 py-2.5 rounded-xl text-[14px] border bg-[#f7f7f7] dark:bg-[#0d0e10] border-[#e0e0e0] dark:border-[#ffffff0a] text-[#111111] dark:text-[#ececf1] focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 transition-shadow" defaultValue="NOLASMSPro" />
            </div>
            <div>
                <label className="block text-[12px] font-semibold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-2">Free Usage Limit</label>
                <input type="number" className="w-full px-4 py-2.5 rounded-xl text-[14px] border bg-[#f7f7f7] dark:bg-[#0d0e10] border-[#e0e0e0] dark:border-[#ffffff0a] text-[#111111] dark:text-[#ececf1] focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 transition-shadow" defaultValue="10" />
            </div>
            <div className="pt-2">
                <button className="flex items-center justify-center gap-2 w-full px-5 py-3 bg-gradient-to-r from-[#2b83fa] to-[#1d6bd4] hover:shadow-[0_8px_25px_rgba(43,131,250,0.4)] text-white rounded-xl font-bold text-[14px] transition-all shadow-md shadow-blue-500/20 active:scale-95">
                    Save System Settings
                </button>
            </div>
        </div>
    </div>
);
