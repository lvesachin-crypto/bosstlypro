import { Link, useLocation } from "react-router-dom";
import { Boxes, Crown, LayoutDashboard, LifeBuoy, LogOut, Rocket, Send, Settings, Shield, Sparkles, Wallet, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/logo.png";

const colors = {
  navy: "#141414",
  blue: "#2563EB",
  blue2: "#3B82F6",
  white: "#FFFFFF",
  cream: "#F3F4F6",
  ink: "#6B7280",
  line: "rgba(17,24,39,0.10)",
};

const items = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Rocket, label: "Full Engagement", path: "/engagement-order", tag: "NEW" },
  { icon: Boxes, label: "Mass Order", path: "/orders", tag: "NEW" },
  { icon: Sparkles, label: "Engagement Orders", path: "/orders" },
  { icon: Crown, label: "Subscription", path: "/wallet", tag: "PRO" },
  { icon: Wallet, label: "Wallet", path: "/wallet" },
  { icon: LifeBuoy, label: "Support", path: "/support" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const location = useLocation();
  const { profile, signOut, isAdmin } = useAuth();

  const renderItem = (item: (typeof items)[number]) => {
    const active = location.pathname === item.path;
    return (
      <Link
        key={`${item.label}-${item.path}`}
        to={item.path}
        onClick={onClose}
        className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition-all"
        style={active ? { background: "rgba(29,92,255,0.10)", color: colors.navy, boxShadow: "inset 0 0 0 1px rgba(29,92,255,0.35)" } : { color: colors.ink }}
      >
        <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2.2} style={{ color: active ? colors.blue : colors.navy, opacity: active ? 1 : 0.75 }} />
        <span className="flex-1 truncate">{item.label}</span>
        {item.tag && (
          <span className="rounded px-1.5 py-0.5 text-[9.5px] font-black tracking-wider" style={item.tag === "NEW" ? { background: "rgba(29,92,255,0.10)", color: colors.blue, border: `1px solid ${colors.blue}55` } : { background: colors.cream, color: "#B4741A", border: "1px solid #E9BE7A" }}>
            {item.tag}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white">
      <div className="flex items-center justify-between px-5 pb-4 pt-5">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-[#141414] shadow-lg">
            <img src={logo} alt="Boostly Pro logo" className="h-full w-full object-cover" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[15px] font-black tracking-tight text-[#141414]">boostly<span className="text-[#2563EB]">.</span>pro</span>
            <span className="text-[9.5px] font-bold tracking-[0.16em] text-[#2563EB]">LUXURY EDITION</span>
          </div>
        </Link>
        <button onClick={onClose} aria-label="Close sidebar" className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/[.06] text-[#141414] lg:hidden"><X className="h-4 w-4" /></button>
      </div>

      {profile && (
        <div className="mx-4 mb-4 flex items-center gap-3 rounded-2xl border border-black/10 bg-[#F3F4F6] px-3 py-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB] to-[#3B82F6] text-[13px] font-black text-white">
            {(profile.fullName || profile.full_name || profile.email || "U")[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-[#141414]">{profile.fullName || profile.full_name || "User"}</p>
            <p className="truncate text-[10.5px] text-[#6B7280]">{profile.email}</p>
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        <p className="mb-2 px-3 text-[9.5px] font-black tracking-[0.18em] text-[#2563EB]">:MENU</p>
        {items.map(renderItem)}
        {isAdmin && (
          <>
            <div className="my-4 h-px bg-black/10" />
            <p className="mb-2 px-3 text-[9.5px] font-black tracking-[0.18em] text-[#2563EB]">:ADMIN</p>
            <Link to="/dashboard" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold text-[#6B7280]"><Shield className="h-[18px] w-[18px] text-[#141414]" />Admin Panel</Link>
          </>
        )}
      </nav>

      <div className="px-3 pb-2">
        <a href="https://t.me/whopcampaign" target="_blank" rel="noopener noreferrer" className="flex w-full items-center gap-2.5 rounded-2xl bg-[#141414] px-3 py-2.5 text-[12.5px] font-bold text-white shadow-lg">
          <Send className="h-4 w-4 text-[#3B82F6]" /><span className="tracking-[0.14em]">:JOIN TELEGRAM</span>
        </a>
      </div>
      <div className="border-t border-black/10 p-3">
        <button onClick={() => signOut()} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] font-semibold text-[#6B7280] hover:bg-blue-50 hover:text-[#2563EB]"><LogOut className="h-4 w-4" />Sign out</button>
      </div>
    </div>
  );
}