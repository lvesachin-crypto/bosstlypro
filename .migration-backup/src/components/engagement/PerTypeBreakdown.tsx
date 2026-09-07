import { useState } from "react";
import { Eye, Heart, MessageCircle, Bookmark, Share2, BarChart3, Pause, Play, X, Activity, Repeat2, Repeat, UserPlus, Bell, Clock as ClockIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ENGAGEMENT_CONFIG: Record<string, { icon: typeof Eye; label: string; themeClass: string; gradientClass: string; glowClass: string; shadowClass: string }> = {
  views: { 
    icon: Eye, label: "Views", 
    themeClass: "text-cyan-500", 
    gradientClass: "from-cyan-500/20 to-cyan-600/5",
    glowClass: "shadow-[0_0_15px_rgba(6,182,212,0.3)]",
    shadowClass: "shadow-cyan-500/10"
  },
  likes: { 
    icon: Heart, label: "Likes", 
    themeClass: "text-emerald-500", 
    gradientClass: "from-emerald-500/20 to-emerald-600/5",
    glowClass: "shadow-[0_0_15px_rgba(16,185,129,0.3)]",
    shadowClass: "shadow-emerald-500/10"
  },
  comments: { 
    icon: MessageCircle, label: "Comments", 
    themeClass: "text-emerald-500", 
    gradientClass: "from-emerald-500/20 to-emerald-600/5",
    glowClass: "shadow-[0_0_15px_rgba(16,185,129,0.3)]",
    shadowClass: "shadow-emerald-500/10"
  },
  saves: { 
    icon: Bookmark, label: "Saves", 
    themeClass: "text-amber-500", 
    gradientClass: "from-amber-500/20 to-amber-600/5",
    glowClass: "shadow-[0_0_15px_rgba(245,158,11,0.3)]",
    shadowClass: "shadow-amber-500/10"
  },
  shares: { 
    icon: Share2, label: "Shares", 
    themeClass: "text-violet-400", 
    gradientClass: "from-violet-500/20 to-violet-600/5",
    glowClass: "shadow-[0_0_15px_rgba(139,92,246,0.3)]",
    shadowClass: "shadow-violet-500/10"
  },
  reposts: { 
    icon: Repeat2, label: "Reposts", 
    themeClass: "text-purple-500", 
    gradientClass: "from-purple-500/20 to-purple-600/5",
    glowClass: "shadow-[0_0_15px_rgba(168,85,247,0.3)]",
    shadowClass: "shadow-purple-500/10"
  },
  retweets: {
    icon: Repeat, label: "Retweets",
    themeClass: "text-sky-500",
    gradientClass: "from-sky-500/20 to-sky-600/5",
    glowClass: "shadow-[0_0_15px_rgba(14,165,233,0.3)]",
    shadowClass: "shadow-sky-500/10"
  },
  followers: {
    icon: UserPlus, label: "Followers",
    themeClass: "text-teal-500",
    gradientClass: "from-teal-500/20 to-teal-600/5",
    glowClass: "shadow-[0_0_15px_rgba(20,184,166,0.3)]",
    shadowClass: "shadow-teal-500/10"
  },
  subscribers: {
    icon: Bell, label: "Subscribers",
    themeClass: "text-red-500",
    gradientClass: "from-red-500/20 to-red-600/5",
    glowClass: "shadow-[0_0_15px_rgba(239,68,68,0.3)]",
    shadowClass: "shadow-red-500/10"
  },
  watch_hours: {
    icon: ClockIcon, label: "Watch Hours",
    themeClass: "text-orange-500",
    gradientClass: "from-orange-500/20 to-orange-600/5",
    glowClass: "shadow-[0_0_15px_rgba(249,115,22,0.3)]",
    shadowClass: "shadow-orange-500/10"
  }
};

const getEngagementConfig = (type: string) => {
  return ENGAGEMENT_CONFIG[type] || {
    icon: Activity,
    label: type?.charAt(0).toUpperCase() + type?.slice(1) || "Items",
    themeClass: "text-slate-500",
    gradientClass: "from-slate-500/20 to-slate-600/5",
    glowClass: "shadow-[0_0_15px_rgba(100,116,139,0.3)]",
    shadowClass: "shadow-slate-500/10"
  };
};

interface RunData {
  id: string;
  engagement_type: string;
  run_number: number;
  status: string;
  quantity_to_send: number;
  scheduled_at: string;
  completed_at?: string;
  started_at?: string;
}

interface TypeData {
  type: string;
  target: number;
  delivered: number;
  scheduled?: number;
}

interface PerTypeBreakdownProps {
  types: TypeData[];
  allRuns?: RunData[];
  onTypeClick?: (type: string) => void;
  itemStatuses?: Record<string, { id: string; status: string }>;
  onPauseType?: (itemId: string) => void;
  onResumeType?: (itemId: string) => void;
  onCancelType?: (itemId: string) => void;
}

export function PerTypeBreakdown({ types, allRuns = [], onTypeClick, itemStatuses, onPauseType, onResumeType, onCancelType }: PerTypeBreakdownProps) {
  const [cancelConfirmType, setCancelConfirmType] = useState<string | null>(null);

  const knownTypes = Object.keys(ENGAGEMENT_CONFIG);
  const activeTypes = types
    .filter(t => t.target > 0)
    .sort((a, b) => {
      const aIndex = knownTypes.indexOf(a.type);
      const bIndex = knownTypes.indexOf(b.type);
      const aPos = aIndex === -1 ? 999 : aIndex;
      const bPos = bIndex === -1 ? 999 : bIndex;
      return aPos - bPos;
    });

  const typeHistories = activeTypes.map(typeData => {
    const typeRuns = allRuns
      .filter(r => r.engagement_type === typeData.type)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    
    let cumulativeScheduled = 0;
    const history = typeRuns.map(run => {
      if (run.status !== 'failed') {
        cumulativeScheduled += run.quantity_to_send;
      }
      return { ...run, cumulativeScheduled };
    });

    const completedRuns = history.filter(r => r.status === 'completed');
    const activeRuns = history.filter(r => r.status === 'started');
    const pendingRuns = history.filter(r => r.status === 'pending');
    const failedRuns = history.filter(r => r.status === 'failed');

    return {
      ...typeData,
      history,
      completedRuns,
      activeRuns,
      pendingRuns,
      failedRuns,
    };
  });

  const grandScheduled = typeHistories.reduce((sum, t) => {
    const lastRun = t.history[t.history.length - 1];
    return sum + (lastRun?.cumulativeScheduled || 0);
  }, 0);
  const grandOriginalTarget = activeTypes.reduce((sum, t) => sum + t.target, 0);
  const grandTarget = Math.max(grandOriginalTarget, grandScheduled);
  const grandDelivered = activeTypes.reduce((sum, t) => sum + t.delivered, 0);
  const grandProgress = grandTarget > 0 ? (grandDelivered / grandTarget) * 100 : 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-card to-muted/30 shadow-[0_8px_30px_rgb(0,0,0,0.08)] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/5 bg-black/5 dark:bg-white/5 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-foreground/10 ring-1 ring-foreground/20 shadow-inner">
              <BarChart3 className="h-4 w-4 text-foreground" />
            </div>
            <span className="font-bold text-foreground tracking-wide bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Live Engagement Breakdown</span>
          </div>
          <div className="flex items-center gap-3 bg-background/50 border border-white/10 px-3 py-1.5 rounded-lg shadow-inner">
            <span className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Aggregate</span>
            <span className="font-black text-base text-foreground tabular-nums drop-shadow-sm">
              {grandDelivered.toLocaleString()} / {grandTarget.toLocaleString()}
            </span>
            <Badge variant="secondary" className="font-mono font-bold text-xs bg-primary/20 text-primary border-primary/30">
              {grandProgress.toFixed(1)}%
            </Badge>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="p-5 bg-card/40 backdrop-blur-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {activeTypes.map(typeData => {
            const config = getEngagementConfig(typeData.type);
            const Icon = config.icon;
            const originalTarget = typeData.target || 0;
            const delivered = typeData.delivered || 0;
            const scheduled = typeData.scheduled || 0;
            
            const dynamicTarget = Math.max(originalTarget, scheduled);
            const progress = dynamicTarget > 0 ? (delivered / dynamicTarget) * 100 : 0;

            const itemInfo = itemStatuses?.[typeData.type];
            const itemStatus = itemInfo?.status || 'processing';
            const isPaused = itemStatus === 'paused';
            const isCancelled = itemStatus === 'cancelled';
            const isCompleted = itemStatus === 'completed';
            const isFailed = itemStatus === 'failed';
            const isTerminal = isCancelled || isCompleted || isFailed;

            return (
              <div 
                key={typeData.type} 
                className={`group relative flex flex-col p-4 rounded-xl border border-white/10 shadow-lg ${config.shadowClass} overflow-hidden transition-all duration-300 isolate ${
                  isPaused ? 'opacity-80 grayscale-[40%]' : ''
                } ${isCancelled ? 'opacity-60 grayscale-[80%]' : ''} ${
                  onTypeClick ? 'cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:shadow-[0_15px_30px_-5px_rgba(0,0,0,0.2)]' : ''
                }`}
                onClick={() => onTypeClick?.(typeData.type)}
                role={onTypeClick ? "button" : undefined}
                tabIndex={onTypeClick ? 0 : undefined}
                onKeyDown={(e) => {
                  if (onTypeClick && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onTypeClick(typeData.type);
                  }
                }}
              >
                {/* 3D Glass Background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${config.gradientClass} mix-blend-overlay opacity-50 z-0`}></div>
                <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent z-0"></div>
                <div className="absolute inset-0 bg-card/60 backdrop-blur-md z-0"></div>
                
                {/* Content */}
                <div className="relative z-10 flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg bg-background/50 ring-1 ring-white/10 ${config.glowClass}`}>
                      <Icon className={`h-4 w-4 ${config.themeClass}`} />
                    </div>
                    <span className={`text-xs uppercase font-extrabold tracking-wider ${config.themeClass} drop-shadow-sm`}>{config.label}</span>
                  </div>
                  {isPaused && (
                    <Badge variant="outline" className="text-[9px] font-bold uppercase px-1.5 py-0 h-4 border-amber-500/50 text-amber-500 bg-amber-500/10 shadow-[0_0_10px_rgba(245,158,11,0.2)]">Paused</Badge>
                  )}
                  {isCancelled && (
                    <Badge variant="outline" className="text-[9px] font-bold uppercase px-1.5 py-0 h-4 border-destructive/50 text-destructive bg-destructive/10 shadow-[0_0_10px_rgba(var(--destructive),0.2)]">Stopped</Badge>
                  )}
                  {isCompleted && (
                    <Badge variant="outline" className="text-[9px] font-bold uppercase px-1.5 py-0 h-4 border-emerald-500/50 text-emerald-500 bg-emerald-500/10 shadow-[0_0_10px_rgba(16,185,129,0.2)]">Done</Badge>
                  )}
                </div>
                
                <div className="relative z-10 flex flex-col gap-1 mt-auto">
                  <div className="flex items-baseline gap-1.5 drop-shadow-md">
                    <span className="text-2xl font-black tabular-nums text-foreground">
                      {delivered.toLocaleString()}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      / {dynamicTarget.toLocaleString()}
                    </span>
                  </div>
                </div>
                
                {/* Luminous Progress Bar */}
                <div className="relative z-10 h-2 mt-3 w-full bg-background/80 rounded-full overflow-hidden shadow-inner border border-white/5">
                  <div 
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
                    style={{ 
                      width: `${Math.min(progress, 100)}%`,
                      backgroundColor: 'currentColor'
                    }}
                  >
                    <div className={`absolute inset-0 opacity-100 ${config.themeClass} bg-current`}></div>
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.5)_50%,transparent_100%)] animate-[shimmer_2s_infinite]"></div>
                  </div>
                </div>
                
                {/* Actions */}
                {itemInfo && !isTerminal && (
                  <div className="relative z-10 flex items-center gap-1.5 mt-4 pt-3 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
                    {isPaused ? (
                      <Button 
                        size="sm" 
                        variant="secondary"
                        className="flex-1 h-8 text-[10px] uppercase font-bold tracking-wider gap-1.5 bg-background/80 hover:bg-background border border-white/5 shadow-sm hover:shadow-md transition-all"
                        onClick={() => onResumeType?.(itemInfo.id)}
                      >
                        <Play className="h-3 w-3 text-emerald-500" /> Resume
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="secondary"
                        className="flex-1 h-8 text-[10px] uppercase font-bold tracking-wider gap-1.5 bg-background/80 hover:bg-background border border-white/5 shadow-sm hover:shadow-md transition-all"
                        onClick={() => onPauseType?.(itemInfo.id)}
                      >
                        <Pause className="h-3 w-3 text-amber-500" /> Pause
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="destructive"
                      className="h-8 w-8 p-0 bg-background/80 hover:bg-destructive/90 text-destructive hover:text-white border border-white/5 shadow-sm hover:shadow-md transition-all"
                      onClick={() => setCancelConfirmType(typeData.type)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <AlertDialog open={!!cancelConfirmType} onOpenChange={(open) => !open && setCancelConfirmType(null)}>
        <AlertDialogContent className="border-white/10 bg-card/95 backdrop-blur-xl shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-destructive/20 text-destructive ring-1 ring-destructive/30">
                <X className="h-4 w-4" />
              </div>
              Cancel {cancelConfirmType ? getEngagementConfig(cancelConfirmType).label : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              All pending runs for this type will be permanently stopped. They will not be sent to the provider. Any runs already completed will remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-background/50 border-white/10 hover:bg-background">Keep Active</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground font-bold shadow-lg shadow-destructive/20 hover:bg-destructive/90 hover:scale-105 active:scale-95 transition-all"
              onClick={() => {
                if (cancelConfirmType && itemStatuses?.[cancelConfirmType]) {
                  onCancelType?.(itemStatuses[cancelConfirmType].id);
                }
                setCancelConfirmType(null);
              }}
            >
              Cancel Type
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}