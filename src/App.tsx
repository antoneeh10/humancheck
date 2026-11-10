import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  BookOpen, 
  LayoutDashboard, 
  Sparkles, 
  Terminal, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Database,
  Lock,
  Globe2,
  CheckCircle2,
  Sliders,
  DollarSign,
  HelpCircle,
  Code2,
  Check,
  ChevronRight,
  Monitor,
  Smartphone,
  ExternalLink,
  Laptop,
  Play,
  KeyRound,
  Eye,
  EyeOff,
  User,
  LogOut,
  SlidersHorizontal,
  Menu,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Widget } from './components/Widget';
import { Developer, SiteKey, CaptchaLog, getApiUrl } from './types';

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname);
  const [activeTab, setActiveTab] = useState<'home' | 'docs' | 'dashboard' | 'sandbox' | 'pricing' | 'faq'>(() => {
    const path = window.location.pathname;
    if (path === '/docs') return 'docs';
    if (path === '/sandbox' || path === '/playground') return 'sandbox';
    if (path === '/pricing') return 'pricing';
    if (path === '/faq') return 'faq';
    if (path === '/login' || path === '/dashboard') return 'dashboard';
    return 'home';
  });
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  
  // Developer authentication states
  const [developer, setDeveloper] = useState<Developer | null>(() => {
    const saved = localStorage.getItem('hc_developer');
    return saved ? JSON.parse(saved) : null;
  });
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authForm, setAuthForm] = useState({ email: '', name: '', password: '' });
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Dashboard Developer State
  const [sites, setSites] = useState<SiteKey[]>([]);
  const [selectedSite, setSelectedSite] = useState<SiteKey | null>(null);
  const [stats, setStats] = useState<{
    summary: { total: number; passed: number; failed: number; averageScore: number; passedRate: number };
    dailyHistory: { date: string; total: number; passed: number; failed: number }[];
    logs: CaptchaLog[];
  } | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState<boolean>(false);

  // New Site Key Dialog
  const [showCreateDialog, setShowCreateDialog] = useState<boolean>(false);
  const [newSiteForm, setNewSiteForm] = useState({ name: '', domains: 'localhost, 127.0.0.1, vwebapp.workers.dev' });
  const [siteCreationResult, setSiteCreationResult] = useState<SiteKey | null>(null);

  // Widget settings modifier state (live customization)
  const [customization, setCustomization] = useState<{
    theme: 'light' | 'dark' | 'auto';
    threshold: number;
    domainsText: string;
  }>({
    theme: 'light',
    threshold: 70,
    domainsText: '',
  });

  // Docs sub tab
  const [docsLang, setDocsLang] = useState<'javascript' | 'nodejs' | 'php' | 'laravel'>('javascript');

  // Interactive Sandbox Simulator State
  const [sandboxSiteKey, setSandboxSiteKey] = useState<string>('hc_site_demo_abcdef');
  const [sandboxTheme, setSandboxTheme] = useState<'light' | 'dark'>('light');
  const [sandboxVerified, setSandboxVerified] = useState<boolean>(false);
  const [sandboxToken, setSandboxToken] = useState<string | null>(null);
  const [sandboxResultJson, setSandboxResultJson] = useState<any>(null);
  const [isVerifyingSandbox, setIsVerifyingSandbox] = useState<boolean>(false);
  const [sandboxCallbackOutput, setSandboxCallbackOutput] = useState<string>('Belum ada pemicu...');

  const navigateTo = (path: string) => {
    window.history.pushState(null, '', path);
    setCurrentPath(path);
  };

  // Track window paths
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Sync currentPath and activeTab / redirects
  useEffect(() => {
    if (currentPath === '/') {
      setActiveTab('home');
    } else if (currentPath === '/docs') {
      setActiveTab('docs');
    } else if (currentPath === '/sandbox' || currentPath === '/playground') {
      setActiveTab('sandbox');
    } else if (currentPath === '/pricing') {
      setActiveTab('pricing');
    } else if (currentPath === '/faq') {
      setActiveTab('faq');
    } else if (currentPath === '/login') {
      setActiveTab('dashboard');
      if (developer) {
        window.history.replaceState(null, '', '/dashboard');
        setCurrentPath('/dashboard');
      } else {
        setAuthMode('login');
      }
    } else if (currentPath === '/dashboard') {
      setActiveTab('dashboard');
      if (!developer) {
        window.history.replaceState(null, '', '/login');
        setCurrentPath('/login');
      }
    }
  }, [currentPath, developer]);

  // Fetch developer sites if logged in
  useEffect(() => {
    if (developer) {
      fetchSites();
    }
  }, [developer]);

  // Fetch stats whenever selectedSite changes
  useEffect(() => {
    if (selectedSite) {
      fetchSiteStats(selectedSite.id);
      setCustomization({
        theme: selectedSite.theme,
        threshold: selectedSite.scoreThreshold,
        domainsText: selectedSite.domains.join(', '),
      });
    }
  }, [selectedSite]);

  // If path is /widget, render the stripped widget view for iframe injection
  if (currentPath === '/widget') {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id') || 'hc_site_demo_abcdef';
    const theme = (params.get('theme') || 'light') as 'light' | 'dark' | 'auto';
    const origin = params.get('origin') || '*';

    return (
      <div id="widget-isolated-container" className="w-full h-full flex items-center justify-center p-0 m-0 bg-transparent overflow-hidden">
        <Widget siteKey={id} theme={theme} parentOrigin={origin} />
      </div>
    );
  }

  // Robust local JSON parser helper to prevent "Unexpected end of JSON input" errors
  const safeJson = async (response: Response) => {
    const text = await response.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch (err) {
      console.warn('Response was not valid JSON, returning fallback object:', err);
      return { error: text || 'Gagal memproses respons server.' };
    }
  };

  // Dashboard Database API services
  const fetchSites = async () => {
    if (!developer) return;
    try {
      const res = await fetch(getApiUrl(`/api/developer/sites?devId=${developer.id}`));
      const data = await safeJson(res);
      if (res.ok) {
        setSites(data);
        if (data.length > 0 && !selectedSite) {
          setSelectedSite(data[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching sites:', err);
    }
  };

  const fetchSiteStats = async (siteKey: string) => {
    setIsStatsLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/developer/sites/${siteKey}/stats`));
      const data = await safeJson(res);
      if (res.ok) {
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching site stats:', err);
    } finally {
      setIsStatsLoading(false);
    }
  };

  const handleCreateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!developer || !newSiteForm.name) return;

    const domains = newSiteForm.domains.split(',').map(d => d.trim()).filter(Boolean);

    try {
      const res = await fetch(getApiUrl('/api/developer/sites'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          developerId: developer.id,
          name: newSiteForm.name,
          domains
        }),
      });
      const data = await safeJson(res);
      if (res.ok) {
        setSiteCreationResult(data);
        fetchSites();
        setNewSiteForm({ name: '', domains: 'localhost, 127.0.0.1, vwebapp.workers.dev' });
      }
    } catch (err) {
      console.error('Error creating site:', err);
    }
  };

  const handleUpdateSiteOptions = async () => {
    if (!selectedSite) return;
    const domains = customization.domainsText.split(',').map(d => d.trim()).filter(Boolean);

    try {
      const res = await fetch(getApiUrl(`/api/developer/sites/${selectedSite.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedSite.name,
          domains,
          theme: customization.theme,
          scoreThreshold: Number(customization.threshold),
          compact: false
        }),
      });
      const data = await safeJson(res);
      if (res.ok) {
        setSelectedSite(data);
        fetchSites();
        // Flash confirmation banner or notice
        alert('Pengaturan visual captcha berhasil disimpan.');
      }
    } catch (err) {
      console.error('Error updating site keys:', err);
    }
  };

  const handleDeleteSite = async (siteId: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus Site Key ini? Seluruh statistik dan riwayat logs akan terhapus selamanya.')) return;
    try {
      const res = await fetch(getApiUrl(`/api/developer/sites/${siteId}`), {
        method: 'DELETE',
      });
      if (res.ok) {
        setSites(prev => prev.filter(s => s.id !== siteId));
        setSelectedSite(null);
        setStats(null);
        fetchSites();
      }
    } catch (err) {
      console.error('Error deleting site:', err);
    }
  };

  // Developer User registration & Signin
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const isLogin = authMode === 'login';
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const payload = isLogin 
      ? { email: authForm.email, password: authForm.password }
      : { email: authForm.email, name: authForm.name, password: authForm.password };

    try {
      const res = await fetch(getApiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error(data.error || 'Autentikasi gagal.');
      }

      localStorage.setItem('hc_developer', JSON.stringify(data.user));
      setDeveloper(data.user);
      setAuthForm({ email: '', name: '', password: '' });
      navigateTo('/dashboard');
    } catch (err: any) {
      setAuthError(err.message || 'Koneksi ke sistem otentikasi bermasalah.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('hc_developer');
    setDeveloper(null);
    setSelectedSite(null);
    setSites([]);
    setStats(null);
    navigateTo('/');
  };

  // Setup live callbacks for sandbox simulation demo
  useEffect(() => {
    const handleWidgetVerified = (event: MessageEvent) => {
      // Allow local development endpoints or domain origin
      const currentOrigin = window.location.origin;
      if (event.origin !== currentOrigin) return;
      
      const data = event.data;
      if (data && data.type === 'humancheck-verified') {
        setSandboxVerified(true);
        setSandboxToken(data.token);
        setSandboxCallbackOutput(`✅ Event: humancheck-verified dipicu!\nToken: ${data.token.substring(0, 32)}...`);
      }
    };

    window.addEventListener('message', handleWidgetVerified);
    return () => window.removeEventListener('message', handleWidgetVerified);
  }, []);

  // Sandbox client server verification mock request
  const runSandboxServerVerify = async () => {
    if (!sandboxToken) return;
    setIsVerifyingSandbox(true);
    setSandboxResultJson(null);

    try {
      // Find current site keys secrets
      let secret = 'hc_secret_demo_123456789'; // default demo
      
      if (developer && selectedSite) {
        secret = selectedSite.secretKey;
      }

      const res = await fetch(getApiUrl('/api/siteverify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret,
          response: sandboxToken
        }),
      });
      const data = await safeJson(res);
      setSandboxResultJson(data);
    } catch (err: any) {
      setSandboxResultJson({ success: false, error: 'Hubungan verifikasi server backend gagal' });
    } finally {
      setIsVerifyingSandbox(false);
    }
  };

  // Re-trigger/reset sandbox iframe
  const resetSandbox = () => {
    setSandboxVerified(false);
    setSandboxToken(null);
    setSandboxResultJson(null);
    setSandboxCallbackOutput('Menunggu interaksi manusia...');
    
    // Quick reload iframe
    const iframe = document.getElementById('sandbox-captcha-iframe') as HTMLIFrameElement;
    if (iframe) {
      iframe.src = iframe.src;
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-slate-800 flex flex-col selection:bg-blue-600/10 selection:text-slate-900 font-sans">
      
      {/* GLOBAL NAVBAR HEADER */}
      <header id="global-navbar-header" className="border-b border-slate-200 bg-white sticky top-0 z-40 px-4 md:px-8 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigateTo('/')}>
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-xs">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg leading-none text-slate-900 font-sans tracking-tight">HumanCheck</span>
            <span className="text-[10px] text-blue-600 font-mono font-bold tracking-widest leading-none mt-0.5">ALTERNATIVE</span>
          </div>
        </div>

        {/* Navigation Tabs (Removed Dashboard per request) */}
        <nav className="hidden lg:flex items-center gap-1.5 bg-slate-100 p-1 rounded-full border border-slate-200">
          <button 
            id="nav-tab-home"
            onClick={() => navigateTo('/')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${activeTab === 'home' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Beranda
          </button>
          <button 
            id="nav-tab-docs"
            onClick={() => navigateTo('/docs')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${activeTab === 'docs' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Dokumentasi
          </button>
          <button 
            id="nav-tab-sandbox"
            onClick={() => navigateTo('/sandbox')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${activeTab === 'sandbox' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Playground Demo
          </button>
          <button 
            id="nav-tab-pricing"
            onClick={() => navigateTo('/pricing')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${activeTab === 'pricing' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Paket Layanan
          </button>
          <button 
            id="nav-tab-faq"
            onClick={() => navigateTo('/faq')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${activeTab === 'faq' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
          >
            FAQ
          </button>
        </nav>

        {/* Right Corner Buttons */}
        <div className="flex items-center gap-3">
          {developer ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end cursor-pointer mr-1" onClick={() => navigateTo('/dashboard')}>
                <span className="text-xs font-bold text-slate-805 hover:text-blue-605 transition">{developer.name}</span>
                <span className="text-[10px] text-slate-500 font-mono">{developer.email}</span>
              </div>
              <button 
                id="btn-logout"
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-205 text-xs text-rose-600 font-medium border border-slate-200 transition"
              >
                <LogOut className="w-3.5 h-3.5" /> Keluar
              </button>
            </div>
          ) : (
            <button 
              id="btn-goto-login"
              onClick={() => { navigateTo('/login'); setAuthMode('login'); }}
              className="px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-xs font-bold tracking-wide text-white shadow-xs transition"
            >
              Masuk Dashboard
            </button>
          )}

          {/* Hamburger Icon Trigger for Mobile View */}
          <button 
            id="mobile-hamburger-btn"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* MOBILE HEADER BUTTON DRAWER MENU */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div 
            id="mobile-drawer-menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden bg-white border-b border-slate-200 shadow-md sticky top-[61px] z-30 overflow-hidden flex flex-col py-3.5 px-5 space-y-2"
          >
            <button 
              onClick={() => { navigateTo('/'); setMobileOpen(false); }}
              className={`w-full text-left px-4 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'home' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Beranda
            </button>
            <button 
              onClick={() => { navigateTo('/docs'); setMobileOpen(false); }}
              className={`w-full text-left px-4 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'docs' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Dokumentasi
            </button>
            <button 
              onClick={() => { navigateTo('/sandbox'); setMobileOpen(false); }}
              className={`w-full text-left px-4 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'sandbox' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Playground Demo
            </button>
            <button 
              onClick={() => { navigateTo('/pricing'); setMobileOpen(false); }}
              className={`w-full text-left px-4 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'pricing' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Paket Layanan
            </button>
            <button 
              onClick={() => { navigateTo('/faq'); setMobileOpen(false); }}
              className={`w-full text-left px-4 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'faq' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              FAQ
            </button>

            {developer ? (
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <div className="px-4 py-1 flex flex-col">
                  <span className="text-[10px] text-slate-400 block font-mono font-bold uppercase select-none">Developer Aktif:</span>
                  <span className="text-xs font-bold text-slate-805">{developer.name}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{developer.email}</span>
                </div>
                <button 
                  onClick={() => { navigateTo('/dashboard'); setMobileOpen(false); }}
                  className="w-full text-left px-4 py-2 text-xs font-bold text-blue-600 hover:bg-slate-50 rounded-lg transition flex items-center gap-1.5"
                >
                  <LayoutDashboard className="w-4 h-4" /> Masuk Dashboard
                </button>
                <button 
                  onClick={() => { handleLogout(); setMobileOpen(false); }}
                  className="w-full text-left px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition flex items-center gap-1.5"
                >
                  <LogOut className="w-4 h-4" /> Keluar Akun
                </button>
              </div>
            ) : (
              <div className="pt-2 border-t border-slate-100">
                <button 
                  onClick={() => { navigateTo('/login'); setAuthMode('login'); setMobileOpen(false); }}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-extrabold tracking-wide text-center transition"
                >
                  Masuk Dashboard
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 max-w-7xl w-full mx-auto px-2.5 py-4 sm:p-6 md:p-8">
        <AnimatePresence mode="wait">
          
          {/* TAB 1: BERANDA/LANDING PAGE */}
          {activeTab === 'home' && (
            <motion.div 
              key="tab-home"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-12 py-4"
            >
              {/* HERO BANNER */}
              <div className="text-center max-w-3xl mx-auto space-y-4 py-8">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold border border-blue-100">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" /> HumanCheck v1.0.0 siap digunakan
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight md:leading-[1.15] text-slate-900">
                  Sistem CAPTCHA Modern Tanpa <span className="text-blue-600">AI</span>, Tanpa Pelacakan Privasi.
                </h1>
                <p className="text-slate-500 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
                  Metode verifikasi manusia berkecepatan tinggi yang mengandalkan analisis detail kursor mouse, sentuhan mobile, dan interaksi natural secara realtime. Alternatif reCAPTCHA dan Cloudflare Turnstile yang ringan dan ramah privasi.
                </p>
                
                <div className="pt-4 flex flex-wrap justify-center gap-4">
                  <button 
                    onClick={() => navigateTo('/sandbox')}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-xs font-bold tracking-wider text-white shadow-xs transition"
                  >
                    Uji Coba Sekarang <ChevronRight className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => navigateTo('/docs')}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white hover:bg-slate-50 text-xs font-bold tracking-wider text-slate-700 border border-slate-200 shadow-xs transition"
                  >
                    Dokumentasi Integrasi <BookOpen className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* INTEGRATION SAMPLE PREVIEW DOCK */}
              <div className="grid md:grid-cols-2 gap-8 items-center bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 md:p-8 shadow-sm">
                <div className="space-y-4">
                  <span className="text-[10px] text-blue-600 font-bold uppercase tracking-widest font-mono">Real-time Experience</span>
                  <h3 className="text-2xl font-bold font-sans text-slate-900">Cobalah Widget Captcha Produksi</h3>
                  <p className="text-slate-500 text-xs leading-relaxed">
                     Di bawah ini adalah widget HumanCheck yang terhubung ke server kami secara langsung menggunakan token HMAC-SHA256. Lakukan klik atau interaksi untuk beraksi.
                  </p>

                  <div className="flex items-center gap-3 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <div className="flex flex-col text-[11px]">
                      <span className="font-bold text-slate-800">Keamanan Tanpa File Kuki Pelacak</span>
                      <span className="text-slate-500">HumanCheck tidak menempatkan cookies iklan pihak ketiga dan mematuhi GDPR / UU PDP.</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-50 rounded-xl border border-slate-200 w-full overflow-hidden">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-3">Live Interactive Captcha</span>
                  <Widget siteKey="hc_site_demo_abcdef" theme="light" parentOrigin="*" />
                  <p className="text-[10px] text-slate-500 mt-4 text-center">
                    Gunakan kursor Anda secara alami untuk mengisi kotak verifikasi di atas.
                  </p>
                </div>
              </div>

              {/* FEATURES BENCHMARK GRID */}
              <div className="space-y-6">
                <div className="text-center space-y-1.5 py-4">
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">Teknologi Analisis Perilaku Realtime</h2>
                   <p className="text-slate-500 text-xs">Mendeteksi automasi script dan robot simulator dengan presisi per milidetik.</p>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 hover:border-slate-300 shadow-xs transition">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 mb-3.5">
                      <Terminal className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-800">Analisis Gerakan Mouse (Desktop)</h4>
                    <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                      Mengevaluasi curvature (kelengkungan lintasan kursor), dinamika akselerasi, friksi gerak tangan, serta variasi deselerasi untuk menyaring kursor buatan.
                    </p>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 hover:border-slate-300 shadow-xs transition">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 mb-3.5">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-800">Analisis Sentuhan Layar (Mobile)</h4>
                    <p className="text-slate-505 text-xs mt-1.5 leading-relaxed">
                      Mengukur durasi tekanan (touch duration), kurva kecepatan sapuan jari (swipe velocity), area korelasi piksel, dan multi-touch sensorik guna mendeteksi emulator.
                    </p>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 hover:border-slate-300 shadow-xs transition">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 mb-3.5">
                      <Sliders className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-800">Sistem Skor Perilaku (0-100)</h4>
                    <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                      Skor di bawah 40 otomatis ditolak. Skor 40-69 memicu tantangan interaktif (geser puzzle), dan skor di atas 70 dilewatkan secara instan dan mulus.
                    </p>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 hover:border-slate-300 shadow-xs transition">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 mb-3.5">
                      <Database className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-800">Toko Kunci &amp; Log Diagnostik</h4>
                    <p className="text-slate-505 text-xs mt-1.5 leading-relaxed">
                      Portal dashboard menyediakan log real-time lengkap berisi evaluasi waktu muat, ukuran ip, detail browser user-agent, dan peta sebaran skor verifikasi.
                    </p>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 hover:border-slate-300 shadow-xs transition">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 mb-3.5">
                      <Lock className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-800">Proteksi Token HMAC SHA256</h4>
                    <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                      Token berumur pendek (120 detik) ditandatangani menggunakan algoritma HMAC-SHA-256 dan dilindungi dari pemutaran ulang (anti replay-attack) di server.
                    </p>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 hover:border-slate-300 shadow-xs transition">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 mb-3.5">
                      <Globe2 className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-800">Validasi Nama Domain Aman</h4>
                    <p className="text-slate-505 text-xs mt-1.5 leading-relaxed">
                      Mencegah pencurian site-key oleh website lain. Server hanya memproses token yang di-generate dari domain sah yang terdaftar pada setelan developer.
                    </p>
                  </div>
                </div>
              </div>

            </motion.div>
          )}

          {/* TAB 2: DOKUMENTASI LENGKAP */}
          {activeTab === 'docs' && (
            <motion.div 
              key="tab-docs"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="grid lg:grid-cols-12 gap-8 py-4 animate-fade-in w-full max-w-full min-w-0 overflow-hidden"
            >
              {/* SIDE DOCUMENTATION NAV */}
              <div className="lg:col-span-3 space-y-4">
                <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-2 shadow-xs">
                  <h4 className="text-xs font-bold text-blue-650 font-mono uppercase tracking-wider px-2">Integrasi Klien</h4>
                  <button 
                    onClick={() => setDocsLang('javascript')}
                    className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition ${docsLang === 'javascript' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-850 hover:bg-slate-50'}`}
                  >
                    <Code2 className="w-4 h-4" /> HTML &amp; Vanilla JS
                  </button>

                  <h4 className="text-xs font-bold text-blue-650 font-mono uppercase tracking-wider px-2 pt-4">Verifikasi Server (API)</h4>
                  <button 
                    onClick={() => setDocsLang('nodejs')}
                    className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition ${docsLang === 'nodejs' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-850 hover:bg-slate-50'}`}
                  >
                    <Laptop className="w-4 h-4" /> Node.js (Express)
                  </button>
                  <button 
                    onClick={() => setDocsLang('php')}
                    className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition ${docsLang === 'php' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-850 hover:bg-slate-50'}`}
                  >
                    <Code2 className="w-4 h-4" /> Native PHP
                  </button>
                  <button 
                    onClick={() => setDocsLang('laravel')}
                    className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition ${docsLang === 'laravel' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-850 hover:bg-slate-50'}`}
                  >
                    <Terminal className="w-4 h-4" /> Laravel Controller
                  </button>
                </div>

                <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-105 shadow-xs">
                  <h4 className="text-xs font-bold text-blue-800">Unduh SDK Manual</h4>
                  <p className="text-[10px] text-slate-655 mt-1 leading-relaxed">
                    Setiap pendaftaran dan manajemen kunci dilakukan melalui developer account dashboard secara gratis tanpa batasan request harian.
                  </p>
                </div>
              </div>

              {/* DOCS DOCUMENT BODY CONTENT */}
              <div className="lg:col-span-9 min-w-0 space-y-6 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 md:p-8 shadow-sm text-slate-700 w-full max-w-full overflow-hidden">
                
                {/* INTERACTIVE GUIDE RENDERED BASED ON LANGUAGE SELECTED */}
                {docsLang === 'javascript' && (
                  <div className="space-y-4">
                    <span className="text-[11px] font-mono text-blue-650 font-bold uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded border border-blue-100">Integration Guide</span>
                    <h2 className="text-2xl font-bold text-slate-900">Langkah 1: Hubungkan Script &amp; Tag HTML Ke Halaman Buatan Anda</h2>
                    <p className="text-slate-500 text-xs leading-relaxed">
                      Masukkan script global `api.js` pada bagian `head` dokumen HTML Anda secara asinkronus, kemudian buat elemen input penampung widget dengan class `humancheck` disertai atribut kunci `data-sitekey`.
                    </p>

                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-slate-800">File HTML Integrasi Klien (index.html)</span>
                      <pre className="bg-slate-50 p-3 sm:p-4 rounded-lg overflow-x-auto text-[10px] sm:text-[11px] font-mono text-slate-805 border border-slate-200 shadow-xs leading-relaxed w-full max-w-full min-w-0">
{`<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Halaman Signup Anda</title>
    <!-- 1. Hubungkan SDK HumanCheck secara global -->
    <script src="${window.location.origin}/api.js" async defer></script>
</head>
<body>
    <form action="/proses-register" method="POST">
        <h3>Pendaftaran Akun Baru</h3>
        <input type="email" placeholder="Email" name="email" required />
        <br/><br/>

        <!-- 2. Tambahkan widget HumanCheck ke formulir -->
        <div 
            class="humancheck" 
            data-sitekey="HC_SITE_KEY_DEVELOPER_ANDA"
            data-theme="light"
            data-callback="onCaptchaVerified">
        </div>
        <br/>

        <button type="submit">Daftar Akun</button>
    </form>

    <script>
      // 3. Opsional: Callback JavaScript saat verifikasi berhasil
      function onCaptchaVerified(token) {
        console.log("HumanCheck verifikasi sukses! Token: " + token);
      }
    </script>
</body>
</html>`}
                      </pre>
                    </div>

                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-105 space-y-2">
                      <h4 className="text-xs font-semibold text-blue-800">Cara Kerja API Token Submission:</h4>
                      <p className="text-slate-655 text-xs">
                        Ketika pengguna berhasil melewati analisis gerakan kursor atau menjawab tantangan geser puzzle, skrip `api.js` akan secara dinamis menyuntikkan sebuah input tersembunyi berjenis &lt;input type="hidden" name="humancheck-response" value="TOKEN_DATA" /&gt; ke dalam tag form Anda. Kunci token ini wajib dikirimkan ke server backend Anda untuk verifikasi akhir.
                      </p>
                    </div>
                  </div>
                )}

                {docsLang === 'nodejs' && (
                  <div className="space-y-4">
                    <span className="text-[11px] font-mono text-blue-650 font-bold uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded border border-blue-100">Server-side Integration</span>
                    <h2 className="text-2xl font-bold text-slate-900">Verifikasi Menggunakan Node.js + Express</h2>
                    <p className="text-slate-500 text-xs leading-relaxed">
                      Lakukan panggilan HTTP POST server-ke-server menuju endpoint verifikasi kami(`/api/siteverify`) dari controller backend Node.js untuk mendapatkan konfirmasi otentik.
                    </p>

                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-slate-800">Eksposisi Kode Router Express</span>
                      <pre className="bg-slate-50 p-3 sm:p-4 rounded-lg overflow-x-auto text-[10px] sm:text-[11px] font-mono text-slate-805 border border-slate-200 shadow-xs leading-relaxed w-full max-w-full min-w-0">
{`const express = require('express');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post('/proses-register', async (req, res) => {
  // Ambil token response yang dikirimkan oleh klien
  const token = req.body['humancheck-response'];

  if (!token) {
    return res.status(400).send("CAPTCHA wajib diisi.");
  }

  try {
    // 1. Eksekusi server-to-server request ke HumanCheck API
    const verifyResponse = await fetch('${window.location.origin}/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: 'HC_SECRET_KEY_DEVELOPER_ANDA', // Gunakan secret key Anda
        response: token
      })
    });

    const result = await verifyResponse.json();

    // 2. Evaluasi hasil skor verifikasi
    if (result.success) {
      // Keberhasilan terverifikasi sebagai manusia (score >= 70)
      res.send(\`Registrasi Berhasil. Skor Manusia: \${result.score}\`);
    } else {
      // Ditolak sebagai robot
      res.status(400).send(\`Deteksi Robot Teridentifikasi. Kegagalan error: \${result.error_codes.join(', ')}\`);
    }
  } catch (error) {
    res.status(500).send("Gagal melakukan kontak server-validation.");
  }
});`}
                      </pre>
                    </div>
                  </div>
                )}

                {docsLang === 'php' && (
                  <div className="space-y-4">
                    <span className="text-[11px] font-mono text-blue-650 font-bold uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded border border-blue-100">Classic PHP</span>
                    <h2 className="text-2xl font-bold text-slate-900">Koneksi Verifikasi Menggunakan Native PHP</h2>
                    <p className="text-slate-500 text-xs leading-relaxed">
                      Gunakan `curl` native PHP untuk berkomunikasi dengan HumanCheck API Endpoint.
                    </p>

                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-slate-800">Kode Skrip Native PHP (verify.php)</span>
                      <pre className="bg-slate-50 p-3 sm:p-4 rounded-lg overflow-x-auto text-[10px] sm:text-[11px] font-mono text-slate-805 border border-slate-200 shadow-xs leading-relaxed w-full max-w-full min-w-0">
{`<?php
if (\$_SERVER['REQUEST_METHOD'] === 'POST') {
    \$token = \$_POST['humancheck-response'] ?? '';

    if (empty(\$token)) {
        die("Verifikasi Captcha wajib diisi.");
    }

    // Kunci Rahasia Developer
    \$secretKey = "HC_SECRET_KEY_DEVELOPER_ANDA";

    // Data payload untuk dikirimkan
    \$payload = json_encode([
        'secret' => \$secretKey,
        'response' => \$token
    ]);

    // Lakukan POST request menggunakan CURL
    \$ch = curl_init("${window.location.origin}/api/siteverify");
    curl_setopt(\$ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt(\$ch, CURLOPT_POST, true);
    curl_setopt(\$ch, CURLOPT_POSTFIELDS, \$payload);
    curl_setopt(\$ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json'
    ]);

    \$response = curl_exec(\$ch);
    curl_close(\$ch);

    \$result = json_decode(\$response, true);

    if (\$result && \$result['success'] === true) {
        echo "Lolos Verifikasi. Skor Anda adalah: " . \$result['score'];
        // Lanjutkan pemrosesan database pendaftaran...
    } else {
        echo "Validasi gagal. Kode pelanggaran: " . implode(', ', \$result['error_codes'] ?? []);
    }
}`}
                      </pre>
                    </div>
                  </div>
                )}

                {docsLang === 'laravel' && (
                  <div className="space-y-4">
                    <span className="text-[11px] font-mono text-sky-400 font-bold uppercase tracking-widest bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/15">Laravel Framework</span>
                    <h2 className="text-2xl font-bold">Implementasi Menggunakan Laravel Controller</h2>
                    <p className="text-slate-400 text-xs leading-relaxed">
                      Gunakan modul HTTP client modern bawaan Laravel Framework untuk validasi kursor captcha secara terstruktur.
                    </p>

                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-slate-300">File Controller PHP (RegisterController.php)</span>
                      <pre className="bg-slate-950 p-3 sm:p-4 rounded-lg overflow-x-auto text-[10px] sm:text-[11px] font-mono text-purple-300 border border-slate-800 leading-relaxed w-full max-w-full min-w-0">
{`<?php

namespace App\\Http\\Controllers;

use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\Http;

class RegisterController extends Controller
{
    public function register(Request \$request)
    {
        // 1. Dapatkan token response
        \$token = \$request->input('humancheck-response');

        if (!\$token) {
            return back()->withErrors(['captcha' => 'Verifikasi kursor wajib diselesaikan.']);
        }

        // 2. Hubungi endpoint HumanCheck API
        \$response = Http::post('${window.location.origin}/api/siteverify', [
            'secret' => config('services.humancheck.secret'), // Atur di config/services.php
            'response' => \$token
        ]);

        \$result = \$response->json();

        // 3. Evaluasi
        if (\$result['success'] ?? false) {
            // Lolos Validasi Manusia
            // Tarik data \$result['score'] dsb.
            
            return redirect('/dashboard')->with('success', 'Selamat datang kembali.');
        }

        return back()->withErrors([
            'captcha' => 'Deteksi abnormalitas teratasi. Anda diidentifikasi sebagai robot.'
        ]);
    }
}`}
                      </pre>
                    </div>
                  </div>
                )}

              </div>
            </motion.div>
          )}

          {/* TAB 3: PLAYGROUND SIMULATOR */}
          {activeTab === 'sandbox' && (
            <motion.div 
              key="tab-sandbox"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-6 py-4 animate-fade-in text-slate-705"
            >
              <div className="max-w-3xl mx-auto text-center space-y-2">
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Interactive Sandbox Playground</h2>
                <p className="text-slate-500 text-xs">
                  Situs eksperimental untuk mensimulasikan integrasi client-to-server secara utuh dalam satu halaman interaktif.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-8 items-stretch">
                
                {/* COMPONENT 1: THE INTEGRATED CLIENT CLIENT */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
                  <div>
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                      <span className="text-xs font-bold text-blue-600 flex items-center gap-1.5 font-mono">
                        <Monitor className="w-4 h-4" /> TAMPILAN WEBSITE CLIENT
                      </span>
                      <button 
                        onClick={resetSandbox}
                        className="text-[10px] text-slate-400 hover:text-blue-650 flex items-center gap-1 font-semibold transition"
                      >
                        <RefreshCw className="w-3 h-3" /> Reset Sandbox
                      </button>
                    </div>

                    <p className="text-slate-500 text-xs leading-relaxed mb-6">
                      Lakukan simulasi pendaftaran formulir di bawah. Status verifikasi ditunjukkan lewat visual checkbox. Selesaikan visual puzzle apabila diinstruksikan.
                    </p>

                    <div className="space-y-4 bg-slate-50 p-3.5 sm:p-5 rounded-xl border border-slate-205">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">E-MAIL PENDAFTAR</label>
                        <input 
                          type="email" 
                          placeholder="developer@gmail.com" 
                          disabled
                          className="w-full bg-slate-100/70 border border-slate-200 rounded px-3 py-1.5 text-xs text-slate-500 outline-none"
                        />
                      </div>

                      {/* THE TARGET CAPTCHA PLACEHOLDER */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1.5">VERIFIKASI MANUAL</label>
                        <div className="flex justify-start w-full">
                          {/* Live Dynamic IFrame Widget wrapper rendering */}
                          <div className="w-full max-w-[300px] border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs">
                            <iframe 
                              id="sandbox-captcha-iframe"
                              src={`${window.location.origin}/widget?id=${sandboxSiteKey}&theme=${sandboxTheme}&origin=${encodeURIComponent(window.location.origin)}`}
                              title="Sandbox CAPTCHA Widget"
                              frameBorder="0"
                              scrolling="no"
                              sandbox="allow-scripts allow-same-origin allow-popups"
                              style={{ width: '100%', maxWidth: '300px', height: '80px', transition: 'height 0.25s' }}
                            />
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={runSandboxServerVerify}
                        disabled={!sandboxVerified || isVerifyingSandbox}
                        className={`w-full py-2.5 rounded-lg text-xs font-bold tracking-wider text-white transition flex items-center justify-center gap-2 ${
                          sandboxVerified 
                            ? 'bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/10' 
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {isVerifyingSandbox ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sedang menghubungi server...
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" /> Kirim Formulir Pendaftaran (POST)
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 p-3 rounded-lg bg-slate-50 text-[11px] font-mono border border-slate-200">
                    <span className="text-slate-500 block mb-1">📟 Callback Listener Log (js):</span>
                    <div className="text-blue-600 font-bold whitespace-pre-wrap leading-tight">{sandboxCallbackOutput}</div>
                  </div>
                </div>

                {/* COMPONENT 2: THE BACKEND VALIDATOR CONSOLE */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
                  <div>
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                      <span className="text-xs font-bold text-amber-600 flex items-center gap-1.5 font-mono">
                        <Terminal className="w-4 h-4" /> KONSOL LOG BACKEND VALIDATOR
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono font-bold">POST /api/siteverify</span>
                    </div>

                    <p className="text-slate-505 text-xs leading-relaxed mb-6">
                      Di server aman (secure backend), verifikasi token HMAC-SHA256 dilakukan dengan memanggil API `/api/siteverify` di atas menggunakan Secret Key developer.
                    </p>

                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200 leading-normal">
                        <div>
                          <span className="text-[10px] text-slate-400 font-mono block">DEVELOPER SECRET KEY:</span>
                          <span className="font-mono text-amber-600 font-bold">
                            {developer && selectedSite ? selectedSite.secretKey.substring(0, 16) + '...' : 'hc_secret_demo_1234...'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-mono block font-bold">SASARAN DOMAIN:</span>
                          <span className="font-semibold text-slate-700">localhost</span>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 h-48 overflow-y-auto font-mono text-[11px] leading-relaxed select-text">
                        <span className="text-slate-450 font-bold">// Response dari Server API SiteVerify:</span>
                        {sandboxResultJson ? (
                          <pre className="text-emerald-600 font-bold mt-2">
                            {JSON.stringify(sandboxResultJson, null, 2)}
                          </pre>
                        ) : (
                          <div className="text-slate-400 italic mt-6 text-center">
                            Selesaikan verifikasi captcha di sebelah kiri, kemudian tekan tombol kiriman formulir pendaftaran untuk merender log verifikasi.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 p-3 rounded-lg bg-amber-50/70 text-[11px] border border-amber-100 text-amber-900 font-medium">
                    💡 <span className="font-bold">Tips Pengujian:</span> Jika Anda menekan checkbox terlalu cepat (kurang dari 400 milidetik sejak halaman dimuat), algoritma HumanCheck akan mendegradasi skor Anda ke bawah 70 dan menyajikan tantangan geser slider puzzle tambahan.
                  </div>
                </div>

              </div>
            </motion.div>
          )}

          {/* TAB 4: DEVELOPER DASHBOARD PORTAL */}
          {activeTab === 'dashboard' && (
            <motion.div 
              key="tab-dashboard"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="py-4 animate-fade-in w-full max-w-full min-w-0 overflow-hidden"
            >
              {!developer ? (
                /* AUTH LOGIN/REGISTER PANEL */
                <div className="max-w-md mx-auto bg-white p-5 sm:p-8 rounded-2xl border border-slate-200 shadow-md space-y-6">
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mx-auto shadow-xs">
                      <Lock className="w-6 h-6 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold font-sans text-slate-900">
                      {authMode === 'login' ? 'Masuk ke Portal' : 'Daftar Akun Developer'}
                    </h2>
                    <p className="text-slate-500 text-xs text-center">
                      {authMode === 'login' 
                        ? 'Kelola site keys, setelan tema, dan analisis log perilaku' 
                        : 'Mulai buat kunci pelindung website instan tanpa biaya'}
                    </p>
                  </div>

                  {authError && (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-700 text-xs font-semibold flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 flex-shrink-0 text-rose-600" />
                      {authError}
                    </div>
                  )}

                  <form onSubmit={handleAuthSubmit} className="space-y-4">
                    {authMode === 'register' && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">NAMA LENGKAP</label>
                        <input 
                          type="text" 
                          required
                          placeholder="Budi Gunawan" 
                          value={authForm.name}
                          onChange={(e) => setAuthForm(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:border-blue-600 hover:bg-slate-100/30 outline-none text-slate-800 font-medium transition"
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">EMAIL DEVELOPER</label>
                      <input 
                        type="email" 
                        required
                        placeholder="developer@humancheck.io" 
                        value={authForm.email}
                        onChange={(e) => setAuthForm(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:border-blue-600 hover:bg-slate-100/30 outline-none text-slate-800 font-medium transition"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">PASSWORD</label>
                      <div className="relative">
                        <input 
                          type={showPassword ? 'text' : 'password'} 
                          required
                          placeholder="••••••••••••" 
                          value={authForm.password}
                          onChange={(e) => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:border-blue-600 hover:bg-slate-100/30 outline-none text-slate-800 font-medium pr-10 transition"
                        />
                        <button 
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 pointer-events-auto"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button 
                      type="submit"
                      className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-bold tracking-wider text-white transition shadow-xs"
                    >
                      {authMode === 'login' ? 'Masuk Sekarang' : 'Daftar Akun Baru'}
                    </button>
                  </form>

                  {/* QUICK DEMO LOGIN SHORTCUT */}
                  {authMode === 'login' && (
                    <div className="pt-2 border-t border-slate-100">
                      <button 
                        type="button"
                        onClick={() => {
                          setAuthForm({
                            email: 'developer@humancheck.io',
                            name: 'Demo Account',
                            password: 'password123'
                          });
                        }}
                        className="w-full py-2 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100/70 border-dashed text-xs text-blue-600 font-bold transition cursor-pointer"
                      >
                        ⚡ Masuk Instan Pakai Akun Simulasi (Demo)
                      </button>
                    </div>
                  )}

                  <div className="text-center text-xs">
                    {authMode === 'login' ? (
                      <span className="text-slate-500">
                        Belum punya akun?{' '}
                        <button onClick={() => setAuthMode('register')} className="text-blue-600 font-bold hover:underline cursor-pointer">
                          Daftar Akun Baru
                        </button>
                      </span>
                    ) : (
                      <span className="text-slate-500">
                        Sudah punya akun?{' '}
                        <button onClick={() => setAuthMode('login')} className="text-blue-600 font-bold hover:underline cursor-pointer">
                          Masuk disini
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                /* DEVELOPER MANAGEMENT DASHBOARD */
                <div className="space-y-8 w-full max-w-full min-w-0 overflow-hidden">
                  
                  {/* UPPER CONFIG BAR */}
                  <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <div className="flex items-center gap-3">
                      <Globe2 className="w-5 h-5 text-blue-600" />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 block leading-none">PILIH SITE KEY AKTIF:</span>
                        {sites.length > 0 ? (
                          <select 
                            value={selectedSite?.id || ''}
                            onChange={(e) => setSelectedSite(sites.find(s => s.id === e.target.value) || null)}
                            className="bg-transparent text-sm font-bold text-slate-800 outline-none cursor-pointer mt-1 border-none"
                          >
                            {sites.map(s => (
                              <option key={s.id} value={s.id} className="bg-white text-slate-800">{s.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Belum membuat site key</span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => setShowCreateDialog(true)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-xs transition"
                      >
                        <Plus className="w-3.5 h-3.5" /> Buat Site Key
                      </button>
                      {selectedSite && (
                        <button 
                          onClick={() => handleDeleteSite(selectedSite.id)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-600 border border-rose-200 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Hapus
                        </button>
                      )}
                    </div>
                  </div>

                  {/* CREATE DIALOG MODAL */}
                  {showCreateDialog && (
                    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 relative shadow-2xl">
                        <h3 className="text-lg font-bold flex items-center gap-2 mb-2 text-slate-900">
                          <Plus className="w-5 h-5 text-blue-650" /> Daftarkan Website Baru
                        </h3>
                        <p className="text-slate-500 text-xs mb-4">
                          Sistem akan men-generate Site Key publik dan Secret Key privat unik untuk mengunci form website Anda.
                        </p>

                        <form onSubmit={handleCreateSite} className="space-y-4">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 block mb-1">NAMA KEY / WEBSITE</label>
                            <input 
                              type="text" 
                              required
                              placeholder="Klien Toko Buku" 
                              value={newSiteForm.name}
                              onChange={(e) => setNewSiteForm(prev => ({ ...prev, name: e.target.value }))}
                              className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-600"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-500 block mb-1">DOMAINS YANG DIIZINKAN (PISAHKAN KOMA)</label>
                            <input 
                              type="text" 
                              required
                              placeholder="localhost, 127.0.0.1, dynamic-app.com" 
                              value={newSiteForm.domains}
                              onChange={(e) => setNewSiteForm(prev => ({ ...prev, domains: e.target.value }))}
                              className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-600"
                            />
                            <span className="text-[9px] text-slate-400 leading-tight block mt-1">Keamanan Origin: Hanya situs yang domainnya berada dalam list ini yang diizinkan memuat widget captcha Anda.</span>
                          </div>

                          <div className="flex gap-2 justify-end pt-2">
                            <button 
                              type="button" 
                              onClick={() => { setShowCreateDialog(false); setSiteCreationResult(null); }}
                              className="px-4 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition"
                            >
                              Tutup
                            </button>
                            <button 
                              type="submit" 
                              className="px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition"
                            >
                              Buat Kunci
                            </button>
                          </div>
                        </form>

                        {/* GENERATED KEYS OUTPUT SUCCESS */}
                        {siteCreationResult && (
                          <div className="mt-4 pt-4 border-t border-slate-150 space-y-3 font-mono animate-scale-in">
                            <div className="p-2.5 bg-blue-50 rounded border border-blue-105 text-[11px] text-blue-700 font-sans font-bold flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Kunci Kredensial Berhasil Dibuat!
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-400 block font-sans font-bold uppercase">SITE KEY (PUBLIK)</span>
                              <input 
                                readOnly 
                                value={siteCreationResult.id} 
                                onClick={(e) => (e.target as any).select()}
                                className="w-full bg-slate-50 border border-slate-200 p-1.5 text-[10px] uppercase text-slate-850 font-mono select-all text-center rounded mt-1 cursor-pointer outline-none"
                              />
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-400 block font-sans font-bold uppercase">SECRET KEY (PRIVAT - JANGAN DISEBARKAN)</span>
                              <input 
                                readOnly 
                                value={siteCreationResult.secretKey} 
                                onClick={(e) => (e.target as any).select()}
                                className="w-full bg-slate-50 border border-slate-200 p-1.5 text-[10px] uppercase text-amber-600 font-mono select-all text-center rounded mt-1 cursor-pointer outline-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedSite ? (
                    <div className="space-y-8 animate-fade-in">
                      
                      {/* STATS TILES HERO SUMMARY */}
                      {stats ? (
                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs text-slate-700">
                            <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-widest block mb-1">TOTAL REQUEST</span>
                            <div className="text-2xl font-black font-sans text-slate-900">{stats.summary.total}</div>
                            <span className="text-[9px] text-slate-400 leading-none block mt-1">Verifikasi kursor mouse &amp; mobile</span>
                          </div>

                          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs text-slate-700">
                            <span className="text-[10px] font-mono text-emerald-600 font-bold uppercase tracking-widest block mb-1">LOLOS MANUSIA</span>
                            <div className="text-2xl font-black font-sans text-emerald-650">{stats.summary.passed}</div>
                            <span className="text-[9px] text-slate-400 leading-none block mt-1">Berhasil melewati passing threshold</span>
                          </div>

                          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs text-slate-700">
                            <span className="text-[10px] font-mono text-rose-650 font-bold uppercase tracking-widest block mb-1">TERDETEKSI BOT (GAGAL)</span>
                            <div className="text-2xl font-black font-sans text-rose-650">{stats.summary.failed}</div>
                            <span className="text-[9px] text-slate-400 leading-none block mt-1">{stats.summary.total > 0 ? Math.round((stats.summary.failed / stats.summary.total) * 100) : 0}% Tingkat penolakan robot otomatis</span>
                          </div>

                          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs text-slate-700">
                            <span className="text-[10px] font-mono text-blue-600 font-bold uppercase tracking-widest block mb-1">RATA-RATA SKOR AKTIVITAS</span>
                            <div className="text-2xl font-black font-sans text-blue-600">{stats.summary.averageScore} / 100</div>
                            <span className="text-[9px] text-slate-400 leading-none block mt-1">Aktivitas kursor alami vs linear</span>
                          </div>
                        </div>
                      ) : (
                        <div className="h-28 bg-white rounded-xl border border-slate-205 border-dashed flex items-center justify-center text-slate-450 text-xs italic">
                          <RefreshCw className="w-4 h-4 animate-spin mr-1.5" /> Sedang menarik data ringkasan logs...
                        </div>
                      )}

                      {/* STATS ANALYTICS CHART & CAPTCHA DESIGNER SETTINGS */}
                      <div className="grid lg:grid-cols-3 gap-8 w-full max-w-full min-w-0">
                        
                        {/* CHART COLUMN */}
                        <div className="lg:col-span-2 min-w-0 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 md:p-6 space-y-4 shadow-xs w-full max-w-full overflow-hidden">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <h4 className="text-sm font-extrabold flex items-center gap-1.5 text-slate-800 font-sans">
                              <Database className="w-4 h-4 text-blue-600" /> GRAFIK VOLUME VERIFIKASI (14 HARI TERAKHIR)
                            </h4>
                            <span className="text-[9px] text-slate-400 font-mono uppercase tracking-widest">Realtime Traffic Logs</span>
                          </div>

                          {stats && stats.dailyHistory.length > 0 ? (
                            <div className="space-y-2">
                              {/* Custom SVG Bar Graph implementation for extreme reliability and styling */}
                              <div className="w-full overflow-x-auto">
                                <svg viewBox="0 0 600 220" className="w-full h-auto min-w-[500px] select-none font-mono">
                                  {/* Gridlines */}
                                  <line x1="40" y1="20" x2="580" y2="20" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                                  <line x1="40" y1="70" x2="580" y2="70" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                                  <line x1="40" y1="120" x2="580" y2="120" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                                  <line x1="40" y1="170" x2="580" y2="170" stroke="#e2e8f0" strokeWidth="1" />

                                  {/* Left axis values */}
                                  <text x="30" y="24" fill="#94a3b8" fontSize="9" textAnchor="end">100%</text>
                                  <text x="30" y="74" fill="#94a3b8" fontSize="9" textAnchor="end">50%</text>
                                  <text x="30" y="124" fill="#94a3b8" fontSize="9" textAnchor="end">25%</text>
                                  <text x="30" y="174" fill="#94a3b8" fontSize="9" textAnchor="end">0%</text>

                                  {/* Bars Renders */}
                                  {stats.dailyHistory.map((day, ix) => {
                                    // Map daily history coordinates
                                    const colWidth = 540 / stats.dailyHistory.length;
                                    const x = 45 + ix * colWidth;
                                    
                                    // Scale factor
                                    const maxRequests = Math.max(...stats.dailyHistory.map(d => d.total)) || 1;
                                    const heightPassed = (day.passed / maxRequests) * 140;
                                    const heightFailed = (day.failed / maxRequests) * 140;

                                    const dayName = day.date.substring(8, 10) + '/' + day.date.substring(5, 7);

                                    return (
                                      <g key={day.date} className="group cursor-pointer">
                                        <title>{`${day.date}\nTotal: ${day.total}\nLolos (Manusia): ${day.passed}\nGagal (Bot): ${day.failed}`}</title>
                                        
                                        {/* Passed block bar */}
                                        <rect 
                                          x={x + 2} 
                                          y={170 - heightPassed} 
                                          width={colWidth - 6} 
                                          height={heightPassed} 
                                          fill="#2563eb" 
                                          opacity="0.85"
                                          className="hover:opacity-100 transition-all duration-150 animate-fade-in"
                                        />

                                        {/* Failed bar top layer */}
                                        <rect 
                                          x={x + 2} 
                                          y={170 - heightPassed - heightFailed} 
                                          width={colWidth - 6} 
                                          height={heightFailed} 
                                          fill="#e11d48" 
                                          opacity="0.75"
                                          className="hover:opacity-100 transition-all duration-150 animate-fade-in"
                                        />

                                        {/* Label text */}
                                        <text 
                                          x={x + colWidth / 2} 
                                          y="190" 
                                          fill="#64748b" 
                                          fontSize="8" 
                                          textAnchor="middle"
                                        >
                                          {dayName}
                                        </text>
                                      </g>
                                    );
                                  })}
                                </svg>
                              </div>

                              <div className="flex items-center justify-center gap-6 text-[10px] font-mono font-bold uppercase mt-2 pt-2 border-t border-slate-100 text-slate-500">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2.5 h-2.5 rounded bg-blue-600" />
                                  <span>Lolos Verifikasi (Manusia)</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2.5 h-2.5 rounded bg-rose-600" />
                                  <span>Terdeteksi / Bot Gagal</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p className="text-slate-400 text-xs italic text-center py-12">Belum memiliki log pencatatan mingguan.</p>
                          )}
                        </div>

                        {/* CONFIGURATION COLUMN */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 md:p-6 space-y-4 flex flex-col justify-between shadow-xs text-slate-705 w-full min-w-0 max-w-full overflow-hidden">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                              <h4 className="text-sm font-extrabold flex items-center gap-1.5 text-slate-800 font-sans">
                                <SlidersHorizontal className="w-4 h-4 text-blue-600" /> EDIT KEY &amp; VISUAL CAPTCHA
                              </h4>
                              <span className="text-[9px] font-mono uppercase font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">Terhubung</span>
                            </div>

                            <p className="text-slate-505 text-[11px] leading-relaxed">
                              Sesuaikan tema tampilan bawaan dan domains yang diizinkan untuk site-key ini. Perubahan akan merender penyesuaian visual instan.
                            </p>

                            <div className="space-y-3.5">
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 block mb-1">NAMA KEY WEBSITE</label>
                                <input 
                                  type="text" 
                                  value={selectedSite.name}
                                  onChange={(e) => {
                                    const updatedName = e.target.value;
                                    setSelectedSite(prev => prev ? { ...prev, name: updatedName } : null);
                                  }}
                                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 outline-none transition"
                                />
                              </div>

                              <div>
                                <label className="text-[10px] font-bold text-slate-500 block mb-1">DOMAINS YANG DIIZINKAN</label>
                                <input 
                                  type="text" 
                                  placeholder="localhost, run.app, vwebapp.workers.dev" 
                                  value={customization.domainsText}
                                  onChange={(e) => setCustomization(prev => ({ ...prev, domainsText: e.target.value }))}
                                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-805 focus:border-blue-600 outline-none transition"
                                />
                              </div>

                              <div>
                                <label className="text-[10px] font-bold text-slate-500 block mb-1">TEMA CAPTCHA DEFAULT</label>
                                <select 
                                  value={customization.theme}
                                  onChange={(e) => setCustomization(prev => ({ ...prev, theme: e.target.value as any }))}
                                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-850 cursor-pointer outline-none focus:border-blue-600"
                                >
                                  <option value="light">Light Theme (Terang)</option>
                                  <option value="dark">Dark Theme (Gelap)</option>
                                  <option value="auto">System Theme Auto (Otomatis)</option>
                                </select>
                              </div>

                              <div>
                                <label className="text-[10px] font-bold text-slate-500 block mb-1 flex justify-between">
                                  <span>EVALUASI THRESHOLD SKOR</span>
                                  <span className="text-blue-600 font-extrabold">{customization.threshold}</span>
                                </label>
                                <input 
                                  type="range" 
                                  min="50" 
                                  max="90" 
                                  value={customization.threshold}
                                  onChange={(e) => setCustomization(prev => ({ ...prev, threshold: Number(e.target.value) }))}
                                  className="w-full accent-blue-600 h-1 rounded bg-slate-200 cursor-pointer"
                                />
                                <span className="text-[9px] text-slate-400 block leading-tight mt-1">Skor minimum aktivitas manusia (biasanya 70). Di bawah threshold ini, tantangan puzzle slider akan dipicu otomatis.</span>
                              </div>
                            </div>
                          </div>

                          <button 
                            onClick={handleUpdateSiteOptions}
                            className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-xs transition mt-4 cursor-pointer"
                          >
                            Simpan Perubahan Setelan
                          </button>
                        </div>

                      </div>

                      {/* RAW VERIFICATION LOGS TABLE */}
                      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 md:p-6 space-y-4 shadow-xs w-full max-w-full overflow-hidden min-w-0">
                        <div className="pb-2 border-b border-slate-100 flex items-center justify-between">
                          <h4 className="text-sm font-bold flex items-center gap-1.5 text-slate-800 font-sans">
                            <Terminal className="w-4 h-4 text-blue-600" /> LOGS AKTIVITAS TERKINI (LIVE DATABASE)
                          </h4>
                          <span className="text-[9px] text-slate-400 font-mono uppercase tracking-widest">JSON format database</span>
                        </div>

                        {stats && stats.logs.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="border-b border-slate-100 text-[10px] font-mono text-slate-400 uppercase">
                                  <th className="py-2.5 px-3">Waktu</th>
                                  <th className="py-2.5 px-3">Status</th>
                                  <th className="py-2.5 px-3 text-center">Skor Perilaku</th>
                                  <th className="py-2.5 px-3">Arah Hostname</th>
                                  <th className="py-2.5 px-3">Device (Platform)</th>
                                  <th className="py-2.5 px-3">Alamat IP</th>
                                  <th className="py-2.5 px-3 text-right">Detil Integrasi</th>
                                </tr>
                              </thead>
                              <tbody>
                                {stats.logs.map((log) => (
                                  <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/75 text-slate-700 transition-colors">
                                    <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                                      {new Date(log.timestamp).toLocaleTimeString('id-ID')}
                                    </td>
                                    
                                    <td className="py-3 px-3">
                                      {log.success ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-850 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                          Lolos Manusia
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-850 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                                          Bot Ditolak
                                        </span>
                                      )}
                                    </td>
                                    
                                    <td className="py-3 px-3 text-center font-bold font-mono">
                                      <span className={log.score >= 70 ? 'text-emerald-600' : log.score >= 40 ? 'text-blue-600' : 'text-rose-650'}>
                                        {log.score}%
                                      </span>
                                    </td>
                                    
                                    <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                                      {log.hostname}
                                    </td>
                                    
                                    <td className="py-3 px-3 text-slate-550 text-[11px]">
                                      {log.device}
                                    </td>
                                    
                                    <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                                      {log.ip}
                                    </td>

                                    <td className="py-3 px-3 text-right">
                                      <div className="flex flex-col text-[10px] text-slate-400 leading-tight">
                                        <span>Len: {log.behaviorMetrics.mousePathLength}px</span>
                                        <span>Points: {log.behaviorMetrics.mousePointsCount}</span>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-center py-8 text-slate-400 italic text-xs">Belum ada aktivitas login untuk site key ini. Lakukan tes pada Playground Demo untuk memunculkan logs.</div>
                        )}
                      </div>

                    </div>
                  ) : (
                    <div className="h-64 bg-slate-900/20 border border-slate-900 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3">
                      <Globe2 className="w-10 h-10 text-slate-650" />
                      <div className="text-center">
                        <span className="text-slate-400 text-sm font-bold block">Memilih atau Mendaftarkan Site Key</span>
                        <span className="text-slate-500 text-xs mt-1 block">Silakan daftarkan website Anda atau pilih site key demonstrasi di atas.</span>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </motion.div>
          )}

          {/* TAB 5: PRICING TABLE */}
          {activeTab === 'pricing' && (
            <motion.div 
              key="tab-pricing"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-8 py-4"
            >
              <div className="max-w-2xl mx-auto text-center space-y-2">
                <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Skema Paket Layanan HumanCheck</h2>
                <p className="text-slate-500 text-sm">
                  Tarif murah bercirikan kepedulian terhadap privasi. Sesuai untuk developer perorangan maupun skala korporasi global.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-6 items-stretch max-w-5xl mx-auto pt-4">
                
                {/* PLAN 1 */}
                <div className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-6 flex flex-col justify-between transition shadow-xs">
                  <div>
                    <span className="text-[10px] font-bold text-blue-600 font-mono uppercase tracking-widest block mb-1">Developer</span>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Selamanya Gratis</h3>
                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="text-3xl font-extrabold text-slate-900">Rp 0</span>
                      <span className="text-xs text-slate-455 font-medium">/ selamanya</span>
                    </div>
                    
                    <p className="text-slate-500 text-xs leading-relaxed mb-6">
                      Sempurna untuk pembuatan blog portofolio, tugas kampus, startup kecil, sandbox, dan platform lokal berskala ringan.
                    </p>

                    <div className="space-y-2.5 border-t border-slate-100 pt-4 text-xs font-medium text-slate-600">
                      <div className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-600 flex-shrink-0" /> Maks. 50.000 request per bulan</div>
                      <div className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-600 flex-shrink-0" /> Kompatibilitas multi-domain</div>
                      <div className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-600 flex-shrink-0" /> Kustomisasi warna bawaan</div>
                      <div className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-600 flex-shrink-0" /> Integrasi JavaScript &amp; Node</div>
                    </div>
                  </div>

                  <button 
                    onClick={() => { navigateTo('/login'); setAuthMode('register'); }}
                    className="w-full py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-705 border border-slate-200 transition mt-6 cursor-pointer"
                  >
                    Daftar Sekarang
                  </button>
                </div>

                {/* PLAN 2 */}
                <div className="bg-white border-2 border-blue-600 rounded-2xl p-6 flex flex-col justify-between transition relative transform md:-translate-y-2 shadow-sm">
                  <div className="absolute top-0 right-6 translate-y-[-50%] bg-blue-600 text-white font-bold text-[9px] uppercase tracking-widest px-2.5 py-0.5 rounded-full">
                    Sangat Rekomendasi
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-blue-600 font-mono uppercase tracking-widest block mb-1">Startup &amp; Agency</span>
                    <h3 className="text-lg font-bold text-slate-850 mb-2">Pro SaaS</h3>
                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="text-3xl font-extrabold text-slate-900">Rp 249K</span>
                      <span className="text-xs text-slate-500 font-medium">/ bulan</span>
                    </div>
                    
                    <p className="text-slate-500 text-xs leading-relaxed mb-6">
                      Sesuai untuk platform e-commerce, portal keanggotaan premium, periklanan, dan portal bisnis yang rentan sasaran bot spammer.
                    </p>

                    <div className="space-y-2.5 border-t border-slate-100 pt-4 text-xs font-medium text-slate-600">
                      <div className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-600 flex-shrink-0" /> Unlimited Request harian</div>
                      <div className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-600 flex-shrink-0" /> Hapus tulisan logo bawaan</div>
                      <div className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-600 flex-shrink-0" /> Response time verifikasi &lt; 50ms</div>
                      <div className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-600 flex-shrink-0" /> Bantuan teknis prioritas / WA</div>
                    </div>
                  </div>

                  <button 
                    onClick={() => { navigateTo('/login'); setAuthMode('register'); }}
                    className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white transition mt-6 cursor-pointer"
                  >
                    Mulai Berlangganan
                  </button>
                </div>

                {/* PLAN 3 */}
                <div className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-6 flex flex-col justify-between transition shadow-xs">
                  <div>
                    <span className="text-[10px] font-bold text-blue-600 font-mono uppercase tracking-widest block mb-1">Enterprise</span>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Korporat Besar</h3>
                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="text-3xl font-extrabold text-slate-900">Custom</span>
                    </div>
                    
                    <p className="text-slate-500 text-xs leading-relaxed mb-6">
                      Bagi aplikasi perbankan, instansi pertahanan negara, agensi korporat besar ber-volume jutaan hits login harian.
                    </p>

                    <div className="space-y-2.5 border-t border-slate-100 pt-4 text-xs font-medium text-slate-600">
                      <div className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-600 flex-shrink-0" /> Deployment on-premise (lokal server)</div>
                      <div className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-600 flex-shrink-0" /> Lisensi kode sumber penuh</div>
                      <div className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-600 flex-shrink-0" /> Custom enkripsi HMAC privat</div>
                      <div className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-600 flex-shrink-0" /> Perjanjian SLA Keandalan 99.9%</div>
                    </div>
                  </div>

                  <button 
                    onClick={() => alert('Fitur Hubungi Enterprise memerlukan pengaturan email server. Silakan hubungi tim sales kami di sales@humancheck.io')}
                    className="w-full py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-705 border border-slate-200 transition mt-6 cursor-pointer"
                  >
                    Hubungi Sales Kami
                  </button>
                </div>

              </div>
            </motion.div>
          )}

          {/* TAB 6: FAQ SECTION */}
          {activeTab === 'faq' && (
            <motion.div 
              key="tab-faq"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-6 py-4 max-w-3xl mx-auto"
            >
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Kumpulan Tanya Jawab (FAQ)</h2>
                <p className="text-slate-500 text-sm">Menjawab setiap rincian teknis perihal privasi, performa, dan validasi.</p>
              </div>

              <div className="space-y-4 pt-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2 shadow-xs">
                  <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-2"><HelpCircle className="w-4.5 h-4.5 text-blue-600 flex-shrink-0" /> Bagaimana HumanCheck mendeteksi bot tanpa AI?</h4>
                  <p className="text-slate-505 text-xs leading-relaxed">
                    Kami merekam detail fisik input kursor mouse: tingkat kelengkungan koordinat rute kursor (splines), variabilitas velositas (akselerasi dan deselerasi jari), rentang waktu pengisian, dan blur/focus window browser. Robot atau bot scripting biasnya menembak event klik secara linear konstan/instan atau melompat tanpa lintasan kurva, sehingga skor verifikasi akan merendah dan memicu slider puzzle.
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2 shadow-xs">
                  <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-2"><HelpCircle className="w-4.5 h-4.5 text-blue-600 flex-shrink-0" /> Apakah HumanCheck menggunakan kuki (Cookies)?</h4>
                  <p className="text-slate-505 text-xs leading-relaxed">
                    Berbeda dengan reCAPTCHA v3 yang mengidentifikasi user dengan membaca cookies login akun Google milik Anda dari situs lain, HumanCheck 100% didesain stateless. Kami sama sekali tidak menulis kuki maupun menyimpan riwayat kunjungan browser antar website. Data yang dikirimkan murni koordinat behavior temporer selama pendaftaran.
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2 shadow-xs">
                  <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-2"><HelpCircle className="w-4.5 h-4.5 text-blue-600 flex-shrink-0" /> Apa kegunaan token HMAC SHA256?</h4>
                  <p className="text-slate-505 text-xs leading-relaxed">
                    Token HMAC SHA256 ditandatangani menggunakan Secret Key Anda di sisi server. Ini menjamin token tersebut dibuat secara legal oleh HumanCheck Engine dan mencegah pembuatan token palsu oleh bot secara lokal. Token tersebut hanya berlaku selama 2 menit (120 detik) dan sekali pakai untuk mencegah penyerangan replay (replay attack).
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2 shadow-xs">
                  <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-2"><HelpCircle className="w-4.5 h-4.5 text-blue-600 flex-shrink-0" /> Apakah widget mendukung perangkat smartphone/layar sentuh?</h4>
                  <p className="text-slate-505 text-xs leading-relaxed">
                    Ya. Di smartphone we use touch listeners (`touchstart`, `touchmove`, `touchend`) yang mendeteksi dinamika sentuhan jempol manusia, luasan area sentuh jika tersedia, dan velocity seretan jari saat menyelesaikan tantangan geser.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 p-6 md:p-8 bg-white text-slate-500 text-center text-xs space-y-4 shadow-inner">
        <div className="flex flex-wrap justify-center gap-4 md:gap-6 text-[11px] font-semibold text-slate-600">
          <button onClick={() => navigateTo('/')} className="hover:text-blue-600 transition cursor-pointer">Beranda</button>
          <button onClick={() => navigateTo('/docs')} className="hover:text-blue-600 transition cursor-pointer">Dokumentasi</button>
          <button onClick={() => navigateTo('/sandbox')} className="hover:text-blue-600 transition cursor-pointer">Playground</button>
          <span className="text-slate-300 hidden sm:inline">|</span>
          <span className="text-slate-400 font-mono">APP URL: {window.location.origin}</span>
        </div>
        <div>
          <p>© 2026 HumanCheck Security. Semua hak dilindungi undang-undang.</p>
          <p className="text-[10px] text-slate-405 mt-1">Dibuat menggunakan standardisasi web berperingkat privasi tinggi tanpa pelacakan data perorangan.</p>
        </div>
      </footer>

    </div>
  );
}
