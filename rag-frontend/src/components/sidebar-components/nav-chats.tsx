"use client";

import { Folder, MoreHorizontal, Share, Trash2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useChatsList } from "@/hooks/chats";
import { useParams, useRouter } from "next/navigation";
import { PATHS } from "@/constants/paths";

export function NavChats() {
  const { isMobile } = useSidebar();
  const params = useParams();
  const orgId = params.orgId as string;
  const router = useRouter();

  const { data, isLoading, isFetching, isError, refetch } = useChatsList();

  const chats = data?.data ?? [];

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>
        Chats
        {isFetching && !isLoading && (
          <span className="ml-2 text-xs text-muted-foreground">
            Updating...
          </span>
        )}
      </SidebarGroupLabel>

      <SidebarMenu>
        {isLoading && (
          <div className="px-2 py-4 text-sm text-muted-foreground">
            Loading chats...
          </div>
        )}

        {isError && !isLoading && (
          <div className="px-2 py-4 space-y-2">
            <p className="text-sm text-red-500">Failed to load chats.</p>
            <button
              onClick={() => refetch()}
              className="text-xs underline text-muted-foreground hover:text-foreground"
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && chats.length === 0 && (
          <div className="px-2 py-4 text-sm text-muted-foreground">
            No chats yet.
          </div>
        )}

        {!isLoading &&
          !isError &&
          chats.length > 0 &&
          chats.map((item) => (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton
                asChild
                onClick={() => router.replace(PATHS.pl.CHAT(orgId, item.id))}
                className="hover:cursor-pointer"
              >
                <span className="truncate">{item.title}</span>
              </SidebarMenuButton>

              <DropdownMenu>
                <DropdownMenuTrigger asChild className="bg-amber-50">
                  <SidebarMenuAction showOnHover>
                    <MoreHorizontal />
                    <span className="sr-only">More</span>
                  </SidebarMenuAction>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  className="w-48"
                  side={isMobile ? "bottom" : "right"}
                  align={isMobile ? "end" : "start"}
                >
                  <DropdownMenuItem>
                    <Folder className="text-muted-foreground" />
                    <span>View Project</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem>
                    <Share className="text-muted-foreground" />
                    <span>Share Project</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem>
                    <Trash2 className="text-muted-foreground" />
                    <span>Delete Project</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          ))}

        <SidebarMenuItem>
          <SidebarMenuButton>
            <MoreHorizontal />
            <span>More</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
