"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardStats } from "@/hooks/orgs_user";
import { Users, FileText, MessageCircle, Zap } from "lucide-react";

interface MetricCardProps {
  title: string;
  active: number;
  total: number;
  icon: React.ReactNode;
  borderColor: string;
}

function MetricCard({
  title,
  active,
  total,
  icon,
  borderColor,
}: Readonly<MetricCardProps>) {
  return (
    <Card
      className={`rounded-lg border-l-4 ${borderColor} hover:shadow-sm transition-all px-5 py-4`}
    >
      <CardHeader className="flex flex-row items-center justify-between p-0 mb-2">
        <CardTitle className="text-sm md:text-xl font-medium text-muted-foreground">
          Active {title}
        </CardTitle>

        <div className="w-8 h-8 rounded-md bg-muted/40 flex items-center justify-center">
          {icon}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="text-2xl font-semibold leading-none">
          {active.toLocaleString()}
        </div>

        <div className="text-xs md:text-sm text-muted-foreground mt-1">
          Total till now: {total.toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}

export default function StatsCards() {
  const { data, isLoading, isError } = useDashboardStats();

  const metrics = useMemo(() => {
    if (!data) return [];

    return [
      {
        title: "Users",
        active: data.active_users ?? 0,
        total: data.total_users ?? 0,
        icon: <Users className="h-4 w-4 text-blue-500" />,
        borderColor: "border-l-blue-500",
      },
      {
        title: "Documents",
        active: data.active_documents ?? 0,
        total: data.total_documents ?? 0,
        icon: <FileText className="h-4 w-4 text-orange-500" />,
        borderColor: "border-l-orange-500",
      },
      {
        title: "Chats",
        active: data.active_chats ?? 0,
        total: data.total_chats ?? 0,
        icon: <MessageCircle className="h-4 w-4 text-purple-500" />,
        borderColor: "border-l-purple-500",
      },
      {
        title: "Queries",
        active: data.total_queries ?? 0,
        total: data.total_messages ?? 0,
        icon: <Zap className="h-4 w-4 text-emerald-500" />,
        borderColor: "border-l-emerald-500",
      },
    ];
  }, [data]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return <div className="text-red-500 text-sm">Failed to load stats</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, index) => (
        <MetricCard key={`metric-${index}`} {...metric} />
      ))}
    </div>
  );
}
