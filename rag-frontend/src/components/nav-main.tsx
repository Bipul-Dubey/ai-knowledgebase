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

const MENU_ITEMS = [
  {
    title: "Dashboard",
    url: "analytics",
    icon: ChartArea,
  },
  {
    title: "Documents",
    url: "documents",
    icon: BookOpen,
  },
  {
    title: "Users",
    url: "users",
    icon: Users2Icon,
  },
  {
    title: "Settings",
    url: "settings",
    icon: Settings2,
  },
];

export function NavMain() {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>

      <SidebarMenu>
        {MENU_ITEMS.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton asChild tooltip={item.title}>
              <Link
                href={item.url}
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
