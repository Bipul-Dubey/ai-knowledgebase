"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function GeneralSettings() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Organization Info */}
      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Basic organization details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              value="Acme Corp"
              className="max-w-sm"
              onChange={(e) => console.log("e:", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium">Created</Label>
            <p className="text-sm text-muted-foreground">January 15, 2026</p>
          </div>
        </CardContent>
      </Card>

      {/* User Info */}
      <Card>
        <CardHeader>
          <CardTitle>User Account</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value="bipul_dubey"
              className="max-w-sm"
              onChange={(e) => console.log("e:", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium">Role</Label>
            <Badge className="bg-emerald-500 hover:bg-emerald-600">Owner</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
