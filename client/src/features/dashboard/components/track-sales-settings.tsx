import { useId, useState } from "react";
import type { TrackSummary } from "@music-city/shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { tracksApi } from "@/features/music/lib/tracks-api";

function validPrice(value: string) {
  if (!/^(0|[1-9][0-9]{0,11})(\.[0-9]{1,7})?$/.test(value)) return false;
  const [whole, fraction = ""] = value.split(".");
  const units = BigInt(whole!) * 10000000n + BigInt(fraction.padEnd(7, "0"));
  return units > 0n && units <= 9223372036854775807n;
}

export function TrackSalesSettings({
  track,
  token,
  onSaved,
}: {
  track: TrackSummary;
  token: string;
  onSaved: (track: TrackSummary) => void;
}) {
  const id = useId();
  const [enabled, setEnabled] = useState(track.purchaseEnabled ?? false);
  const [price, setPrice] = useState(track.purchasePrice ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty =
    enabled !== Boolean(track.purchaseEnabled) ||
    (enabled && price !== track.purchasePrice);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (enabled && !validPrice(price)) {
      setError("Enter a price above zero with up to 7 decimal places.");
      return;
    }
    setBusy(true);
    try {
      const updated = await tracksApi.updateTrackMonetization(token, track.id, {
        purchaseEnabled: enabled,
        purchasePrice: enabled ? price : undefined,
      });
      onSaved(updated);
      setEnabled(Boolean(updated.purchaseEnabled));
      setPrice(updated.purchasePrice ?? "");
      setSaved(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save sales settings. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={(event) => void save(event)}
      className="max-w-[720px] space-y-4 border-t border-border pt-6"
      aria-label="Track sales"
    >
      <h3 className="text-lg font-semibold">Track sales</h3>
      <fieldset disabled={busy} className="space-y-4">
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <Checkbox
            checked={enabled}
            onChange={(event) => {
              setEnabled(event.target.checked);
              setSaved(false);
            }}
          />
          Let listeners buy this song
        </label>
        {enabled && (
          <div className="max-w-xs">
            <FormField id={`${id}-price`} label="Price (USDC)">
              <Input
                inputMode="decimal"
                value={price}
                onChange={(event) => {
                  setPrice(event.target.value);
                  setSaved(false);
                }}
              />
            </FormField>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy || !dirty}>
            {busy ? "Saving…" : "Save sales settings"}
          </Button>
          {saved && !dirty && (
            <p role="status" className="text-sm text-muted-foreground">
              Sales settings saved
            </p>
          )}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
