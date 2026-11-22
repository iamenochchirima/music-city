"use client";

import { useEffect, useState } from "react";

import { paymentsApi } from "../lib/payments-api";

/**
 * Track ids the signed-in wallet has bought. Fetched once per music page so
 * each track row can show its download action without its own request.
 */
export const usePurchasedTrackIds = (token?: string) => {
  const [owned, setOwned] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let active = true;

    if (!token) {
      setOwned(new Set());
      return;
    }

    void paymentsApi
      .listMine(token)
      .then((items) => {
        if (!active) return;
        setOwned(
          new Set(
            items
              .filter(
                (payment) =>
                  payment.productType === "track_purchase" &&
                  payment.status === "confirmed" &&
                  Boolean(payment.trackId),
              )
              .map((payment) => payment.trackId!),
          ),
        );
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [token]);

  return owned;
};
