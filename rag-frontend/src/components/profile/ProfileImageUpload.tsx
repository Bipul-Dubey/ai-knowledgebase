"use client";

import { useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";

interface Props {
  imageUrl?: string;
  name: string;
}

export default function ProfileImageUpload({ imageUrl, name }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | undefined>(imageUrl);

  const initials = name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleFileChange = (file: File) => {
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    // 🔥 Later: call mutation to upload to S3
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <Avatar className="h-24 w-24">
        <AvatarImage src={preview} />
        <AvatarFallback className="text-lg font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>

      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
      >
        <Camera className="w-4 h-4 mr-2" />
        Change Photo
      </Button>

      <input
        type="file"
        hidden
        ref={fileInputRef}
        accept="image/*"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            handleFileChange(e.target.files[0]);
          }
        }}
      />
    </div>
  );
}
