"use client";

import StatsCards from "@/components/analytics/StatsCards";
import { TrendChart } from "@/components/analytics/TrendChart";
import { useDashboardStats } from "@/hooks/orgs_user";
import { Building2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";

const AnalyticsPage = () => {
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } =
    useDashboardStats();

  const lastUpdated = useMemo(() => {
    if (!dataUpdatedAt) return null;
    return new Date(dataUpdatedAt).toLocaleString();
  }, [dataUpdatedAt]);

  if (isLoading) {
    return (
      <div className="p-10 text-sm text-muted-foreground">
        Loading dashboard...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-10 text-sm text-red-500">
        Failed to load dashboard data.
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-background min-h-screen">
      {/* Org Header */}
      <div className="border-b bg-card/50">
        <div className="px-6 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Left: Org Info */}
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary" />
              </div>

              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  {data.organization_name}
                </h1>

                <p className="text-sm text-muted-foreground">
                  Dashboard • {data.user_name} (
                  <span className="uppercase">{data.user_role}</span>)
                </p>
              </div>
            </div>

            {/* Right: Last Updated + Refresh */}
            <div className="flex items-center gap-4">
              {lastUpdated && (
                <span className="text-xs text-muted-foreground">
                  Last updated: {lastUpdated}
                </span>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="flex items-center gap-2"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 px-6 py-10 space-y-8">
        <StatsCards />
        <TrendChart />
      </main>
    </div>
  );
};

export default AnalyticsPage;
