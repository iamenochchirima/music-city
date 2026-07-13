"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PaymentIntentRecord } from "@music-city/shared";
import { LockKeyhole } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { ArtistPaymentReviewDialog } from "./artist-payment-review-dialog";
import { useArtistOnboardingPayment } from "../hooks/use-artist-onboarding-payment";

type ArtistAccessGateProps = {
  action: string;
};

export const ArtistAccessGate = ({ action }: ArtistAccessGateProps) => {
  const router = useRouter();
  const { session } = useAuth();
  const {
    complete,
    isChecking,
    isPaid,
    isPaying,
    isPreparing,
    prepare,
  } = useArtistOnboardingPayment();
  const [paymentIntent, setPaymentIntent] =
    useState<PaymentIntentRecord | null>(null);
  const hasArtistProfile = session?.role === "artist";
  const hasArtistAccess = hasArtistProfile && isPaid;

  const handleContinue = async () => {
    if (!session?.token) {
      router.push("/auth");
      return;
    }

    if (hasArtistAccess) {
      router.push("/dashboard");
      return;
    }

    if (isPaid) {
      router.push("/onboarding");
      return;
    }

    try {
      setPaymentIntent(await prepare());
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to prepare the onboarding fee payment",
      );
    }
  };

  const handleConfirmPayment = async () => {
    if (!paymentIntent) {
      return;
    }

    try {
      await complete(paymentIntent);
      setPaymentIntent(null);
      if (hasArtistProfile) {
        toast.success("Onboarding fee paid. Your artist studio is now unlocked.");
        return;
      }

      toast.success("Onboarding fee paid. Finish your artist profile to continue.");
      router.push("/onboarding");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to complete the onboarding fee payment",
      );
    }
  };

  return (
    <>
      <section className="rounded-[28px] border border-emerald-400/20 bg-emerald-400/[0.07] p-6 sm:p-8">
        <span className="flex size-11 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300">
          <LockKeyhole className="size-5" aria-hidden="true" />
        </span>
        <p className="mt-5 text-xs font-medium uppercase tracking-[0.28em] text-emerald-400">
          Artist access
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          {!session
            ? "Log in to unlock your artist studio"
            : hasArtistAccess
              ? "Your artist studio is unlocked"
              : isPaid
                ? "Finish setting up your artist profile"
                : "Unlock your artist studio"}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
          {!session
            ? `Log in with your wallet to pay the once-off artist onboarding fee and ${action}.`
            : hasArtistAccess
              ? `Continue to the studio to ${action}.`
              : isPaid
                ? `Your onboarding fee has been received. Complete your artist profile before you ${action}.`
                : `Pay the once-off $19 artist onboarding fee before you ${action}. Your connected Stellar wallet will be used for payment.`}
        </p>
        <Button
          type="button"
          className="mt-6 bg-emerald-400 text-slate-950 hover:bg-emerald-300"
          disabled={isChecking || isPreparing}
          onClick={() => void handleContinue()}
        >
          {!session
            ? "Log in to continue"
            : hasArtistAccess
              ? "Open artist studio"
              : isChecking
                ? "Checking payment status..."
                : isPaid
                  ? "Finish artist setup"
                  : isPreparing
                    ? "Preparing checkout..."
                    : "Pay $19 and continue"}
        </Button>
      </section>
      <ArtistPaymentReviewDialog
        intent={paymentIntent}
        isPaying={isPaying}
        onCancel={() => setPaymentIntent(null)}
        onConfirm={() => void handleConfirmPayment()}
      />
    </>
  );
};
