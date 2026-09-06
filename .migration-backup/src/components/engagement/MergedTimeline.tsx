import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { format, formatDistanceToNow } from "date-fns";
import {
  Eye, Heart, MessageCircle, Bookmark, Share2,
  Clock, Play, CheckCircle2, XCircle, Pencil, Timer, RefreshCw, Loader2, TrendingUp, CalendarClock, Activity, AlertTriangle, AlertCircle, Info
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";

const ENGAGEMENT_CONFIG: Record<string, { icon: typeof Eye; label: string }> = {
  views: { icon: Eye, label: "Views" },
  likes: { icon: Heart, label: "Likes" },
  comments: { icon: MessageCircle, label: "Comments" },
  saves: { icon: Bookmark, label: "Saves" },
  shares: { icon: Share2, label: "Shares" },
  reposts: { icon: Share2, label: "Reposts" },
};

const getEngagementConfig = (type: string) => ENGAGEMENT_CONFIG[type] || { icon: Activity, label: type };

interface MergedRun {
  id: string;
  engagement_type: string;
  run_number: number;
  status: string;
  quantity_to_send: number;
  scheduled_at: string;
  started_at?: string;
  completed_at?: string;
  peak_multiplier?: number;
  variance_applied?: number;
  provider_order_id?: string;
  provider_status?: string;
  provider_start_count?: number;
  provider_remains?: number;
  last_status_check?: string;
  item_id: string;
  provider_account_name?: string | null;
  error_message?: string | null;
}

interface TypeTarget {
  type: string;
  target: number;
  delivered: number;
}

interface MergedTimelineProps {
  runs: MergedRun[];
  onEditRun: (run: MergedRun) => void;
  nextRun?: MergedRun | null;
  onRefresh?: () => void;
  typeTargets?: TypeTarget[];
}

export function MergedTimeline({ runs, onEditRun, nextRun, onRefresh, typeTargets = [] }: MergedTimelineProps) {
  const [refreshingRunId, setRefreshingRunId] = useState<string | null>(null);
  const [isGlobalRefreshing, setIsGlobalRefreshing] = useState(false);

  const normalizeProviderStatus = (s?: string | null) => (s ?? '').toString().toLowerCase().trim();
  const targetStateByType: Record<string, TypeTarget> = {};
  typeTargets.forEach(t => { targetStateByType[t.type] = t; });
  
  const isTargetCompleteCancelMessage = (message: string) => (
    message.startsWith('target met') ||
    message.startsWith('target count reached') ||
    message.includes('target count reached') ||
    message.includes('target reached') ||
    message.includes('cancelling remaining runs') ||
    message.startsWith('delivery reserved') ||
    message.includes('already delivered') ||
    message.includes('auto-cancelled') ||
    message.includes('auto completed') ||
    message.includes('auto-completed') ||
    message.includes('item completed')
  );

  const isTargetMetAutoCompleted = (run: MergedRun) => {
    const status = (run.status || '').toString().toLowerCase().trim();
    const message = (run.error_message || '').toString().toLowerCase().trim();

    if (status !== 'cancelled' && status !== 'canceled') return false;
    if (isTargetCompleteCancelMessage(message)) return true;

    const typeTarget = targetStateByType[run.engagement_type];
    return !run.provider_order_id && Boolean(run.completed_at) && Boolean(typeTarget?.target) && typeTarget.delivered >= typeTarget.target;
  };

  const getEffectiveStatus = (run: MergedRun): 'pending' | 'started' | 'completed' | 'failed' | 'cancelled' => {
    if (isTargetMetAutoCompleted(run)) return 'completed';

    const ps = normalizeProviderStatus(run.provider_status);

    if (run.provider_order_id && run.provider_remains === 0) return 'completed';
    if (ps === 'completed' || ps === 'complete' || ps === 'partial') return 'completed';
    if (ps === 'pending') return run.provider_order_id ? 'started' : 'pending';
    if (ps === 'in progress' || ps === 'processing') return 'started';
    if (ps === 'canceled' || ps === 'cancelled' || ps === 'refunded' || ps === 'failed' || ps === 'error') return 'failed';

    const s = (run.status || '').toString().toLowerCase().trim();
    if (run.provider_order_id && (s === 'pending' || s === 'started' || s === 'processing')) return 'started';
    if (s === 'processing') return 'started';
    if (s === 'cancelled' || s === 'canceled') return 'cancelled';
    if (s === 'pending' || s === 'started' || s === 'completed' || s === 'failed') return s as any;
    return 'pending';
  };

  const getDeliveredFromProvider = (run: MergedRun): number => {
    const ps = normalizeProviderStatus(run.provider_status);
    if (ps === 'completed' || ps === 'complete') return run.quantity_to_send;
    if (isTargetMetAutoCompleted(run)) return run.quantity_to_send;
    if (run.provider_remains !== null && run.provider_remains !== undefined) {
      return Math.max(0, run.quantity_to_send - run.provider_remains);
    }
    if ((run.status || '').toLowerCase() === 'completed') return run.quantity_to_send;
    return 0;
  };

  const sortedRuns = [...runs].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  const cumulativeDelivered: Record<string, number> = {};
  const cumulativeScheduled: Record<string, number> = {};

  const runsWithCumulative = sortedRuns.map((run) => {
    const type = run.engagement_type;
    const effective = getEffectiveStatus(run);
    const actualDelivered = getDeliveredFromProvider(run);

    if (effective !== 'failed' && effective !== 'cancelled') {
      const currentScheduled = cumulativeScheduled[type] || 0;
      cumulativeScheduled[type] = currentScheduled + run.quantity_to_send;
    }

    if (actualDelivered > 0) {
      const currentDelivered = cumulativeDelivered[type] || 0;
      cumulativeDelivered[type] = currentDelivered + actualDelivered;
    }

    return {
      ...run,
      actualDeliveredThisRun: actualDelivered,
      scheduledThisRun: (effective !== 'failed' && effective !== 'cancelled') ? run.quantity_to_send : 0,
      cumulativeAtThisPoint: cumulativeDelivered[type] || 0,
    };
  });

  const refreshRunStatus = async (runId: string) => {
    setRefreshingRunId(runId);
    try {
      const { error } = await supabase.functions.invoke('check-order-status', { body: { runId } });
      if (error) throw error;
      toast.success('Status updated from provider!');
      onRefresh?.();
    } catch (err: any) {
      toast.error(`Failed to refresh: ${err.message}`);
    } finally {
      setRefreshingRunId(null);
    }
  };

  const refreshAllStatus = async () => {
    setIsGlobalRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-order-status');
      if (error) throw error;
      toast.success(`Checked ${data?.completed + data?.stillProcessing || 0} runs from provider`);
      onRefresh?.();
    } catch (err: any) {
      toast.error(`Failed to refresh: ${err.message}`);
    } finally {
      setIsGlobalRefreshing(false);
    }
  };

  const activeRuns = runs.filter(r => getEffectiveStatus(r) === 'started').length;
  const grandTotalDelivered = runs.reduce((sum, r) => sum + getDeliveredFromProvider(r), 0);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col max-h-[800px]">
      <div className="px-4 py-3 border-b border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <Timer className="h-5 w-5 text-muted-foreground" />
          <span className="font-semibold text-foreground tracking-tight">Run Schedule</span>
          <Badge variant="secondary" className="font-mono text-xs text-muted-foreground">{runs.length} runs</Badge>
          <Badge variant="secondary" className="font-mono text-xs text-primary border-primary/20 bg-primary/5">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {grandTotalDelivered.toLocaleString()} delivered
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {activeRuns > 0 && (
            <Button variant="outline" size="sm" onClick={refreshAllStatus} disabled={isGlobalRefreshing} className="h-8">
              {isGlobalRefreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <RefreshCw className="h-3.5 w-3.5 mr-2" />}
              Check {activeRuns} Active
            </Button>
          )}
          {nextRun && (
            <Badge variant="outline" className="h-8 px-3 rounded-md font-medium text-xs">
              <CalendarClock className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              Next: {formatDistanceToNow(new Date(nextRun.scheduled_at))}
            </Badge>
          )}
        </div>
      </div>

      <div className="overflow-y-auto flex-1 p-4 space-y-3">
        {runsWithCumulative.map((run, index) => {
          const engConfig = getEngagementConfig(run.engagement_type);
          const Icon = engConfig.icon;
          const scheduledDate = new Date(run.scheduled_at);
          const now = new Date();
          const isAutoCompletedCancel = isTargetMetAutoCompleted(run);
          const effectiveStatus = getEffectiveStatus(run);
          
          const isPending = effectiveStatus === 'pending';
          const isActive = effectiveStatus === 'started';
          const isCompleted = effectiveStatus === 'completed';
          const isFailed = effectiveStatus === 'failed';
          const isCancelled = effectiveStatus === 'cancelled';
          const providerStatus = normalizeProviderStatus(run.provider_status);
          const hasProviderOrder = Boolean(run.provider_order_id) && !isAutoCompletedCancel;

          const isAlreadyExecuted = isCompleted || isFailed || isActive;
          const isScheduledInPast = scheduledDate < now;
          const isUpcoming = isPending && !isScheduledInPast;

          const getDisplayStatus = () => {
            if (isAutoCompletedCancel) return 'Completed';
            if (isCompleted) return 'Completed';
            if (isActive) return 'Processing';
            if (run.provider_status) return run.provider_status;
            if (isCancelled) return 'Cancelled';
            if (isFailed) return 'Failed';
            if (isPending && isUpcoming) return 'Scheduled';
            if (isPending) return 'Queued';
            if (isCompleted) return 'Completed';
            return run.status.charAt(0).toUpperCase() + run.status.slice(1).toLowerCase();
          };
          const displayStatus = getDisplayStatus();

          const providerRemains = run.provider_remains ?? null;
          const delivered = providerRemains !== null ? (run.quantity_to_send - providerRemains) : null;
          const progressPercent = providerRemains !== null && run.quantity_to_send > 0
            ? Math.min(100, Math.max(0, ((run.quantity_to_send - providerRemains) / run.quantity_to_send) * 100))
            : null;

          return (
            <div
              key={run.id}
              className={`relative flex flex-col sm:flex-row p-4 gap-4 rounded-lg border transition-all ${
                isActive ? 'border-primary shadow-sm bg-primary/5' : 
                isCompleted ? 'border-border bg-muted/10' :
                isFailed ? 'border-destructive/30 bg-destructive/5' :
                isCancelled ? 'border-border/50 bg-muted/5 opacity-75' :
                'border-border bg-card hover:bg-muted/10 cursor-pointer hover:border-foreground/20'
              }`}
              onClick={() => isPending && onEditRun(run)}
            >
              {/* Index Column */}
              <div className="flex flex-col items-center gap-2 sm:w-12 shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold ${
                  isActive ? 'bg-primary text-primary-foreground' : 
                  isCompleted ? 'bg-secondary text-secondary-foreground' :
                  isFailed ? 'bg-destructive text-destructive-foreground' :
                  isCancelled ? 'bg-muted text-muted-foreground' :
                  'bg-muted/50 text-foreground border border-border'
                }`}>
                  {index + 1}
                </div>
                {isPending && (
                  <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground hover:text-foreground">
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Main Content */}
              <div className="flex-1 min-w-0 flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant={isActive ? "default" : isCompleted ? "secondary" : isFailed ? "destructive" : isCancelled ? "outline" : "outline"} className={`font-semibold ${isPending && isUpcoming ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : ''}`}>
                    {isCompleted && <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                    {isActive && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                    {isFailed && <XCircle className="h-3.5 w-3.5 mr-1.5" />}
                    {isCancelled && <AlertCircle className="h-3.5 w-3.5 mr-1.5" />}
                    {isPending && isUpcoming && <CalendarClock className="h-3.5 w-3.5 mr-1.5" />}
                    {isPending && !isUpcoming && <Clock className="h-3.5 w-3.5 mr-1.5" />}
                    {displayStatus}
                  </Badge>

                  <div className="flex items-center gap-1.5 text-foreground font-semibold">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>+{run.quantity_to_send.toLocaleString()} {engConfig.label}</span>
                  </div>

                  {run.variance_applied !== undefined && run.variance_applied !== 0 && (
                    <span className="text-xs text-muted-foreground font-medium bg-muted px-1.5 py-0.5 rounded">
                      var: {run.variance_applied > 0 ? '+' : ''}{run.variance_applied}
                    </span>
                  )}

                  {isCompleted && run.cumulativeAtThisPoint > 0 && (
                    <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground ml-auto bg-muted/50 px-2 py-0.5 rounded-full border border-border/50">
                      <TrendingUp className="h-3 w-3" />
                      <span>{run.cumulativeAtThisPoint.toLocaleString()} total</span>
                    </div>
                  )}
                </div>

                {/* Progress bar for active runs */}
                {isActive && progressPercent !== null && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-muted-foreground">Delivery Progress</span>
                      <span className="text-foreground">{delivered?.toLocaleString()} / {run.quantity_to_send.toLocaleString()} ({progressPercent.toFixed(1)}%)</span>
                    </div>
                    <Progress value={progressPercent} className="h-1.5 bg-secondary" />
                  </div>
                )}

                {/* Sub status info */}
                {!isAutoCompletedCancel && (run.error_message || run.provider_status || run.provider_order_id) && (
                  <div className="flex items-start gap-2 text-xs bg-background/50 border border-border/50 p-2 rounded-md">
                    <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 flex flex-col gap-1">
                      {isFailed && run.error_message && (
                        <span className="text-destructive font-medium">{run.error_message}</span>
                      )}
                      {(run.provider_status === 'Completed' || (hasProviderOrder && run.provider_remains === 0)) && (
                        <span className="text-muted-foreground">Provider delivery complete.</span>
                      )}
                      {run.provider_status === 'Partial' && (
                        <span className="text-amber-600">Partial delivery. {run.provider_remains} remaining.</span>
                      )}
                      {run.error_message?.includes('Auto-completed') && !run.provider_status?.includes('Completed') && (
                        <span className="text-muted-foreground">Order placed at provider (#{run.provider_order_id}). Delivering in background.</span>
                      )}
                      {providerStatus === 'pending' && !hasProviderOrder && (
                        <span className="text-muted-foreground">Auto-assigning to provider when free...</span>
                      )}
                      {run.last_status_check && (
                        <span className="text-muted-foreground opacity-70">
                          Checked {formatDistanceToNow(new Date(run.last_status_check))} ago.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Timestamps */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {format(scheduledDate, 'MMM d, h:mm a')}
                    {isUpcoming && <span className="font-medium text-amber-600 bg-amber-500/10 px-1.5 rounded ml-1">in {formatDistanceToNow(scheduledDate)}</span>}
                  </span>
                  
                  {run.started_at && (
                    <span className="flex items-center gap-1.5">
                      <Play className="h-3 w-3" /> Started {format(new Date(run.started_at), 'h:mm a')}
                    </span>
                  )}
                  {run.completed_at && (
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3" /> Done {format(new Date(run.completed_at), 'h:mm a')}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Column */}
              <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-3 sm:w-32 shrink-0 border-t sm:border-t-0 sm:border-l border-border/50 pt-3 sm:pt-0 sm:pl-4">
                {run.provider_account_name && !isAutoCompletedCancel && (
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Provider</p>
                    <p className="text-xs font-medium text-foreground truncate max-w-[120px]">{run.provider_account_name}</p>
                  </div>
                )}
                {run.provider_order_id && !isAutoCompletedCancel && (
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Order ID</p>
                    <p className="text-xs font-mono text-muted-foreground">{run.provider_order_id}</p>
                  </div>
                )}
                {isActive && run.provider_order_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs w-full mt-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      refreshRunStatus(run.id);
                    }}
                    disabled={refreshingRunId === run.id}
                  >
                    {refreshingRunId === run.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                    Check
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        {runsWithCumulative.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            No runs scheduled.
          </div>
        )}
      </div>
    </div>
  );
}
