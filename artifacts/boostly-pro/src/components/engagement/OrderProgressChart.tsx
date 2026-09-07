import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { format } from "date-fns";
import { Activity, TrendingUp, Clock, CheckCircle2 } from "lucide-react";

// Local EngagementType to avoid importing from non-existent paths
type EngagementType = 'views' | 'likes' | 'comments' | 'saves' | 'shares' | 'followers' | 'subscribers' | 'watch_hours' | 'retweets' | 'reposts';

const ENGAGEMENT_CONFIG: Record<string, { label: string }> = {
  views: { label: "Views" },
  likes: { label: "Likes" },
  comments: { label: "Comments" },
  saves: { label: "Saves" },
  shares: { label: "Shares" },
  followers: { label: "Followers" },
  subscribers: { label: "Subscribers" },
  watch_hours: { label: "Watch Hours" },
  retweets: { label: "Retweets" },
  reposts: { label: "Reposts" },
};

const TYPE_COLORS: Record<string, string> = {
  views: '#3b82f6',     // blue-500
  likes: '#10b981',     // emerald-500
  comments: '#10b981',  // emerald-500
  saves: '#f59e0b',     // amber-500
  shares: '#6366f1',    // indigo-500
  reposts: '#a855f7',   // purple-500
  retweets: '#0ea5e9',  // sky-500
  followers: '#14b8a6', // teal-500
  subscribers: '#ef4444',// red-500
  watch_hours: '#f97316',// orange-500
};

interface Run {
  id: string;
  run_number: number;
  scheduled_at: string;
  quantity_to_send: number;
  status: string;
  engagement_type: string;
  started_at?: string;
  completed_at?: string;
  provider_remains?: number;
  provider_order_id?: string | null;
  error_message?: string | null;
}

interface OrderProgressChartProps {
  runs: Run[];
  perType: { type: string; target: number; delivered: number; scheduled?: number }[];
}

export function OrderProgressChart({ runs = [], perType = [] }: OrderProgressChartProps) {
  const chartData = useMemo(() => {
    if (!runs.length) return [];

    const sortedRuns = [...runs].sort(
      (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    );

    const dataPoints: Record<string, any> = {};
    const cumulative: Record<string, number> = {};

    sortedRuns.forEach((run) => {
      const date = new Date(run.scheduled_at);
      const timeKey = format(date, "MMM d, HH:mm");
      const type = run.engagement_type;

      if (!cumulative[type]) cumulative[type] = 0;

      const isDelivered = run.status === 'completed' || (run.status === 'cancelled' && run.error_message?.toLowerCase().includes('target met'));
      
      let deliveredAmount = 0;
      if (isDelivered) {
        deliveredAmount = run.quantity_to_send;
      } else if ((run.status === 'started' || run.status === 'failed') && run.provider_remains !== undefined && run.provider_remains !== null) {
        deliveredAmount = Math.max(0, run.quantity_to_send - run.provider_remains);
      }

      if (deliveredAmount > 0) {
        cumulative[type] += deliveredAmount;
      }

      if (!dataPoints[timeKey]) {
        dataPoints[timeKey] = {
          time: timeKey,
          timestamp: date.getTime(),
          ...cumulative
        };
      } else {
        dataPoints[timeKey] = {
          ...dataPoints[timeKey],
          [type]: cumulative[type]
        };
      }
    });

    const types = Array.from(new Set(runs.map(r => r.engagement_type)));
    let lastKnown: Record<string, number> = {};

    return Object.values(dataPoints)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(point => {
        const fullPoint = { ...point };
        types.forEach(type => {
          if (fullPoint[type] === undefined) {
            fullPoint[type] = lastKnown[type] || 0;
          } else {
            lastKnown[type] = fullPoint[type];
          }
        });
        return fullPoint;
      });
  }, [runs]);

  const activeTypes = useMemo(() => {
    return Array.from(new Set(runs.map(r => r.engagement_type)));
  }, [runs]);

  if (!runs.length) return null;

  return (
    <Card className="rounded-2xl border border-teal-100 dark:border-white/10 bg-white dark:bg-card shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
      <CardHeader className="border-b border-teal-50 dark:border-white/5 bg-teal-50/30 dark:bg-white/5 px-5 py-4 flex flex-row items-center justify-between gap-4 flex-wrap backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-teal-100 dark:bg-primary/20 ring-1 ring-teal-200 dark:ring-primary/30 shadow-inner">
            <TrendingUp className="h-4 w-4 text-teal-600 dark:text-primary" />
          </div>
          <CardTitle className="text-base font-bold text-slate-900 dark:text-foreground">Delivery Trajectory</CardTitle>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {activeTypes.map(type => {
            const config = ENGAGEMENT_CONFIG[type];
            const typeStats = perType.find(t => t.type === type);
            const delivered = typeStats?.delivered || 0;
            const scheduled = Math.max(typeStats?.target || 0, typeStats?.scheduled || 0);
            const percent = scheduled > 0 ? ((delivered / scheduled) * 100).toFixed(0) : '0';
            const color = TYPE_COLORS[type] || '#888';
            return (
              <div 
                key={type}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white dark:bg-background/50 border border-slate-200 dark:border-white/10 shadow-sm"
              >
                <div 
                  className="w-2 h-2 rounded-full shadow-inner" 
                  style={{ backgroundColor: color }}
                />
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-600 dark:text-muted-foreground">{config?.label || type}</span>
                <span className="text-[11px] font-black text-slate-900 dark:text-foreground tabular-nums ml-1">
                  {delivered.toLocaleString()}/{scheduled.toLocaleString()}
                </span>
                <span className="text-[10px] font-bold text-teal-600 dark:text-primary">({percent}%)</span>
              </div>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[300px] w-full p-4 bg-white/40 dark:bg-transparent">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-border/50" />
              <XAxis 
                dataKey="time" 
                tick={{ fontSize: 11, fontWeight: 600, fill: 'currentColor' }} 
                className="text-slate-400 dark:text-muted-foreground"
                tickMargin={10}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 11, fontWeight: 600, fill: 'currentColor' }} 
                className="text-slate-400 dark:text-muted-foreground"
                tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-card/95 p-3 shadow-xl backdrop-blur-xl">
                        <p className="mb-2 text-xs font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 dark:border-border/50 pb-2">
                          <Clock className="h-3 w-3" />
                          {label}
                        </p>
                        <div className="space-y-1.5">
                          {payload.filter(p => p.value && (p.value as number) > 0).map((entry, index) => {
                            const type = entry.dataKey as string;
                            const config = ENGAGEMENT_CONFIG[type];
                            return (
                              <div key={index} className="flex items-center justify-between gap-4 text-xs font-bold">
                                <div className="flex items-center gap-1.5">
                                  <div 
                                    className="w-2 h-2 rounded-full shadow-inner" 
                                    style={{ backgroundColor: TYPE_COLORS[type] || '#888' }}
                                  />
                                  <span className="uppercase tracking-wider text-slate-700 dark:text-foreground">{config?.label || type}</span>
                                </div>
                                <span className="tabular-nums text-slate-900 dark:text-foreground">{(entry.value as number).toLocaleString()}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {activeTypes.map((type) => (
                <Line
                  key={type}
                  type="monotone"
                  dataKey={type}
                  stroke={TYPE_COLORS[type] || '#888'}
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0, fill: TYPE_COLORS[type] || '#888' }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}