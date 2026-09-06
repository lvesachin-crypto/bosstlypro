import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageMeta } from "@/components/seo/PageMeta";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function CoreSettings() {
  const { profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setFullName(profile?.fullName ?? profile?.full_name ?? "");
    setCurrency(profile?.currency ?? "USD");
  }, [profile]);

  async function save() {
    setSaving(true);
    try {
      await api.updateSettings({ fullName: fullName || null, currency });
      await refreshProfile();
      toast.success("Settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout>
      <PageMeta title="Settings" description="Manage your Boostly Pro profile." noIndex />
      <div className="max-w-xl space-y-6">
        <div><h1 className="text-2xl font-bold">Settings</h1><p className="text-sm text-muted-foreground">Manage your account profile.</p></div>
        <div className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="space-y-2"><Label>Email</Label><Input value={profile?.email ?? ""} disabled /></div>
          <div className="space-y-2"><Label>Full name</Label><Input value={fullName} onChange={(event) => setFullName(event.target.value)} /></div>
          <div className="space-y-2">
            <Label>Currency</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={currency} onChange={(event) => setCurrency(event.target.value)}>
              <option value="USD">USD</option><option value="INR">INR</option><option value="EUR">EUR</option>
            </select>
          </div>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
        </div>
        <p className="text-xs text-muted-foreground">Password and sign-in security are managed by Clerk.</p>
      </div>
    </DashboardLayout>
  );
}