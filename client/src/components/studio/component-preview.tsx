import { TrackUploadResult } from "@/features/dashboard/components/track-upload-result";
import { useState } from "react";
import { MUSIC_GENRES } from "@music-city/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { SearchablePicker } from "@/components/ui/searchable-picker";
import { FormField } from "@/components/ui/form-field";
import { ChoiceCard } from "@/components/ui/choice-card";
import { ToggleChip } from "@/components/ui/toggle-chip";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { StudioPageHeader } from "./page-header";
import { FormSection } from "./form-section";
import { ActionBar } from "./action-bar";
import { StatusBadge } from "./status-badge";
import { EmptyState } from "./empty-state";
import { FlowProgress } from "./flow-progress";

export default function ComponentPreview() {
  const [genre, setGenre] = useState("");
  const [role, setRole] = useState("listener");
  const [selected, setSelected] = useState(false);
  const [dialog, setDialog] = useState(false);
  return (
    <section className="studio-theme min-h-screen bg-background px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto max-w-[960px] space-y-8">
        <StudioPageHeader
          title="Studio component preview"
          description="Development only. These controls use the same components as the product. Fixture values never reach the API."
        />
        <FormSection title="Actions">
          <div className="flex flex-wrap gap-3">
            <Button>Primary action</Button>
            <Button variant="outline">Secondary action</Button>
            <Button variant="ghost">Quiet action</Button>
            <Button variant="destructive">Delete</Button>
            <Button disabled>Saving…</Button>
          </div>
        </FormSection>
        <Card>
          <CardHeader>
            <CardTitle>Fields and validation</CardTitle>
            <CardDescription>
              Long labels, optional guidance, disabled inputs, and errors.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <FormField
              id="preview-name"
              label="Contributor name with a longer label"
              hint="Use the credited person or organization name."
            >
              <Input defaultValue="Music City Publishing Company" />
            </FormField>
            <FormField
              id="preview-isrc"
              label="Existing ISRC"
              hint="Optional."
              error="Enter a valid 12-character ISRC."
            >
              <Input defaultValue="INVALID" />
            </FormField>
            <FormField id="preview-disabled" label="Disabled control">
              <Input value="Uploading recording…" disabled />
            </FormField>
            <FormField id="preview-select" label="Release type">
              <Select>
                <option>Single</option>
                <option>EP</option>
                <option>Album</option>
              </Select>
            </FormField>
            <FormField id="preview-genre" label="Searchable genre">
              <SearchablePicker
                id="preview-genre"
                value={genre}
                onValueChange={setGenre}
                options={MUSIC_GENRES}
                placeholder="Select a genre"
                searchPlaceholder="Search genres"
              />
            </FormField>
            <FormField
              id="preview-note"
              label="Track note"
              hint="Optional. Multi-line text stays aligned."
            >
              <Textarea defaultValue="A recording note that wraps naturally as the viewport gets narrower." />
            </FormField>
          </CardContent>
        </Card>
        <FormSection title="Choices and statuses">
          <div className="grid gap-3 sm:grid-cols-2">
            {["listener", "artist"].map((value) => (
              <ChoiceCard
                key={value}
                label={
                  value === "listener" ? "Listen to music" : "Release music"
                }
                description="Choose one option with the keyboard or pointer."
                name="preview-role"
                value={value}
                checked={role === value}
                onChange={() => setRole(value)}
              />
            ))}
          </div>
          <ToggleChip
            selected={selected}
            onClick={() => setSelected((value) => !value)}
          >
            Afrobeats
          </ToggleChip>
          <div className="flex flex-wrap gap-3">
            {[
              "draft",
              "scheduled",
              "published",
              "processing",
              "needs attention",
            ].map((status) => (
              <StatusBadge key={status} status={status} />
            ))}
          </div>
        </FormSection>
        <FormSection title="Progress and empty states">
          <FlowProgress label="Artist identity" current={3} total={6} />
          <EmptyState
            title="No tracks yet"
            description="Upload a recording to start building your catalog."
          />
        </FormSection>
        <FormSection
          title="Audio processing result"
          description="A passive example of the actual upload result. Its links cannot navigate or send fixture data to the API."
        >
          <div inert>
            <TrackUploadResult
              title="Example processing recording"
              trackId="preview-only"
              playbackReady={false}
              onReset={() => undefined}
            />
          </div>
        </FormSection>
        <ActionBar>
          <p className="text-sm text-muted-foreground">Unsaved changes</p>
          <Button onClick={() => setDialog(true)}>Open example dialog</Button>
        </ActionBar>
        {dialog ? (
          <Dialog
            title="Review your changes"
            description="Test keyboard focus, scrolling, and restoration with the same dialog used in release and onboarding flows."
            onClose={() => setDialog(false)}
          >
            <FormField id="preview-dialog-name" label="Name">
              <Input autoFocus defaultValue="Example artist" />
            </FormField>
            <ActionBar>
              <Button variant="outline" onClick={() => setDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => setDialog(false)}>Save example</Button>
            </ActionBar>
          </Dialog>
        ) : null}
      </div>
    </section>
  );
}
