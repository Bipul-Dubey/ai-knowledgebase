import StatsCards from "@/components/analytics/StatsCards";
import { TrendChart } from "@/components/analytics/TrendChart";
import { Building2 } from "lucide-react";
import React from "react";

const AnalyticsPage = () => {
  // Static data for demo
  const currentOrg = { id: "org_1", name: "Acme Corp" };
  const currentUser = { name: "Bipul Dubey", role: "Admin" };

  return (
    <div className="flex flex-col bg-background">
      {/* Org Header */}
      <div className="border-b bg-card/50">
        <div className=" mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Org Info */}
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  {currentOrg.name}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Dashboard • {currentUser.name} ({currentUser.role})
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex items-center space-x-4 text-sm bg-muted/50 px-6 py-3 rounded-xl flex-1 xl:flex-none">
              <span>47 chats</span>
              <span>•</span>
              <span>1.2k messages</span>
              <span>•</span>
              <span>23 active users</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Full Width */}
      <main className="flex-1 px-6 py-12 space-y-8">
        <StatsCards />

        <TrendChart />
      </main>
    </div>
  );
};

export default AnalyticsPage;
