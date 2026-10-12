import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { updateMe } from "../services/authService";
import { User, Clock, Heart, Bell, Download, Settings, Key, CheckCircle, Pencil, Eye, EyeOff, BarChart2, Shield, Ban, Crown } from "lucide-react";
import AvatarModal from "../components/user/AvatarModal";
import { updateMetaTags } from "../utils/seo";
import AccountShell from "../components/account/AccountShell";

const getAccountAge = (dateString) => {
  if (!dateString) return null;
  const days = Math.floor((new Date() - new Date(dateString)) / (1000 * 60 * 60 * 24));
  if (days < 30) {
    const d = Math.max(1, days);
    return `${d} DAY${d === 1 ? '' : 'S'} OLD`;
  }
  if (days < 365) {
    const m = Math.floor(days / 30);
    return `${m} MONTH${m === 1 ? '' : 'S'} OLD`;
  }
  const y = Math.floor(days / 365);
  return `${y} YEAR${y === 1 ? '' : 'S'} OLD`;
};

export default function Profile() {
  const { t } = useTranslation();
  const { user, triggerAuthToast, updateUser, globalSettings } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: user?.username || "",
    email: user?.email || "",
    displayName: user?.displayName || user?.username || "",
    currentPassword: "",
    password: "",
    confirmPassword: ""
  });
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [error, setError] = useState(null);
  const [emailVerificationUrl, setEmailVerificationUrl] = useState('');

  useEffect(() => {
    updateMetaTags({
      title: t('profile.settingsTitle'),
      description: t('profile.settingsDesc'),
      url: "/profile",
      image: user?.avatar || "https://tenzora.top/default-meta.jpg"
    });
  }, [t, user]);

  useEffect(() => {
    if (!user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    
    try {
      if (showPasswordFields) {
        if (formData.password !== formData.confirmPassword) {
          throw new Error("New passwords do not match!");
        }
        if (formData.password.length > 0 && formData.password.length < 6) {
          throw new Error("New password must be at least 6 characters long.");
        }
      }

      const updateData = {
        email: formData.email,
        displayName: formData.displayName,
        ...(formData.currentPassword ? { currentPassword: formData.currentPassword } : {}),
      };

      if (showPasswordFields && formData.password) {
        updateData.currentPassword = formData.currentPassword;
        updateData.password = formData.password;
      }

      const response = await updateMe(updateData);
      
      if (response && response.user) {
        if (response.token) localStorage.setItem('token', response.token);
        updateUser(response.user);
        setEmailVerificationUrl(response.emailVerificationUrl || '');
        triggerAuthToast(t('profile.updateSuccess'), "success");
        setShowPasswordFields(false);
        setFormData({ ...formData, currentPassword: "", password: "", confirmPassword: "" });
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || t('profile.updateFailed'));
      triggerAuthToast(err.response?.data?.message || err.message || t('profile.updateFailed'), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarSave = (newAvatarUrl) => {
    updateUser({ ...user, avatar: newAvatarUrl });
    setShowAvatarModal(false);
    triggerAuthToast(t('profile.avatarUpdated'), "success");
  };

  if (!user) return null;

  return (
    <>
      <AccountShell sidebarProps={{ onAvatarEdit: () => setShowAvatarModal(true) }}>
          {/* BAN BANNER */}
          {user?.banUntil && new Date(user.banUntil) > new Date() && (
            <div className="mb-6 flex w-full items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-400">
              <div className="mt-0.5"><Ban size={18} /></div>
              <div>
                <h4 className="font-bold text-sm">Account Restricted</h4>
                <p className="text-xs text-red-400/80 mt-1">
                  You are currently banned from commenting until {new Date(user.banUntil).toLocaleString()} 
                  {user.bannedByRole ? ` by ${user.bannedByRole}.` : '.'}
                </p>
              </div>
            </div>
          )}

          <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-700">
            <div className="relative overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#151517] px-7 py-7 shadow-[0_20px_60px_rgba(0,0,0,.16)] md:px-8">
              <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_78%_50%,rgba(255,255,255,.25)_0_1px,transparent_1px),linear-gradient(165deg,transparent_44%,rgba(255,255,255,.22)_45%,transparent_46%,transparent_51%,rgba(255,255,255,.16)_52%,transparent_53%)] [background-size:9px_9px,100%_100%]" />
              <div className="relative">
                <p className="mb-3 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50"><span className="h-2 w-2 rounded-full bg-white/70" /> Account Overview</p>
                <h1 className="text-2xl font-extrabold tracking-[-0.04em] text-white md:text-[27px]">PROFILE SETTINGS</h1>
                <p className="mt-1 text-[13px] text-white/45">Manage your personal information, security credentials, and account preferences.</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#151517] px-5 py-3 text-[13px] text-cyan-200/80 shadow-[0_12px_35px_rgba(0,0,0,.12)]">
              <span className="text-lg text-cyan-400">◉</span>
              <span className="flex-1">Animated avatar frames are now available. Click to customize your look.</span>
              <button type="button" onClick={() => setShowAvatarModal(true)} className="rounded-lg bg-white/[0.08] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-white/[0.15]">Customize</button>
              <span className="text-white/30">×</span>
            </div>

            <div className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#151517] shadow-[0_20px_60px_rgba(0,0,0,.16)]">
              <div className="space-y-8 p-5 md:p-7">
                
                {/* Avatar Section - Centered */}
                <div className="hidden flex-col items-center gap-4 border-b border-white/15 pb-8 md:pb-10">
                  <div className="relative group">
                    <div className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden border border-white/10 bg-[#181818] flex items-center justify-center shadow-lg transition-transform group-hover:scale-105 duration-300">
                      {user.avatar ? (
                        <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-3xl font-medium text-white/80">
                          {user.username?.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    {/* Pencil Edit Icon */}
                    <button 
                      onClick={() => setShowAvatarModal(true)}
                      style={{ backgroundColor: globalSettings?.themeColor || '#5865F2' }}
                      className="absolute -bottom-1 -right-1 p-2 rounded-full border-2 border-[#111] text-white hover:scale-110 transition-all shadow-xl"
                      title={t('profile.changeAvatar')}
                    >
                      <Pencil size={12} strokeWidth={3} />
                    </button>
                    {/* Crown for Admin/Mod */}
                    {(user.role === 'admin' || user.role === 'moderator') && (
                      <div className={`absolute -top-1 -left-1 p-1 rounded-full shadow-lg ${
                        user.role === 'admin' ? 'bg-purple-600' : 'bg-blue-500'
                      } border-2 border-[#111] text-white`}>
                        {user.role === 'admin' ? (
                          <Crown size={14} fill="currentColor" />
                        ) : (
                          <Shield size={14} fill="currentColor" />
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-center">
                    <h2 className="text-lg md:text-xl font-medium tracking-tight text-white">
                      {user.profileId || user.username}
                    </h2>
                    <span className="text-[10px] text-white/40 uppercase tracking-[0.2em]">{t('profile.verifiedUser')}</span>
                    {user.createdAt && (
                      <span className="text-[9px] text-white/30 uppercase tracking-widest mt-1">
                        {getAccountAge(user.createdAt)} &bull; SINCE {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Form Section */}
                <form onSubmit={handleSave} className="flex-1 flex flex-col gap-6 w-full">
                  <div className="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2">
                    {/* Profile ID (Disabled) */}
                    <div className="order-1 flex flex-col gap-2 group">
                      <label className="ml-1 text-[11px] font-bold uppercase tracking-widest text-white/50">PUBLIC PROFILE ID</label>
                      <input
                        type="text"
                        value={user?.profileId || user?.username || ""}
                        disabled
                        className="w-full cursor-not-allowed rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-[13px] text-white/65 outline-none"
                      />
                      <p className="ml-1 mt-0.5 text-[10px] text-white/30">This is your unique Profile ID used in your public URL.</p>
                    </div>

                    {/* Email */}
                    <div className="order-3 flex flex-col gap-2 group">
                      <label className="text-[11px] font-bold text-white/40 uppercase tracking-widest ml-1">{t('profile.emailAddress')}</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => { setFormData({ ...formData, email: e.target.value }); if (error) setError(null); }}
                        className="w-full rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-[13px] text-white outline-none transition-all focus:border-white/30 focus:bg-white/[0.04]"
                      />
                    </div>

                    {/* Display Name */}
                    {formData.email !== user.email && !showPasswordFields && <input type="password" autoComplete="current-password" placeholder="Current password to change email" value={formData.currentPassword} onChange={e => setFormData({ ...formData, currentPassword: e.target.value })} className="order-4 w-full rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-[13px] text-white md:col-start-2" />}
                    <div className="order-2 flex flex-col gap-2 group">
                      <label className="ml-1 text-[11px] font-bold uppercase tracking-widest text-white/50">{t('profile.displayName')}</label>
                      <input
                        type="text"
                        value={formData.displayName}
                        onChange={(e) => { setFormData({ ...formData, displayName: e.target.value }); if (error) setError(null); }}
                        className="w-full rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-[13px] text-white outline-none transition-all focus:border-white/30 focus:bg-white/[0.04]"
                      />
                    </div>
                  </div>

                  {/* Password Section */}
                  <div className="mt-2 border-t border-white/[0.08] pt-5">
                    <button
                      type="button"
                      onClick={() => setShowPasswordFields(!showPasswordFields)}
                      style={{ color: showPasswordFields ? (globalSettings?.themeColor || '#5865F2') : '' }}
                      className={`ml-1 mt-0 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-bold uppercase tracking-widest transition-colors ${showPasswordFields ? 'text-cyan-300' : 'text-white/55 hover:bg-white/[0.08] hover:text-white'}`}
                    >
                      <Key size={14} />
                      <span>{showPasswordFields ? t('profile.discardPassword') : t('profile.changePassword')}</span>
                    </button>

                    {showPasswordFields && (
                      <div className="mt-6 flex flex-col gap-5 animate-in fade-in slide-in-from-top-1 duration-300">
                        {/* Current Password */}
                        <div className="relative group">
                          <input
                            type={showPasswords ? "text" : "password"}
                            placeholder={t('profile.currentPasswordPlaceholder')}
                            value={formData.currentPassword}
                            onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                             className={`w-full rounded-xl border bg-[#0a0a0a] px-4 py-3 text-[13px] text-white outline-none transition-all ${error && error.toLowerCase().includes("current password") ? "border-red-500 animate-shake" : "border-white/10 focus:border-white/30"}`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords(!showPasswords)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                          >
                            {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        <div className="flex justify-start px-1 -mt-3">
                          <Link 
                            to="/forgot-password"
                            style={{ color: globalSettings?.themeColor || '#5865F2' }}
                            className="hover:opacity-80 text-[10px] font-bold uppercase transition-opacity"
                          >
                            {t('profile.forgotPassword')}
                          </Link>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* New Password */}
                          <div className="relative group">
                            <input
                              type={showPasswords ? "text" : "password"}
                              placeholder={t('profile.newPasswordPlaceholder')}
                              value={formData.password}
                              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                               className="w-full rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-[13px] text-white outline-none focus:border-white/30"
                            />
                          </div>

                          {/* Confirm Password */}
                          <div className="relative group">
                            <input
                              type={showPasswords ? "text" : "password"}
                              placeholder={t('profile.confirmPasswordPlaceholder')}
                              value={formData.confirmPassword}
                              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                               className={`w-full rounded-xl border bg-[#0a0a0a] px-4 py-3 text-[13px] text-white outline-none transition-all ${error && error.toLowerCase().includes("match") ? "border-red-500 animate-shake" : "border-white/10 focus:border-white/30"}`}
                            />
                          </div>
                        </div>

                        {/* Password Strength Indicator */}
                        {formData.password && (
                          <div className="px-1 flex flex-col gap-1.5 mt-2">
                            <div className="flex justify-between items-center text-[10px] uppercase tracking-wider font-bold">
                              <span className="text-white/40">{t('profile.strength')}</span>
                              <span className={
                                formData.password.length < 6 ? "text-red-500" :
                                formData.password.length < 10 ? "text-yellow-500" : "text-emerald-500"
                              }>
                                {formData.password.length < 6 ? t('profile.weak') :
                                 formData.password.length < 10 ? t('profile.medium') : t('profile.strong')}
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-500 ${
                                  formData.password.length < 6 ? "bg-red-500 w-1/3" :
                                  formData.password.length < 10 ? "bg-yellow-500 w-2/3" : "bg-emerald-500 w-full"
                                }`}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Save Button */}
                  {user.pendingEmail && <p className="text-sm text-yellow-300">Confirm the verification link sent to {user.pendingEmail} to finish changing your email.</p>}
                  {emailVerificationUrl && <Link to={new URL(emailVerificationUrl).pathname} className="text-sm text-discord-400 underline">Verify new email (local preview)</Link>}
                   <div className="mt-2 flex items-center justify-between gap-4 border-t border-white/[0.08] pt-5">
                   <p className="text-[11px] text-white/40">◈ Personal information is private and securely encrypted</p>
                   <button
                    type="submit"
                    disabled={isSaving}
                    style={{ backgroundColor: globalSettings?.themeColor || '#5865F2' }}
                     className="mt-0 shrink-0 rounded-xl bg-white px-7 py-3.5 text-xs font-bold uppercase tracking-widest text-[#111] shadow-lg transition-all hover:bg-white/90 active:scale-[0.98] disabled:opacity-50"
                  >
                    {isSaving ? t('profile.saving') : t('profile.saveChanges')}
                   </button>
                   </div>
                </form>
              </div>
            </div>
          </div>
      <AvatarModal 
        isOpen={showAvatarModal}
        onClose={() => setShowAvatarModal(false)}
        onSave={handleAvatarSave}
        currentAvatar={user?.avatar}
      />
      </AccountShell>
    </>
  );
}
