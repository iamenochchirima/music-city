"use client";

import { useEffect, useState } from "react";
import type { TrackSale } from "@music-city/shared";
import { CreatorClaims } from "@/features/settlements/creator-claims";
import { paymentsApi } from "@/features/payments/lib/payments-api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const DashboardRevenueOverview = () => {
  const { session } = useAuth();
  const [sales, setSales] = useState<TrackSale[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const artist =
    session?.primaryIntent === "artist" || session?.primaryIntent === "both";
  useEffect(() => {
    let active = true;
    setSales([]);
    setError(null);
    if (!session?.token || !artist) return;
    void paymentsApi
      .listTrackSales(session.token)
      .then((items) => {
        if (active) {
          setSales(items);
          setError(null);
        }
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Could not load sales",
          );
      });
    return () => {
      active = false;
    };
  }, [session?.token, artist, refresh]);
  if (!session)
    return (
      <p className="text-sm text-muted-foreground">
        Sign in to view your earnings.
      </p>
    );
  return (
    <div className="space-y-8">
      <CreatorClaims />
      {artist && (
        <section
          className="space-y-4 border-t border-border pt-6"
          aria-label="Song sales"
        >
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-semibold">Song sales</h3>
            <span className="text-sm text-muted-foreground">
              {sales.length} {sales.length === 1 ? "purchase" : "purchases"}
            </span>
          </div>
          {error ? (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span>{error}</span>
              <Button
                variant="outline"
                onClick={() => setRefresh((n) => n + 1)}
              >
                Try again
              </Button>
            </div>
          ) : !sales.length ? (
            <p className="text-sm text-muted-foreground">
              Your song sales will appear here.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {sales.map((sale) => (
                <li
                  key={sale.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{sale.trackTitle}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(sale.confirmedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm">
                      {sale.amount} {sale.assetCode}
                    </span>
                    {[
                      "Public Global Stellar Network ; September 2015",
                      "Test SDF Network ; September 2015",
                    ].includes(sale.networkPassphrase ?? "") && (
                      <a
                        className="text-sm underline"
                        target="_blank"
                        rel="noreferrer"
                        href={`https://stellar.expert/explorer/${sale.networkPassphrase === "Public Global Stellar Network ; September 2015" ? "public" : "testnet"}/tx/${sale.txHash}`}
                      >
                        View receipt
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
};
