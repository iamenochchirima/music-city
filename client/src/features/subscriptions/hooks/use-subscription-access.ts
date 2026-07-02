"use client";

import { useCallback, useEffect, useState } from "react";
import type { SubscriptionRecord, TrackSummary } from "@music-city/shared";

import { subscriptionsApi } from "@/features/subscriptions/lib/subscriptions-api";
import { useAuth } from "@/hooks/use-auth";

export const useSubscriptionAccess = () => {
  const { session } = useAuth();
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);

  useEffect(() => {
    let cancelled = false;

    if (!session?.token) {
      setSubscriptions([]);
      return;
    }

    void subscriptionsApi
      .listMine(session.token)
      .then((items) => {
        if (!cancelled) {
          setSubscriptions(items.filter((item) => item.status === "active"));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSubscriptions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session?.token]);

  const canAccessSubscriberTrack = useCallback(
    (track: TrackSummary) =>
      track.access !== "subscribers" ||
      subscriptions.some((subscription) => subscription.scope === "platform"),
    [subscriptions],
  );

  return { canAccessSubscriberTrack };
};
