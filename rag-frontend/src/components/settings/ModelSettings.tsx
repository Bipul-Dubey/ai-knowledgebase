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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Key, CheckCircle2, XCircle } from "lucide-react";

export default function ModelSettings() {
  const [apiKey, setApiKey] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [validationError, setValidationError] = useState("");

  const validateApiKey = async () => {
    if (!apiKey.trim()) return;

    setIsValidating(true);
    setValidationError("");
    setIsValid(false);

    try {
      const res = await fetch("/api/validate-openai-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.quotaExceeded) {
          throw new Error("API key valid but quota is exhausted");
        }
        throw new Error(data.error || "Invalid API key");
      }

      setIsValid(true);
      // Optional: store models or show them
      //   console.log("Accessible models:", data.models);
    } catch (error) {
      setValidationError(
        error instanceof Error ? error.message : "Validation failed",
      );
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="w-5 h-5" />
          OpenAI API Key
        </CardTitle>
        <CardDescription>
          {`Enter your OpenAI API key to enable RAG inference. We'll test the
          connection automatically.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              placeholder="sk-proj-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="font-mono text-sm"
            />
          </div>

          {/* Validation Status */}
          {isValid && (
            <Alert className="border-emerald-200 bg-emerald-50">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <AlertDescription className="text-emerald-800 space-y-1">
                <p>✅ API key is valid</p>
                <p>• Quota available</p>
                <p>• Models access confirmed</p>
              </AlertDescription>
            </Alert>
          )}

          {validationError && (
            <Alert
              variant="destructive"
              className="border-destructive bg-destructive/10"
            >
              <XCircle className="w-4 h-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            onClick={validateApiKey}
            disabled={!apiKey.trim() || isValidating}
            className="flex-1"
          >
            {isValidating ? "Testing..." : "Test & Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
