import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { format, formatDistanceToNow } from "date-fns";
import {
  Eye, Heart, MessageCircle, Bookmark, Share2,
  Clock, Play, CheckCircle2, XCircle, Pencil, Timer, RefreshCw, Loader2, TrendingUp, CalendarClock, Activity, AlertTriangle, AlertCircle, Info, Repeat2, Repeat, UserPlus, Bell, Clock as ClockIcon
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";

const ENGAGEMENT_CONFIG: Record<string, { icon: typeof Eye; label: string; themeClass: string; bgClass: string }> = {
  views: { icon: Eye, label: "Views", themeClass: "text-cyan-500", bgClass: "bg-cyan-500/10" },
  likes: { icon: Heart, label: "Likes", themeClass: "text-emerald-500", bgClass: "bg-emerald-500/10" },
  comments: { icon: MessageCircle, label: "Comments", themeClass: "text-emerald-500", bgClass: "bg-emerald-500/10" },
  saves: { icon: Bookmark, label: "Saves", themeClass: "text-amber-500", bgClass: "bg-amber-500/10" },
  shares: { icon: Share2, label: "Shares", themeClass: "text-violet-400", bgClass: "bg-violet-500/10" },
  reposts: { icon: Repeat2, label: "Reposts", themeClass: "text-purple-500", bgClass: "bg-purple-500/10" },
  retweets: { icon: Repeat, label: "Retweets", themeClass: "text-sky-500", bgClass: "bg-sky-500/10" },
  followers: { icon: UserPlus, label: "Followers", themeClass: "text-teal-500", bgClass: "bg-teal-500/10" },
  subscribers: { icon: Bell, label: "Subscribers", themeClass: "text-red-500", bgClass: "bg-red-500/10" },
  watch_hours: { icon: ClockIcon, label: "Watch Hours", themeClass: "text-orange-500", bgClass: "bg-orange-500/10" }
};

const getEngagementConfig = (type: string) => ENGAGEMENT_CONFIG[type] || { icon: Activity, label: type, themeClass: "text-slate-500", bgClass: "bg-slate-500/10" };

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
    <div className="rounded-xl border border-slate-100 dark:border-white/10 bg-white dark:bg-card shadow-sm overflow-hidden flex flex-col max-h-[800px]">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <Timer className="h-5 w-5 text-teal-500" />
          <span className="font-bold text-slate-900 dark:text-foreground tracking-tight">Run Schedule</span>
          <Badge variant="secondary" className="font-mono text-xs bg-white text-slate-600 border-slate-200 dark:bg-muted/50 dark:text-muted-foreground dark:border-border">{runs.length} runs</Badge>
          <Badge variant="secondary" className="font-mono text-xs text-teal-600 bg-teal-50 border-teal-100 dark:text-primary dark:border-primary/20 dark:bg-primary/5">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {grandTotalDelivered.toLocaleString()} delivered
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {activeRuns > 0 && (
            <Button variant="outline" size="sm" onClick={refreshAllStatus} disabled={isGlobalRefreshing} className="h-8 border-teal-200 text-teal-700 hover:bg-teal-50">
              {isGlobalRefreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <RefreshCw className="h-3.5 w-3.5 mr-2" />}
              Check {activeRuns} Active
            </Button>
          )}
          {nextRun && (
            <Badge variant="outline" className="h-8 px-3 rounded-md font-medium text-xs border-teal-100 text-teal-700 bg-teal-50/50">
              <CalendarClock className="h-3.5 w-3.5 mr-1.5 text-teal-500" />
              Next: {formatDistanceToNow(new Date(nextRun.scheduled_at))}
            </Badge>
          )}
        </div>
      </div>

      <div className="overflow-y-auto flex-1 p-3 sm:p-4 space-y-2.5 bg-slate-50/30 dark:bg-transparent">
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
              className={`relative flex flex-col sm:flex-row p-3 gap-3.5 rounded-xl border transition-all ${
                isActive ? 'border-blue-200 shadow-[0_0_15px_rgba(59,130,246,0.1)] bg-white dark:bg-card dark:border-primary/50' : 
                isCompleted ? 'border-emerald-100 bg-emerald-50/30 dark:border-white/5 dark:bg-white/5' :
                isFailed ? 'border-red-200 bg-red-50/50 dark:border-destructive/30 dark:bg-destructive/5' :
                isCancelled ? 'border-slate-200 bg-slate-50 opacity-75 dark:border-white/5 dark:bg-muted/5' :
                'border-slate-100 bg-white hover:bg-slate-50 cursor-pointer hover:border-slate-200 hover:shadow-sm dark:bg-card dark:border-white/10 dark:hover:bg-white/5'
              }`}
              onClick={() => isPending && onEditRun(run)}
            >
              {/* Index Column */}
              <div className="flex flex-col items-center gap-1 sm:w-10 shrink-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold ring-2 ring-white dark:ring-transparent ${
                  isActive ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20' : 
                  isCompleted ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                  isFailed ? 'bg-red-500 text-white shadow-md shadow-red-500/20' :
                  isCancelled ? 'bg-slate-200 text-slate-500 dark:bg-muted dark:text-muted-foreground' :
                  'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400'
                }`}>
                  {index + 1}
                </div>
                {isPending && (
                  <Button variant="ghost" size="icon" className="w-6 h-6 text-slate-400 hover:text-slate-700 dark:text-muted-foreground dark:hover:text-foreground">
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Main Content */}
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Badge variant="outline" className={`font-semibold px-2 py-0 h-5 ${
                    isCompleted ? 'border-emerald-200 bg-emerald-100/50 text-emerald-700' :
                    isActive ? 'border-blue-200 bg-blue-50 text-blue-700' :
                    isFailed ? 'border-red-200 bg-red-50 text-red-700' :
                    isCancelled ? 'border-slate-200 text-slate-500' :
                    isUpcoming ? 'border-teal-200 bg-teal-50 text-teal-700' :
                    'border-slate-200 text-slate-600'
                  }`}>
                    {isCompleted && <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" />}
                    {isActive && <Loader2 className="h-3 w-3 mr-1 animate-spin text-blue-500" />}
                    {isFailed && <XCircle className="h-3 w-3 mr-1 text-red-500" />}
                    {isCancelled && <AlertCircle className="h-3 w-3 mr-1" />}
                    {isPending && isUpcoming && <CalendarClock className="h-3 w-3 mr-1" />}
                    {isPending && !isUpcoming && <Clock className="h-3 w-3 mr-1" />}
                    {displayStatus}
                  </Badge>

                  <div className="flex items-center gap-1.5 text-slate-900 dark:text-foreground font-bold text-sm">
                    <div className={`p-1 rounded-md ${engConfig.bgClass}`}>
                      <Icon className={`h-3.5 w-3.5 ${engConfig.themeClass}`} />
                    </div>
                    <span className={engConfig.themeClass}>+{run.quantity_to_send.toLocaleString()}</span>
                    <span>{engConfig.label}</span>
                  </div>

                  {run.variance_applied !== undefined && run.variance_applied !== 0 && (
                    <span className="text-[10px] text-slate-500 dark:text-muted-foreground font-bold uppercase tracking-wider bg-slate-100 dark:bg-muted px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/5">
                      var: {run.variance_applied > 0 ? '+' : ''}{run.variance_applied}
                    </span>
                  )}

                  {isCompleted && run.cumulativeAtThisPoint > 0 && (
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 ml-auto bg-teal-50 dark:bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-100 dark:border-teal-500/20">
                      <TrendingUp className="h-3 w-3" />
                      <span>{run.cumulativeAtThisPoint.toLocaleString()} total</span>
                    </div>
                  )}
                </div>

                {/* Progress bar for active runs */}
                {isActive && progressPercent !== null && (
                  <div className="space-y-1.5 bg-blue-50/50 dark:bg-background/50 p-2 rounded-lg border border-blue-100 dark:border-white/5">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
                      <span className="text-blue-600 dark:text-blue-400">Delivery Progress</span>
                      <span className="text-slate-800 dark:text-foreground">{delivered?.toLocaleString()} / {run.quantity_to_send.toLocaleString()} ({progressPercent.toFixed(1)}%)</span>
                    </div>
                    <Progress value={progressPercent} className="h-1.5 bg-blue-100 dark:bg-secondary" />
                  </div>
                )}

                {/* Sub status info */}
                {!isAutoCompletedCancel && (run.error_message || run.provider_status || run.provider_order_id) && (
                  <div className="flex items-start gap-1.5 text-[11px] bg-slate-50 dark:bg-background/50 border border-slate-100 dark:border-border/50 px-2.5 py-1.5 rounded-md text-slate-600 dark:text-muted-foreground">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <div className="flex-1 flex flex-col gap-0.5 font-medium">
                      {isFailed && run.error_message && (
                        <span className="text-red-600 dark:text-destructive">{run.error_message}</span>
                      )}
                      {(run.provider_status === 'Completed' || (hasProviderOrder && run.provider_remains === 0)) && (
                        <span className="text-emerald-600 dark:text-emerald-400">Provider delivery complete.</span>
                      )}
                      {run.provider_status === 'Partial' && (
                        <span className="text-amber-600">Partial delivery. {run.provider_remains} remaining.</span>
                      )}
                      {run.error_message?.includes('Auto-completed') && !run.provider_status?.includes('Completed') && (
                        <span>Order placed at provider (#{run.provider_order_id}). Delivering in background.</span>
                      )}
                      {providerStatus === 'pending' && !hasProviderOrder && (
                        <span>Auto-assigning to provider when free...</span>
                      )}
                      {run.last_status_check && (
                        <span className="opacity-70 text-[10px]">
                          Checked {formatDistanceToNow(new Date(run.last_status_check))} ago.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Timestamps */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                    {format(scheduledDate, 'MMM d, h:mm a')}
                    {isUpcoming && <span className="text-teal-600 bg-teal-50 px-1.5 rounded-sm ml-1 ring-1 ring-teal-100">in {formatDistanceToNow(scheduledDate)}</span>}
                  </span>
                  
                  {run.started_at && (
                    <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                      <Play className="h-3 w-3" /> Started {format(new Date(run.started_at), 'h:mm a')}
                    </span>
                  )}
                  {run.completed_at && (
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> Done {format(new Date(run.completed_at), 'h:mm a')}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Column */}
              <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 sm:w-28 shrink-0 border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-border/50 pt-2 sm:pt-0 sm:pl-3">
                {run.provider_account_name && !isAutoCompletedCancel && (
                  <div className="text-left sm:text-right">
                    <p className="text-[9px] text-slate-400 dark:text-muted-foreground uppercase font-bold tracking-wider">Provider</p>
                    <p className="text-[11px] font-bold text-slate-700 dark:text-foreground truncate max-w-[100px]">{run.provider_account_name}</p>
                  </div>
                )}
                {run.provider_order_id && !isAutoCompletedCancel && (
                  <div className="text-left sm:text-right">
                    <p className="text-[9px] text-slate-400 dark:text-muted-foreground uppercase font-bold tracking-wider">Order ID</p>
                    <p className="text-[11px] font-mono font-medium text-slate-500 dark:text-muted-foreground">{run.provider_order_id}</p>
                  </div>
                )}
                {isActive && run.provider_order_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[10px] uppercase tracking-wider font-bold w-full mt-auto bg-white hover:bg-slate-50 text-slate-700 border-slate-200 dark:bg-transparent dark:text-foreground dark:border-border"
                    onClick={(e) => {
                      e.stopPropagation();
                      refreshRunStatus(run.id);
                    }}
                    disabled={refreshingRunId === run.id}
                  >
                    {refreshingRunId === run.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1 text-slate-400" />}
                    Check
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        {runsWithCumulative.length === 0 && (
          <div className="text-center py-10 text-slate-500 dark:text-muted-foreground font-medium">
            No runs scheduled.
          </div>
        )}
      </div>
    </div>
  );
}