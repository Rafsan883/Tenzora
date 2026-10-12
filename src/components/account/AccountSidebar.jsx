import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import {
  User,
  Clock3,
  Heart,
  Bell,
  Download,
  Settings,
  BarChart3,
  ExternalLink,
  Pencil,
  Shield,
  Crown,
} from "lucide-react";

const navItems = [
  { id: "profile", label: "Profile", icon: User, path: "/profile" },
  { id: "watching", label: "Continue Watching", icon: Clock3, path: "/watching" },
  { id: "bookmarks", label: "Bookmarks", icon: Heart, path: "/watchlist" },
  { id: "notifications", label: "Notifications", icon: Bell, path: "/notifications" },
  { id: "stats", label: "Stats", icon: BarChart3, path: "/stats" },
  { id: "import", label: "Import/Export", icon: Download, path: "/import" },
  { id: "settings", label: "Settings", icon: Settings, path: "/settings" },
];

const getMemberSince = (date) => {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const getMana = (user) => {
  const value = user?.mana ?? user?.totalMana ?? 0;
  return `${Number(value).toLocaleString()} M`;
};

export default function AccountSidebar({ onAvatarEdit }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const cleanTypography = (str) => {
    if (typeof str !== "string") return "";
    return str.normalize("NFKD");
  };

  const displayName = cleanTypography(user.displayName || user.username || "User");
  const profileId = cleanTypography(user.profileId || user.username || "profile");
  const progress = Math.max(0, Math.min(100, Number(user.sideCharacterProgress ?? user.manaProgress ?? 0)));
  const roleLabel = user.role && user.role !== "user"
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : "Standard Member";

  const isActive = (item) => location.pathname === item.path;

  const renderProfileIdentity = (compact = false) => (
    <div className={`flex items-center ${compact ? "gap-3" : "flex-col"}`}>
      <div className={`relative shrink-0 ${compact ? "h-12 w-12" : "h-[104px] w-[104px]"}`}>
        <div className={`h-full w-full overflow-hidden rounded-full border-[3px] border-[#151517] bg-[#222225] ring-1 ring-white/10 ${compact ? "" : "shadow-[0_10px_30px_rgba(0,0,0,.35)]"}`}>
          {user.avatar ? (
            <img src={user.avatar} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-white/70 font-sans">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <button type="button" onClick={onAvatarEdit} className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-lg border-2 border-[#151517] bg-[#202125] text-white/65 shadow-lg transition-colors hover:bg-white/15 hover:text-white" title="Change avatar">
          <Pencil size={12} />
        </button>
        {(user.role === "admin" || user.role === "moderator") && (
          <span className="absolute -left-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#151517] bg-cyan-500 text-black">
            {user.role === "admin" ? <Crown size={12} fill="currentColor" /> : <Shield size={12} fill="currentColor" />}
          </span>
        )}
      </div>
      <div className={compact ? "min-w-0" : "mt-4 text-center"}>
        <div className="flex items-center gap-2">
          <h2 className="truncate text-[17px] font-extrabold tracking-[-0.03em] text-white font-sans">{displayName}</h2>
          <span className="text-cyan-300">✦</span>
          <span className="hidden items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400 sm:flex">
            <span className="h-1 w-1 rounded-full bg-emerald-400" /> Verified
          </span>
        </div>
        <p className="mt-1 truncate text-[12px] text-white/35 font-sans">@{cleanTypography(user.username || profileId)}</p>
      </div>
    </div>
  );

  const renderMenu = (mobile = false) => (
    <nav className={mobile ? "flex min-w-max gap-1" : "mt-7 space-y-1"} aria-label="Account navigation">
      {!mobile && <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.22em] text-white/30">Menu</p>}
      {navItems.concat(user.role === "admin" ? [{ id: "admin", label: "Admin", icon: Shield, path: "/admin" }] : []).map((item) => {
        const Icon = item.icon;
        const active = isActive(item);
        return (
          <Link
            key={item.id}
            to={item.path}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all duration-300 ${mobile ? "whitespace-nowrap" : "w-full"} ${active
              ? "bg-white text-[#111] shadow-[0_8px_20px_rgba(255,255,255,.08)]"
              : "text-white/45 hover:bg-white/[0.045] hover:text-white"
            }`}
          >
            <Icon size={17} strokeWidth={active ? 2.25 : 1.7} className="shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <aside className="hidden w-[384px] shrink-0 rounded-[20px] border border-white/[0.07] bg-[#151517] p-6 shadow-[0_20px_60px_rgba(0,0,0,.18)] lg:sticky lg:top-[148px] lg:block">
        {renderProfileIdentity()}

        <div className="mt-6 border-t border-white/[0.08] pt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[13px]">
              <span className="flex items-center gap-2 text-white/45"><span className="text-cyan-400">ϟ</span> Total Mana</span>
              <strong className="font-bold text-cyan-400">{getMana(user)}</strong>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="flex items-center gap-2 text-white/45"><span className="text-white/45">▣</span> Member Since</span>
              <strong className="font-bold text-white/75">{getMemberSince(user.createdAt)}</strong>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="flex items-center gap-2 text-white/45"><span className="text-white/45">♢</span> Account Type</span>
              <strong className="font-bold text-white/75">{roleLabel}</strong>
            </div>
          </div>

          <div className="mt-4 border-t border-white/[0.07] pt-3">
            <div className="mb-2 flex items-center justify-between text-[11px] font-bold">
              <span className="text-cyan-400">Side Character</span>
              <span className="text-white/70">{progress.toFixed(2)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
              <div className="h-full rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,.55)] transition-all duration-700" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <Link to={`/user/${profileId}`} className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] py-3 text-[13px] font-bold text-white/70 transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-white">
            View Public Profile <ExternalLink size={14} />
          </Link>
        </div>

        {renderMenu()}
      </aside>

      <div className="mb-5 rounded-2xl border border-white/[0.08] bg-[#151517] p-4 lg:hidden">
        {renderProfileIdentity(true)}
        <div className="mt-4 overflow-x-auto scrollbar-hide">{renderMenu(true)}</div>
      </div>
    </>
  );
}
