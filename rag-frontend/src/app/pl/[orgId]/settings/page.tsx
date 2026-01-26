import DangerZone from "@/components/settings/DangerZone";
import GeneralSettings from "@/components/settings/GeneralSettings";
import ModelSettings from "@/components/settings/ModelSettings";
import { Settings } from "lucide-react";

const SettingsPage = () => {
  return (
    <div className="flex flex-col bg-background">
      {/* Settings Header */}
      <div className="border-b bg-card/50">
        <div className="w-full px-6 py-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <Settings className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
              <p className="text-sm text-muted-foreground">
                {`Configure your organization's RAG platform `}• Acme Corp
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col space-y-6 py-6">
        {/* general settings - organization/users */}
        <GeneralSettings />
        {/* Model setting - Add OPENAI API keys and test if it correct or not */}
        <ModelSettings />

        {/* delete account - if owner */}
        <DangerZone />
      </div>
    </div>
  );
};

export default SettingsPage;
