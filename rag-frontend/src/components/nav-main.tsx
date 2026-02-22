"use client";

import {
  BookOpen,
  ChartArea,
  ChevronRight,
  Settings2,
  Users2Icon,
} from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { PATHS } from "@/constants/paths";
import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const MENU_ITEMS = [
  {
    title: "Dashboard",
    url: PATHS.pl.ANALYTICS,
    icon: ChartArea,
  },
  {
    title: "Documents",
    url: PATHS.pl.DOCUMENTS,
    icon: BookOpen,
  },
  {
    title: "Users",
    url: PATHS.pl.USERS,
    icon: Users2Icon,
  },
  {
    title: "Settings",
    url: PATHS.pl.SETTINGS,
    icon: Settings2,
  },
];

export function NavMain() {
  const params: { orgId: string } = useParams();
  const { isMember } = useAuth();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>

      <SidebarMenu>
        {MENU_ITEMS?.filter(
          (item) => !(isMember && ["Users", "Settings"].includes(item.title)),
        ).map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton asChild tooltip={item.title}>
              <Link
                href={item.url.replace(":orgId", params.orgId)}
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-2">
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </div>

                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
