"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardStats } from "@/hooks/orgs_user";
import { HelpCircle } from "lucide-react";

export default function UnansweredQuestions() {
  const { data, isLoading, isError } = useDashboardStats();

  if (isLoading || isError || !data) return null;

  const questions = data.unanswered_questions ?? [];

  return (
    <Card className="rounded-lg px-5 py-4">
      <CardHeader className="p-0 mb-4">
        <CardTitle className="text-base font-medium">
          Questions we couldn&apos;t answer
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          What to upload next, in your users&apos; own words.
        </p>
      </CardHeader>

      <CardContent className="p-0">
        {questions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing here - every question so far was answered from your
            documents.
          </p>
        ) : (
          <ul className="divide-y">
            {questions.map((item) => (
              <li
                key={`${item.asked_at}-${item.question}`}
                className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0"
              >
                <HelpCircle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm break-words">{item.question}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(item.asked_at).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
