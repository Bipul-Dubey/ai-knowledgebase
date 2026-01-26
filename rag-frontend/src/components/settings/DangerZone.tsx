"use client";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, ShieldAlert } from "lucide-react";
import { Label } from "../ui/label";
import { Input } from "../ui/input";

export default function DangerZone() {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    // Simulate delete API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsDeleting(false);
    // Handle success/error
  };

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <ShieldAlert className="w-5 h-5" />
          Danger Zone
        </CardTitle>
        <CardDescription className="text-destructive/70">
          Permanently delete your organization and all associated data. This
          action cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="lg"
              className="w-full font-semibold h-12 text-base"
              disabled={isDeleting}
            >
              <Trash2 className="w-5 h-5 mr-2" />
              {isDeleting ? "Deleting..." : "Delete Organization"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription className="text-base">
                This action{" "}
                <span className="font-semibold text-destructive">
                  cannot be undone
                </span>
                . This will permanently delete your organization, all chats,
                documents, and RAG data. Please type{" "}
                <code className="bg-muted px-1 rounded font-mono">DELETE</code>{" "}
                to confirm.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label htmlFor="confirm-delete">Type DELETE to confirm</Label>
              <Input id="confirm-delete" placeholder="DELETE" />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                disabled={isDeleting}
                onClick={handleDelete}
              >
                Delete Organization
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
