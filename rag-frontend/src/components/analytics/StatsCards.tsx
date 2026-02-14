"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardStats } from "@/hooks/orgs_user";
import { Users, FileText, MessageCircle, Zap } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  borderColor: string;
}

function MetricCard({
  title,
  value,
  icon,
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
      </CardContent>
    </Card>
  );
}

export default function StatsCards() {
  const { data, isLoading, isError } = useDashboardStats();
  console.log("data:", data);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="h-30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <div className="text-red-500">Failed to load dashboard stats</div>;
  }

  const metrics = [
    {
      title: "Total Users",
      value: data?.total_users?.toLocaleString() ?? 0,
      icon: <Users className="h-5 w-5 text-blue-500" />,
      borderColor: "border-l-blue-500",
    },
    {
      title: "Total Documents",
      value: data?.total_documents?.toLocaleString() ?? 0,
      icon: <FileText className="h-5 w-5 text-orange-500" />,
      borderColor: "border-l-orange-500",
    },
    {
      title: "Total Chats",
      value: data?.total_chats?.toLocaleString() ?? 0,
      icon: <MessageCircle className="h-5 w-5 text-purple-500" />,
      borderColor: "border-l-purple-500",
    },
    {
      title: "Total Queries",
      value: data?.total_queries?.toLocaleString() ?? 0,
      icon: <Zap className="h-5 w-5 text-emerald-500" />,
      borderColor: "border-l-emerald-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {metrics.map((metric, index) => (
        <MetricCard key={`metric-${index}`} {...metric} />
      ))}
    </div>
  );
}
