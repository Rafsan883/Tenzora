import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { updateSettings } from "../services/settingsService";
import { getAnilistAuthUrl, disconnectAnilist, getMe } from "../services/authService";
import { CheckCircle2 } from "lucide-react";
import AccountShell from "../components/account/AccountShell";

const getDefaults = (settings) => ({
  titleLanguage: settings?.titleLanguage || 'EN',
  videoLanguage: settings?.videoLanguage || 'Any',
  skipSeconds: settings?.skipSeconds || 5,
  bookmarksPerPage: settings?.bookmarksPerPage || 20,
  autoPlay: settings?.autoPlay ?? true,
  autoNext: settings?.autoNext ?? true,
  themeColor: settings?.themeColor || '#5865F2'
});

const THEME_COLORS = [
  { id: 'default', color: '#5865F2', label: 'Blurple' },
  { id: 'crimson', color: '#dc2626', label: 'Crimson' },
  { id: 'rose', color: '#e11d48', label: 'Deep Rose' },
  { id: 'magenta', color: '#c026d3', label: 'Magenta' },
  { id: 'violet', color: '#7c3aed', label: 'Violet' },
  { id: 'indigo', color: '#4f46e5', label: 'Indigo' },
  { id: 'blue', color: '#2563eb', label: 'Royal Blue' },
  { id: 'azure', color: '#0284c7', label: 'Azure' },
  { id: 'cyan', color: '#0891b2', label: 'Cyan' },
  { id: 'teal', color: '#0d9488', label: 'Teal' },
  { id: 'emerald', color: '#059669', label: 'Emerald' },
  { id: 'green', color: '#16a34a', label: 'Forest' },
  { id: 'lime', color: '#65a30d', label: 'Lime' },
  { id: 'gold', color: '#d97706', label: 'Gold' },
  { id: 'orange', color: '#ea580c', label: 'Burnt Orange' },
  { id: 'rust', color: '#b91c1c', label: 'Rust' },
];

export default function Settings() {
  const { globalSettings } = useAuth();
  return <SettingsForm key={globalSettings?.updatedAt || globalSettings?._id || 'default'} />;
}

function SettingsForm() {
  const { user, globalSettings, setGlobalSettings, updateUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [anilistNotice, setAnilistNotice] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const success = params.get('success');
    const error = params.get('error');
    if (!success && !error) return;

    if (success === 'anilist_connected') {
      setTimeout(() => setAnilistNotice({ type: 'success', message: 'AniList connected successfully.' }), 0);
      getMe()
        .then(result => {
          if (result?.success && result.user) updateUser(result.user);
        })
        .catch(() => {
          // AuthProvider refreshes the session on a full redirect; keep the
          // success state visible if this secondary refresh is unavailable.
        });
    } else {
      setTimeout(() => setAnilistNotice({ type: 'error', message: 'AniList connection could not be completed. Please try again.' }), 0);
    }

    navigate({ pathname: location.pathname, search: '' }, { replace: true });
  }, [location.pathname, location.search, navigate, updateUser]);

  // Redirect if not logged in
  useEffect(() => {
    if (!user) navigate("/");
  }, [user, navigate]);

  // Key forces form remount when globalSettings loads/changes — no setState in effect needed
  const settingsKey = globalSettings?.updatedAt || globalSettings?._id || 'default';

  const [formData, setFormData] = useState(() => getDefaults(globalSettings));

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Live Theme Preview & Revert on Unmount
  useEffect(() => {
    const applyColor = (color) => {
      if (color) {
        document.documentElement.style.setProperty('--discord-600', color);
        document.documentElement.style.setProperty('--discord-500', color);
        document.documentElement.style.setProperty('--discord-700', color);
        document.documentElement.style.setProperty('--discord-400', color);
        document.documentElement.style.setProperty('--discord-800', color);
        document.documentElement.style.setProperty('--discord-900', color);
      } else {
        document.documentElement.style.removeProperty('--discord-600');
        document.documentElement.style.removeProperty('--discord-500');
        document.documentElement.style.removeProperty('--discord-700');
        document.documentElement.style.removeProperty('--discord-400');
        document.documentElement.style.removeProperty('--discord-800');
        document.documentElement.style.removeProperty('--discord-900');
      }
    };
    
    applyColor(formData.themeColor);
    
    return () => {
      applyColor(globalSettings?.themeColor);
    };
  }, [formData.themeColor, globalSettings?.themeColor]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await updateSettings(formData);
      if (!res.success) throw new Error(res.message || 'Settings could not be saved.');
      setGlobalSettings(res.settings);
      localStorage.setItem('cached_settings', JSON.stringify(res.settings));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      window.alert(error.response?.data?.message || error.message);
    } finally { setIsSaving(false); }
  };

  const handleDisconnect = async () => {
    const res = await disconnectAnilist();
    if (res.success) {
      window.location.reload(); // Refresh to update user state
    }
    setShowConfirmModal(false);
  };

  return (
    <AccountShell>
      <div key={settingsKey} className="animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-700">
        <div className="relative overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#151517] px-7 py-7 shadow-[0_20px_60px_rgba(0,0,0,.16)] md:px-8">
          <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_78%_50%,rgba(255,255,255,.25)_0_1px,transparent_1px),linear-gradient(165deg,transparent_44%,rgba(255,255,255,.22)_45%,transparent_46%,transparent_51%,rgba(255,255,255,.16)_52%,transparent_53%)] [background-size:9px_9px,100%_100%]" />
          <div className="relative">
            <p className="mb-3 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50"><span className="h-2 w-2 rounded-full bg-white/70" /> Account Overview</p>
            <h1 className="text-2xl font-extrabold tracking-[-0.04em] text-white md:text-[27px]">PREFERENCES &amp; SETTINGS</h1>
            <p className="mt-1 text-[13px] text-white/45">Configure player options, display preferences, theme colors and connected services.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="space-y-7 rounded-[20px] border border-white/[0.08] bg-[#151517] p-5 shadow-[0_20px_60px_rgba(0,0,0,.16)] md:p-7">
              {anilistNotice && (
                <div className={`rounded-lg border px-4 py-3 text-[12px] font-medium ${anilistNotice.type === 'success'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
                  {anilistNotice.message}
                </div>
              )}

              <div className="border-b border-white/[0.08] pb-4">
                <h2 className="text-[16px] font-extrabold uppercase tracking-wide text-white">SYNC &amp; CONNECTED ACCOUNTS</h2>
                <p className="mt-1 text-[12px] text-white/40">Link third-party platforms to synchronize watch progress, tags and badges.</p>
              </div>
              
              {/* 1. Sync Section - Mobile Optimized */}
              <div className="flex flex-col items-center justify-between gap-5 border-b border-white/[0.08] pb-7 md:flex-row">
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] md:h-12 md:w-12">
                    <img 
                      src="https://anilist.co/img/icons/icon.svg" 
                      alt="AL" 
                      className={`w-6 h-6 md:w-7 md:h-7 ${user?.anilist?.username ? 'opacity-100' : 'opacity-20 grayscale'}`} 
                    />
                  </div>
                  <div className="text-left">
                    <h4 className="text-[14px] md:text-[15px] font-bold text-white leading-tight">
                      {user?.anilist?.username ? <>Connected as <span className="text-[#02A9FF]">{user.anilist.username}</span></> : 'AniList Sync'}
                    </h4>
                    <p className="text-[10px] md:text-[11px] font-medium text-white/30">
                      Mirror your progress automatically.
                    </p>
                  </div>
                </div>
                
                {user?.anilist?.username ? (
                  <button 
                    type="button"
                    onClick={() => setShowConfirmModal(true)}
                     className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-bold text-white/60 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white md:w-auto"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button 
                    type="button"
                    onClick={async () => {
                      try { window.location.assign(await getAnilistAuthUrl()); }
                      catch (error) { window.alert(error.response?.data?.message || 'AniList connection is not configured.'); }
                    }}
                     className="w-full rounded-lg bg-cyan-400 px-6 py-2.5 text-[11px] font-bold text-[#071015] transition-all hover:bg-cyan-300 active:scale-95 md:w-auto"
                  >
                    Connect
                  </button>
                )}
              </div>

              <div className="border-b border-white/[0.08] pb-4 pt-1">
                <h2 className="text-[16px] font-extrabold uppercase tracking-wide text-white">DISPLAY &amp; PLAYBACK</h2>
                <p className="mt-1 text-[12px] text-white/40">Choose how your catalog and episodes behave across devices.</p>
              </div>

              {/* 2. Title Language - Refined Mobile Layout */}
              <div className="flex flex-col justify-between gap-4 rounded-2xl border border-white/[0.07] bg-black/10 p-5 md:flex-row md:items-center">
                <div className="text-left">
                  <h3 className="text-[14px] font-bold text-white">Title Language</h3>
                  <p className="text-[11px] text-white/30">Anime name display preference.</p>
                </div>
                 <div className="flex w-full rounded-xl border border-white/10 bg-black/30 p-1 md:w-auto">
                  {['EN', 'JP'].map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setFormData({...formData, titleLanguage: lang})}
                       className={`flex-1 rounded-lg px-6 py-2 text-[11px] font-bold transition-all md:flex-none ${formData.titleLanguage === lang ? 'bg-white text-[#111] shadow-lg' : 'text-white/40 hover:text-white'}`}
                    >
                      {lang === 'EN' ? 'English' : 'Japanese'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Player Options - Simplified List */}
              <div className="space-y-6 rounded-2xl border border-white/[0.07] bg-black/10 p-5 pt-5">
                <div className="flex items-center justify-between group">
                  <span className="text-[13px] font-medium text-white/60 group-hover:text-white transition-colors">Auto-play next episode</span>
                     <div
                    onClick={() => setFormData({...formData, autoNext: !formData.autoNext})}
                       className={`relative h-5 w-10 cursor-pointer rounded-full transition-all duration-300 ${formData.autoNext ? 'bg-white' : 'bg-white/10'}`}
                  >
                     <div className={`absolute top-1 h-3 w-3 rounded-full transition-all duration-300 ${formData.autoNext ? 'left-6 bg-[#111]' : 'left-1 bg-white/60'}`} />
                  </div>
                </div>

                <div className="flex items-center justify-between group">
                  <span className="text-[13px] font-medium text-white/60 group-hover:text-white transition-colors">Auto-start video</span>
                  <div 
                    onClick={() => setFormData({...formData, autoPlay: !formData.autoPlay})}
                       className={`relative h-5 w-10 cursor-pointer rounded-full transition-all duration-300 ${formData.autoPlay ? 'bg-white' : 'bg-white/10'}`}
                  >
                     <div className={`absolute top-1 h-3 w-3 rounded-full transition-all duration-300 ${formData.autoPlay ? 'left-6 bg-[#111]' : 'left-1 bg-white/60'}`} />
                  </div>
                </div>

                 <div className="flex flex-col gap-4 border-t border-white/[0.08] pt-5">
                  <span className="text-[13px] font-medium text-white/60">Theme Color</span>
                  <div className="grid grid-cols-8 gap-3 mt-1">
                    {THEME_COLORS.map((theme) => {
                      const isActive = formData.themeColor.toUpperCase() === theme.color.toUpperCase();
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          title={theme.label}
                          onClick={() => setFormData({...formData, themeColor: theme.color})}
                           className={`relative flex h-8 w-8 items-center justify-center justify-self-center rounded-full transition-all duration-300
                            ${isActive ? 'z-10 scale-125 ring-2 ring-white ring-offset-2 ring-offset-[#151517]' : 'opacity-70 hover:scale-110 hover:opacity-100'}
                          `}
                          style={{ backgroundColor: theme.color }}
                        >
                          <div className="absolute inset-0 rounded-full bg-white/10 mix-blend-overlay"></div>
                          {isActive && <CheckCircle2 size={14} className="text-white drop-shadow-md relative z-10" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

            </div>

            {/* Submit Button */}
            <div className="rounded-[20px] border border-white/[0.08] bg-[#151517] p-5 shadow-[0_20px_60px_rgba(0,0,0,.12)]">
              <button 
                type="submit"
                disabled={isSaving}
                 className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-[14px] font-bold text-[#111] shadow-lg transition-all hover:bg-white/90 active:scale-[0.98] disabled:opacity-50"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : saveSuccess ? (
                  <>
                    <CheckCircle2 size={18} />
                    <span>Settings Saved Successfully</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>

        </form>
      </div>

      {/* Simple Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center px-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity"
            onClick={() => setShowConfirmModal(false)}
          />
          <div className="relative bg-[#111] border border-white/15 rounded-2xl p-6 max-w-[320px] w-full shadow-2xl">
            <h3 className="text-[16px] font-bold text-white mb-2">Disconnect AniList?</h3>
            <p className="text-white/40 text-[12px] mb-6 leading-relaxed">
              Your watch progress will no longer be synced to your AniList profile.
            </p>
            <div className="flex gap-3">
              <button 
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 rounded-lg bg-white/5 text-white/50 text-[11px] font-bold hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleDisconnect}
                className="flex-1 py-2.5 rounded-lg bg-discord-600/90 text-white text-[11px] font-bold hover:bg-discord-600 transition-all"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </AccountShell>
  );
}
