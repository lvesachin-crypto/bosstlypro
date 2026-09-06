import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageMeta } from "@/components/seo/PageMeta";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/hooks/useCurrency";
import { api } from "@/lib/api";
import { Wallet, ShoppingCart, Activity, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function CoreDashboard() {
  const { user, profile } = useAuth();
  const { formatPrice } = useCurrency();
  const { data } = useQuery({
    queryKey: ["dashboard", user?.id],
    queryFn: api.getDashboard,
    enabled: Boolean(user),
  });
  const orders = data?.recentOrders ?? [];
  const active = orders.filter((order: any) => ["pending", "processing"].includes(order.status)).length;

  return (
    <DashboardLayout>
      <PageMeta title="Dashboard" description="Your Boostly Pro account overview." noIndex />
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back</p>
          <h1 className="text-2xl font-bold">{profile?.fullName || profile?.full_name || "Your dashboard"}</h1>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Wallet balance", value: formatPrice(Number(data?.wallet?.balance ?? 0)), icon: Wallet },
            { label: "Recent orders", value: String(orders.length), icon: ShoppingCart },
            { label: "Active orders", value: String(active), icon: Activity },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border bg-white p-5 shadow-sm">
              <item.icon className="mb-4 h-5 w-5 text-blue-600" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</p>
              <p className="mt-2 text-2xl font-bold">{item.value}</p>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b p-5">
            <h2 className="font-semibold">Recent order activity</h2>
            <Button asChild size="sm" variant="outline"><Link to="/orders">View all <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>
          <div className="divide-y">
            {orders.map((order: any) => (
              <div key={order.id} className="flex items-center justify-between gap-4 p-5 text-sm">
                <div>
                  <p className="font-medium">Order #{order.orderNumber ?? order.id.slice(0, 8)}</p>
                  <p className="max-w-md truncate text-xs text-muted-foreground">{order.link}</p>
                </div>
                <span className="capitalize text-muted-foreground">{order.status}</span>
              </div>
            ))}
            {!orders.length && <p className="p-10 text-center text-sm text-muted-foreground">No order activity yet.</p>}
          </div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
          New order placement is paused until a provider fulfillment connection is configured. Your wallet will not be charged.
        </div>
      </div>
    </DashboardLayout>
  );
}