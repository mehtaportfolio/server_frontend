import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { RefreshCw, CheckCircle, XCircle, Loader2, Moon, Sun, AlertTriangle, Clock, Activity, Power, Bell, BellOff, RotateCcw } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const API_TOKEN = import.meta.env.VITE_API_AUTH_TOKEN;

// MANUAL BRANDING: Edit this map to customize letters for each service
const SERVICE_BRANDING = {
  'expense': 'EXP',
  'uqe': 'UQE',
  'portfolio' : 'PFO',
  'angel-one' : 'AOP',
  'nse' : 'NSE',
  'googlesheet' : 'GSS',
  'quality' : 'QAD',
  'data' : 'D360',
  'uqe-H' : 'UQX',
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Authorization: `Bearer ${API_TOKEN}`,
  },
});

function App() {
  const [services, setServices] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [restarting, setRestarting] = useState({});
  const [status, setStatus] = useState(null);
  const [confirmRestart, setConfirmRestart] = useState(null); // { name, type: 'single' | 'all', action: 'restart' | 'redeploy' }
  const [activeTab, setActiveTab] = useState('restart');
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'blank';
  });
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  const checkSubscription = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    setPushEnabled(!!subscription);
  }, []);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const togglePush = async () => {
    try {
      setPushLoading(true);
      if (pushEnabled) {
        // Unsubscribe
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
          await apiClient.post('/unsubscribe', subscription);
        }
        setPushEnabled(false);
        setStatus({ type: 'success', message: 'Notifications disabled' });
      } else {
        // Subscribe
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          throw new Error('Permission not granted');
        }

        const registration = await navigator.serviceWorker.ready;
        const response = await apiClient.get('/vapid-public-key');
        const vapidPublicKey = response.data.publicKey;

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });

        await apiClient.post('/subscribe', subscription);
        setPushEnabled(true);
        setStatus({ type: 'success', message: 'Notifications enabled' });
      }
    } catch (error) {
      console.error('Push error:', error);
      setStatus({ type: 'error', message: `Notification error: ${error.message}` });
    } finally {
      setPushLoading(false);
    }
  };

  const fetchStatuses = useCallback(async () => {
    try {
      const response = await apiClient.get('/status');
      setStatuses(response.data);
    } catch (error) {
      console.error('Failed to fetch statuses:', error);
    }
  }, []);

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/services');
      const sortedServices = response.data.services.sort((a, b) => a.localeCompare(b));
      setServices(sortedServices);
      setStatus({ type: 'success', message: 'Services connected' });
      await fetchStatuses();
    } catch (error) {
      console.error('Failed to fetch services:', error);
      const errorMsg = error.response?.data?.error || error.message;
      setStatus({ type: 'error', message: `Offline: ${errorMsg}` });
    } finally {
      setLoading(false);
    }
  }, [fetchStatuses]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  useEffect(() => {
    const interval = setInterval(fetchStatuses, 30000);
    return () => clearInterval(interval);
  }, [fetchStatuses]);

  useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => {
        setStatus(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'blank' ? 'light' : 'blank'));
  };

  const handleRestart = async (serviceName, action = 'restart') => {
    try {
      setRestarting((prev) => ({ ...prev, [serviceName]: true }));
      setStatus({ type: 'info', message: `${action === 'redeploy' ? 'Redeploying' : 'Restarting'} ${serviceName}...` });
  
      await apiClient.post(`/${action}/${serviceName}`);
      setStatus({
        type: 'success',
        message: `${serviceName} ${action} triggered.`,
      });
      setTimeout(fetchStatuses, 2000);
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message;
      setStatus({ type: 'error', message: `Failed: ${errorMsg}` });
    } finally {
      setRestarting((prev) => ({ ...prev, [serviceName]: false }));
      setConfirmRestart(null);
    }
  };
  
  const handleRestartAll = async (action = 'restart') => {
    try {
      const restartObj = {};
      services.forEach(s => restartObj[s] = true);
      setRestarting(restartObj);
      setStatus({ type: 'info', message: `Triggering bulk ${action}...` });
  
      await apiClient.post(`/${action}-all`);
      setStatus({
        type: 'success',
        message: `Bulk ${action} triggered for all services.`,
      });
      setTimeout(fetchStatuses, 2000);
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message;
      setStatus({ type: 'error', message: `Bulk ${action} failed: ${errorMsg}` });
    } finally {
      setRestarting({});
      setConfirmRestart(null);
    }
  };

  const handleRestartMaster = async () => {
    try {
      setStatus({ type: 'info', message: 'Triggering Master Backend restart...' });
      await apiClient.post('/restart-master');
      setStatus({ type: 'success', message: 'Master Backend restart triggered.' });
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message;
      setStatus({ type: 'error', message: `Master Restart Failed: ${errorMsg}` });
    }
  };

  const getStatusColor = (serviceName) => {
    const s = statuses[serviceName]?.status;
    if (s === 'running') return 'bg-emerald-500';
    if (s === 'restarting') return 'bg-amber-500';
    if (s === 'down') return 'bg-rose-500';
    return 'bg-slate-500';
  };

  const getStatusGlow = (serviceName) => {
    const s = statuses[serviceName]?.status;
    if (s === 'running') return 'shadow-[0_0_10px_#10b981]';
    if (s === 'restarting') return 'shadow-[0_0_10px_#f59e0b]';
    if (s === 'down') return 'shadow-[0_0_10px_#f43f5e]';
    return '';
  };

  const formatLastRestart = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const datePart = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const timePart = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${datePart} ${timePart}`;
  };

  const isLight = theme === 'light';

  const stats = {
    total: services.length,
    healthy: Object.values(statuses).filter(s => ['running', 'restarting'].includes(s.status)).length,
    down: Object.values(statuses).filter(s => s.status === 'down').length,
    restarting: Object.values(statuses).filter(s => s.status === 'restarting').length,
  };

  return (
    <div className={`min-h-screen transition-colors duration-500 selection:bg-indigo-500/30 overflow-x-hidden font-sans ${
      isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#020205] text-slate-100'
    }`}>
      {/* Top Navigation & Header */}
      <div className="fixed top-8 left-0 right-0 z-50 flex flex-col items-center pointer-events-none">
        <div className="w-full px-6 flex justify-between items-center pointer-events-auto">
          {/* Left Controls */}
          <div className="flex gap-3">
            <button
              onClick={handleRestartMaster}
              className={`w-11 h-11 rounded-2xl transition-all active:scale-95 border flex items-center justify-center font-black text-sm ${
                isLight 
                  ? 'bg-white border-black/10 text-slate-600 shadow-sm hover:bg-slate-50' 
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
              }`}
              title="Restart Master Backend"
            >
              M
            </button>
            <button
              onClick={togglePush}
              disabled={pushLoading}
              className={`p-3 rounded-2xl transition-all active:scale-95 border ${
                isLight 
                  ? 'bg-white border-black/10 text-slate-600 shadow-sm hover:bg-slate-50' 
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
              } ${pushEnabled ? 'text-indigo-500' : ''}`}
              title={pushEnabled ? "Disable Notifications" : "Enable Notifications"}
            >
              {pushLoading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : pushEnabled ? (
                <BellOff size={20} />
              ) : (
                <Bell size={20} />
              )}
            </button>
            <button
              onClick={fetchServices}
              className={`p-3 rounded-2xl transition-all active:scale-95 border ${
                isLight 
                  ? 'bg-white border-black/10 text-slate-400 hover:bg-slate-50 shadow-sm' 
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
              }`}
              title="Refresh Services"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Right Controls */}
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmRestart({ type: 'all', action: activeTab })}
              className={`p-3 rounded-2xl transition-all active:scale-95 border ${
                isLight 
                  ? 'bg-white border-black/10 text-rose-500 shadow-sm hover:bg-slate-50' 
                  : 'bg-rose-500/5 border-rose-500/10 text-rose-400 hover:bg-rose-500/10'
              }`}
              title={activeTab === 'redeploy' ? "Redeploy All" : "Restart All"}
            >
              <Power size={20} />
            </button>
            <button
              onClick={toggleTheme}
              className={`p-3 rounded-2xl transition-all active:scale-95 border ${
                isLight 
                  ? 'bg-white border-black/10 text-slate-600 shadow-sm hover:bg-slate-50' 
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
              }`}
            >
              {theme === 'blank' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>

        {/* Header - Row 2 */}
        <header className="text-center pointer-events-auto mt-4">
          <h1 className="text-4xl font-black tracking-tight mb-2 italic">
            <span className={`bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-${isLight ? 'slate-600' : 'white'} to-fuchsia-400`}>
              CORE-INFRA
            </span>
          </h1>
          <div className="h-1 w-12 bg-indigo-500 mx-auto rounded-full mb-6 opacity-50" />
          
          <div className="flex justify-center gap-4">
            <div className={`px-4 py-2 rounded-2xl border flex items-center gap-2 ${
              isLight ? 'bg-white border-black/5 shadow-sm' : 'bg-white/5 border-white/5'
            }`}>
              <Activity size={12} className="text-indigo-400" />
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Active: {stats.total}</span>
            </div>
            <div className={`px-4 py-2 rounded-2xl border flex items-center gap-2 ${
              isLight ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400'
            }`}>
              <div className="w-1.5 h-1.5 rounded-full bg-current" />
              <span className="text-[10px] font-black uppercase tracking-widest">Healthy: {stats.healthy}</span>
            </div>
            {stats.down > 0 && (
              <div className={`px-4 py-2 rounded-2xl border flex items-center gap-2 ${
                isLight ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-rose-500/5 border-rose-500/10 text-rose-400'
              }`}>
                <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest">Down: {stats.down}</span>
              </div>
            )}
          </div>
        </header>
      </div>

      {/* Confirmation Modal */}
      {confirmRestart && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-black/40 animate-in fade-in duration-300">
          <div className={`w-full max-w-sm rounded-[2.5rem] p-8 border ${
            isLight ? 'bg-white border-black/10 shadow-2xl' : 'bg-[#0a0a0f] border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]'
          }`}>
            <div className="flex flex-col items-center text-center gap-6">
              <div className={`p-4 rounded-full ${isLight ? 'bg-rose-50 text-rose-500' : 'bg-rose-500/10 text-rose-400'}`}>
                <AlertTriangle size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tight mb-2">Are you sure?</h3>
                <p className={`text-xs font-bold leading-relaxed ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  {confirmRestart.type === 'all' 
                    ? `This will trigger a ${confirmRestart.action} for ALL active services simultaneously. This action cannot be undone.`
                    : `You are about to ${confirmRestart.action} the ${confirmRestart.name} service. This will trigger a fresh deploy.`}
                </p>
              </div>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setConfirmRestart(null)}
                  className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-600' : 'bg-white/5 hover:bg-white/10 text-slate-400'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRestart.type === 'all' ? () => handleRestartAll(confirmRestart.action) : () => handleRestart(confirmRestart.name, confirmRestart.action)}
                  className="flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-indigo-500 hover:bg-indigo-600 text-white transition-all shadow-lg shadow-indigo-500/20"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[100px] animate-pulse ${
          isLight ? 'bg-indigo-200/40' : 'bg-indigo-500/10'
        }`} />
        <div className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[100px] animate-pulse delay-1000 ${
          isLight ? 'bg-fuchsia-200/40' : 'bg-fuchsia-500/10'
        }`} />
      </div>

      <div className="relative max-w-lg mx-auto px-6 pt-56 pb-20">
        {/* Tab Switcher */}
        <div className={`flex p-0 rounded-2xl mb-8 border ${
          isLight ? 'bg-slate-100 border-black/5' : 'bg-white/5 border-white/5'
        }`}>
          <button
            onClick={() => setActiveTab('restart')}
            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'restart'
                ? isLight ? 'bg-white text-indigo-600 shadow-sm' : 'bg-white/10 text-white'
                : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            Restart
          </button>
          <button
            onClick={() => setActiveTab('redeploy')}
            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'redeploy'
                ? isLight ? 'bg-white text-indigo-600 shadow-sm' : 'bg-white/10 text-white'
                : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            Redeploy
          </button>
        </div>

        {status && (
          <div
            onClick={() => setStatus(null)}
            className={`mb-10 p-4 rounded-2xl flex items-center gap-3 border animate-in fade-in zoom-in slide-in-from-top-4 cursor-pointer backdrop-blur-3xl transition-all duration-300 ${
              status.type === 'success'
                ? isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                : status.type === 'error'
                ? isLight ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-rose-500/5 border-rose-500/20 text-rose-400'
                : isLight ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-indigo-500/5 border-indigo-500/20 text-indigo-400'
            }`}
          >
            {status.type === 'success' ? (
              <CheckCircle size={16} />
            ) : status.type === 'error' ? (
              <XCircle size={16} />
            ) : (
              <Loader2 size={16} className="animate-spin" />
            )}
            <span className="text-[11px] font-bold tracking-tight uppercase leading-tight whitespace-pre-line">{status.message}</span>
          </div>
        )}

        <div className={`p-8 rounded-[2.5rem] border ${
          isLight ? 'bg-white border-black/10 shadow-xl' : 'bg-white/5 border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.3)]'
        }`}>
          <div className="grid grid-cols-3 gap-6">
            {loading ? (
              Array(6).fill(0).map((_, i) => (
                <div key={i} className={`aspect-square rounded-[2rem] animate-pulse ${
                  isLight ? 'bg-slate-200' : 'bg-white/5 border border-white/5'
                }`} />
              ))
            ) : services.length > 0 ? (
              services.map((service) => (
                <button
                  key={service}
                  onClick={() => setConfirmRestart({ name: service, type: 'single', action: activeTab })}
                  disabled={restarting[service]}
                  className="group relative flex flex-col items-center gap-3 outline-none"
                >
                  {/* App Icon Container */}
                  <div className={`relative w-full aspect-square rounded-[2.2rem] flex items-center justify-center transition-all duration-500 ${
                    restarting[service] 
                      ? (isLight ? 'bg-slate-100 ring-4 ring-indigo-500/20' : 'bg-slate-900 ring-4 ring-indigo-500/20')
                      : (isLight 
                          ? 'bg-white ring-1 ring-black/10 hover:ring-indigo-500/40 group-active:scale-95 shadow-sm'
                          : 'bg-gradient-to-br from-white/[0.08] to-white/[0.02] hover:from-white/[0.12] hover:to-white/[0.05] ring-1 ring-white/10 group-hover:ring-indigo-500/40 group-active:scale-95 shadow-2xl')
                  } backdrop-blur-xl overflow-hidden`}>
                  
                  {/* Glass Highlight */}
                  {!isLight && <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />}
                  
                  {/* Status Indicator */}
                  {!restarting[service] && (
                    <div className={`absolute top-4 right-4 w-2 h-2 rounded-full transition-all duration-500 ${getStatusColor(service)} ${!isLight ? getStatusGlow(service) : ''}`} />
                  )}

                  {/* Letter Branding */}
                  <span className={`text-2xl font-black tracking-tighter transition-all duration-500 ${
                    restarting[service] ? 'opacity-20 scale-75' : 'group-hover:scale-110'
                  } ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>
                    {SERVICE_BRANDING[service] || service.substring(0, 2).toUpperCase()}
                  </span>

                  {/* Loading Overlay */}
                  {restarting[service] && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 size={24} className="text-indigo-500 animate-spin" />
                    </div>
                  )}

                  {/* Hover Glow */}
                  <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  {/* Last Restart Time Hover */}
                  <div className="absolute bottom-4 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                    <Clock size={10} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
                    <span className={`text-[10px] font-black tracking-tight ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                      {formatLastRestart(activeTab === 'redeploy' ? statuses[service]?.lastRedeploy : statuses[service]?.lastRestart)}
                    </span>
                  </div>
                </div>

                {/* Service Label */}
                <div className="flex flex-col items-center gap-1">
                  <span className={`text-[12px] font-black uppercase tracking-widest transition-colors ${
                    isLight ? 'text-slate-400 group-hover:text-slate-900' : 'text-slate-500 group-hover:text-white'
                  }`}>
                    {service}
                  </span>
                  {statuses[service]?.status === 'restarting' && (
                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-tighter animate-pulse">Restarting...</span>
                  )}
                </div>

                {/* Progress Bar (Visible during restart) */}
                {restarting[service] && (
                  <div className={`absolute -bottom-1 left-4 right-4 h-0.5 rounded-full overflow-hidden ${
                    isLight ? 'bg-slate-200' : 'bg-slate-800'
                  }`}>
                    <div className="h-full bg-indigo-500 animate-progress origin-left" />
                  </div>
                )}
              </button>
              ))
            ) : (
              <div className="col-span-3 text-center py-20 opacity-20">
                <XCircle size={32} className={`mx-auto mb-4 ${isLight ? 'text-slate-900' : 'text-white'}`} />
                <p className={`text-[10px] font-black uppercase tracking-widest ${isLight ? 'text-slate-900' : 'text-white'}`}>No Nodes Found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
