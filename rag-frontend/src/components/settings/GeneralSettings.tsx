"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTime } from "@/lib/utils";

export default function GeneralSettings() {
  const { organization } = useAuth();

  if (!organization) return null;

  const {
    name,
    account_id,
    status,
    created_at,
    total_users = 0,
    total_maintainers = 0,
    total_members = 0,
    owner_email,
  } = organization;

  return (
    <div className="space-y-8">
      {/* Main Card */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Organization</CardTitle>
          <CardDescription>
            Overview of your organization settings and members
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* Top Info Grid */}
          <div className="grid gap-6 md:grid-cols-2">
            <InfoItem label="Organization Name" value={name} />
            <InfoItem label="Account ID" value={account_id} />
            <InfoItem
              label="Status"
              value={
                <Badge className="uppercase" variant={getStatusVariant(status)}>
                  {status}
                </Badge>
              }
            />
            <InfoItem label="Owner Email" value={owner_email ?? "—"} />
            <InfoItem label="Created At" value={formatDateTime(created_at)} />
          </div>

          <Separator />

          {/* Member Statistics */}
          <div>
            <p className="text-sm font-medium mb-4 text-muted-foreground">
              Member Overview
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Total Users" value={total_users} />
              <StatCard label="Maintainers" value={total_maintainers} />
              <StatCard label="Members" value={total_members} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Small Components ---------- */

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium mt-1">{value}</div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}

function getStatusVariant(status?: string) {
  switch (status?.toLowerCase()) {
    case "active":
      return "success";
    case "pending":
      return "secondary";
    case "inactive":
    case "suspended":
      return "destructive";
    default:
      return "outline";
  }
}
