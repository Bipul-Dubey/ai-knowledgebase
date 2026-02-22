"use client";

import * as React from "react";

import { NavMain } from "@/components/nav-main";
import { NavChats } from "@/components/sidebar-components/nav-chats";
import { NavUser } from "@/components/sidebar-components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import Image from "next/image";
import { Plus } from "lucide-react";
import { LinkButton } from "../ui/link-button";
import { PATHS } from "@/constants/paths";
import { useParams } from "next/navigation";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const params = useParams();

  const orgId = params.orgId as string;
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div>
              <div className="flex items-center gap-2 justify-between">
                <div className="relative h-9 w-9">
                  <Image
                    src="/images/logos.png"
                    alt="KnowDocs Logo"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>

                <SidebarTrigger className="-ml-1" />
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain />
        <LinkButton className="mx-2" href={PATHS.pl.NEW_CHAT(orgId)}>
          New Chat <Plus />
        </LinkButton>
        <NavChats />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
