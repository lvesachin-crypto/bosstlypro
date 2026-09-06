import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageMeta } from "@/components/seo/PageMeta";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/hooks/useCurrency";
import { Package } from "lucide-react";

export default function CoreOrders() {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders", user?.id],
    queryFn: api.getOrders,
    enabled: Boolean(user),
    refetchInterval: 10_000,
  });

  return (
    <DashboardLayout>
      <PageMeta title="Orders" description="Track your Boostly Pro orders." noIndex />
      <div className="space-y-6">
        <div>
          <div>
            <h1 className="text-2xl font-bold">Orders</h1>
            <p className="text-sm text-muted-foreground">Track orders placed through the Replit API.</p>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          {isLoading ? (
            <p className="p-10 text-center text-sm text-muted-foreground">Loading orders…</p>
          ) : orders.length ? (
            <div className="divide-y">
              {orders.map((order: any) => (
                <div key={order.id} className="grid gap-3 p-5 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-blue-50 p-2 text-blue-600"><Package className="h-4 w-4" /></div>
                    <div>
                      <p className="font-medium">Order #{order.orderNumber ?? order.id.slice(0, 8)}</p>
                      <p className="max-w-md truncate text-xs text-muted-foreground">{order.link}</p>
                    </div>
                  </div>
                  <span className="text-sm">{order.quantity.toLocaleString()} units</span>
                  <div className="text-right">
                    <p className="font-semibold">{formatPrice(Number(order.price))}</p>
                    <p className="text-xs capitalize text-muted-foreground">{order.status}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <p className="text-sm text-muted-foreground">No orders yet.</p>
              <p className="mt-2 text-xs text-muted-foreground">New orders are paused until a fulfillment provider is configured.</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}