"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { OnboardingForm } from "./onboarding-form";

export const OnboardingGate = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { session, logout, refreshSessionProfile } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [openedWallet, setOpenedWallet] = useState<string | null>(() =>
    session && session.onboardingStatus !== "complete"
      ? session.walletAddress
      : null,
  );
  useEffect(() => {
    setDismissed(false);
    setOpenedWallet(
      session && session.onboardingStatus !== "complete"
        ? session.walletAddress
        : null,
    );
  }, [session?.walletAddress]);
  if (
    !session ||
    pathname === "/onboarding" ||
    dismissed ||
    (session.onboardingStatus === "complete" &&
      openedWallet !== session.walletAddress)
  )
    return null;
  const canDismiss =
    session.onboardingStep !== "identity" &&
    session.onboardingStep !== "intent";
  return (
    <Dialog
      title="Music City onboarding"
      hideTitle
      className="max-w-[720px]"
      busy={busy || !canDismiss}
      onClose={() => setDismissed(true)}
    >
      <OnboardingForm
        key={session.walletAddress}
        mode="modal"
        onBusyChange={setBusy}
        onCompleted={(_, destination) => {
          setBusy(true);
          void refreshSessionProfile()
            .then(() => {
              setDismissed(true);
              router.push(destination);
            })
            .catch((error) =>
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Unable to refresh your profile",
              ),
            )
            .finally(() => setBusy(false));
        }}
      />
      <div className="mt-5 flex flex-wrap justify-end gap-3 border-t border-border pt-4">
        {canDismiss ? (
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => setDismissed(true)}
          >
            Continue later
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => void logout()}
        >
          Sign out
        </Button>
      </div>
    </Dialog>
  );
};
