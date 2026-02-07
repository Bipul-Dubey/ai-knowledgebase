"use client";

export const FullScreenLoader = ({
  text = "Loading...",
}: {
  text?: string;
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        {/* Bouncing dots loader */}
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 bg-primary rounded-full animate-bounce [animation-delay:0s]" />
          <div className="h-3 w-3 bg-primary rounded-full animate-bounce [animation-delay:0.1s]" />
          <div className="h-3 w-3 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
        </div>

        {/* Text */}
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
};
