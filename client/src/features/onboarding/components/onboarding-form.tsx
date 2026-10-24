"use client";

import AppImage from "next/image";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MUSIC_GENRES,
  type ArtistActivationQuote,
  type ArtistSummary,
  type PrimaryIntent,
  type SaveOnboardingStepInput,
} from "@music-city/shared";

import { ReferralCodeInput } from "@/features/referrals/referral-code-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { SearchablePicker } from "@/components/ui/searchable-picker";
import { ChoiceCard } from "@/components/ui/choice-card";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { ActionBar } from "@/components/studio/action-bar";
import { FlowProgress } from "@/components/studio/flow-progress";
import { FormStepHeader } from "@/components/studio/form-step-header";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { usersApi } from "@/features/users/lib/users-api";
import { ApiClientError } from "@/lib/api/http-client";
import { trackEvent } from "@/lib/analytics";
import { sponsorshipsApi } from "@/features/sponsorships/sponsorships-api";
import { ArtistActivationSummary } from "@/features/sponsorships/artist-activation-summary";

type OnboardingFormProps = {
  mode?: "page" | "modal";
  onBusyChange?: (busy: boolean) => void;
  footerActions?: ReactNode;
  onCompleted?: (intent: PrimaryIntent, destination: string) => void;
};

type FlowStep =
  | "identity"
  | "intent"
  | "artist_activation"
  | "personalize"
  | "artist_identity"
  | "visuals"
  | "complete";
type MusicGenre = (typeof MUSIC_GENRES)[number];

const COUNTRY_OPTIONS = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Congo (Democratic Republic of the)",
  "Congo (Republic of the)",
  "Costa Rica",
  "Côte d’Ivoire",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czechia",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Eswatini",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Korea",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Palestine",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Timor-Leste",
  "Togo",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Türkiye",
  "Turkmenistan",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Vatican City",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
] as const;

const intentOptions: Array<{
  value: PrimaryIntent;
  label: string;
  description: string;
}> = [
  {
    value: "listener",
    label: "I’m here to listen",
    description:
      "Discover artists, save tracks, and build your listening space.",
  },
  {
    value: "artist",
    label: "I’m an artist",
    description:
      "Build your artist profile, release music, and review your activation offer.",
  },
  {
    value: "both",
    label: "Both",
    description:
      "Listen as a fan and keep an artist workspace ready when you need it.",
  },
];

const isArtistIntent = (intent: PrimaryIntent) =>
  intent === "artist" || intent === "both";

const isListenerIntent = (intent: PrimaryIntent) =>
  intent === "listener" || intent === "both";

const isEmailDerivedDisplayName = (displayName: string, email?: string) =>
  Boolean(email?.trim()) &&
  displayName.trim().toLowerCase() === email!.trim().toLowerCase();

const nextStepFor = (intent: PrimaryIntent): FlowStep => {
  return isArtistIntent(intent) ? "artist_activation" : "personalize";
};

const nextStepAfterArtistActivation = (intent: PrimaryIntent): FlowStep =>
  isListenerIntent(intent) ? "personalize" : "artist_identity";

const stepLabels = (intent: PrimaryIntent) => [
  "Welcome",
  "How you’ll use Music City",
  ...(isArtistIntent(intent) ? ["Artist activation"] : []),
  ...(isListenerIntent(intent) ? ["Personalize"] : []),
  ...(isArtistIntent(intent) ? ["Artist identity"] : []),
  "Profile visuals",
  "Ready",
];

const initialNotificationPreferences = {
  releaseNotifications: true,
  artistUpdates: true,
  productUpdates: false,
};

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

const prepareImageFile = (
  file: File,
  purpose: "profile_image" | "header_image",
) =>
  new Promise<File>((resolve, reject) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      reject(new Error("Choose a JPG, PNG, or WebP image."));
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      reject(new Error("Images must be 10MB or smaller."));
      return;
    }

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const targetRatio = purpose === "profile_image" ? 1 : 2.67;
      const sourceRatio = image.width / image.height;
      const sourceWidth =
        sourceRatio > targetRatio ? image.height * targetRatio : image.width;
      const sourceHeight =
        sourceRatio > targetRatio ? image.height : image.width / targetRatio;
      const sourceX = (image.width - sourceWidth) / 2;
      const sourceY = (image.height - sourceHeight) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = purpose === "profile_image" ? 800 : 1600;
      canvas.height = purpose === "profile_image" ? 800 : 600;
      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("Your browser could not prepare this image."));
        return;
      }

      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Your browser could not prepare this image."));
            return;
          }

          resolve(
            new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, {
              type: "image/jpeg",
            }),
          );
        },
        "image/jpeg",
        0.9,
      );
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("That image could not be read."));
    };
    image.src = objectUrl;
  });

export const OnboardingForm = ({
  mode = "page",
  onCompleted,
  onBusyChange,
  footerActions,
}: OnboardingFormProps) => {
  const router = useRouter();
  const { session, refreshSessionProfile } = useAuth();
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadRetry, setLoadRetry] = useState(0);
  const [saveError, setSaveError] = useState("");
  const [mediaErrors, setMediaErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<FlowStep>("identity");
  const [primaryIntent, setPrimaryIntent] = useState<PrimaryIntent>(
    session?.primaryIntent ?? "listener",
  );
  const [profileId, setProfileId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(
    session && !isEmailDerivedDisplayName(session.displayName, session.email)
      ? session.displayName
      : "",
  );
  const [email, setEmail] = useState(session?.email ?? "");
  const [location, setLocation] = useState("");
  const [genres, setGenres] = useState<MusicGenre[]>([]);
  const [favoriteArtistIds, setFavoriteArtistIds] = useState<string[]>([]);
  const [interestedInLocalMusic, setInterestedInLocalMusic] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState(
    initialNotificationPreferences,
  );
  const [bio, setBio] = useState("");
  const [socialLinks, setSocialLinks] = useState({
    website: "",
    instagram: "",
    youtube: "",
    soundcloud: "",
    x: "",
  });
  const [hasReleasedMusic, setHasReleasedMusic] = useState<
    boolean | undefined
  >();
  const [artists, setArtists] = useState<ArtistSummary[]>([]);
  const [isLoadingArtists, setIsLoadingArtists] = useState(false);
  const [artistLoadError, setArtistLoadError] = useState<string | null>(null);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [headerImageFile, setHeaderImageFile] = useState<File | null>(null);
  const [savedProfileImageUrl, setSavedProfileImageUrl] = useState<
    string | null
  >(null);
  const [savedHeaderImageUrl, setSavedHeaderImageUrl] = useState<string | null>(
    null,
  );
  const [removeProfileImage, setRemoveProfileImage] = useState(false);
  const [removeHeaderImage, setRemoveHeaderImage] = useState(false);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(
    null,
  );
  const [headerImagePreview, setHeaderImagePreview] = useState<string | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isPreparingMedia, setIsPreparingMedia] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [artistActivationQuote, setArtistActivationQuote] =
    useState<ArtistActivationQuote | null>(null);
  const [artistActivationError, setArtistActivationError] = useState<
    string | null
  >(null);
  const [isLoadingArtistActivation, setIsLoadingArtistActivation] =
    useState(false);
  const [artistActivationRetry, setArtistActivationRetry] = useState(0);

  useEffect(() => {
    setEmail((current) => current || session?.email || "");
  }, [session?.email]);

  useEffect(() => {
    if (!session?.token || !isArtistIntent(primaryIntent)) {
      setArtistActivationQuote(null);
      setArtistActivationError(null);
      setIsLoadingArtistActivation(false);
      return;
    }

    let cancelled = false;
    setIsLoadingArtistActivation(true);
    setArtistActivationError(null);
    void sponsorshipsApi
      .getMyArtistActivation(session.token)
      .then((quote) => {
        if (!cancelled) setArtistActivationQuote(quote);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setArtistActivationQuote(null);
          setArtistActivationError(
            error instanceof Error
              ? error.message
              : "Artist activation price could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingArtistActivation(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.token, primaryIntent, artistActivationRetry]);

  useEffect(() => {
    if (!session?.token) {
      return;
    }

    let cancelled = false;
    setIsHydrating(true);
    setLoadError("");

    void usersApi
      .getOnboardingState(session.token)
      .then((state) => {
        if (!state || cancelled) {
          return;
        }

        const profile = state.profile;
        setProfileId(profile.id);
        setPrimaryIntent(profile.primaryIntent);
        setDisplayName(
          isEmailDerivedDisplayName(profile.displayName, profile.email)
            ? ""
            : profile.displayName,
        );
        setEmail(profile.email ?? "");
        setLocation(
          COUNTRY_OPTIONS.includes(
            profile.location as (typeof COUNTRY_OPTIONS)[number],
          )
            ? profile.location
            : "",
        );
        setGenres(
          profile.genres.filter((genre): genre is MusicGenre =>
            MUSIC_GENRES.includes(genre as MusicGenre),
          ),
        );
        setFavoriteArtistIds(profile.favoriteArtistIds);
        setInterestedInLocalMusic(profile.interestedInLocalMusic);
        setNotificationPreferences(profile.notificationPreferences);
        setBio(profile.bio);
        setSocialLinks({
          website: profile.socialLinks.website ?? "",
          instagram: profile.socialLinks.instagram ?? "",
          youtube: profile.socialLinks.youtube ?? "",
          soundcloud: profile.socialLinks.soundcloud ?? "",
          x: profile.socialLinks.x ?? "",
        });
        setHasReleasedMusic(profile.hasReleasedMusic);
        setSavedProfileImageUrl(profile.profileImageUrl ?? null);
        setSavedHeaderImageUrl(profile.headerImageUrl ?? null);
        setRemoveProfileImage(false);
        setRemoveHeaderImage(false);

        if (state.onboardingStatus === "complete") {
          setStep("complete");
        } else if (
          [
            "identity",
            "intent",
            "artist_activation",
            "personalize",
            "artist_identity",
            "visuals",
          ].includes(state.onboardingStep)
        ) {
          setStep(state.onboardingStep as FlowStep);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load your saved profile.",
          );
      })
      .finally(() => {
        if (!cancelled) setIsHydrating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.token, loadRetry]);

  useEffect(() => {
    if (!session?.onboardingStep || session.onboardingStatus === "complete") {
      return;
    }

    const savedStep = session.onboardingStep as FlowStep;
    if (
      [
        "identity",
        "intent",
        "artist_activation",
        "personalize",
        "artist_identity",
        "visuals",
      ].includes(savedStep)
    ) {
      setStep(savedStep);
    }
  }, [session?.onboardingStatus, session?.onboardingStep]);

  useEffect(() => {
    if (!isListenerIntent(primaryIntent) || step !== "personalize") {
      return;
    }

    let cancelled = false;
    setIsLoadingArtists(true);
    setArtistLoadError(null);

    void usersApi
      .listArtists()
      .then((items) => {
        if (!cancelled) {
          setArtists(items);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setArtistLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load artists right now.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingArtists(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [primaryIntent, step]);

  useEffect(() => {
    if (!profileImageFile) {
      setProfileImagePreview(savedProfileImageUrl);
      return;
    }

    const previewUrl = URL.createObjectURL(profileImageFile);
    setProfileImagePreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [profileImageFile, savedProfileImageUrl]);

  useEffect(() => {
    if (!headerImageFile) {
      setHeaderImagePreview(savedHeaderImageUrl);
      return;
    }

    const previewUrl = URL.createObjectURL(headerImageFile);
    setHeaderImagePreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [headerImageFile, savedHeaderImageUrl]);

  const labels = useMemo(() => stepLabels(primaryIntent), [primaryIntent]);
  const currentLabel =
    step === "identity"
      ? "Welcome"
      : step === "intent"
        ? "How you’ll use Music City"
        : step === "artist_activation"
          ? "Artist activation"
          : step === "personalize"
            ? "Personalize"
            : step === "artist_identity"
              ? "Artist identity"
              : step === "visuals"
                ? "Profile visuals"
                : "Ready";
  const currentIndex = Math.max(labels.indexOf(currentLabel), 0);
  useEffect(() => {
    onBusyChange?.(isSaving || isPreparingMedia);
  }, [isSaving, isPreparingMedia, onBusyChange]);
  useEffect(() => {
    if (!isHydrating && !loadError) {
      const heading = stepHeading.current;
      const dialog = heading?.closest("dialog");
      if (dialog) {
        dialog.scrollTop = 0;
        heading?.focus({ preventScroll: true });
      } else {
        heading?.focus();
        heading?.scrollIntoView({ block: "nearest" });
      }
    }
  }, [step, isHydrating, loadError]);

  const clearFieldError = (key: string) =>
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });

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

  const saveStep = async (input: SaveOnboardingStepInput) => {
    if (!session?.token) {
      throw new Error("Connect your wallet first");
    }

    const profile = await usersApi.saveOnboardingStep(session.token, input);
    setProfileId(profile.id);
    await refreshSessionProfile();
    return profile;
  };

  const complete = async () => {
    if (!session?.token) {
      throw new Error("Connect your wallet first");
    }

    await usersApi.completeOnboarding(session.token);
    await refreshSessionProfile();
    setStep("complete");
    if (isArtistIntent(primaryIntent)) {
      try {
        setArtistActivationQuote(
          await sponsorshipsApi.getMyArtistActivation(session.token),
        );
      } catch (error) {
        setArtistActivationQuote(null);
        setArtistActivationError(
          error instanceof Error
            ? error.message
            : "Your activation receipt could not be loaded.",
        );
      }
    }
  };

  const submitCurrentStep = async (skipOptional = false) => {
    setIsSaving(true);
    setFieldErrors({});
    setSaveError("");

    try {
      if (step === "identity") {
        if (!displayName.trim()) {
          setFieldErrors({ displayName: "Enter a display name to continue." });
          requestAnimationFrame(() =>
            document.getElementById("displayName")?.focus(),
          );
          return;
        }

        await saveStep({
          step: "identity",
          displayName: displayName.trim(),
          email,
          location,
        });
        setStep("intent");
      } else if (step === "intent") {
        if (isArtistIntent(primaryIntent) && !artistActivationQuote) {
          throw new Error(
            "Load the artist activation price before continuing.",
          );
        }
        await saveStep({
          step: "intent",
          primaryIntent,
        });
        setStep(nextStepFor(primaryIntent));
      } else if (step === "artist_activation") {
        if (!artistActivationQuote) {
          throw new Error(
            "Load the artist activation price before continuing.",
          );
        }
        await saveStep({ step: "artist_activation" });
        setStep(nextStepAfterArtistActivation(primaryIntent));
      } else if (step === "personalize") {
        await saveStep({
          step: "personalize",
          genres,
          favoriteArtistIds,
          interestedInLocalMusic,
          notificationPreferences,
        });
        setStep(isArtistIntent(primaryIntent) ? "artist_identity" : "visuals");
      } else if (step === "artist_identity") {
        await saveStep({
          step: "artist_identity",
          bio,
          genres,
          socialLinks,
          hasReleasedMusic,
        });
        setStep("visuals");
      } else if (step === "visuals") {
        if (!session?.token) {
          throw new Error("Connect your wallet first");
        }

        const [profileImageStorageKey, headerImageStorageKey] = skipOptional
          ? [undefined, undefined]
          : await Promise.all([
              uploadProfileMedia(
                session.token,
                "profile_image",
                profileImageFile,
              ),
              isArtistIntent(primaryIntent)
                ? uploadProfileMedia(
                    session.token,
                    "header_image",
                    headerImageFile,
                  )
                : Promise.resolve(undefined),
            ]);

        await saveStep({
          step: "visuals",
          profileImageStorageKey,
          headerImageStorageKey,
          removeProfileImage: skipOptional ? false : removeProfileImage,
          removeHeaderImage: skipOptional ? false : removeHeaderImage,
        });
        await complete();
        trackEvent("signup_completed");
      } else {
        const destination =
          primaryIntent === "artist" ? "/dashboard" : "/discover";
        onCompleted?.(primaryIntent, destination);
        if (!onCompleted) router.push(destination);
      }
    } catch (error) {
      if (error instanceof ApiClientError) {
        setFieldErrors(error.fieldErrors);
        requestAnimationFrame(() =>
          document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
        );
      }
      setSaveError(
        error instanceof Error ? error.message : "Unable to save onboarding",
      );
      toast.error(
        error instanceof Error ? error.message : "Unable to save onboarding",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const navigateAfterCompletion = (destination: string) => {
    if (onCompleted) {
      onCompleted(primaryIntent, destination);
      return;
    }

    void refreshSessionProfile().then(() => router.push(destination));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitCurrentStep();
  };

  const handleBack = () => {
    if (step === "intent") {
      setStep("identity");
    } else if (step === "artist_activation") {
      setStep("intent");
    } else if (step === "personalize") {
      setStep(isArtistIntent(primaryIntent) ? "artist_activation" : "intent");
    } else if (step === "artist_identity") {
      setStep(
        isListenerIntent(primaryIntent) ? "personalize" : "artist_activation",
      );
    } else if (step === "visuals") {
      setStep(
        isArtistIntent(primaryIntent) ? "artist_identity" : "personalize",
      );
    } else if (step === "complete") {
      setStep("visuals");
    }
  };

  const skipCurrentStep = () => {
    void submitCurrentStep(true);
  };

  const toggleGenre = (genre: MusicGenre) => {
    setGenres((current) =>
      current.includes(genre)
        ? current.filter((item) => item !== genre)
        : current.length < 5
          ? [...current, genre]
          : current,
    );
  };

  const toggleFavoriteArtist = (artistId: string) => {
    setFavoriteArtistIds((current) =>
      current.includes(artistId)
        ? current.filter((item) => item !== artistId)
        : current.length < 5
          ? [...current, artistId]
          : current,
    );
  };

  const handleImageChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    purpose: "profile_image" | "header_image",
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setIsPreparingMedia(true);
    setMediaErrors((current) => ({ ...current, [purpose]: "" }));
    void prepareImageFile(file, purpose)
      .then((prepared) => {
        if (purpose === "profile_image") {
          setProfileImageFile(prepared);
          setRemoveProfileImage(false);
        } else {
          setHeaderImageFile(prepared);
          setRemoveHeaderImage(false);
        }
      })
      .catch((error) => {
        setMediaErrors((current) => ({
          ...current,
          [purpose]:
            error instanceof Error ? error.message : "Unable to prepare image",
        }));
        toast.error(
          error instanceof Error ? error.message : "Unable to prepare image",
        );
      })
      .finally(() => setIsPreparingMedia(false));
  };

  if (!session?.token)
    return (
      <p className="text-sm text-muted-foreground">
        Connect your account to set up your profile.
      </p>
    );
  if (isHydrating)
    return (
      <p role="status" className="py-8 text-sm text-muted-foreground">
        Loading your saved profile…
      </p>
    );
  if (loadError)
    return (
      <div role="alert" className="space-y-4 py-6">
        <p className="text-sm text-destructive">{loadError}</p>
        <Button
          variant="outline"
          onClick={() => setLoadRetry((value) => value + 1)}
        >
          Retry profile load
        </Button>
      </div>
    );

  return (
    <form
      className={
        mode === "modal"
          ? "space-y-5"
          : "studio-theme w-full max-w-[720px] space-y-5 rounded-lg border border-border bg-card p-4 sm:p-6"
      }
      onSubmit={handleSubmit}
      noValidate
      aria-busy={isSaving || isPreparingMedia}
    >
      <FlowProgress
        label={currentLabel}
        current={currentIndex}
        total={labels.length}
      />
      <fieldset disabled={isSaving || isPreparingMedia} className="min-w-0">
        <legend className="sr-only">Profile setup</legend>
        {step === "identity" ? (
          <div className="space-y-6">
            <FormStepHeader
              ref={stepHeading}
              title="Welcome to Music City"
              eyebrow="Profile basics"
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="displayName"
                label="Display name"
                error={fieldErrors.displayName}
                className="sm:col-span-2"
              >
                <Input
                  name="displayName"
                  autoComplete="nickname"
                  value={displayName}
                  onChange={(event) => {
                    setDisplayName(event.target.value);
                    clearFieldError("displayName");
                  }}
                  placeholder="Your name"
                  required
                />
              </FormField>
              <FormField
                id="email"
                label="Email"
                hint="Optional. For updates and account recovery."
                error={fieldErrors.email}
              >
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    clearFieldError("email");
                  }}
                />
              </FormField>
              <FormField
                id="location"
                label="Country"
                hint="Optional."
                error={fieldErrors.location}
              >
                <SearchablePicker
                  id="location"
                  value={location}
                  onValueChange={setLocation}
                  options={COUNTRY_OPTIONS}
                  placeholder="Select your country"
                  searchPlaceholder="Search countries"
                />
              </FormField>
            </div>

            {!profileId ? (
              <div className="max-w-xl">
                <ReferralCodeInput />
              </div>
            ) : null}
          </div>
        ) : null}

        {step === "intent" ? (
          <div className="space-y-6">
            <FormStepHeader
              ref={stepHeading}
              title="How will you use Music City?"
              eyebrow="Your starting point"
            />

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium leading-none text-foreground">
                Choose your starting point
              </legend>
              <div className="grid gap-3">
                {intentOptions.map((option) => (
                  <ChoiceCard
                    key={option.value}
                    name="primaryIntent"
                    value={option.value}
                    checked={primaryIntent === option.value}
                    onChange={() => setPrimaryIntent(option.value)}
                    label={option.label}
                    description={option.description}
                  />
                ))}
              </div>
            </fieldset>
            {isArtistIntent(primaryIntent) &&
            (isLoadingArtistActivation || artistActivationError) ? (
              <div className="space-y-3">
                {isLoadingArtistActivation ? (
                  <p role="status" className="text-sm text-muted-foreground">
                    Loading your activation offer…
                  </p>
                ) : (
                  <>
                    <p role="alert" className="text-sm text-destructive">
                      {artistActivationError}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setArtistActivationRetry((value) => value + 1)
                      }
                    >
                      Try again
                    </Button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {step === "artist_activation" ? (
          <div className="space-y-6">
            <FormStepHeader
              ref={stepHeading}
              title={
                artistActivationQuote?.discountAmountMinor
                  ? "Your early-user discount is applied"
                  : artistActivationQuote?.status === "paid"
                    ? "Artist activation confirmed"
                    : artistActivationQuote?.status === "legacy_free"
                      ? "Your artist access is active"
                      : "Artist activation"
              }
            />

            {isLoadingArtistActivation ? (
              <p
                role="status"
                className="rounded-md border border-border bg-background p-6 text-sm text-muted-foreground"
              >
                Loading your artist activation offer…
              </p>
            ) : artistActivationQuote ? (
              <ArtistActivationSummary
                quote={artistActivationQuote}
                variant="step"
              />
            ) : (
              <div role="alert" className="space-y-3 text-sm text-destructive">
                <p>
                  {artistActivationError ??
                    "Artist activation price could not be loaded."}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setArtistActivationRetry((value) => value + 1)}
                >
                  Try again
                </Button>
              </div>
            )}
          </div>
        ) : null}

        {step === "personalize" ? (
          <div className="space-y-6">
            <FormStepHeader
              ref={stepHeading}
              title="Help us find your sound."
              eyebrow="Personalize"
              description="Choose a few interests now. You can change them any time."
            />

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">
                Favorite genres
              </legend>
              <p className="text-xs text-muted-foreground">
                Choose up to five. {genres.length} selected.
              </p>
              <div className="flex flex-wrap gap-2">
                {MUSIC_GENRES.map((genre) => {
                  const selected = genres.includes(genre);
                  return (
                    <ToggleChip
                      key={genre}
                      selected={selected}
                      disabled={!selected && genres.length >= 5}
                      onClick={() => toggleGenre(genre)}
                    >
                      {genre}
                    </ToggleChip>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">
                Artists to follow
              </legend>
              {isLoadingArtists ? (
                <p className="text-sm text-muted-foreground">
                  Loading artists...
                </p>
              ) : artistLoadError ? (
                <p className="text-sm text-destructive" role="alert">
                  {artistLoadError}
                </p>
              ) : artists.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  You can skip this and discover artists from your listening
                  space.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {artists.slice(0, 10).map((artist) => {
                    const selected = favoriteArtistIds.includes(artist.id);
                    return (
                      <label
                        key={artist.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 transition ${
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border bg-background hover:border-input"
                        }`}
                      >
                        <Checkbox
                          checked={selected}
                          disabled={!selected && favoriteArtistIds.length >= 5}
                          onChange={() => toggleFavoriteArtist(artist.id)}
                          className="h-4 w-4 accent-primary"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {artist.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {artist.city}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </fieldset>

            <label className="flex items-center gap-3 rounded-md border border-border bg-background p-4 text-sm text-muted-foreground">
              <Checkbox
                checked={interestedInLocalMusic}
                onChange={(event) =>
                  setInterestedInLocalMusic(event.target.checked)
                }
                className="h-4 w-4 accent-primary"
              />
              Show me more artists and releases from my area.
            </label>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">
                Notifications
              </legend>
              {(
                [
                  [
                    "releaseNotifications",
                    "New releases from artists I follow",
                  ],
                  ["artistUpdates", "Updates from artists I follow"],
                  ["productUpdates", "Helpful Music City product updates"],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex min-h-11 items-center gap-3 text-sm text-foreground"
                >
                  <Checkbox
                    checked={notificationPreferences[key]}
                    onChange={(event) =>
                      setNotificationPreferences((current) => ({
                        ...current,
                        [key]: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-primary"
                  />
                  {label}
                </label>
              ))}
            </fieldset>
          </div>
        ) : null}

        {step === "artist_identity" ? (
          <div className="space-y-6">
            <FormStepHeader
              ref={stepHeading}
              title="Artist profile"
              eyebrow="Artist identity"
            />

            <FormField
              id="bio"
              label="Short biography"
              hint="Optional. Tell listeners about your sound."
              error={fieldErrors.bio}
            >
              <Textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                className="min-h-28"
              />
            </FormField>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">
                Primary genres
              </legend>
              <p className="text-xs text-muted-foreground">
                Choose up to five. {genres.length} selected.
              </p>
              <div className="flex flex-wrap gap-2">
                {MUSIC_GENRES.map((genre) => {
                  const selected = genres.includes(genre);
                  return (
                    <ToggleChip
                      key={genre}
                      selected={selected}
                      disabled={!selected && genres.length >= 5}
                      onClick={() => toggleGenre(genre)}
                    >
                      {genre}
                    </ToggleChip>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">
                Have you released music before?
              </legend>
              <div className="flex gap-4">
                {[
                  [true, "Yes"],
                  [false, "Not yet"],
                ].map(([value, label]) => (
                  <label
                    key={String(value)}
                    className="flex min-h-11 items-center gap-2 text-sm text-foreground"
                  >
                    <input
                      type="radio"
                      name="hasReleasedMusic"
                      checked={hasReleasedMusic === value}
                      onChange={() => setHasReleasedMusic(value as boolean)}
                      className="h-4 w-4 accent-primary"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["website", "Website"],
                  ["instagram", "Instagram"],
                  ["youtube", "YouTube"],
                  ["soundcloud", "SoundCloud"],
                  ["x", "X"],
                ] as const
              ).map(([key, label]) => (
                <FormField
                  key={key}
                  id={key}
                  label={label}
                  hint="Optional."
                  error={fieldErrors[key] ?? fieldErrors[`socialLinks.${key}`]}
                >
                  <Input
                    type="url"
                    value={socialLinks[key]}
                    onChange={(event) =>
                      setSocialLinks((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                    placeholder={`https://${key === "x" ? "x.com" : `${key}.com`}/...`}
                  />
                </FormField>
              ))}
            </div>
          </div>
        ) : null}

        {step === "visuals" ? (
          <div className="space-y-6">
            <FormStepHeader
              ref={stepHeading}
              title="Make your profile yours."
              eyebrow="Profile visuals"
              description="Images are optional. Use JPG, PNG, or WebP up to 10MB."
            />

            <div className="grid items-start gap-6 sm:grid-cols-2">
              <div className="space-y-4">
                {profileImagePreview ? (
                  <AppImage
                    src={profileImagePreview}
                    sizes="96px" maxWidth={384}
                    alt="Profile preview"
                    className="h-24 w-24 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground">
                    Photo
                  </div>
                )}
                <FormField
                  id="profileImage"
                  label="Profile image"
                  hint="Optional. JPG, PNG, or WebP, up to 10 MB."
                  error={
                    mediaErrors.profile_image ??
                    fieldErrors.profileImageStorageKey
                  }
                >
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) =>
                      handleImageChange(event, "profile_image")
                    }
                  />
                </FormField>
                {profileImageFile ? (
                  <p className="break-words text-xs text-muted-foreground">
                    {profileImageFile.name}
                  </p>
                ) : null}
                {profileImagePreview ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setProfileImageFile(null);
                      setSavedProfileImageUrl(null);
                      setRemoveProfileImage(true);
                    }}
                  >
                    Remove profile image
                  </Button>
                ) : null}
              </div>
              {isArtistIntent(primaryIntent) ? (
                <div className="space-y-4">
                  {headerImagePreview ? (
                    <AppImage
                      src={headerImagePreview}
                      sizes="(min-width: 640px) 480px, 92vw"
                      alt="Header preview"
                      className="aspect-[8/3] w-full rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[8/3] w-full items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">
                      Header artwork
                    </div>
                  )}
                  <FormField
                    id="headerImage"
                    label="Header image"
                    hint="Optional. JPG, PNG, or WebP, up to 10 MB."
                    error={
                      mediaErrors.header_image ??
                      fieldErrors.headerImageStorageKey
                    }
                  >
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) =>
                        handleImageChange(event, "header_image")
                      }
                    />
                  </FormField>
                  {headerImageFile ? (
                    <p className="break-words text-xs text-muted-foreground">
                      {headerImageFile.name}
                    </p>
                  ) : null}
                  {headerImagePreview ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setHeaderImageFile(null);
                        setSavedHeaderImageUrl(null);
                        setRemoveHeaderImage(true);
                      }}
                    >
                      Remove header image
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {step === "complete" ? (
          <div className="space-y-4 py-4 text-center">
            <p className="text-sm font-medium text-primary">You’re ready</p>
            <h2
              ref={stepHeading}
              tabIndex={-1}
              className="text-[28px] font-semibold leading-8 text-foreground focus:outline-none"
            >
              {primaryIntent === "listener"
                ? "Your listening space is ready."
                : "Your artist workspace is ready."}
            </h2>
            <p className="mx-auto max-w-md text-sm leading-7 text-muted-foreground">
              {primaryIntent === "listener"
                ? "Start with a fresh release, follow an artist, or build your first playlist."
                : "Your profile is ready. Continue into the studio whenever you want to release music."}
            </p>
          </div>
        ) : null}
      </fieldset>
      {saveError ? (
        <p role="alert" className="text-sm text-destructive">
          {saveError}. Your entries are still here. Try again.
        </p>
      ) : null}
      <ActionBar className="gap-4 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          {step !== "identity" ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={isSaving || isPreparingMedia}
            >
              Back
            </Button>
          ) : null}
          {footerActions}
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {step === "personalize" ||
          step === "artist_identity" ||
          step === "visuals" ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => void skipCurrentStep()}
              disabled={isSaving}
            >
              Skip for now
            </Button>
          ) : null}
          {step === "complete" ? (
            <>
              {primaryIntent !== "listener" ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigateAfterCompletion("/dashboard/create")}
                  >
                    Create your first release
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      navigateAfterCompletion(
                        profileId ? `/artists/${profileId}` : "/artists",
                      )
                    }
                  >
                    Preview public profile
                  </Button>
                </>
              ) : null}
              <Button
                type="button"
                onClick={() => navigateAfterCompletion("/discover")}
              >
                Explore music
              </Button>
            </>
          ) : (
            <Button
              type="submit"
              disabled={
                isSaving ||
                isPreparingMedia ||
                ((step === "artist_activation" ||
                  (step === "intent" && isArtistIntent(primaryIntent))) &&
                  (isLoadingArtistActivation || !artistActivationQuote))
              }
            >
              {isPreparingMedia
                ? "Preparing image..."
                : isSaving
                  ? "Saving..."
                  : step === "visuals"
                    ? "Finish setup"
                    : step === "artist_activation"
                      ? isListenerIntent(primaryIntent)
                        ? "Continue to listening setup"
                        : "Continue to artist profile"
                      : "Continue"}
            </Button>
          )}
        </div>
      </ActionBar>
    </form>
  );
};
