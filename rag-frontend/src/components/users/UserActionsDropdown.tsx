"use client";

import { useState } from "react";
import { MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { IUser } from "@/types/apis";
import { useDeleteUser, useResendInvite } from "@/hooks/orgs_user";

interface Props {
  user: IUser;
}

export default function UserActionsDropdown({ user }: Props) {
  const [openConfirm, setOpenConfirm] = useState(false);

  const { mutate: deleteUser, isPending: isDeleting } = useDeleteUser();
  const { mutate: resendInvite, isPending: isResending } = useResendInvite();

  const handleConfirmDelete = () => {
    deleteUser(user.id, {
      onSuccess: () => setOpenConfirm(false),
    });
  };

  return (
    <>
      {/* Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          {user.status === "pending" && (
            <DropdownMenuItem
              onClick={() => resendInvite(user.id)}
              disabled={isResending}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              {isResending ? "Resending..." : "Resend Invite"}
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            onClick={() => setOpenConfirm(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Remove User
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirmation Modal */}
      <AlertDialog open={openConfirm} onOpenChange={setOpenConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User?</AlertDialogTitle>

            <AlertDialogDescription>
              This action cannot be undone.
              <br />
              Are you sure you want to remove{" "}
              <span className="font-semibold">{user.name}</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>

            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? "Removing..." : "Remove User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
