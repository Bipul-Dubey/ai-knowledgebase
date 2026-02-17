"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TUSER_ROLE } from "@/types/apis";

interface RoleSelectProps {
  value: TUSER_ROLE;
  onChange: (val: TUSER_ROLE) => void;
  disabled?: boolean;
}

export default function RoleSelect({
  value,
  onChange,
  disabled,
}: RoleSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(val) => onChange(val as TUSER_ROLE)}
      disabled={disabled}
    >
      <SelectTrigger className="w-36 h-9 text-sm">
        <SelectValue />
      </SelectTrigger>

      <SelectContent>
        <SelectItem value="owner" disabled>
          Owner
        </SelectItem>
        <SelectItem value="maintainer">Maintainer</SelectItem>
        <SelectItem value="member">Member</SelectItem>
      </SelectContent>
    </Select>
  );
}
