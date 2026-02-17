"use client";

import { MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { IUser } from "@/types/apis";

interface Props {
  status: IUser["status"];
  onResend: () => void;
  onRemove: () => void;
}

export default function UserActionsDropdown({
  status,
  onResend,
  onRemove,
}: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {status === "pending" && (
          <DropdownMenuItem onClick={onResend}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Resend Invite
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onClick={onRemove} className="text-destructive">
          <Trash2 className="w-4 h-4 mr-2" />
          Remove User
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
