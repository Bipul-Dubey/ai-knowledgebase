import { AppSidebar } from "@/components/common/AppSidebar";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default function Page({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1 group-data-[state=expanded]/sidebar-wrapper:hidden" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4 group-data-[state=expanded]/sidebar-wrapper:hidden"
            />
            <span className="text-xl font-bold tracking-tight leading-none">
              Your<span className="font-extrabold">Docs</span>
            </span>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
