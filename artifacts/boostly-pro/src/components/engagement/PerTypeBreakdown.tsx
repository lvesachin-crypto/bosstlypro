import { useState } from "react";
import { Eye, Heart, MessageCircle, Bookmark, Share2, Zap, BarChart3, Pause, Play, X, Activity } from "lucide-react";
import { Progress } from "@/components/ui/progress";
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

const ENGAGEMENT_CONFIG: Record<string, { icon: typeof Eye; label: string; colorClass: string; bgClass: string; borderClass: string; textClass: string }> = {
  views: { icon: Eye, label: "Views", colorClass: "text-blue-500", bgClass: "bg-blue-500/10", borderClass: "border-blue-500/20", textClass: "text-blue-600 dark:text-blue-400" },
  likes: { icon: Heart, label: "Likes", colorClass: "text-rose-500", bgClass: "bg-rose-500/10", borderClass: "border-rose-500/20", textClass: "text-rose-600 dark:text-rose-400" },
  comments: { icon: MessageCircle, label: "Comments", colorClass: "text-emerald-500", bgClass: "bg-emerald-500/10", borderClass: "border-emerald-500/20", textClass: "text-emerald-600 dark:text-emerald-400" },
  saves: { icon: Bookmark, label: "Saves", colorClass: "text-amber-500", bgClass: "bg-amber-500/10", borderClass: "border-amber-500/20", textClass: "text-amber-600 dark:text-amber-400" },
  shares: { icon: Share2, label: "Shares", colorClass: "text-indigo-500", bgClass: "bg-indigo-500/10", borderClass: "border-indigo-500/20", textClass: "text-indigo-600 dark:text-indigo-400" },
  reposts: { icon: Share2, label: "Reposts", colorClass: "text-purple-500", bgClass: "bg-purple-500/10", borderClass: "border-purple-500/20", textClass: "text-purple-600 dark:text-purple-400" },
};

const getEngagementConfig = (type: string) => {
  return ENGAGEMENT_CONFIG[type] || {
    icon: Activity,
    label: type?.charAt(0).toUpperCase() + type?.slice(1) || "Items",
    colorClass: "text-slate-500",
    bgClass: "bg-slate-500/10",
    borderClass: "border-slate-500/20",
    textClass: "text-slate-600 dark:text-slate-400"
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
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border bg-muted/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <span className="font-semibold text-foreground tracking-tight">Live Engagement Breakdown</span>
          </div>
          <div className="flex items-center gap-3 bg-background border border-border px-3 py-1.5 rounded-md shadow-sm">
            <span className="text-sm text-muted-foreground font-medium">Aggregate:</span>
            <span className="font-bold text-base text-foreground tabular-nums">
              {grandDelivered.toLocaleString()} / {grandTarget.toLocaleString()}
            </span>
            <Badge variant="secondary" className="font-mono text-xs">
              {grandProgress.toFixed(1)}%
            </Badge>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="p-4 bg-muted/10">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
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
                className={`group flex flex-col p-3.5 rounded-lg border transition-all ${config.bgClass} ${config.borderClass} ${
                  isPaused ? 'opacity-75 grayscale-[30%]' : ''
                } ${isCancelled ? 'opacity-50 grayscale-[80%]' : ''} ${
                  onTypeClick ? 'cursor-pointer hover:border-foreground/20 hover:shadow-sm' : ''
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
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Icon className={`h-4 w-4 ${config.colorClass}`} />
                    <span className={`text-xs uppercase font-bold tracking-wider ${config.textClass}`}>{config.label}</span>
                  </div>
                  {isPaused && (
                    <Badge variant="outline" className="text-[9px] uppercase px-1 py-0 h-4 border-amber-500/40 text-amber-600 bg-amber-500/10">Paused</Badge>
                  )}
                  {isCancelled && (
                    <Badge variant="outline" className="text-[9px] uppercase px-1 py-0 h-4 border-destructive/40 text-destructive bg-destructive/10">Stopped</Badge>
                  )}
                  {isCompleted && (
                    <Badge variant="outline" className="text-[9px] uppercase px-1 py-0 h-4 border-blue-500/40 text-blue-600 bg-blue-500/10">Done</Badge>
                  )}
                </div>
                
                <div className="flex items-baseline gap-1 mt-auto">
                  <span className={`text-xl font-bold tabular-nums ${config.textClass}`}>
                    {delivered.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    / {dynamicTarget.toLocaleString()}
                  </span>
                </div>
                
                <Progress value={Math.min(progress, 100)} className="h-1.5 mt-2.5 bg-background border border-border/50" />
                
                {/* Actions */}
                {itemInfo && !isTerminal && (
                  <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/40" onClick={(e) => e.stopPropagation()}>
                    {isPaused ? (
                      <Button 
                        size="sm" 
                        variant="secondary"
                        className="flex-1 h-7 text-[10px] uppercase font-bold tracking-wider gap-1 bg-background hover:bg-muted"
                        onClick={() => onResumeType?.(itemInfo.id)}
                      >
                        <Play className="h-3 w-3" /> Resume
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="secondary"
                        className="flex-1 h-7 text-[10px] uppercase font-bold tracking-wider gap-1 bg-background hover:bg-muted text-muted-foreground"
                        onClick={() => onPauseType?.(itemInfo.id)}
                      >
                        <Pause className="h-3 w-3" /> Pause
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setCancelConfirmType(typeData.type)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <AlertDialog open={!!cancelConfirmType} onOpenChange={(open) => !open && setCancelConfirmType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Cancel {cancelConfirmType ? getEngagementConfig(cancelConfirmType).label : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              All pending runs for this type will be permanently stopped. They will not be sent to the provider. Any runs already completed will remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Active</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
