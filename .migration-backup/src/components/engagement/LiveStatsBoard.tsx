import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Timer, CheckCircle2, Play, Clock, AlertTriangle, RefreshCw, TrendingUp, RotateCcw, Loader2 } from "lucide-react";
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
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center w-2 h-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/60"></span>
            <span className="relative h-1.5 w-1.5 rounded-full bg-primary"></span>
          </div>
          <span className="font-semibold text-sm uppercase tracking-wide text-foreground">Live Tracking</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: '4s' }} />
            Auto-updating
          </div>
          {nextRun && (
            <Badge variant="secondary" className="font-medium px-2 py-0.5 text-xs">
              <Timer className="h-3.5 w-3.5 mr-1.5" />
              Next: {formatDistanceToNow(new Date(nextRun.scheduled_at))}
            </Badge>
          )}
        </div>
      </div>

      {/* Big Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-border">
        {/* Total Runs */}
        <div className="p-4 sm:p-5 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider font-semibold">Total Runs</span>
          </div>
          <span className="text-3xl font-bold text-foreground tabular-nums">{totalRuns}</span>
        </div>

        {/* Completed */}
        <div className="p-4 sm:p-5 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider font-semibold">Completed</span>
          </div>
          <span className="text-3xl font-bold text-foreground tabular-nums">{completedRuns}</span>
        </div>

        {/* In Progress */}
        <div className="p-4 sm:p-5 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <Play className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider font-semibold">In Progress</span>
          </div>
          <span className="text-3xl font-bold text-foreground tabular-nums">{startedRuns}</span>
        </div>

        {/* Pending */}
        <div className="p-4 sm:p-5 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider font-semibold">Pending</span>
          </div>
          <span className="text-3xl font-bold text-foreground tabular-nums">{pendingRuns}</span>
        </div>

        {/* Delivered */}
        <div className="p-4 sm:p-5 flex flex-col justify-center sm:col-span-1 col-span-2 bg-muted/10">
          <div className="flex items-center gap-2 mb-2 text-primary">
            <Zap className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider font-bold">Delivered</span>
          </div>
          <span className="text-3xl font-bold text-foreground tabular-nums">
            {totalDelivered.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Overall Progress Bar */}
      <div className="p-4 sm:p-5 border-t border-border bg-muted/10 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 font-medium">
            <span className="text-foreground">Overall Progress</span>
            <span className="text-muted-foreground">
              ({totalDelivered.toLocaleString()} / {totalQuantity.toLocaleString()})
            </span>
          </div>
          <div className="font-bold text-foreground">{progressPercent.toFixed(1)}%</div>
        </div>
        
        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Failed Runs Warning */}
      {failedRuns > 0 && (
        <div className="p-4 border-t border-destructive/20 bg-destructive/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="text-destructive bg-destructive/10 p-2 rounded-md">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-destructive">{failedRuns} runs failed</p>
              <p className="text-xs text-destructive/80">API key errors or provider failures. Update keys if necessary.</p>
            </div>
          </div>
          {onRetryFailed && (
            <Button 
              onClick={onRetryFailed} 
              disabled={isRetrying}
              variant="outline"
              size="sm"
              className="w-full sm:w-auto border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              {isRetrying ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Retry Failed
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
