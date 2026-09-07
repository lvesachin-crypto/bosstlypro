import { useState } from "react";
import { useCurrency } from "@/hooks/useCurrency";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format, formatDistanceToNow } from "date-fns";
import {
  Eye, Heart, MessageCircle, Bookmark, Share2,
  Clock, Play, CheckCircle2, XCircle, Pencil,
  ChevronDown, ChevronUp, ExternalLink, RefreshCw, Zap, CalendarClock,
  Pause, PlayCircle, Ban, RefreshCw as Repost, Repeat, UserPlus, Bell, Clock as ClockIcon, BarChart3, TrendingUp, AlertTriangle, AlertCircle, Info, Activity, Repeat2, Loader2
} from "lucide-react";
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
import { Progress } from "@/components/ui/progress";

const ENGAGEMENT_CONFIG: Record<string, { icon: typeof Eye; label: string; themeClass: string; bgClass: string; shadowClass: string }> = {
  views: { icon: Eye, label: "Views", themeClass: "text-cyan-500", bgClass: "bg-cyan-500/10", shadowClass: "shadow-cyan-500/10" },
  likes: { icon: Heart, label: "Likes", themeClass: "text-emerald-500", bgClass: "bg-emerald-500/10", shadowClass: "shadow-emerald-500/10" },
  comments: { icon: MessageCircle, label: "Comments", themeClass: "text-emerald-500", bgClass: "bg-emerald-500/10", shadowClass: "shadow-emerald-500/10" },
  saves: { icon: Bookmark, label: "Saves", themeClass: "text-amber-500", bgClass: "bg-amber-500/10", shadowClass: "shadow-amber-500/10" },
  shares: { icon: Share2, label: "Shares", themeClass: "text-violet-400", bgClass: "bg-violet-500/10", shadowClass: "shadow-violet-500/10" },
  reposts: { icon: Repeat2, label: "Reposts", themeClass: "text-purple-500", bgClass: "bg-purple-500/10", shadowClass: "shadow-purple-500/10" },
  retweets: { icon: Repeat, label: "Retweets", themeClass: "text-sky-500", bgClass: "bg-sky-500/10", shadowClass: "shadow-sky-500/10" },
  followers: { icon: UserPlus, label: "Followers", themeClass: "text-teal-500", bgClass: "bg-teal-500/10", shadowClass: "shadow-teal-500/10" },
  subscribers: { icon: Bell, label: "Subscribers", themeClass: "text-red-500", bgClass: "bg-red-500/10", shadowClass: "shadow-red-500/10" },
  watch_hours: { icon: ClockIcon, label: "Watch Hours", themeClass: "text-orange-500", bgClass: "bg-orange-500/10", shadowClass: "shadow-orange-500/10" },
};

const getEngagementConfig = (type: string) => ENGAGEMENT_CONFIG[type] || { icon: Activity, label: type, themeClass: "text-slate-500", bgClass: "bg-slate-500/10", shadowClass: "shadow-slate-500/10" };

interface Run {
  id: string;
  run_number: number;
  status: string;
  quantity_to_send: number;
  base_quantity: number;
  variance_applied?: number;
  scheduled_at: string;
  started_at?: string;
  completed_at?: string;
  peak_multiplier?: number;
  provider_order_id?: string;
  provider_remains?: number | null;
  provider_start_count?: number | null;
  provider_status?: string | null;
  provider_account_name?: string | null;
  error_message?: string | null;
  last_status_check?: string | null;
}

interface TypeHistoryCardProps {
  engagementType: string;
  targetQuantity: number;
  deliveredQuantity: number;
  runs: Run[];
  serviceName?: string;
  onEditRun?: (run: Run) => void;
  itemId?: string;
  itemStatus?: string;
  itemStartCount?: number | null;
  onPause?: (itemId: string) => void;
  onResume?: (itemId: string) => void;
  onCancel?: (itemId: string) => void;
}

export function TypeHistoryCard({
  engagementType,
  targetQuantity,
  deliveredQuantity,
  runs,
  serviceName,
  onEditRun,
  itemId,
  itemStatus,
  itemStartCount,
  onPause,
  onResume,
  onCancel,
}: TypeHistoryCardProps) {
  const { formatPrice } = useCurrency();
  const [isExpanded, setIsExpanded] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const engConfig = getEngagementConfig(engagementType);
  const Icon = engConfig.icon;

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

  const normalizeProviderStatus = (s?: string | null) => (s ?? '').toString().toLowerCase().trim();

  const isTargetMetAutoCompleted = (run: Run) => {
    const status = (run.status || '').toString().toLowerCase().trim();
    const message = (run.error_message || '').toString().toLowerCase().trim();
    if (status !== 'cancelled' && status !== 'canceled') return false;
    if (isTargetCompleteCancelMessage(message)) return true;
    return !run.provider_order_id && Boolean(run.completed_at) && targetQuantity > 0 && deliveredQuantity >= targetQuantity;
  };

  const getEffectiveStatus = (run: Run) => {
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

  const sortedRuns = [...runs].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const cumulativeScheduled: number[] = [];
  const cumulativeDelivered: number[] = [];
  let currentSched = 0;
  let currentDel = 0;

  const runsWithHistory = sortedRuns.map(run => {
    const effectiveStatus = getEffectiveStatus(run);
    
    if (effectiveStatus !== 'failed' && effectiveStatus !== 'cancelled') {
      currentSched += run.quantity_to_send;
    }
    
    let actualDelivered = 0;
    const ps = normalizeProviderStatus(run.provider_status);
    if (ps === 'completed' || ps === 'complete') {
      actualDelivered = run.quantity_to_send;
    } else if (isTargetMetAutoCompleted(run)) {
      actualDelivered = run.quantity_to_send;
    } else if (run.provider_remains !== null && run.provider_remains !== undefined) {
      actualDelivered = Math.max(0, run.quantity_to_send - run.provider_remains);
    } else if ((run.status || '').toLowerCase() === 'completed') {
      actualDelivered = run.quantity_to_send;
    }

    if (actualDelivered > 0) {
      currentDel += actualDelivered;
    }

    cumulativeScheduled.push(currentSched);
    cumulativeDelivered.push(currentDel);

    return {
      ...run,
      cumulativeScheduled: currentSched,
      cumulativeDelivered: currentDel,
      effectiveStatus,
      actualDelivered
    };
  });

  const totalScheduled = runsWithHistory.filter(r => r.effectiveStatus !== 'failed' && r.effectiveStatus !== 'cancelled')
    .reduce((sum, r) => sum + r.quantity_to_send, 0);
  
  const dynamicTarget = Math.max(targetQuantity, totalScheduled);
  const progressPercent = dynamicTarget > 0 ? (deliveredQuantity / dynamicTarget) * 100 : 0;
  
  const isPaused = itemStatus === 'paused';
  const isCancelled = itemStatus === 'cancelled';
  const isCompleted = itemStatus === 'completed';
  const isTerminal = isCancelled || isCompleted || itemStatus === 'failed';

  return (
    <Card className={`rounded-2xl border border-teal-100 dark:border-white/10 bg-white dark:bg-card shadow-lg ${engConfig.shadowClass} overflow-hidden transition-all duration-300 ${
      isPaused ? 'opacity-80 grayscale-[40%]' : ''
    } ${isCancelled ? 'opacity-60 grayscale-[80%]' : ''}`}>
      <div className="px-5 py-4 border-b border-teal-50 dark:border-white/5 bg-teal-50/20 dark:bg-white/5 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl bg-white dark:bg-background shadow-sm border border-teal-100 dark:border-white/10 ${engConfig.themeClass}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg uppercase tracking-wider text-slate-900 dark:text-foreground">{engConfig.label}</h3>
              {isPaused && <Badge variant="outline" className="text-[10px] font-bold uppercase px-1.5 py-0 h-5 border-amber-500/50 text-amber-600 bg-amber-50">Paused</Badge>}
              {isCancelled && <Badge variant="outline" className="text-[10px] font-bold uppercase px-1.5 py-0 h-5 border-slate-300 text-slate-500 bg-slate-50">Stopped</Badge>}
              {isCompleted && <Badge variant="outline" className="text-[10px] font-bold uppercase px-1.5 py-0 h-5 border-emerald-200 text-emerald-700 bg-emerald-50">Completed</Badge>}
            </div>
            {serviceName && (
              <p className="text-sm font-medium text-slate-500 dark:text-muted-foreground line-clamp-1 max-w-[300px]">
                {serviceName}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex flex-col sm:items-end gap-1">
          <div className="flex items-baseline gap-2 bg-white dark:bg-background px-3 py-1.5 rounded-lg border border-teal-100 dark:border-white/10 shadow-sm">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-muted-foreground">Progress</span>
            <span className={`text-xl font-black tabular-nums ${engConfig.themeClass}`}>
              {deliveredQuantity.toLocaleString()}
            </span>
            <span className="text-sm font-bold text-slate-400 dark:text-muted-foreground">
              / {dynamicTarget.toLocaleString()}
            </span>
            <Badge variant="secondary" className="ml-2 font-mono font-bold text-[10px] bg-teal-50 text-teal-700 border-teal-100">
              {progressPercent.toFixed(1)}%
            </Badge>
          </div>
          {itemStartCount !== null && itemStartCount !== undefined && (
            <div className="text-xs font-semibold text-slate-500 dark:text-muted-foreground">
              Start Count: {itemStartCount.toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {!isTerminal && itemId && (
        <div className="px-5 py-3 border-b border-teal-50 dark:border-white/5 bg-white/50 dark:bg-black/5 flex flex-wrap items-center gap-2">
          {isPaused ? (
            <Button size="sm" variant="outline" onClick={() => onResume?.(itemId)} className="h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50 bg-white">
              <Play className="h-3.5 w-3.5 mr-1.5" /> Resume Type
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => onPause?.(itemId)} className="h-8 border-amber-200 text-amber-700 hover:bg-amber-50 bg-white">
              <Pause className="h-3.5 w-3.5 mr-1.5" /> Pause Type
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setCancelConfirmOpen(true)} className="h-8 border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-destructive hover:border-destructive/30 bg-white ml-auto">
            <Ban className="h-3.5 w-3.5 mr-1.5" /> Stop Type
          </Button>
        </div>
      )}

      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent>
          <div className="p-3 sm:p-5 bg-slate-50/50 dark:bg-transparent max-h-[500px] overflow-y-auto space-y-2.5">
            {runsWithHistory.map((run, index) => {
              const scheduledDate = new Date(run.scheduled_at);
              const now = new Date();
              const isPastDue = scheduledDate < now;
              const isActive = run.effectiveStatus === 'started';
              const isCompleted = run.effectiveStatus === 'completed';
              const isFailed = run.effectiveStatus === 'failed';
              const isCancelled = run.effectiveStatus === 'cancelled';
              const isPending = run.effectiveStatus === 'pending';
              const isUpcoming = isPending && !isPastDue;
              
              const isAutoCompletedCancel = isTargetMetAutoCompleted(run);
              const hasProviderOrder = Boolean(run.provider_order_id) && !isAutoCompletedCancel;
              const providerStatus = normalizeProviderStatus(run.provider_status);

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
              const runProgressPercent = providerRemains !== null && run.quantity_to_send > 0
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
                  onClick={() => isPending && onEditRun?.(run)}
                >
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
                    {isPending && onEditRun && (
                      <Button variant="ghost" size="icon" className="w-6 h-6 text-slate-400 hover:text-slate-700 dark:text-muted-foreground dark:hover:text-foreground">
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </div>

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

                    {isActive && runProgressPercent !== null && (
                      <div className="space-y-1.5 bg-blue-50/50 dark:bg-background/50 p-2 rounded-lg border border-blue-100 dark:border-white/5">
                        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
                          <span className="text-blue-600 dark:text-blue-400">Delivery Progress</span>
                          <span className="text-slate-800 dark:text-foreground">{delivered?.toLocaleString()} / {run.quantity_to_send.toLocaleString()} ({runProgressPercent.toFixed(1)}%)</span>
                        </div>
                        <Progress value={runProgressPercent} className="h-1.5 bg-blue-100 dark:bg-secondary" />
                      </div>
                    )}

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
                        </div>
                      </div>
                    )}

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
                  </div>
                </div>
              );
            })}
            
            {runsWithHistory.length === 0 && (
              <div className="text-center py-8 text-slate-500 dark:text-muted-foreground font-medium">
                No runs scheduled for this engagement type.
              </div>
            )}
          </div>
        </CollapsibleContent>

        <div className="border-t border-teal-50 dark:border-white/5 bg-white dark:bg-card">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full rounded-none h-12 text-slate-500 dark:text-muted-foreground hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-foreground font-bold tracking-wider uppercase text-xs">
              {isExpanded ? (
                <>Hide Full History <ChevronUp className="ml-2 h-4 w-4" /></>
              ) : (
                <>View Full History ({runsWithHistory.length} Runs) <ChevronDown className="ml-2 h-4 w-4" /></>
              )}
            </Button>
          </CollapsibleTrigger>
        </div>
      </Collapsible>

      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent className="border-white/10 bg-card/95 backdrop-blur-xl shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-destructive/20 text-destructive ring-1 ring-destructive/30">
                <Ban className="h-4 w-4" />
              </div>
              Stop {engConfig.label}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently stop all future runs for {engConfig.label}. Any runs that are already completed or in progress with the provider will remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-background/50 border-white/10 hover:bg-background">Keep Active</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground font-bold shadow-lg shadow-destructive/20 hover:bg-destructive/90 hover:scale-105 active:scale-95 transition-all"
              onClick={() => {
                if (itemId) onCancel?.(itemId);
                setCancelConfirmOpen(false);
              }}
            >
              Stop {engConfig.label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}