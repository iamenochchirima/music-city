"use client";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { TrackCreateForm } from "./track-create-form";
import { ReleaseCreateOverview } from "./release-create-overview";
export const DashboardCreateOverview = () => {
  const [params, setParams] = useSearchParams();
  if (params.get("recording") === "1")
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setParams({})}>
          ← Create a release instead
        </Button>
        <TrackCreateForm onCreated={() => {}} onClose={() => setParams({})} />
      </div>
    );
  return (
    <div className="space-y-6">
      <ReleaseCreateOverview />
      <div className="border-t border-border pt-4">
        <p className="text-sm text-muted-foreground">
          Preparing audio before arranging a release?
        </p>
        <Button variant="ghost" onClick={() => setParams({ recording: "1" })}>
          Upload to recordings library
        </Button>
      </div>
    </div>
  );
};
