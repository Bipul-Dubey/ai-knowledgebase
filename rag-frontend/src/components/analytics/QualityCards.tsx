"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardStats } from "@/hooks/orgs_user";
import { formatFileSize } from "@/lib/utils";
import { Database, HardDrive, Target, UserCheck } from "lucide-react";

interface InsightCardProps {
  title: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  borderColor: string;
}

function InsightCard({
  title,
  value,
  hint,
  icon,
  borderColor,
}: Readonly<InsightCardProps>) {
  return (
    <Card
      className={`rounded-lg border-l-4 ${borderColor} hover:shadow-sm transition-all px-5 py-4`}
    >
      <CardHeader className="flex flex-row items-center justify-between p-0 mb-2">
        <CardTitle className="text-sm md:text-base font-medium text-muted-foreground">
          {title}
        </CardTitle>

        <div className="w-8 h-8 rounded-md bg-muted/40 flex items-center justify-center">
          {icon}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="text-2xl font-semibold leading-none">{value}</div>
        <div className="text-xs md:text-sm text-muted-foreground mt-1">
          {hint}
        </div>
      </CardContent>
    </Card>
  );
}

export default function QualityCards() {
  const { data, isLoading, isError } = useDashboardStats();

  if (isLoading || isError || !data) return null;

  const totalAnswers = data.answered_queries + data.unanswered_queries;

  const cards: InsightCardProps[] = [
    {
      title: "Answer rate",
      // No answers yet reads better than 0%, which looks like a failure.
      value: totalAnswers === 0 ? "--" : `${data.answer_rate.toFixed(0)}%`,
      hint:
        totalAnswers === 0
          ? "No questions asked yet"
          : `${data.unanswered_queries.toLocaleString()} of ${totalAnswers.toLocaleString()} unanswered`,
      icon: <Target className="w-4 h-4 text-muted-foreground" />,
      borderColor: "border-l-emerald-500",
    },
    {
      title: "Indexed content",
      value: data.total_chunks.toLocaleString(),
      hint: `chunks across ${data.indexed_pages.toLocaleString()} pages`,
      icon: <Database className="w-4 h-4 text-muted-foreground" />,
      borderColor: "border-l-sky-500",
    },
    {
      title: "Storage used",
      value: formatFileSize(data.storage_bytes),
      hint: `${data.active_documents.toLocaleString()} documents stored`,
      icon: <HardDrive className="w-4 h-4 text-muted-foreground" />,
      borderColor: "border-l-violet-500",
    },
    {
      title: "Active users",
      value: data.active_users_30d.toLocaleString(),
      hint: `asked something in 30d, of ${data.active_users.toLocaleString()} seats`,
      icon: <UserCheck className="w-4 h-4 text-muted-foreground" />,
      borderColor: "border-l-amber-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <InsightCard key={card.title} {...card} />
      ))}
    </div>
  );
}
