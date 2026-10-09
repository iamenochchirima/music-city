import type { ArtistActivationQuote } from "@music-city/shared";

const formatUsd = (minor: number) => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
}).format(minor / 100);

export const ArtistActivationSummary = ({ quote }: { quote: ArtistActivationQuote }) => {
  if (quote.status === "legacy_free") {
    return (
      <section aria-label="Artist activation" className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-sm text-slate-300">
        <p className="font-semibold text-white">Artist activation</p>
        <p className="mt-2">Your account has legacy free artist access.</p>
        {quote.activatedAt ? <p className="mt-1 text-xs text-slate-500">Activated {new Date(quote.activatedAt).toLocaleDateString()}</p> : null}
      </section>
    );
  }

  if (quote.status === "paid") {
    return (
      <section aria-label="Artist activation" className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-sm text-slate-300">
        <p className="font-semibold text-white">Artist activation</p>
        <p className="mt-2">Your artist activation payment is confirmed.</p>
        {quote.activatedAt ? <p className="mt-1 text-xs text-slate-500">Confirmed {new Date(quote.activatedAt).toLocaleDateString()}</p> : null}
      </section>
    );
  }

  const sponsored = quote.status === "eligible" || quote.status === "sponsored";
  return (
    <section aria-label="Artist activation" className="rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.07] p-4 text-sm text-slate-200">
      <p className="font-semibold text-white">One-time artist activation</p>
      {quote.discountAmountMinor > 0 ? (
        <div role="status" className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-3">
          <p className="font-semibold text-emerald-100">
            {quote.campaignCode ?? "Early-user"} code applied automatically
          </p>
          <p className="mt-1 text-sm text-emerald-100/80">
            {quote.discountPercent}% discount · You save {formatUsd(quote.discountAmountMinor)} · Amount due {formatUsd(quote.amountDueMinor)}
          </p>
        </div>
      ) : null}
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2">
        <dt>Standard price</dt><dd className="text-right">{formatUsd(quote.originalAmountMinor)}</dd>
        {quote.discountAmountMinor > 0 ? <>
          <dt>Early-user discount</dt>
          <dd className="text-right text-emerald-300">−{formatUsd(quote.discountAmountMinor)}</dd>
        </> : null}
        <dt className="border-t border-white/10 pt-2 font-semibold text-white">{quote.amountDueMinor === 0 ? "Amount due" : "Due today"}</dt>
        <dd className="border-t border-white/10 pt-2 text-right font-semibold text-white">{formatUsd(quote.amountDueMinor)}</dd>
      </dl>
      {sponsored ? (
        <p className="mt-3 leading-6 text-emerald-100">
          Music City covers this fee through the {quote.campaignCode ?? "early-user"} offer. No payment or transaction is needed.
          {quote.status === "eligible" ? " Artist access activates when you finish registration." : " Your artist access is active."}
        </p>
      ) : (
        <p className="mt-3 leading-6 text-slate-400">The early-user offer is not available for this account.</p>
      )}
      {quote.status === "sponsored" && quote.activatedAt ? <p className="mt-2 text-xs text-emerald-100/70">Activated {new Date(quote.activatedAt).toLocaleDateString()} · terms {quote.termsRevision}</p> : null}
    </section>
  );
};
