"use client";

import ProfileImageUpload from "@/components/profile/ProfileImageUpload";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { UserPlus } from "lucide-react";

export default function ProfilePage() {
  const { user, organization } = useAuth();

  if (!user) return null;

  return (
    <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center space-x-4">
        <div className="w-12 h-12 bg-orange-500/10 dark:bg-orange-500/20 rounded-xl flex items-center justify-center">
          <UserPlus className="w-6 h-6 text-orange-500" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        </div>
      </div>
      {/* ================= HEADER (Hero Style) ================= */}
      <Card className="overflow-hidden border bg-background shadow-sm py-0">
        <div className="bg-linear-to-r from-muted/40 via-muted/20 to-transparent px-6 py-10">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            <ProfileImageUpload
              imageUrl={user.profile_image_url}
              name={user.name}
            />

            <div className="text-center md:text-left space-y-2">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                {user.name}
              </h1>

              <p className="text-muted-foreground text-sm sm:text-base break-all">
                {user.email}
              </p>

              <Badge
                className="mt-3 capitalize px-3 py-1 text-xs font-medium"
                variant="secondary"
              >
                {user.role}
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* ================= ACCOUNT INFORMATION ================= */}
      <Card className="border bg-background shadow-sm">
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your personal account details</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-12">
            <InfoItem label="Full Name" value={user.name} />
            <InfoItem label="Email Address" value={user.email} />
            <InfoItem label="Role" value={user.role} />
            <InfoItem
              label="Account Created"
              value={formatDateTime(user.created_at)}
            />
          </div>
        </CardContent>
      </Card>

      {/* ================= ORGANIZATION ================= */}
      {organization && (
        <Card className="border bg-background shadow-sm">
          <CardHeader>
            <CardTitle>Organization</CardTitle>
            <CardDescription>
              Your organization membership details
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-12">
              <InfoItem label="Organization Name" value={organization.name} />

              <InfoItem label="Account ID" value={organization.account_id} />

              <InfoItem
                label="Organization Status"
                value={
                  <Badge className="capitalize" variant="outline">
                    {organization.status}
                  </Badge>
                }
              />

              <InfoItem
                label="Joined At"
                value={formatDateTime(organization.created_at)}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ================= Reusable Info Item ================= */

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="text-sm sm:text-base font-medium wrap-break-word">
        {value ?? "—"}
      </div>
    </div>
  );
}
