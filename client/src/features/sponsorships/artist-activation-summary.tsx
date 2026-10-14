import type { ArtistActivationQuote } from "@music-city/shared";

const formatUsd = (minor: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(minor / 100);

export const ArtistActivationSummary = ({
  quote,
  variant = "compact",
}: {
  quote: ArtistActivationQuote;
  variant?: "compact" | "step";
}) => {
  const isStep = variant === "step";

  if (quote.status === "legacy_free") {
    return (
      <section
        aria-label="Artist activation"
        className={`rounded-lg border border-border bg-background ${isStep ? "p-4 text-base" : "p-4 text-sm"} text-muted-foreground`}
      >
        {!isStep ? (
          <p className="font-semibold text-foreground">Artist activation</p>
        ) : null}
        <p className={isStep ? "" : "mt-2"}>Your artist access is active.</p>
        {quote.activatedAt ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Activated {new Date(quote.activatedAt).toLocaleDateString()}
          </p>
        ) : null}
      </section>
    );
  }

  if (quote.status === "paid") {
    return (
      <section
        aria-label="Artist activation"
        className={`rounded-lg border border-border bg-background ${isStep ? "p-4 text-base" : "p-4 text-sm"} text-muted-foreground`}
      >
        {!isStep ? (
          <p className="font-semibold text-foreground">Artist activation</p>
        ) : null}
        <p className={isStep ? "" : "mt-2"}>Your payment is confirmed.</p>
        {quote.activatedAt ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Confirmed {new Date(quote.activatedAt).toLocaleDateString()}
          </p>
        ) : null}
      </section>
    );
  }

  const sponsored = quote.status === "eligible" || quote.status === "sponsored";
  return (
    <section
      aria-label="Artist activation"
      className={`rounded-lg border border-border bg-background ${isStep ? "p-4" : "p-4"} text-foreground`}
    >
      {!isStep ? (
        <p className="text-sm font-semibold text-foreground">
          One-time artist activation
        </p>
      ) : null}
      {quote.discountAmountMinor > 0 ? (
        <div
          role="status"
          className={`${isStep ? "mt-0" : "mt-3"} border-l-2 border-primary bg-primary/5 ${isStep ? "p-5" : "p-3"}`}
        >
          <p className="font-semibold text-foreground">
            {quote.campaignCode ?? "Early-user"}{" "}
            {isStep ? "applied automatically" : "code applied automatically"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isStep
              ? `${quote.discountPercent}% off`
              : `${quote.discountPercent}% discount · You save ${formatUsd(quote.discountAmountMinor)} · Amount due ${formatUsd(quote.amountDueMinor)}`}
          </p>
        </div>
      ) : null}
      <dl
        className={`mt-5 grid grid-cols-[1fr_auto] gap-x-4 ${isStep ? "gap-y-4 text-base" : "gap-y-2 text-sm"}`}
      >
        <dt>Standard price</dt>
        <dd className="text-right">{formatUsd(quote.originalAmountMinor)}</dd>
        {quote.discountAmountMinor > 0 ? (
          <>
            <dt>Early-user discount</dt>
            <dd className="text-right text-primary">
              −{formatUsd(quote.discountAmountMinor)}
            </dd>
          </>
        ) : null}
        <dt
          className={`border-t border-border ${isStep ? "pt-4 text-lg" : "pt-2"} font-semibold text-foreground`}
        >
          {quote.amountDueMinor === 0 ? "Amount due" : "Due today"}
        </dt>
        <dd
          className={`border-t border-border ${isStep ? "pt-4 text-lg" : "pt-2"} text-right font-semibold text-foreground`}
        >
          {formatUsd(quote.amountDueMinor)}
        </dd>
      </dl>
      {sponsored ? (
        <p className="mt-5 text-sm leading-6 text-foreground">
          {isStep
            ? quote.status === "eligible"
              ? "No payment or transaction needed. Artist access starts after registration."
              : "Your artist access is active."
            : `Music City covers this fee through the ${quote.campaignCode ?? "early-user"} offer. No payment or transaction is needed.${quote.status === "eligible" ? " Artist access activates when you finish registration." : " Your artist access is active."}`}
        </p>
      ) : (
        <p className="mt-3 leading-6 text-muted-foreground">
          The early-user offer is not available for this account.
        </p>
      )}
      {quote.status === "sponsored" && quote.activatedAt ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Activated {new Date(quote.activatedAt).toLocaleDateString()} · terms{" "}
          {quote.termsRevision}
        </p>
      ) : null}
    </section>
  );
};
