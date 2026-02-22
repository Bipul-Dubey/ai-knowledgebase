"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useInviteUser } from "@/hooks/orgs_user";
import { InviteUserPayload } from "@/types/apis";
import { useAuth } from "@/hooks/useAuth";

interface FormErrors {
  name?: string;
  email?: string;
}

export default function InviteUserButton() {
  const { isMaintainer } = useAuth();
  const [open, setOpen] = useState(false);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<InviteUserPayload["role"]>("member");

  const [errors, setErrors] = useState<FormErrors>({});

  const { mutate, isPending, error } = useInviteUser();

  const validate = () => {
    const newErrors: FormErrors = {};

    if (!name.trim()) {
      newErrors.name = "Name is required";
    } else if (name.trim().length < 2) {
      newErrors.name = "Name must be at least 2 characters";
    }

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        newErrors.email = "Enter a valid email address";
      }
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleInvite = () => {
    if (!validate()) return;

    mutate(
      { email, role, name },
      {
        onSuccess: () => {
          resetForm();
        },
      },
    );
  };

  const resetForm = () => {
    setOpen(false);
    setEmail("");
    setName("");
    setRole("member");
    setErrors({});
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <UserPlus className="w-4 h-4" />
        Invite User
      </Button>

      <Dialog
        open={open}
        onOpenChange={(val) => {
          setOpen(val);
          if (!val) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>
              Please fill all the field to invite new user.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-1">
              <Input
                placeholder="Full Name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name)
                    setErrors((prev) => ({
                      ...prev,
                      name: undefined,
                    }));
                }}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1">
              <Input
                placeholder="Email address"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email)
                    setErrors((prev) => ({
                      ...prev,
                      email: undefined,
                    }));
                }}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email}</p>
              )}
            </div>

            {/* Role */}
            <Select
              value={role}
              onValueChange={(val) => setRole(val as InviteUserPayload["role"])}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {isMaintainer ? null : (
                  <SelectItem value="maintainer">Maintainer</SelectItem>
                )}
                <SelectItem value="member">Member</SelectItem>
              </SelectContent>
            </Select>

            {/* API Error (optional) */}
            {error && (
              <p className="text-xs text-destructive">
                Failed to send invite. Try again.
              </p>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>

            <Button onClick={handleInvite} disabled={isPending}>
              {isPending ? "Sending..." : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
