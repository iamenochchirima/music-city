"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MUSIC_GENRES, type ArtistSummary, type PrimaryIntent, type SaveOnboardingStepInput } from "@music-city/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { usersApi } from "@/features/users/lib/users-api";
import { ApiClientError } from "@/lib/api/http-client";
import { trackEvent } from "@/lib/analytics";

type OnboardingFormProps = {
  mode?: "page" | "modal";
  onCompleted?: (intent: PrimaryIntent, destination: string) => void;
};

type FlowStep = "identity" | "intent" | "personalize" | "artist_identity" | "visuals" | "complete";
type MusicGenre = (typeof MUSIC_GENRES)[number];

const COUNTRY_OPTIONS = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
  "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
  "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo (Democratic Republic of the)", "Congo (Republic of the)", "Costa Rica", "Côte d’Ivoire", "Croatia", "Cuba", "Cyprus", "Czechia",
  "Denmark", "Djibouti", "Dominica", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia",
  "Fiji", "Finland", "France",
  "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
  "Haiti", "Honduras", "Hungary",
  "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy",
  "Jamaica", "Japan", "Jordan",
  "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan",
  "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
  "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar",
  "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway",
  "Oman",
  "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
  "Qatar",
  "Romania", "Russia", "Rwanda",
  "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
  "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Türkiye", "Turkmenistan", "Tuvalu",
  "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan",
  "Vanuatu", "Vatican City", "Venezuela", "Vietnam",
  "Yemen",
  "Zambia", "Zimbabwe",
] as const;

const intentOptions: Array<{
  value: PrimaryIntent;
  label: string;
  description: string;
}> = [
  {
    value: "listener",
    label: "I’m here to listen",
    description: "Discover artists, save tracks, and build your listening space.",
  },
  {
    value: "artist",
    label: "I’m an artist",
    description: "Build your artist profile, release music, and grow your audience.",
  },
  {
    value: "both",
    label: "Both",
    description: "Listen as a fan and keep an artist workspace ready when you need it.",
  },
];

const isArtistIntent = (intent: PrimaryIntent) =>
  intent === "artist" || intent === "both";

const isListenerIntent = (intent: PrimaryIntent) =>
  intent === "listener" || intent === "both";

const isEmailDerivedDisplayName = (displayName: string, email?: string) =>
  Boolean(email?.trim()) && displayName.trim().toLowerCase() === email!.trim().toLowerCase();

const nextStepFor = (intent: PrimaryIntent): FlowStep => {
  if (isListenerIntent(intent)) {
    return "personalize";
  }

  return "artist_identity";
};

const stepLabels = (intent: PrimaryIntent) => [
  "Welcome",
  "How you’ll use Music City",
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

const prepareImageFile = (file: File, purpose: "profile_image" | "header_image") =>
  new Promise<File>((resolve, reject) => {
    if (![
      "image/jpeg",
      "image/png",
      "image/webp",
    ].includes(file.type)) {
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
      const sourceWidth = sourceRatio > targetRatio
        ? image.height * targetRatio
        : image.width;
      const sourceHeight = sourceRatio > targetRatio
        ? image.height
        : image.width / targetRatio;
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
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Your browser could not prepare this image."));
          return;
        }

        resolve(new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, {
          type: "image/jpeg",
        }));
      }, "image/jpeg", 0.9);
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
}: OnboardingFormProps) => {
  const router = useRouter();
  const { session, refreshSessionProfile } = useAuth();
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
  const [hasReleasedMusic, setHasReleasedMusic] = useState<boolean | undefined>();
  const [artists, setArtists] = useState<ArtistSummary[]>([]);
  const [isLoadingArtists, setIsLoadingArtists] = useState(false);
  const [artistLoadError, setArtistLoadError] = useState<string | null>(null);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [headerImageFile, setHeaderImageFile] = useState<File | null>(null);
  const [savedProfileImageUrl, setSavedProfileImageUrl] = useState<string | null>(null);
  const [savedHeaderImageUrl, setSavedHeaderImageUrl] = useState<string | null>(null);
  const [removeProfileImage, setRemoveProfileImage] = useState(false);
  const [removeHeaderImage, setRemoveHeaderImage] = useState(false);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [headerImagePreview, setHeaderImagePreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreparingMedia, setIsPreparingMedia] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setEmail((current) => current || session?.email || "");
  }, [session?.email]);

  useEffect(() => {
    if (!session?.token) {
      return;
    }

    let cancelled = false;

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
          COUNTRY_OPTIONS.includes(profile.location as (typeof COUNTRY_OPTIONS)[number])
            ? profile.location
            : "",
        );
        setGenres(
          profile.genres.filter(
            (genre): genre is MusicGenre =>
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
          ["identity", "intent", "personalize", "artist_identity", "visuals"].includes(
            state.onboardingStep,
          )
        ) {
          setStep(state.onboardingStep as FlowStep);
        }
      })
      .catch(() => {
        // The session gate still provides a recoverable path if this read fails.
      });

    return () => {
      cancelled = true;
    };
  }, [session?.token]);

  useEffect(() => {
    if (!session?.onboardingStep || session.onboardingStatus === "complete") {
      return;
    }

    const savedStep = session.onboardingStep as FlowStep;
    if (["identity", "intent", "personalize", "artist_identity", "visuals"].includes(savedStep)) {
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
            error instanceof Error ? error.message : "Unable to load artists right now.",
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
        : step === "personalize"
          ? "Personalize"
          : step === "artist_identity"
            ? "Artist identity"
            : step === "visuals"
              ? "Profile visuals"
              : "Ready";
  const currentIndex = Math.max(labels.indexOf(currentLabel), 0);
  const progress = Math.round((currentIndex / Math.max(labels.length - 1, 1)) * 100);

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
    setStep("complete");
  };

  const submitCurrentStep = async (skipOptional = false) => {
    setIsSaving(true);
    setFieldErrors({});

    try {
      if (step === "identity") {
        if (!displayName.trim()) {
          setFieldErrors({ displayName: "Enter a display name to continue." });
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
        await saveStep({
          step: "intent",
          primaryIntent,
        });
        setStep(nextStepFor(primaryIntent));
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
              uploadProfileMedia(session.token, "profile_image", profileImageFile),
              isArtistIntent(primaryIntent)
                ? uploadProfileMedia(session.token, "header_image", headerImageFile)
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
        const destination = primaryIntent === "artist" ? "/dashboard" : "/discover";
        onCompleted?.(primaryIntent, destination);
        if (!onCompleted) router.push(destination);
      }
    } catch (error) {
      if (error instanceof ApiClientError) {
        setFieldErrors(error.fieldErrors);
      }
      toast.error(error instanceof Error ? error.message : "Unable to save onboarding");
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
    } else if (step === "personalize") {
      setStep("intent");
    } else if (step === "artist_identity") {
      setStep(isListenerIntent(primaryIntent) ? "personalize" : "intent");
    } else if (step === "visuals") {
      setStep(isArtistIntent(primaryIntent) ? "artist_identity" : "personalize");
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
        toast.error(error instanceof Error ? error.message : "Unable to prepare image");
      })
      .finally(() => setIsPreparingMedia(false));
  };

  return (
    <form
      className={
        mode === "modal"
          ? "space-y-6"
          : "max-w-2xl space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8"
      }
      onSubmit={handleSubmit}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4 text-xs uppercase tracking-[0.24em] text-slate-500">
          <span>{currentLabel}</span>
          <span>{progress}% complete</span>
        </div>
        <div className="flex gap-2" aria-label={`Onboarding progress: ${currentLabel}`}>
          {labels.map((label, index) => (
            <div
              key={label}
              className={`h-1.5 flex-1 rounded-full ${
                index <= currentIndex ? "bg-emerald-400" : "bg-white/10"
              }`}
            />
          ))}
        </div>
      </div>

      {step === "identity" ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-emerald-400">
              Profile basics
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Welcome to Music City
            </h1>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="displayName">
                Display name <span className="text-emerald-300">(required)</span>
              </Label>
              <Input
                id="displayName"
                name="displayName"
                autoComplete="nickname"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Your name here"
                required
                className="border-white/10 bg-slate-950/70 text-white"
              />
              {fieldErrors.displayName ? <p role="alert" className="text-xs text-rose-200">{fieldErrors.displayName}</p> : null}
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
                placeholder="For release updates and account recovery"
                className="border-white/10 bg-slate-950/70 text-white"
              />
              {fieldErrors.email ? <p role="alert" className="text-xs text-rose-200">{fieldErrors.email}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">
                Country <span className="text-slate-500">(optional)</span>
              </Label>
              <select
                id="location"
                name="location"
                autoComplete="country-name"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                className="h-10 w-full rounded-md border border-white/10 bg-slate-950/70 px-3 text-sm text-white outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
              >
                <option value="">Select your country</option>
                {COUNTRY_OPTIONS.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
              {fieldErrors.location ? <p role="alert" className="text-xs text-rose-200">{fieldErrors.location}</p> : null}
            </div>
          </div>

        </div>
      ) : null}

      {step === "intent" ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-emerald-400">
              Your starting point
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              How will you use Music City?
            </h1>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium leading-none text-white">
              Choose your starting point
            </legend>
            <div className="grid gap-3">
              {intentOptions.map((option) => {
                const selected = primaryIntent === option.value;

                return (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition ${
                      selected
                        ? "border-emerald-300 bg-emerald-400/15 text-white"
                        : "border-white/10 bg-slate-950/50 text-slate-300 hover:border-white/25"
                    }`}
                  >
                    <input
                      type="radio"
                      name="primaryIntent"
                      value={option.value}
                      checked={selected}
                      onChange={() => setPrimaryIntent(option.value)}
                      className="mt-1 size-4 accent-emerald-400"
                    />
                    <span>
                      <span className="block text-sm font-semibold">{option.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-400">
                        {option.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>
      ) : null}

      {step === "personalize" ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-emerald-400">
              Personalize your listening
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-white">
              Help us find your sound.
            </h2>
            <p className="text-sm leading-7 text-slate-300">
              Choose a few interests now. You can change them any time.
            </p>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-white">Favorite genres</legend>
            <div className="flex flex-wrap gap-2">
              {MUSIC_GENRES.map((genre) => {
                const selected = genres.includes(genre);
                return (
                  <button
                    key={genre}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleGenre(genre)}
                    className={`rounded-full border px-3 py-2 text-sm transition ${
                      selected
                        ? "border-emerald-300 bg-emerald-400/15 text-emerald-100"
                        : "border-white/10 bg-white/5 text-slate-300 hover:border-white/25"
                    }`}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-white">Artists to follow</legend>
            {isLoadingArtists ? (
              <p className="text-sm text-slate-400">Loading artists...</p>
            ) : artistLoadError ? (
              <p className="text-sm text-rose-200">{artistLoadError}</p>
            ) : artists.length === 0 ? (
              <p className="text-sm text-slate-400">
                You can skip this and discover artists from your listening space.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {artists.slice(0, 10).map((artist) => {
                  const selected = favoriteArtistIds.includes(artist.id);
                  return (
                    <label
                      key={artist.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                        selected
                          ? "border-emerald-300 bg-emerald-400/10"
                          : "border-white/10 bg-slate-950/40 hover:border-white/25"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleFavoriteArtist(artist.id)}
                        className="size-4 accent-emerald-400"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-white">
                          {artist.name}
                        </span>
                        <span className="block truncate text-xs text-slate-400">
                          {artist.city}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>

          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={interestedInLocalMusic}
              onChange={(event) => setInterestedInLocalMusic(event.target.checked)}
              className="size-4 accent-emerald-400"
            />
            Show me more artists and releases from my area.
          </label>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-white">Notifications</legend>
            {(
              [
                ["releaseNotifications", "New releases from artists I follow"],
                ["artistUpdates", "Updates from artists I follow"],
                ["productUpdates", "Helpful Music City product updates"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={notificationPreferences[key]}
                  onChange={(event) =>
                    setNotificationPreferences((current) => ({
                      ...current,
                      [key]: event.target.checked,
                    }))
                  }
                  className="size-4 accent-emerald-400"
                />
                {label}
              </label>
            ))}
          </fieldset>
        </div>
      ) : null}

      {step === "artist_identity" ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-emerald-400">
              Artist identity
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-white">
              Artist profile
            </h2>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Short biography</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="Tell listeners what makes your sound yours."
              className="min-h-28 border-white/10 bg-slate-950/70 text-white"
            />
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-white">Primary genres</legend>
            <div className="flex flex-wrap gap-2">
              {MUSIC_GENRES.map((genre) => {
                const selected = genres.includes(genre);
                return (
                  <button
                    key={genre}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleGenre(genre)}
                    className={`rounded-full border px-3 py-2 text-sm transition ${
                      selected
                        ? "border-emerald-300 bg-emerald-400/15 text-emerald-100"
                        : "border-white/10 bg-white/5 text-slate-300 hover:border-white/25"
                    }`}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-white">
              Have you released music before?
            </legend>
            <div className="flex gap-4">
              {[
                [true, "Yes"],
                [false, "Not yet"],
              ].map(([value, label]) => (
                <label key={String(value)} className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="radio"
                    name="hasReleasedMusic"
                    checked={hasReleasedMusic === value}
                    onChange={() => setHasReleasedMusic(value as boolean)}
                    className="size-4 accent-emerald-400"
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
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>{label} <span className="text-slate-500">(optional)</span></Label>
                <Input
                  id={key}
                  type="url"
                  value={socialLinks[key]}
                  onChange={(event) =>
                    setSocialLinks((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  placeholder={`https://${key === "x" ? "x.com" : `${key}.com`}/...`}
                  className="border-white/10 bg-slate-950/70 text-white"
                />
                {fieldErrors[key] ? <p role="alert" className="text-xs text-rose-200">{fieldErrors[key]}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {step === "visuals" ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-emerald-400">
              Profile visuals
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-white">
              Make your profile yours.
            </h2>
            <p className="text-sm leading-7 text-slate-300">
              Images are optional. Use JPG, PNG, or WebP up to 10MB.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-[0.65fr_1fr]">
            <div className="space-y-2">
              <Label htmlFor="profileImage">Profile image <span className="text-slate-500">(optional)</span></Label>
              <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 bg-slate-950/60 p-4 text-center text-sm text-slate-300 hover:border-emerald-300/50">
                {profileImagePreview ? (
                  <img src={profileImagePreview} alt="Profile preview" className="size-24 rounded-full object-cover" />
                ) : (
                  <span className="size-24 rounded-full bg-gradient-to-br from-emerald-300/30 to-slate-900" />
                )}
                <span>{profileImageFile?.name ?? "Choose profile image"}</span>
                <Input
                  id="profileImage"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(event) => handleImageChange(event, "profile_image")}
                />
              </label>
              {profileImagePreview ? (
                <button
                  type="button"
                  className="text-left text-xs text-slate-500 underline-offset-4 hover:text-white hover:underline"
                  onClick={() => {
                    setProfileImageFile(null);
                    setSavedProfileImageUrl(null);
                    setRemoveProfileImage(true);
                  }}
                >
                  Remove image
                </button>
              ) : null}
            </div>

            {isArtistIntent(primaryIntent) ? (
              <div className="space-y-2">
                <Label htmlFor="headerImage">Header image <span className="text-slate-500">(optional)</span></Label>
                <label className="flex min-h-40 cursor-pointer flex-col justify-end overflow-hidden rounded-2xl border border-dashed border-white/15 bg-slate-950/60 text-sm text-slate-300 hover:border-emerald-300/50">
                  {headerImagePreview ? (
                    <img src={headerImagePreview} alt="Header preview" className="h-40 w-full object-cover" />
                  ) : (
                    <div className="flex h-40 items-end bg-gradient-to-br from-emerald-300/20 via-slate-900 to-slate-950 p-4">
                      Choose header image
                    </div>
                  )}
                  {headerImageFile ? <span className="border-t border-white/10 px-4 py-2">{headerImageFile.name}</span> : null}
                  <Input
                    id="headerImage"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(event) => handleImageChange(event, "header_image")}
                  />
                </label>
                {headerImagePreview ? (
                  <button
                    type="button"
                    className="text-left text-xs text-slate-500 underline-offset-4 hover:text-white hover:underline"
                    onClick={() => {
                      setHeaderImageFile(null);
                      setSavedHeaderImageUrl(null);
                      setRemoveHeaderImage(true);
                    }}
                  >
                    Remove image
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {step === "complete" ? (
        <div className="space-y-5 py-8 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-emerald-400">You’re ready</p>
          <h2 className="text-3xl font-semibold tracking-tight text-white">
            {primaryIntent === "listener" ? "Your listening space is ready." : "Your artist workspace is ready."}
          </h2>
          <p className="mx-auto max-w-md text-sm leading-7 text-slate-300">
            {primaryIntent === "listener"
              ? "Start with a fresh release, follow an artist, or build your first playlist."
              : "Your profile is ready. Continue into the studio whenever you want to release music."}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {step !== "identity" && step !== "complete" ? (
          <Button type="button" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={handleBack} disabled={isSaving}>
            Back
          </Button>
        ) : <span />}

        <div className="flex flex-wrap items-center justify-end gap-3">
          {step === "personalize" || step === "artist_identity" || step === "visuals" ? (
            <Button type="button" variant="ghost" className="text-slate-400 hover:bg-white/5 hover:text-white" onClick={() => void skipCurrentStep()} disabled={isSaving}>
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
                    className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                    onClick={() => navigateAfterCompletion("/onboarding")}
                  >
                    Complete artist profile
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                    onClick={() => navigateAfterCompletion("/dashboard/create")}
                  >
                    Upload your first track
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                    onClick={() => navigateAfterCompletion(profileId ? `/artists/${profileId}` : "/artists")}
                  >
                    Preview public profile
                  </Button>
                </>
              ) : null}
              <Button
                type="button"
                className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                onClick={() => navigateAfterCompletion("/discover")}
              >
                Explore music
              </Button>
            </>
          ) : (
            <Button type="submit" className="bg-emerald-400 text-slate-950 hover:bg-emerald-300" disabled={isSaving || isPreparingMedia}>
              {isPreparingMedia ? "Preparing image..." : isSaving ? "Saving..." : step === "visuals" ? "Finish setup" : "Continue"}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
};
