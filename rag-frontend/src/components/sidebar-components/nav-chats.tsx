"use client";

import { MoreHorizontal, Trash2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { useChatsList, useDeleteConversation } from "@/hooks/chats";
import { useParams, useRouter } from "next/navigation";
import { PATHS } from "@/constants/paths";
import { useChatStore } from "@/providers/ChatStore";
import { cn } from "@/lib/utils";

export function NavChats() {
  const { isMobile } = useSidebar();
  const params = useParams();
  const orgId = params.orgId as string;
  const router = useRouter();

  const { data, isLoading, isFetching, isError, refetch } = useChatsList();
  const { mutate: deleteChat, isPending } = useDeleteConversation();
  const { clear, setChatId, cancelStream, chatId } = useChatStore();

  const chats = data?.data ?? [];

  const handleSelectChat = (chatId: string) => {
    cancelStream(); // stop ongoing streaming
    clear(); // clear previous messages
    setChatId(chatId); // set new chat id
    router.replace(PATHS.pl.CHAT(orgId, chatId));
  };

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
                onClick={() => handleSelectChat(item.id)}
                className={cn(
                  "cursor-pointer rounded-md transition-colors",
                  "hover:bg-gray-200/75",
                  chatId === item.id &&
                    "bg-gray-200 text-accent-foreground font-medium",
                )}
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
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChat(item.id);
                    }}
                    disabled={isPending}
                  >
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
