"use client";

import { useState } from "react";
import { Ban, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import {
  useDeleteUser,
  useResendInvite,
  useSuspendUser,
} from "@/hooks/orgs_user";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  user: IUser;
}

type PendingAction = "suspend" | "remove" | null;

export default function UserActionsDropdown({ user }: Props) {
  // One dialog driven by which action was chosen, rather than a separate
  // dialog and open-flag per action.
  const [action, setAction] = useState<PendingAction>(null);

  const { isAdmin } = useAuth();

  const { mutate: suspendUser, isPending: isSuspending } = useSuspendUser();
  const { mutate: removeUser, isPending: isRemoving } = useDeleteUser();
  const { mutate: resendInvite, isPending: isResending } = useResendInvite();

  const isWorking = isSuspending || isRemoving;

  const confirm = () => {
    const onSuccess = () => setAction(null);

    if (action === "suspend") suspendUser(user.id, { onSuccess });
    if (action === "remove") removeUser(user.id, { onSuccess });
  };

  const copy =
    action === "remove"
      ? {
          title: `Remove ${user.name}?`,
          body: "They lose access immediately and disappear from this list. Their chats and uploaded documents are kept.",
          cta: isRemoving ? "Removing..." : "Remove user",
        }
      : {
          title: `Suspend ${user.name}?`,
          body: "They will lose access immediately. You can reactivate them later from this menu.",
          cta: isSuspending ? "Suspending..." : "Suspend user",
        };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" aria-label={`Actions for ${user.name}`}>
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          {/* One endpoint covers both: it accepts pending or suspended users
              and moves a suspended one back to pending. Without the suspended
              case a suspended user had no action at all. */}
          {(user.status === "pending" || user.status === "suspended") && (
            <DropdownMenuItem
              onClick={() => resendInvite(user.id)}
              disabled={isResending}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              {isResending
                ? "Sending..."
                : user.status === "suspended"
                  ? "Reactivate user"
                  : "Resend invite"}
            </DropdownMenuItem>
          )}

          {user.status !== "suspended" && (
            <DropdownMenuItem
              onClick={() => setAction("suspend")}
              className="text-destructive focus:text-destructive"
            >
              <Ban className="w-4 h-4 mr-2" />
              Suspend user
            </DropdownMenuItem>
          )}

          {/* Owner only: removal is the one action with no way back. */}
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setAction("remove")}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove user
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={action !== null}
        onOpenChange={(open) => !open && setAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.title}</AlertDialogTitle>
            <AlertDialogDescription>{copy.body}</AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isWorking}>Cancel</AlertDialogCancel>

            <AlertDialogAction
              onClick={(e) => {
                // Keep the dialog up while the request is in flight, so the
                // row cannot be acted on twice.
                e.preventDefault();
                confirm();
              }}
              disabled={isWorking}
              className="bg-destructive hover:bg-destructive/90"
            >
              {copy.cta}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
