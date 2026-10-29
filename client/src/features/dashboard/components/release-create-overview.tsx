import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PaymentIntentRecord, ReleaseCreateInput } from "@music-city/shared";
import { useAuth } from "@/hooks/use-auth";
import { releasesApi } from "@/features/music/lib/releases-api";
import { ArtistAccessGate } from "@/features/onboarding/components/artist-access-gate";
import { ArtistPaymentReviewDialog } from "@/features/onboarding/components/artist-payment-review-dialog";
import { useArtistOnboardingPayment } from "@/features/onboarding/hooks/use-artist-onboarding-payment";
import { Button } from "@/components/ui/button";
import { StepNavigation } from "@/components/studio/step-navigation";
import { FormStepHeader } from "@/components/studio/form-step-header";
import { ReleaseSetupFields, releaseSetupErrors } from "./release-setup-fields";
import { releaseSteps } from "../lib/release-steps";
export function ReleaseCreateOverview() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const {
    activationQuote,
    complete,
    isChecking,
    isPaid,
    isPaying,
    isPreparing,
    prepare,
    refreshStatus,
  } = useArtistOnboardingPayment();
  const [value, setValue] = useState<ReleaseCreateInput>({
    title: "",
    type: "single",
    expectedTrackCount: 1,
    genre: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activationIntent, setActivationIntent] =
    useState<PaymentIntentRecord | null>(null);
  const [activationError, setActivationError] = useState("");
  async function start() {
    if (!session?.token || busy) return;
    const nextErrors = releaseSetupErrors(value);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setBusy(true);
    setError("");
    try {
      const release = await releasesApi.createRelease(session.token, {
        ...value,
        title: value.title.trim(),
        artistName: session.displayName,
      });
      navigate(`/dashboard/releases/${release.id}?step=music`, {
        replace: true,
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't start your release. Try again.",
      );
      setBusy(false);
    }
  }
  async function reviewActivation() {
    setActivationError("");
    try {
      setActivationIntent(await prepare());
    } catch (e) {
      setActivationError(
        e instanceof Error
          ? e.message
          : "Couldn't prepare artist activation. Try again.",
      );
    }
  }
  async function confirmActivation() {
    if (!activationIntent) return;
    try {
      await complete(activationIntent);
      setActivationIntent(null);
    } catch (e) {
      setActivationError(
        e instanceof Error
          ? e.message
          : "Artist activation couldn't be completed. Try again.",
      );
    }
  }
  async function refreshActivationStatus() {
    setActivationError("");
    try {
      await refreshStatus();
    } catch (e) {
      setActivationError(
        e instanceof Error
          ? e.message
          : "Couldn't refresh artist access. Try again.",
      );
    }
  }
  if (!session) return <p>Connect your account to create a release.</p>;
  if (!["artist", "both"].includes(session.primaryIntent))
    return <ArtistAccessGate action="create a release" />;
  if (!session.artistAccess && !isPaid) {
    const amountDue = activationQuote?.amountDueMinor;
    const formattedAmount =
      amountDue === undefined
        ? null
        : new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: activationQuote?.currency ?? "USD",
          }).format(amountDue / 100);

    return (
      <>
        <section className="max-w-[720px] space-y-5 rounded-lg border border-border bg-card p-4 sm:p-6">
          <FormStepHeader
            eyebrow="Create a release"
            title="Activate artist access"
            description="A one-time activation unlocks release creation and uploads."
          />
          {isChecking ? (
            <p className="text-sm text-muted-foreground" role="status">
              Checking artist access…
            </p>
          ) : activationQuote?.status === "eligible" ? (
            <p className="text-sm text-muted-foreground" role="status">
              Your artist activation is covered. Refresh access to continue.
            </p>
          ) : (
            <div className="space-y-2 rounded-md border border-border bg-background p-4">
              <p className="font-medium">One-time activation</p>
              {formattedAmount ? (
                <p className="text-2xl font-semibold">{formattedAmount}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Review the exact amount before confirming.
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                No payment is made until you review the wallet details and confirm.
              </p>
            </div>
          )}
          {activationError ? (
            <p role="alert" className="text-sm text-destructive">
              {activationError}
            </p>
          ) : null}
          {activationQuote?.status === "eligible" ? (
            <Button
              type="button"
              variant="outline"
              disabled={isChecking}
              onClick={() => void refreshActivationStatus()}
            >
              {isChecking ? "Refreshing…" : "Refresh access"}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={isChecking || isPreparing}
              onClick={() => void reviewActivation()}
            >
              {isPreparing ? "Preparing…" : "Review activation"}
            </Button>
          )}
        </section>
        <ArtistPaymentReviewDialog
          intent={activationIntent}
          isPaying={isPaying}
          onCancel={() => setActivationIntent(null)}
          onConfirm={() => void confirmActivation()}
        />
      </>
    );
  }
  return (
    <div className="max-w-[720px] space-y-6">
      <FormStepHeader
        eyebrow="Create a release"
        title="Set up your release"
        description="Give it a name and choose what you’re releasing."
      />
      <StepNavigation
        steps={releaseSteps}
        completed={[]}
        current={0}
        onSelect={() => {}}
        disabled
        label="Release progress"
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void start();
        }}
        className="space-y-6 rounded-lg border border-border bg-card p-4 sm:p-6"
      >
        <fieldset disabled={busy}>
          <ReleaseSetupFields
            value={value}
            onChange={(patch) =>
              setValue((current) => ({ ...current, ...patch }))
            }
            errors={errors}
          />
        </fieldset>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end border-t border-border pt-5">
          <Button disabled={busy} type="submit">
            {busy ? "Starting your release..." : "Continue to songs"}
          </Button>
        </div>
      </form>
    </div>
  );
}
