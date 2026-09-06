import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, ListOrdered, Wallet, Settings, LifeBuoy, LogOut, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/logo.png";

const items = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: ListOrdered, label: "Order history", path: "/orders" },
  { icon: Wallet, label: "Wallet", path: "/wallet" },
  { icon: LifeBuoy, label: "Support", path: "/support" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b p-5">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo} alt="Boostly Pro" className="h-10 w-10 rounded-xl object-cover" />
          <div><p className="font-black">Boostly Pro</p><p className="text-[10px] font-semibold tracking-wider text-blue-600">UPDATED VERSION</p></div>
        </Link>
        <button className="lg:hidden" onClick={onClose} aria-label="Close menu"><X className="h-5 w-5" /></button>
      </div>
      {profile && <div className="mx-4 mt-4 rounded-xl bg-slate-50 p-3"><p className="truncate text-sm font-semibold">{profile.fullName || profile.full_name || "User"}</p><p className="truncate text-xs text-muted-foreground">{profile.email}</p></div>}
      <nav className="flex-1 space-y-1 p-4">
        {items.map((item) => {
          const active = location.pathname === item.path;
          return <Link key={item.path} to={item.path} onClick={onClose} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}><item.icon className="h-4 w-4" />{item.label}</Link>;
        })}
      </nav>
      <div className="border-t p-4"><button onClick={() => signOut()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"><LogOut className="h-4 w-4" />Sign out</button></div>
    </div>
  );
}