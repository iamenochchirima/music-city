"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PaymentIntentRecord } from "@music-city/shared";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { usersApi } from "@/features/users/lib/users-api";
import { ArtistPaymentReviewDialog } from "./artist-payment-review-dialog";
import { useArtistOnboardingPayment } from "../hooks/use-artist-onboarding-payment";

const normalizeDefaultDisplayName = (value?: string | null) => {
  if (!value) {
    return "";
  }

  if (!value.includes("@")) {
    return value;
  }

  return value
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

type OnboardingFormProps = {
  mode?: "page" | "modal";
  onCompleted?: (role: "artist" | "fan") => void;
};

export const OnboardingForm = ({
  mode = "page",
  onCompleted,
}: OnboardingFormProps) => {
  const router = useRouter();
  const { session, refreshSessionProfile } = useAuth();
  const {
    complete: completeOnboardingFeePayment,
    isChecking: isCheckingOnboardingFee,
    isPaid: artistOnboardingFeePaid,
    isPaying: isPayingOnboardingFee,
    isPreparing: isPreparingOnboardingFee,
    prepare: prepareOnboardingFeePayment,
  } = useArtistOnboardingPayment();
  const [displayName, setDisplayName] = useState(
    normalizeDefaultDisplayName(session?.displayName),
  );
  const [email, setEmail] = useState(session?.email ?? "");
  const [role, setRole] = useState<"artist" | "fan">("artist");
  const [location, setLocation] = useState("");
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [headerImageFile, setHeaderImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(
    null,
  );
  const [headerImagePreview, setHeaderImagePreview] = useState<string | null>(
    null,
  );
  const [step, setStep] = useState<1 | 2>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [paymentIntent, setPaymentIntent] =
    useState<PaymentIntentRecord | null>(null);

  useEffect(() => {
    setDisplayName((current) =>
      current || normalizeDefaultDisplayName(session?.displayName),
    );
    setEmail((current) => current || session?.email || "");
  }, [session?.displayName, session?.email]);

  useEffect(() => {
    if (!profileImageFile) {
      setProfileImagePreview(null);
      return;
    }

    const previewUrl = URL.createObjectURL(profileImageFile);
    setProfileImagePreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [profileImageFile]);

  useEffect(() => {
    if (!headerImageFile) {
      setHeaderImagePreview(null);
      return;
    }

    const previewUrl = URL.createObjectURL(headerImageFile);
    setHeaderImagePreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [headerImageFile]);

  const uploadProfileMedia = async (
    token: string,
    purpose: "profile_image" | "header_image",
    file: File | null,
  ) => {
    if (!file) {
      return undefined;
    }

    const uploadTarget = await usersApi.createMediaUploadTarget(token, {
      purpose,
      fileName: file.name,
      contentType: file.type || "image/jpeg",
      sizeBytes: file.size,
    });

    await usersApi.uploadMedia(token, uploadTarget, file);

    return uploadTarget.storageKey;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (step === 1) {
      setStep(2);
      return;
    }

    if (!session?.token) {
      toast.error("Connect your wallet first");
      router.push("/auth");
      return;
    }

    if (role === "artist" && !artistOnboardingFeePaid) {
      toast.error("Pay the onboarding fee before creating an artist account.");
      return;
    }

    setIsSaving(true);

    try {
      const [profileImageStorageKey, headerImageStorageKey] = await Promise.all([
        uploadProfileMedia(session.token, "profile_image", profileImageFile),
        uploadProfileMedia(session.token, "header_image", headerImageFile),
      ]);

      await usersApi.saveMe(session.token, {
        email,
        displayName,
        role,
        location,
        profileImageStorageKey,
        headerImageStorageKey,
      });
      await refreshSessionProfile();
      toast.success("Profile saved");
      if (onCompleted) {
        onCompleted(role);
        return;
      }

      router.push(role === "artist" ? "/dashboard" : "/stream");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save profile",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handlePayOnboardingFee = async () => {
    if (!session?.token) {
      toast.error("Connect your wallet first");
      router.push("/auth");
      return;
    }

    try {
      setPaymentIntent(await prepareOnboardingFeePayment());
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to prepare the onboarding fee payment",
      );
    }
  };

  const handleConfirmOnboardingFee = async () => {
    if (!paymentIntent) {
      return;
    }

    try {
      await completeOnboardingFeePayment(paymentIntent);
      setPaymentIntent(null);
      toast.success("Onboarding fee paid. You can continue as an artist now.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to complete the onboarding fee payment",
      );
    }
  };

  return (
    <form
      className={
        mode === "modal"
          ? "space-y-5"
          : "max-w-2xl space-y-5 rounded-lg border border-white/10 bg-white/5 p-6"
      }
      onSubmit={handleSubmit}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.24em] text-slate-500">
          <span>Step {step} of 2</span>
          <span>{step === 1 ? "Basics" : "Visuals"}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div
            className={`h-1.5 rounded-full ${
              step >= 1 ? "bg-emerald-400" : "bg-white/10"
            }`}
          />
          <div
            className={`h-1.5 rounded-full ${
              step >= 2 ? "bg-emerald-400" : "bg-white/10"
            }`}
          />
        </div>
      </div>

      {step === 1 ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Your artist or profile name"
              required
              className="border-white/10 bg-slate-950/70 text-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">
              Email <span className="text-slate-500">(optional)</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="border-white/10 bg-slate-950/70 text-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Account type</Label>
            <select
              id="role"
              value={role}
              onChange={(event) =>
                setRole(event.target.value as "artist" | "fan")
              }
              className="h-10 w-full rounded-md border border-white/10 bg-slate-950/70 px-3 text-sm text-white"
            >
              <option value="artist">Artist</option>
              <option value="fan">Fan</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              className="border-white/10 bg-slate-950/70 text-white"
            />
          </div>

          {role === "artist" ? (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-slate-200">
              <p className="font-medium text-white">Artist onboarding fee</p>
              <p className="mt-2 leading-6 text-slate-300">
                A once-off onboarding fee of $19 is required to unlock artist tools,
                uploads, and release management.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={() => void handlePayOnboardingFee()}
                  disabled={
                    artistOnboardingFeePaid ||
                    isCheckingOnboardingFee ||
                    isPreparingOnboardingFee ||
                    isPayingOnboardingFee
                  }
                  className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                >
                  {artistOnboardingFeePaid
                    ? "Onboarding fee paid"
                    : isCheckingOnboardingFee
                      ? "Checking payment status..."
                      : isPreparingOnboardingFee
                        ? "Preparing checkout..."
                        : isPayingOnboardingFee
                          ? "Confirming payment..."
                          : "Pay onboarding fee"}
                </Button>
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  {artistOnboardingFeePaid ? "Unlocked" : "One-time payment"}
                </span>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-[0.65fr_1fr]">
          <div className="space-y-2">
            <Label htmlFor="profileImage">
              Profile picture <span className="text-slate-500">(optional)</span>
            </Label>
            <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 bg-slate-950/60 p-4 text-center text-sm text-slate-300 transition hover:border-emerald-300/50 hover:bg-emerald-400/5">
              {profileImagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profileImagePreview}
                  alt="Profile preview"
                  className="size-20 rounded-full object-cover"
                />
              ) : (
                <span className="size-20 rounded-full bg-gradient-to-br from-emerald-300/30 to-slate-900" />
              )}
              <span>
                {profileImageFile
                  ? profileImageFile.name
                  : "Choose profile image"}
              </span>
              <Input
                id="profileImage"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) =>
                  setProfileImageFile(event.target.files?.[0] ?? null)
                }
              />
            </label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="headerImage">
              Header image <span className="text-slate-500">(optional)</span>
            </Label>
            <label className="flex min-h-36 cursor-pointer flex-col justify-end overflow-hidden rounded-2xl border border-dashed border-white/15 bg-slate-950/60 text-sm text-slate-300 transition hover:border-emerald-300/50 hover:bg-emerald-400/5">
              {headerImagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={headerImagePreview}
                  alt="Header preview"
                  className="h-36 w-full object-cover"
                />
              ) : (
                <div className="flex h-36 items-end bg-gradient-to-br from-emerald-300/20 via-slate-900 to-slate-950 p-4">
                  <span>Choose header image</span>
                </div>
              )}
              {headerImageFile ? (
                <span className="border-t border-white/10 px-4 py-2">
                  {headerImageFile.name}
                </span>
              ) : null}
              <Input
                id="headerImage"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) =>
                  setHeaderImageFile(event.target.files?.[0] ?? null)
                }
              />
            </label>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        {step === 2 ? (
          <Button
            type="button"
            variant="outline"
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            onClick={() => setStep(1)}
            disabled={isSaving}
          >
            Back
          </Button>
        ) : (
          <span />
        )}
        <Button
          className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
          disabled={isSaving || (role === "artist" && !artistOnboardingFeePaid)}
        >
          {isSaving ? "Saving..." : step === 1 ? "Continue" : "Save profile"}
        </Button>
      </div>
      <ArtistPaymentReviewDialog
        intent={paymentIntent}
        isPaying={isPayingOnboardingFee}
        onCancel={() => setPaymentIntent(null)}
        onConfirm={() => void handleConfirmOnboardingFee()}
      />
    </form>
  );
};
