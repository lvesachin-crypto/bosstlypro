import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Brain, Link as LinkIcon, Percent, Rocket } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DeliveryPreview } from "@/components/engagement/DeliveryPreview";
import { EngagementTypeCard } from "@/components/engagement/EngagementTypeCard";
import { LiveGrowthChart } from "@/components/engagement/LiveGrowthChart";
import { PlatformSelector } from "@/components/engagement/PlatformSelector";
import { QuantitySelector } from "@/components/engagement/QuantitySelector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageMeta } from "@/components/seo/PageMeta";
import { useDebounce } from "@/hooks/useDebounce";
import { api } from "@/lib/api";
import {
  DEFAULT_ORGANIC_SETTINGS,
  DEFAULT_RATIOS,
  EngagementConfig,
  EngagementType,
  PLATFORM_ENGAGEMENT_TYPES,
} from "@/lib/engagement-types";
import { cn } from "@/lib/utils";

type EngagementConfigs = Partial<Record<EngagementType, EngagementConfig>>;
type Platform = "instagram" | "tiktok" | "youtube" | "twitter" | "facebook";

const platformNames: Record<Platform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitter: "Twitter/X",
  facebook: "Facebook",
};

function detectPlatform(url: string): Platform | null {
  const value = url.toLowerCase();
  if (value.includes("instagram.com") || value.includes("instagr.am")) return "instagram";
  if (value.includes("youtube.com") || value.includes("youtu.be")) return "youtube";
  if (value.includes("tiktok.com")) return "tiktok";
  if (value.includes("twitter.com") || value.includes("x.com")) return "twitter";
  if (value.includes("facebook.com") || value.includes("fb.com")) return "facebook";
  return null;
}

export default function EngagementOrder() {
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [link, setLink] = useState("");
  const [baseQuantity, setBaseQuantity] = useState(10000);
  const [isOrganicMode, setIsOrganicMode] = useState(true);
  const [isAutoRatios, setIsAutoRatios] = useState(true);
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const editedTypes = useRef(new Set<EngagementType>());
  const debouncedBaseQuantity = useDebounce(baseQuantity, 200);

  const activeTypes = PLATFORM_ENGAGEMENT_TYPES[platform];
  const [engagements, setEngagements] = useState<EngagementConfigs>({});

  useEffect(() => {
    setEngagements((previous) => {
      const next: EngagementConfigs = {};
      activeTypes.forEach((type) => {
        const quantity = Math.round(debouncedBaseQuantity * (DEFAULT_RATIOS[type] / 100));
        const existing = previous[type];
        next[type] = {
          type,
          enabled: existing?.enabled ?? (isAutoRatios || type === "views"),
          quantity: editedTypes.current.has(type) && existing ? existing.quantity : quantity,
          price: 0,
          serviceId: null,
          minQuantity: type === "views" ? 100 : 10,
          timeLimitHours: existing?.timeLimitHours ?? DEFAULT_ORGANIC_SETTINGS.timeLimitHours,
          timeLimitCustomMode: existing?.timeLimitCustomMode,
          variancePercent: existing?.variancePercent ?? DEFAULT_ORGANIC_SETTINGS.variancePercent,
          peakHoursEnabled: existing?.peakHoursEnabled ?? DEFAULT_ORGANIC_SETTINGS.peakHoursEnabled,
          runCount: existing?.runCount,
        };
      });
      return next;
    });
  }, [activeTypes, debouncedBaseQuantity, isAutoRatios]);

  const enabledEngagements = useMemo(
    () => Object.values(engagements).filter((item): item is EngagementConfig => Boolean(item?.enabled)),
    [engagements],
  );
  const totalEngagements = useMemo(
    () => enabledEngagements.reduce((total, item) => total + item.quantity, 0),
    [enabledEngagements],
  );

  const handleEngagementChange = useCallback((type: EngagementType, config: EngagementConfig) => {
    setEngagements((current) => {
      if (current[type]?.quantity !== config.quantity) editedTypes.current.add(type);
      return { ...current, [type]: { ...config, price: 0 } };
    });
    setPreviewRefreshKey((key) => key + 1);
  }, []);

  const handlePlaceOrder = async () => {
    if (!link.trim()) {
      toast.error("Please enter a valid post or video link.");
      return;
    }
    if (!enabledEngagements.length) {
      toast.error("Select at least one engagement type.");
      return;
    }
    const detected = detectPlatform(link);
    if (detected && detected !== platform) {
      toast.error(`This appears to be a ${platformNames[detected]} link. Select the matching platform.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await api.fetchApi("/orders", {
        method: "POST",
        body: JSON.stringify({
          link: link.trim(),
          platform,
          baseQuantity,
          isOrganicMode,
          engagements: enabledEngagements.map(({ type, quantity, timeLimitHours, variancePercent, peakHoursEnabled, runCount }) => ({
            type, quantity, timeLimitHours, variancePercent, peakHoursEnabled, runCount,
          })),
        }),
      });
      // The current API deliberately never resolves this request without fulfillment.
      toast.error("Order placement is not available yet. No charge was made.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Order placement is unavailable. No funds were charged.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <PageMeta title="New Engagement Order" description="Configure a natural full-engagement delivery plan for your social post." canonicalPath="/engagement-order" noIndex />
      <div className="mx-auto max-w-5xl space-y-4 pb-8 sm:space-y-6">
        <header className="relative overflow-hidden rounded-2xl p-4 text-center sm:p-5" style={{ background: "linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)", boxShadow: "0 8px 24px rgba(37,99,235,.18)" }}>
          <div className="relative z-10">
            <div className="mx-auto mb-1.5 flex h-10 w-10 items-center justify-center rounded-xl bg-white/20"><Rocket className="h-5 w-5 text-white" /></div>
            <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Organic Full Engagement</h1>
            <p className="mt-0.5 text-xs text-white/75 sm:text-sm">One link → all engagement types with organic settings</p>
          </div>
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        </header>

        <div className="grid gap-3 sm:grid-cols-2 sm:gap-5">
          <ModeCard active={isOrganicMode} icon={<Brain className="h-4 w-4" />} title="AI Organic Algorithm" description="Creates varied timing and delivery patterns." badge={isOrganicMode ? "ON" : "OFF"} onChange={(value) => { setIsOrganicMode(value); if (value) setIsAutoRatios(false); }} />
          <ModeCard active={isAutoRatios} icon={<Percent className="h-4 w-4" />} title="AI Smart Ratios" description="Calculates natural ratios from your base views." badge={isAutoRatios ? "AUTO" : "MANUAL"} onChange={(value) => { setIsAutoRatios(value); if (value) setIsOrganicMode(false); }} />
        </div>

        <Card className="border-2 border-border"><CardContent className="p-4">
          <Label className="mb-3 block text-sm font-bold">Select Platform</Label>
          <PlatformSelector selected={platform} onSelect={(value) => setPlatform(value as Platform)} availablePlatforms={Object.keys(PLATFORM_ENGAGEMENT_TYPES)} />
        </CardContent></Card>

        <Card className="border-2 border-border"><CardContent className="p-4 sm:p-6">
          <Label className="mb-3 flex items-center gap-2 text-base font-bold"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-foreground/10"><LinkIcon className="h-4 w-4" /></span>Video/Post Link</Label>
          <Input placeholder={`https://${platform}.com/...`} value={link} onChange={(event) => setLink(event.target.value)} className="h-12 rounded-xl border-2 bg-secondary text-base font-medium" />
        </CardContent></Card>

        <Card className="border-2 border-border"><CardContent className="p-4 sm:p-6"><QuantitySelector value={baseQuantity} onChange={setBaseQuantity} min={100} max={1000000} /></CardContent></Card>

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1"><div><h2 className="text-lg font-bold">Engagement Breakdown</h2><p className="text-xs text-muted-foreground">Customize delivery settings for each type.</p></div><Badge className="bg-foreground text-background">{enabledEngagements.length} active</Badge></div>
          <div className="grid gap-3">
            {activeTypes.map((type) => engagements[type] && <EngagementTypeCard key={type} type={type} config={engagements[type]} baseQuantity={baseQuantity} onChange={(config) => handleEngagementChange(type, config)} minQuantity={engagements[type]?.minQuantity} />)}
          </div>
        </section>

        {enabledEngagements.length > 0 && <LiveGrowthChart engagements={engagements as Record<EngagementType, EngagementConfig>} refreshKey={previewRefreshKey} onRefresh={() => setPreviewRefreshKey((key) => key + 1)} platform={platform} />}
        {enabledEngagements.length > 0 && <DeliveryPreview engagements={engagements as Record<EngagementType, EngagementConfig>} refreshKey={previewRefreshKey} platform={platform} />}

        <Card className="overflow-hidden border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-primary/10"><CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><div className="text-3xl font-bold text-primary">{totalEngagements.toLocaleString()} <span className="text-sm font-medium text-muted-foreground">engagements</span></div><p className="mt-1 text-xs text-muted-foreground">Preview only — fulfillment and payments are not configured.</p></div>
            <Button size="lg" onClick={handlePlaceOrder} disabled={!link.trim() || !enabledEngagements.length || isSubmitting} className="h-12 rounded-xl px-6 font-bold">
              <Rocket className="mr-2 h-4 w-4" />{isSubmitting ? "Checking availability..." : "Place Order"}
            </Button>
          </div>
        </CardContent></Card>
      </div>
    </DashboardLayout>
  );
}

function ModeCard({ active, icon, title, description, badge, onChange }: { active: boolean; icon: React.ReactNode; title: string; description: string; badge: string; onChange: (value: boolean) => void }) {
  return <Card className={cn("border-2 transition-colors", active ? "border-primary/40 bg-primary/5" : "border-border")}><CardContent className="flex items-center justify-between gap-3 p-4"><div className="flex items-center gap-3"><span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", active ? "bg-primary text-white" : "bg-secondary text-muted-foreground")}>{icon}</span><div><div className="flex items-center gap-2"><h2 className="text-sm font-bold">{title}</h2><Badge variant="outline" className="text-[9px]">{badge}</Badge></div><p className="text-[11px] text-muted-foreground">{description}</p></div></div><Switch checked={active} onCheckedChange={onChange} /></CardContent></Card>;
}