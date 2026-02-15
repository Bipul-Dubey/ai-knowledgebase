import { Button } from "@/components/ui/button";

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  prompt: string;
  onClick?: (prompt: string) => void;
}

export function ActionButton({
  icon,
  label,
  prompt,
  onClick,
}: Readonly<ActionButtonProps>) {
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={() => onClick?.(prompt)}
      className="border-border bg-secondary/20 flex w-full shrink-0 items-center gap-2 rounded-full border px-3 py-2 whitespace-nowrap transition-colors sm:w-auto sm:px-4"
    >
      {icon}
      <span className="text-xs">{label}</span>
    </Button>
  );
}
