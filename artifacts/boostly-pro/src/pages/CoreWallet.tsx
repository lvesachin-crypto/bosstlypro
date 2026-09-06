import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageMeta } from "@/components/seo/PageMeta";
import { useWallet } from "@/hooks/useWallet";
import { useTransactions, type TransactionFilter } from "@/hooks/useTransactions";
import { useCurrency } from "@/hooks/useCurrency";
import { Button } from "@/components/ui/button";
import { Wallet, History } from "lucide-react";

export default function CoreWallet() {
  const { wallet, isLoading } = useWallet();
  const { formatPrice } = useCurrency();
  const [filter, setFilter] = useState<TransactionFilter>("all");
  const { data: transactions = [] } = useTransactions(filter);

  return (
    <DashboardLayout>
      <PageMeta title="Wallet" description="View your Boostly Pro wallet and transactions." noIndex />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Wallet</h1>
          <p className="text-sm text-muted-foreground">Your balance and account activity.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <Wallet className="mb-5 h-7 w-7 text-blue-600" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Available balance</p>
            <p className="mt-2 text-4xl font-bold">{isLoading ? "—" : formatPrice(Number(wallet?.balance ?? 0))}</p>
          </div>
          <div className="rounded-2xl border bg-blue-50 p-6">
            <h2 className="font-semibold">Payment setup required</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              The previous payment gateways were not carried over without their credentials and verified webhooks.
              No payment controls are enabled or simulated.
            </p>
          </div>
        </div>
        <div className="rounded-2xl border bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
            <div className="flex items-center gap-2 font-semibold"><History className="h-4 w-4" /> Transactions</div>
            <div className="flex gap-2">
              {(["all", "deposit", "order", "refund"] as TransactionFilter[]).map((value) => (
                <Button key={value} size="sm" variant={filter === value ? "default" : "outline"} onClick={() => setFilter(value)}>
                  {value[0].toUpperCase() + value.slice(1)}
                </Button>
              ))}
            </div>
          </div>
          <div className="divide-y">
            {transactions.map((transaction: any) => (
              <div key={transaction.id} className="flex items-center justify-between p-5 text-sm">
                <div>
                  <p className="font-medium">{transaction.description || transaction.type}</p>
                  <p className="text-xs text-muted-foreground">{new Date(transaction.createdAt).toLocaleString()}</p>
                </div>
                <span className="font-semibold">{formatPrice(Number(transaction.amount))}</span>
              </div>
            ))}
            {!transactions.length && <p className="p-10 text-center text-sm text-muted-foreground">No transactions yet.</p>}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}