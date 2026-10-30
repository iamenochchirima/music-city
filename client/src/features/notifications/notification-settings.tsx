import { useState } from "react";
import type { UserProfile } from "@music-city/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usersApi } from "@/features/users/lib/users-api";
const choices = [
  ["releaseNotifications", "New releases"],
  ["artistUpdates", "Artist updates"],
  ["productUpdates", "Music City news"],
] as const;
export function NotificationSettings({
  profile,
  token,
  onSaved,
}: {
  profile: UserProfile;
  token: string;
  onSaved: (profile: UserProfile) => void;
}) {
  const [email, setEmail] = useState(profile.email ?? "");
  const [preferences, setPreferences] = useState(
    profile.notificationPreferences,
  );
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  return (
    <form
      className="space-y-4 rounded-2xl border border-white/10 p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        setStatus(null);
        try {
          const next = await usersApi.updateProfile(token, {
            email: email.trim(),
            notificationPreferences: preferences,
          });
          onSaved(next);
          setStatus("Notification preferences saved.");
        } catch {
          setStatus("Could not save notification preferences. Try again.");
        } finally {
          setSaving(false);
        }
      }}
    >
      <h2 className="text-lg font-semibold text-white">Notifications</h2>
      <label className="block space-y-2 text-sm text-slate-300">
        <span>Email address</span>
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          disabled={saving}
        />
      </label>
      <p className="text-sm text-slate-400">
        Agreement requests, payment receipts and account activity go to this
        address. Without an email address, you can still check notifications
        here.
      </p>
      <fieldset disabled={saving} className="space-y-3">
        <legend className="mb-3 text-sm font-medium text-slate-300">
          Optional email updates
        </legend>
        {choices.map(([key, label]) => (
          <label
            key={key}
            className="flex items-center gap-3 text-sm text-slate-300"
          >
            <input
              type="checkbox"
              checked={preferences[key]}
              onChange={(event) =>
                setPreferences((previous) => ({
                  ...previous,
                  [key]: event.target.checked,
                }))
              }
              className="h-4 w-4 accent-violet-500"
            />
            {label}
          </label>
        ))}
      </fieldset>
      <Button type="submit" disabled={saving}>
        {saving ? "Saving..." : "Save preferences"}
      </Button>
      {status && (
        <p className="text-sm text-slate-300" role="status">
          {status}
        </p>
      )}
    </form>
  );
}
