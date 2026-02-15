"use client";

import * as React from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

import { useDashboardStats } from "@/hooks/orgs_user";
import { DailyActivity } from "@/types/apis";

type ChartKey = "chats" | "messages";

interface ChartDataItem {
  date: string;
  chats: number;
  messages: number;
}

const chartConfig: ChartConfig = {
  views: {
    label: "Activity",
  },
  chats: {
    label: "Chats",
    color: "var(--chart-1)",
  },
  messages: {
    label: "Messages",
    color: "var(--chart-2)",
  },
};

export function TrendChart() {
  const { data, isLoading } = useDashboardStats();

  const [activeChart, setActiveChart] = React.useState<ChartKey>("chats");

  const chartData: ChartDataItem[] = React.useMemo(() => {
    if (!data?.last_30_days) return [];

    return data.last_30_days.map((item: DailyActivity) => ({
      date: item.date,
      chats: item.total_chats ?? 0,
      messages: item.total_messages ?? 0,
    }));
  }, [data]);

  const total: Record<ChartKey, number> = React.useMemo(
    () => ({
      chats: chartData.reduce((acc, curr) => acc + curr.chats, 0),
      messages: chartData.reduce((acc, curr) => acc + curr.messages, 0),
    }),
    [chartData],
  );

  const maxValue = React.useMemo(() => {
    if (!chartData.length) return 10;

    const max = Math.max(...chartData.map((item) => item[activeChart] ?? 0));

    if (max === 0) return 10;

    const padded = max * 1.1;

    const magnitude = Math.pow(10, Math.floor(Math.log10(padded)));

    const rounded = Math.ceil(padded / magnitude) * magnitude;

    return rounded;
  }, [chartData, activeChart]);

  return (
    <Card className="py-4 sm:py-0">
      <CardHeader className="flex flex-col items-stretch border-b p-0! sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 pb-3 sm:pb-0">
          <CardTitle>Chat Activity - Interactive</CardTitle>
          <CardDescription>Showing total chats and messages</CardDescription>
        </div>

        <div className="flex">
          {(["chats", "messages"] as ChartKey[]).map((chart) => (
            <button
              key={chart}
              data-active={activeChart === chart}
              className="data-[active=true]:bg-muted/50 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l sm:border-t-0 sm:border-l sm:px-8 sm:py-6"
              onClick={() => setActiveChart(chart)}
            >
              <span className="text-muted-foreground text-xs">
                {chartConfig[chart].label}
              </span>

              <span className="text-lg leading-none font-bold sm:text-3xl">
                {isLoading ? "..." : total[chart].toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="px-2 sm:p-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-62.5 w-full"
        >
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{ left: 12, right: 12 }}
          >
            <CartesianGrid vertical={false} />

            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) =>
                new Date(value).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }
            />

            <YAxis domain={[0, maxValue]} tickLine={false} axisLine={false} />

            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-37.5"
                  nameKey="views"
                  labelFormatter={(value) =>
                    new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  }
                />
              }
            />

            <Line
              dataKey={activeChart}
              type="monotone"
              stroke={`var(--color-${activeChart})`}
              strokeWidth={2}
              dot={false}
              isAnimationActive
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
