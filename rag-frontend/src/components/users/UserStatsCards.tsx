"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserStats } from "@/hooks/orgs_user";
import { Activity, MessageSquare, ShieldCheck, Users } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  borderColor: string;
}

function StatCard({
  title,
  value,
  hint,
  icon,
  borderColor,
}: Readonly<StatCardProps>) {
  return (
    <Card
      className={`rounded-lg border-l-4 ${borderColor} px-5 py-4 transition-all hover:shadow-sm`}
    >
      <CardHeader className="mb-2 flex flex-row items-center justify-between p-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="flex size-8 items-center justify-center rounded-md bg-muted/40">
          {icon}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="text-2xl font-semibold leading-none">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  );
}

export default function UserStatsCards() {
  const { data: stats, isLoading, isError } = useUserStats();

  if (isLoading || isError || !stats) return null;

  const cards: StatCardProps[] = [
    {
      title: "Total users",
      value: stats.total_users.toLocaleString(),
      hint: `${stats.active} active, ${stats.pending} pending, ${stats.suspended} suspended`,
      icon: <Users className="size-4 text-muted-foreground" />,
      borderColor: "border-l-sky-500",
    },
    {
      title: "By role",
      value: `${stats.maintainers + stats.owners}`,
      hint: `${stats.owners} owner, ${stats.maintainers} maintainer, ${stats.members} member`,
      icon: <ShieldCheck className="size-4 text-muted-foreground" />,
      borderColor: "border-l-violet-500",
    },
    {
      title: "Active this week",
      value: stats.active_users_7d.toLocaleString(),
      hint:
        stats.total_users > 0
          ? `of ${stats.total_users} asked something in 7 days`
          : "nobody has asked anything yet",
      icon: <Activity className="size-4 text-muted-foreground" />,
      borderColor: "border-l-emerald-500",
    },
    {
      title: "Queries per user",
      value: stats.avg_queries_per_user.toFixed(1),
      hint: `${stats.total_queries.toLocaleString()} questions asked in total`,
      icon: <MessageSquare className="size-4 text-muted-foreground" />,
      borderColor: "border-l-amber-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <StatCard key={card.title} {...card} />
      ))}
    </div>
  );
}
