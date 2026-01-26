"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, MessageCircle, Zap, Activity } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  change: string;
  icon: React.ReactNode;
  trendUp?: boolean;
  borderColor: string;
}

function MetricCard({
  title,
  value,
  change,
  icon,
  trendUp = true,
  borderColor,
}: Readonly<MetricCardProps>) {
  return (
    <Card
      className={`flex flex-col overflow-hidden rounded-lg border-l-4 ${borderColor} hover:shadow-md transition-all p-6`}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="w-10 h-10 rounded-lg bg-linear-to-br p-3 flex items-center justify-center">
          <div className="w-5 h-5">{icon}</div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-3xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
          <span>{change}</span>
          {trendUp ? (
            <Activity className="w-3 h-3 text-emerald-500 animate-pulse" />
          ) : (
            <Activity className="w-3 h-3 rotate-180 text-destructive animate-pulse" />
          )}
        </p>
      </CardContent>
    </Card>
  );
}

export default function StatsCards() {
  const staticMetrics = [
    {
      title: "Total Users",
      value: "23",
      change: "+5% this week",
      icon: <Users className="h-5 w-5 text-blue-500" />,
      trendUp: true,
      borderColor: "border-l-blue-500",
    },
    {
      title: "Total Documents",
      value: "2,847",
      change: "+18% this week",
      icon: <FileText className="h-5 w-5 text-orange-500" />,
      trendUp: true,
      borderColor: "border-l-orange-500",
    },
    {
      title: "Total Chats",
      value: "47",
      change: "+12%",
      icon: <MessageCircle className="h-5 w-5 text-purple-500" />,
      trendUp: true,
      borderColor: "border-l-purple-500",
    },
    {
      title: "Total Queries",
      value: "1,247",
      icon: <Zap className="h-5 w-5 text-emerald-500" />,
      change: "+23%",
      trendUp: true,
      borderColor: "border-l-emerald-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {staticMetrics.map((metric, index) => (
        <MetricCard key={"metric" + index} {...metric} />
      ))}
    </div>
  );
}
