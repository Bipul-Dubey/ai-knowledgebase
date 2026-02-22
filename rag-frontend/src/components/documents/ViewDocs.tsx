import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDocumentDownloadUrl } from "@/hooks/useDocumentResources";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

interface Props {
  documentId: string;
}

export const ViewDocumentButton = ({ documentId }: Props) => {
  const { data, isLoading, refetch } = useDocumentDownloadUrl(documentId);

  const handleView = async () => {
    if (!data) {
      const result = await refetch();
      if (result.data?.url) {
        window.open(result.data.url, "_blank");
      }
      return;
    }

    // Check expiry
    if (data.remainingTime <= 0) {
      const result = await refetch();
      if (result.data?.url) {
        window.open(result.data.url, "_blank");
      }
      return;
    }

    // Use cached URL
    window.open(data.url, "_blank");
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleView}
            disabled={isLoading}
            className="text-muted-foreground hover:text-primary"
          >
            <Eye className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>View Document</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
