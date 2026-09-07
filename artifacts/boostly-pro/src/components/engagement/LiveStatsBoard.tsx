import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Timer, CheckCircle2, Play, Clock, AlertTriangle, RefreshCw, TrendingUp, RotateCcw, Loader2, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface LiveStatsBoardProps {
  totalRuns: number;
  completedRuns: number;
  startedRuns: number;
  pendingRuns: number;
  failedRuns: number;
  totalDelivered: number;
  totalQuantity: number;
  nextRun?: { scheduled_at: string } | null;
  onRetryFailed?: () => void;
  isRetrying?: boolean;
}

export function LiveStatsBoard({
  totalRuns,
  completedRuns,
  startedRuns,
  pendingRuns,
  failedRuns,
  totalDelivered,
  totalQuantity,
  nextRun,
  onRetryFailed,
  isRetrying = false,
}: LiveStatsBoardProps) {
  const progressPercent = totalQuantity > 0 ? (totalDelivered / totalQuantity) * 100 : 0;

  return (
    <div className="relative rounded-2xl border border-teal-100 dark:border-white/10 bg-white dark:bg-card shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col isolate">
      {/* Decorative Background Orbs */}
      <div className="absolute top-0 right-0 -mt-16 -mr-16 w-48 h-48 bg-teal-100/50 dark:bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-48 h-48 bg-cyan-100/50 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 px-5 py-3.5 border-b border-teal-50 dark:border-white/5 bg-teal-50/30 dark:bg-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-teal-100 dark:bg-primary/20 shadow-[0_0_10px_rgba(20,184,166,0.3)] dark:shadow-[0_0_10px_rgba(var(--primary),0.5)]">
            <span className="absolute inset-0 animate-ping rounded-full bg-teal-400 dark:bg-primary/40"></span>
            <Activity className="h-3 w-3 text-teal-600 dark:text-primary animate-pulse" />
          </div>
          <span className="font-bold text-sm uppercase tracking-wider text-slate-800 dark:text-foreground">
            Live Tracking
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-muted-foreground font-medium bg-white/80 dark:bg-background/50 px-2.5 py-1 rounded-full border border-teal-100 dark:border-white/10 shadow-sm dark:shadow-inner">
            <RefreshCw className="h-3 w-3 animate-spin" style={{ animationDuration: '3s' }} />
            Auto-updating
          </div>
          {nextRun && (
            <Badge variant="secondary" className="font-semibold px-2.5 py-1 text-xs shadow-sm border-teal-100 bg-white text-teal-700 dark:border-white/10 dark:bg-secondary/80 dark:text-foreground backdrop-blur-sm">
              <Timer className="h-3.5 w-3.5 mr-1.5 text-teal-600 dark:text-primary" />
              Next: {formatDistanceToNow(new Date(nextRun.scheduled_at))}
            </Badge>
          )}
        </div>
      </div>

      {/* Big Stats Grid */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-teal-50 dark:divide-white/5 bg-white/40 dark:bg-card/40 backdrop-blur-sm">
        {/* Total Runs */}
        <div className="p-4 sm:p-5 flex flex-col justify-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-purple-500/0 group-hover:from-purple-500/5 group-hover:to-transparent transition-all duration-500" />
          <div className="relative flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-500/20 text-purple-600 ring-1 ring-purple-100 dark:ring-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.1)] dark:shadow-[0_0_15px_rgba(168,85,247,0.2)]">
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-muted-foreground group-hover:text-slate-700 dark:group-hover:text-foreground transition-colors">Total Runs</span>
          </div>
          <span className="relative text-3xl font-black text-slate-900 dark:text-foreground tabular-nums drop-shadow-sm">{totalRuns}</span>
        </div>

        {/* Completed */}
        <div className="p-4 sm:p-5 flex flex-col justify-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-emerald-500/0 group-hover:from-emerald-500/5 group-hover:to-transparent transition-all duration-500" />
          <div className="relative flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 ring-1 ring-emerald-100 dark:ring-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)] dark:shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-muted-foreground group-hover:text-slate-700 dark:group-hover:text-foreground transition-colors">Completed</span>
          </div>
          <span className="relative text-3xl font-black text-slate-900 dark:text-foreground tabular-nums drop-shadow-sm">{completedRuns}</span>
        </div>

        {/* In Progress */}
        <div className="p-4 sm:p-5 flex flex-col justify-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 to-cyan-500/0 group-hover:from-cyan-500/5 group-hover:to-transparent transition-all duration-500" />
          <div className="relative flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-500/20 text-cyan-600 ring-1 ring-cyan-100 dark:ring-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.1)] dark:shadow-[0_0_15px_rgba(6,182,212,0.2)]">
              <Play className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-muted-foreground group-hover:text-slate-700 dark:group-hover:text-foreground transition-colors">In Progress</span>
          </div>
          <span className="relative text-3xl font-black text-slate-900 dark:text-foreground tabular-nums drop-shadow-sm">{startedRuns}</span>
        </div>

        {/* Pending */}
        <div className="p-4 sm:p-5 flex flex-col justify-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 to-amber-500/0 group-hover:from-amber-500/5 group-hover:to-transparent transition-all duration-500" />
          <div className="relative flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/20 text-amber-600 ring-1 ring-amber-100 dark:ring-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)] dark:shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <Clock className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-muted-foreground group-hover:text-slate-700 dark:group-hover:text-foreground transition-colors">Pending</span>
          </div>
          <span className="relative text-3xl font-black text-slate-900 dark:text-foreground tabular-nums drop-shadow-sm">{pendingRuns}</span>
        </div>

        {/* Delivered */}
        <div className="p-4 sm:p-5 flex flex-col justify-center sm:col-span-1 col-span-2 relative overflow-hidden group bg-teal-50/30 dark:bg-transparent">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 dark:from-primary/10 to-transparent transition-all duration-500" />
          <div className="relative flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-teal-100 dark:bg-primary/20 text-teal-600 dark:text-primary ring-1 ring-teal-200 dark:ring-primary/30 shadow-[0_0_15px_rgba(20,184,166,0.2)] dark:shadow-[0_0_15px_rgba(var(--primary),0.3)]">
              <Zap className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs uppercase tracking-wider font-extrabold text-teal-700 dark:text-primary">Delivered</span>
          </div>
          <span className="relative text-3xl font-black text-slate-900 dark:text-foreground tabular-nums drop-shadow-md">
            {totalDelivered.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Overall Progress Bar */}
      <div className="relative z-10 p-5 border-t border-teal-50 dark:border-white/5 bg-white dark:bg-white/5 space-y-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 font-bold">
            <span className="text-slate-900 dark:text-foreground drop-shadow-sm">Overall Progress</span>
            <Badge variant="outline" className="font-mono text-xs border-teal-200 dark:border-white/20 bg-teal-50 dark:bg-background/50 text-teal-800 dark:text-foreground backdrop-blur-md">
              {totalDelivered.toLocaleString()} / {totalQuantity.toLocaleString()}
            </Badge>
          </div>
          <div className="font-black text-lg text-teal-600 dark:text-primary drop-shadow-sm">{progressPercent.toFixed(1)}%</div>
        </div>
        
        <div className="h-3 w-full bg-slate-100 dark:bg-background/50 rounded-full overflow-hidden shadow-inner border border-slate-200 dark:border-white/5 relative">
          <div className="absolute inset-0 bg-teal-100/50 dark:bg-secondary/30 rounded-full"></div>
          <div 
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-teal-400 to-teal-500 dark:from-primary/80 dark:to-primary rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(20,184,166,0.4)] dark:shadow-[0_0_10px_rgba(var(--primary),0.6)]"
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          >
            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.4)_50%,transparent_100%)] animate-[shimmer_2s_infinite] mix-blend-overlay"></div>
          </div>
        </div>
      </div>

      {/* Failed Runs Warning */}
      {failedRuns > 0 && (
        <div className="relative z-10 p-4 border-t border-red-100 dark:border-destructive/20 bg-gradient-to-r from-red-50 to-white dark:from-destructive/10 dark:to-destructive/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="text-red-600 dark:text-destructive bg-red-100 dark:bg-destructive/20 p-2.5 rounded-xl shadow-[0_0_15px_rgba(220,38,38,0.2)] dark:shadow-[0_0_15px_rgba(var(--destructive),0.3)] ring-1 ring-red-200 dark:ring-destructive/30">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-red-700 dark:text-destructive drop-shadow-sm">{failedRuns} runs failed</p>
              <p className="text-xs text-red-600/80 dark:text-destructive/80 font-medium">API key errors or provider failures. Update keys if necessary.</p>
            </div>
          </div>
          {onRetryFailed && (
            <Button 
              onClick={onRetryFailed} 
              disabled={isRetrying}
              size="sm"
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700 dark:bg-destructive dark:hover:bg-destructive/90 text-white dark:text-destructive-foreground font-bold shadow-lg shadow-red-500/20 dark:shadow-destructive/20 transition-all hover:scale-105 active:scale-95"
            >
              {isRetrying ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Retry Failed Runs
            </Button>
          )}
        </div>
      )}
    </div>
  );
}