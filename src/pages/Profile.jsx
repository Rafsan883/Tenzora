import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { updateMe } from "../services/authService";
import {
  User,
  Key,
  Eye,
  EyeOff,
  Shield,
  Ban,
  Copy,
  Globe,
  Mail,
  Check,
  LogOut,
} from "lucide-react";
import AvatarModal from "../components/user/AvatarModal";
import { updateMetaTags } from "../utils/seo";
import AccountShell from "../components/account/AccountShell";

const cleanTypography = (str) => {
  if (typeof str !== "string") return "";
  return str.normalize("NFKD");
};

export default function Profile() {
  const { t } = useTranslation();
  const { user, triggerAuthToast, updateUser, logoutAuth } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: cleanTypography(user?.username || ""),
    email: user?.email || "",
    displayName: cleanTypography(user?.displayName || user?.username || ""),
    currentPassword: "",
    password: "",
    confirmPassword: ""
  });
  const [showPasswordFields, setShowPasswordFields] = useState(true);
  const [showPasswords, setShowPasswords] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);
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

  const handleCopyUid = () => {
    const uid = user?.profileId || user?._id?.slice(-8) || user?.username || "";
    if (uid) {
      navigator.clipboard.writeText(uid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
      triggerAuthToast("Profile ID copied to clipboard", "success");
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    
    try {
      if (showPasswordFields && formData.password) {
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
          {/* Header Block with Anixo Animated Wave & Grid */}
          <div className="relative overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#151517] px-7 py-7 shadow-[0_20px_60px_rgba(0,0,0,.16)] md:px-8">
            {/* Embedded CSS for seamless loop animations */}
            <style>{`
              @keyframes profileWave1 {
                0% { transform: translateX(0); }
                100% { transform: translateX(-500px); }
              }
              @keyframes profileWave2 {
                0% { transform: translateX(0); }
                100% { transform: translateX(-500px); }
              }
              @keyframes profileNodeFloat {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-5px); }
              }
              .animate-profile-wave-1 {
                animation: profileWave1 20s linear infinite;
                will-change: transform;
              }
              .animate-profile-wave-2 {
                animation: profileWave2 28s linear infinite;
                will-change: transform;
              }
              .animate-profile-node-float {
                animation: profileNodeFloat 5s ease-in-out infinite;
                will-change: transform;
              }
            `}</style>

            {/* Background Animation Container - Positioned strictly behind text */}
            <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
              {/* Tech Grid Pattern */}
              <svg className="absolute inset-0 h-full w-full opacity-40" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="profileHeaderGrid" width="28" height="28" patternUnits="userSpaceOnUse">
                    <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                    <circle cx="28" cy="0" r="0.75" fill="rgba(255,255,255,0.25)" />
                  </pattern>
                  <linearGradient id="profileGridMaskGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#000" stopOpacity="0.15" />
                    <stop offset="35%" stopColor="#fff" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#fff" stopOpacity="0.85" />
                  </linearGradient>
                  <mask id="profileGridMask">
                    <rect width="100%" height="100%" fill="url(#profileGridMaskGrad)" />
                  </mask>
                </defs>
                <rect width="100%" height="100%" fill="url(#profileHeaderGrid)" mask="url(#profileGridMask)" />
              </svg>

              {/* Dynamic Wave Ribbon with gradient mask to fade smoothly behind text on left */}
              <div className="absolute inset-0 h-full w-full [mask-image:linear-gradient(to_right,transparent_0%,rgba(0,0,0,0.1)_20%,rgba(0,0,0,0.75)_50%,rgba(0,0,0,1)_80%)]">
                <svg
                  className="absolute right-0 top-0 h-full w-[85%] md:w-[70%] overflow-visible"
                  viewBox="0 0 1000 200"
                  preserveAspectRatio="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <linearGradient id="profileWaveGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.04" />
                      <stop offset="45%" stopColor="#ffffff" stopOpacity="0.3" />
                      <stop offset="80%" stopColor="#ffffff" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity="0.15" />
                    </linearGradient>
                    <linearGradient id="profileWaveGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.02" />
                      <stop offset="40%" stopColor="#ffffff" stopOpacity="0.2" />
                      <stop offset="75%" stopColor="#ffffff" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity="0.1" />
                    </linearGradient>
                  </defs>

                  {/* Primary Wave Harmonics */}
                  <g className="animate-profile-wave-1">
                    <path
                      d="M -500 100 C -350 35, -150 165, 0 100 C 150 35, 350 165, 500 100 C 650 35, 850 165, 1000 100 C 1150 35, 1350 165, 1500 100"
                      fill="none"
                      stroke="url(#profileWaveGrad1)"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M -500 92 C -350 27, -150 157, 0 92 C 150 27, 350 157, 500 92 C 650 27, 850 157, 1000 92 C 1150 27, 1350 157, 1500 92"
                      fill="none"
                      stroke="url(#profileWaveGrad2)"
                      strokeWidth="1"
                      strokeOpacity="0.6"
                    />
                    <path
                      d="M -500 108 C -350 43, -150 173, 0 108 C 150 43, 350 173, 500 108 C 650 43, 850 173, 1000 108 C 1150 43, 1350 173, 1500 108"
                      fill="none"
                      stroke="url(#profileWaveGrad2)"
                      strokeWidth="1"
                      strokeOpacity="0.45"
                    />
                  </g>

                  {/* Secondary Harmonic Wave */}
                  <g className="animate-profile-wave-2">
                    <path
                      d="M -500 100 C -380 160, -120 40, 0 100 C 120 160, 380 40, 500 100 C 620 160, 880 40, 1000 100 C 1120 160, 1380 40, 1500 100"
                      fill="none"
                      stroke="url(#profileWaveGrad2)"
                      strokeWidth="1.2"
                    />
                    <path
                      d="M -500 105 C -380 165, -120 45, 0 105 C 120 165, 380 45, 500 105 C 620 165, 880 45, 1000 105 C 1120 165, 1380 45, 1500 105"
                      fill="none"
                      stroke="url(#profileWaveGrad2)"
                      strokeWidth="1"
                      strokeDasharray="4 6"
                      strokeOpacity="0.5"
                    />
                    <path
                      d="M -500 95 C -380 155, -120 35, 0 95 C 120 155, 380 35, 500 95 C 620 155, 880 35, 1000 95 C 1120 155, 1380 35, 1500 95"
                      fill="none"
                      stroke="url(#profileWaveGrad2)"
                      strokeWidth="0.8"
                      strokeOpacity="0.3"
                    />
                  </g>

                  {/* Pulsing Nodes / Particles on Wave Ribbon */}
                  <g className="animate-profile-node-float">
                    {/* Node 1 - Central prominent node */}
                    <g transform="translate(730, 85)">
                      <circle r="12" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" className="animate-ping duration-1000" style={{ transformOrigin: "center" }} />
                      <circle r="6" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
                      <circle r="2.5" fill="#ffffff" />
                    </g>

                    {/* Node 2 - Secondary node */}
                    <g transform="translate(850, 115)">
                      <circle r="8" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                      <circle r="2" fill="#ffffff" />
                    </g>

                    {/* Node 3 - Right edge node */}
                    <g transform="translate(940, 95)">
                      <circle r="6" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
                      <circle r="1.5" fill="#ffffff" />
                    </g>
                  </g>
                </svg>
              </div>

              {/* Ambient radial blur glow */}
              <div className="pointer-events-none absolute right-[15%] top-1/2 -translate-y-1/2 h-36 w-64 rounded-full bg-white/[0.03] blur-3xl" />
            </div>

            {/* Foreground Content - Pure z-10 for 100% Readability */}
            <div className="relative z-10">
              <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-white/40 font-sans">
                <span className="h-1.5 w-1.5 rounded-full bg-white/60" /> ACCOUNT OVERVIEW
              </p>
              <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-white md:text-[27px] font-sans">
                PROFILE SETTINGS
              </h1>
              <p className="mt-1 text-[13px] text-white/40 font-sans">
                Manage your personal information, security credentials, and account preferences.
              </p>
            </div>
          </div>

          {/* Announcement Banner */}
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#151517] px-5 py-3 text-[13px] text-cyan-200/80 shadow-[0_12px_35px_rgba(0,0,0,.12)]">
            <span className="text-lg text-cyan-400">◉</span>
            <span className="flex-1 font-sans">Animated avatar frames are now available. Click to customize your look.</span>
            <button
              type="button"
              onClick={() => setShowAvatarModal(true)}
              className="rounded-lg bg-white/[0.08] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-white/[0.15] font-sans"
            >
              Customize
            </button>
            <span className="text-white/30">×</span>
          </div>

          {/* Main Card */}
          <div className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#151517] shadow-[0_20px_60px_rgba(0,0,0,.16)]">
            <div className="space-y-6 p-5 md:p-7">
              {/* Form Section */}
              <form onSubmit={handleSave} className="flex-1 flex flex-col gap-6 w-full">
                <div className="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2">
                  {/* Public Profile ID */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-white/50 font-sans">
                        <Globe size={13} className="text-white/60" /> PUBLIC PROFILE ID
                      </label>
                      <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-bold text-white/40 font-sans">UID</span>
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={user?.profileId || user?._id?.slice(-8) || user?.username || ""}
                        disabled
                        className="w-full rounded-md border border-white/10 bg-[#111111] px-4 py-2.5 pr-24 text-[13px] text-white/70 outline-none font-sans"
                      />
                      <button
                        type="button"
                        onClick={handleCopyUid}
                        className="absolute right-2 flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/15 hover:text-white transition-colors cursor-pointer font-sans"
                      >
                        <Copy size={13} />
                        <span>{copiedUid ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Display Name */}
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-white/50 font-sans">
                      <User size={13} className="text-white/60" /> DISPLAY NAME
                    </label>
                    <input
                      type="text"
                      placeholder="Your display name"
                      value={formData.displayName}
                      onChange={(e) => {
                        setFormData({ ...formData, displayName: cleanTypography(e.target.value) });
                        if (error) setError(null);
                      }}
                      className="w-full rounded-md border border-white/10 bg-[#111111] px-4 py-2.5 text-[13px] text-white placeholder:text-white/30 outline-none transition-all focus:border-white/20 font-sans"
                    />
                  </div>

                  {/* Email Address */}
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-white/50 font-sans">
                      <Mail size={13} className="text-white/60" /> EMAIL ADDRESS
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => { setFormData({ ...formData, email: e.target.value }); if (error) setError(null); }}
                      className="w-full rounded-md border border-white/10 bg-[#111111] px-4 py-2.5 text-[13px] text-white placeholder:text-white/30 outline-none transition-all focus:border-white/20 font-sans"
                    />
                  </div>

                  {/* Password & Security Toggle */}
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-white/50 font-sans">
                      <Key size={13} className="text-white/60" /> PASSWORD & SECURITY
                    </label>
                    <div className="flex items-center justify-between rounded-md border border-white/10 bg-[#111111] px-4 py-2 text-[13px] text-white font-sans">
                      <span className="text-white/70">{showPasswordFields ? "Close password form" : "Change password"}</span>
                      <button
                        type="button"
                        onClick={() => setShowPasswordFields(!showPasswordFields)}
                        className="rounded-md bg-white px-3.5 py-1 text-xs font-semibold text-black hover:bg-gray-200 transition-colors cursor-pointer font-sans"
                      >
                        {showPasswordFields ? "Cancel" : "Change"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Password Section */}
                {showPasswordFields && (
                  <div className="rounded-xl border border-white/10 bg-[#111111]/40 p-5 md:p-6 animate-in fade-in duration-300">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-white font-sans">UPDATE ACCOUNT PASSWORD</h3>
                      <Link 
                        to="/forgot-password"
                        className="text-xs text-white/50 hover:text-white transition-colors font-sans"
                      >
                        Forgot current password?
                      </Link>
                    </div>

                    <div className="space-y-4">
                      {/* Current Password */}
                      <div className="relative">
                        <input
                          type={showPasswords ? "text" : "password"}
                          placeholder="Current password"
                          value={formData.currentPassword}
                          onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                          className={`w-full rounded-md border bg-[#111111] px-4 py-2.5 text-[13px] text-white placeholder:text-white/30 outline-none transition-all font-sans ${error && error.toLowerCase().includes("current password") ? "border-red-500 animate-shake" : "border-white/10 focus:border-white/20"}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords(!showPasswords)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer"
                        >
                          {showPasswords ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>

                      {/* New Password & Confirm Password */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="relative">
                          <input
                            type={showPasswords ? "text" : "password"}
                            placeholder="New password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="w-full rounded-md border border-white/10 bg-[#111111] px-4 py-2.5 text-[13px] text-white placeholder:text-white/30 outline-none transition-all focus:border-white/20 font-sans"
                          />
                        </div>

                        <div className="relative">
                          <input
                            type={showPasswords ? "text" : "password"}
                            placeholder="Confirm password"
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                            className={`w-full rounded-md border bg-[#111111] px-4 py-2.5 text-[13px] text-white placeholder:text-white/30 outline-none transition-all font-sans ${error && error.toLowerCase().includes("match") ? "border-red-500 animate-shake" : "border-white/10 focus:border-white/20"}`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Save Button Bar */}
                {user.pendingEmail && <p className="text-sm text-yellow-300 font-sans">Confirm the verification link sent to {user.pendingEmail} to finish changing your email.</p>}
                {emailVerificationUrl && <Link to={new URL(emailVerificationUrl).pathname} className="text-sm text-discord-400 underline font-sans">Verify new email (local preview)</Link>}

                <div className="flex items-center justify-between gap-4 pt-2">
                  <p className="flex items-center gap-2 text-[11px] text-white/40 font-sans">
                    <Shield size={14} className="text-white/40" />
                    Personal information is private and securely encrypted
                  </p>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-2 rounded-lg bg-white px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-black shadow-md hover:bg-gray-200 transition-colors disabled:opacity-50 font-sans cursor-pointer"
                  >
                    <Check size={15} strokeWidth={2.5} />
                    <span>{isSaving ? "SAVING..." : "SAVE CHANGES"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Active Session Card */}
          <div className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-[#151517] p-5 md:p-6 shadow-[0_12px_35px_rgba(0,0,0,.12)]">
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-400">
                <LogOut size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white font-sans">Active Session</h3>
                <p className="text-xs text-white/40 font-sans">Sign out from your current device session.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={logoutAuth}
              className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 transition-colors font-sans cursor-pointer"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
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
