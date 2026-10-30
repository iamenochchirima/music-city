import { useEffect, useState, type FormEvent } from "react";
import {
  royaltyRecipientRoleSchema,
  type AgreementDetail,
  type AgreementPerson,
  type TrackSummary,
} from "@music-city/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { FormSection } from "@/components/studio/form-section";
import { agreementApi, compactWallet } from "./agreement-api";

type Row = {
  person: AgreementPerson;
  role: (typeof royaltyRecipientRoleSchema.options)[number];
  percentage: string;
};
export function AgreementEditor({
  token,
  owner,
  tracks,
  trackId: initialTrackId,
  detail,
  mode,
  onSaved,
  onCancel,
}: {
  token: string;
  owner: AgreementPerson;
  tracks: TrackSummary[];
  trackId?: string;
  detail?: AgreementDetail;
  mode: "create" | "edit" | "revise";
  onSaved: (id: string) => void;
  onCancel: () => void;
}) {
  const current = detail?.versions.find(
    (v) => v.proposal.version === detail.currentVersion,
  );
  const [trackId, setTrackId] = useState(
    initialTrackId ?? current?.proposal.trackId ?? tracks[0]?.id ?? "",
  );
  const [rows, setRows] = useState<Row[]>(
    current
      ? current.proposal.recipients.map((r) => ({
          person: detail!.context.people.find(
            (p) => p.walletAddress === r.walletAddress,
          )!,
          role: r.role,
          percentage: (r.shareBps / 100).toFixed(2),
        }))
      : [{ person: owner, role: "artist", percentage: "100" }],
  );
  const [terms, setTerms] = useState(current?.proposal.terms ?? "");
  const [resolution, setResolution] = useState("");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<AgreementPerson[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  useEffect(() => {
    let active = true;
    setMatches([]);
    setLookupError(null);
    setSearching(query.trim().length >= 2);
    if (query.trim().length < 2) return;
    const timer = setTimeout(() => {
      void agreementApi
        .contributors(token, query)
        .then((r) => {
          if (active) setMatches(r.items);
        })
        .catch((e) => {
          if (active)
            setLookupError(
              e instanceof Error ? e.message : "Search unavailable",
            );
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, token]);
  const total = rows.reduce(
    (sum, r) =>
      sum +
      (/^(?:\d{1,3})(?:\.\d{1,2})?$/.test(r.percentage)
        ? Math.round(Number(r.percentage) * 100)
        : 0),
    0,
  );
  function validateShares() {
    const invalid: Record<string, string> = {};
    if (!trackId) invalid.track = "Choose a recording";
    rows.forEach((r, i) => {
      if (
        !/^\d{1,3}(\.\d{1,2})?$/.test(r.percentage) ||
        Number(r.percentage) <= 0 ||
        Number(r.percentage) > 100
      )
        invalid[`share-${i}`] =
          "Enter a share above 0%, with at most 2 decimal places";
    });
    if (total !== 10000) invalid.total = "Shares must total 100%";
    if (!rows.length) invalid.total = "Add at least one contributor";
    if (new Set(rows.map((r) => r.person.walletAddress)).size !== rows.length)
      invalid.total = "Choose each contributor once";
    return invalid;
  }
  function continueStep(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (step === 1) {
      const invalid: Record<string, string> = {};
      if (!trackId) invalid.track = "Choose a recording";
      if (!rows.length) invalid.total = "Add at least one contributor";
      setErrors(invalid);
      if (!Object.keys(invalid).length) setStep(2);
      return;
    }
    if (step === 2) {
      const invalid = validateShares();
      setErrors(invalid);
      if (!Object.keys(invalid).length) setStep(3);
      return;
    }
    void save(event);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const invalid = validateShares();
    setErrors(invalid);
    if (Object.keys(invalid).length) return;
    setBusy(true);
    const body = {
      recipients: rows.map((r) => ({
        walletAddress: r.person.walletAddress,
        role: r.role,
        shareBps: Math.round(Number(r.percentage) * 100),
      })),
      terms: terms.trim(),
      ...(mode === "create"
        ? { trackId }
        : {
            expectedVersion: detail!.currentVersion,
            expectedHash: current!.proposalHash,
          }),
      ...(mode === "revise" ? { resolution: resolution.trim() } : {}),
    };
    try {
      if (mode === "create") {
        const existing = await agreementApi.forTrack(token, trackId);
        if (existing.id) {
          onSaved(existing.id);
          return;
        }
      }
      const result = await agreementApi.save(
        token,
        detail?.id ?? null,
        mode,
        body,
      );
      onSaved(result.version.proposal.agreementId);
    } catch (e) {
      // Recover the saved result before offering another mutation after a lost HTTP response.
      try {
        const id =
          detail?.id ?? (await agreementApi.forTrack(token, trackId)).id;
        if (id) {
          const saved = await agreementApi.detail(token, id);
          const next = saved.versions.find(
            (v) => v.proposal.version === saved.currentVersion,
          );
          const exact =
            next?.proposal.terms === body.terms &&
            body.recipients.length === next.proposal.recipients.length &&
            body.recipients.every((r) =>
              next.proposal.recipients.some(
                (v) =>
                  v.walletAddress === r.walletAddress &&
                  v.role === r.role &&
                  v.shareBps === r.shareBps,
              ),
            );
          if (
            exact &&
            (mode !== "revise" ||
              saved.currentVersion === detail!.currentVersion + 1)
          ) {
            onSaved(id);
            return;
          }
        }
      } catch {}
      setError(e instanceof Error ? e.message : "Could not save the agreement");
    } finally {
      setBusy(false);
    }
  }
  const title =
    mode === "create"
      ? "New agreement"
      : mode === "edit"
        ? "Edit draft"
        : "Revise agreement";
  const trackTitle =
    detail?.context.track.title ?? tracks.find((t) => t.id === trackId)?.title;
  const steps = ["Song & people", "Shares", "Review"] as const;
  return (
    <form
      onSubmit={continueStep}
      className="space-y-6 rounded-lg border border-border bg-card p-5 sm:p-6"
      aria-label={title}
    >
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {mode === "create" ? "Set up a song split" : "Update this agreement"}
        </p>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          Choose who earns from this recording, set shares that total 100%, then
          review before saving.
        </p>
      </header>

      <ol
        aria-label="Agreement setup steps"
        className="grid grid-cols-3 gap-2 border-b border-border pb-4"
      >
        {steps.map((label, index) => {
          const number = (index + 1) as 1 | 2 | 3;
          return (
            <li key={label}>
              <button
                type="button"
                disabled={busy || number > step}
                aria-current={step === number ? "step" : undefined}
                onClick={() => setStep(number)}
                className={`w-full rounded-md px-2 py-2 text-left text-sm ${
                  step === number
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground"
                } disabled:cursor-default`}
              >
                <span className="mr-2 inline-flex size-6 items-center justify-center rounded-full border border-current text-xs">
                  {number}
                </span>
                {label}
              </button>
            </li>
          );
        })}
      </ol>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {step === 1 && (
        <div className="space-y-6">
          {initialTrackId || current ? (
            <section className="rounded-md border border-border p-4">
              <p className="text-xs text-muted-foreground">Recording</p>
              <p className="mt-1 font-medium">{trackTitle}</p>
            </section>
          ) : (
            <FormField
              id="agreement-track"
              label="Which recording is this for?"
              error={errors.track}
            >
              <select
                disabled={busy}
                required
                value={trackId}
                onChange={(e) => setTrackId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3"
              >
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          <FormSection title="Who should share the earnings?">
            <p className="mb-2 text-sm text-muted-foreground">
              The artist is included. Add each contributor who should receive a
              share; you’ll set the percentages next.
            </p>
            <ul className="divide-y divide-border">
              {rows.map((row, i) => (
                <li
                  key={row.person.walletAddress}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium">{row.person.name}</p>
                    <p
                      title={row.person.walletAddress}
                      className="mt-1 text-xs text-muted-foreground"
                    >
                      {compactWallet(row.person.walletAddress)}
                    </p>
                  </div>
                  <FormField id={`agreement-role-${i}`} label="Role">
                    <select
                      disabled={busy}
                      value={row.role}
                      onChange={(e) =>
                        setRows((old) =>
                          old.map((r, n) =>
                            n === i
                              ? { ...r, role: e.target.value as Row["role"] }
                              : r,
                          ),
                        )
                      }
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {royaltyRecipientRoleSchema.options.map((role) => (
                        <option key={role} value={role}>
                          {role.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy || row.person.walletAddress === owner.walletAddress}
                    aria-label={`Remove ${row.person.name}`}
                    onClick={() => setRows((old) => old.filter((_, n) => n !== i))}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
            {errors.total && (
              <p role="alert" className="text-sm text-destructive">
                {errors.total}
              </p>
            )}
            {rows.length < 20 && (
              <div className="mt-4 space-y-2">
                <FormField id="agreement-contributor" label="Add a contributor">
                  <Input
                    disabled={busy}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name or wallet"
                    autoComplete="off"
                  />
                </FormField>
                {searching && (
                  <p role="status" className="text-sm text-muted-foreground">
                    Searching…
                  </p>
                )}
                {lookupError && (
                  <p role="alert" className="text-sm text-destructive">
                    {lookupError}
                  </p>
                )}
                {query.trim().length >= 2 && !searching && !lookupError && !matches.length && (
                  <p className="text-sm text-muted-foreground">
                    No matching Music City accounts
                  </p>
                )}
                {matches.length > 0 && (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {matches.map((person) => (
                      <li key={person.walletAddress}>
                        <button
                          type="button"
                          disabled={
                            busy ||
                            rows.some(
                              (r) => r.person.walletAddress === person.walletAddress,
                            )
                          }
                          className="flex w-full flex-wrap justify-between gap-2 p-3 text-left text-sm hover:bg-muted disabled:opacity-50"
                          onClick={() => {
                            setRows((old) => [
                              ...old,
                              { person, role: "producer", percentage: "" },
                            ]);
                            setQuery("");
                          }}
                        >
                          <span>{person.name}</span>
                          <span className="text-muted-foreground">
                            {compactWallet(person.walletAddress)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </FormSection>
        </div>
      )}

      {step === 2 && (
        <section className="space-y-5">
          <div>
            <h2 className="font-semibold">Set each person’s share</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Shares must add up to exactly 100%. Agree on the percentages with
              contributors before sending the proposal.
            </p>
          </div>
          <ul className="divide-y divide-border rounded-md border border-border px-4">
            {rows.map((row, i) => (
              <li
                key={row.person.walletAddress}
                className="flex flex-wrap items-center justify-between gap-4 py-3"
              >
                <div>
                  <p className="font-medium">{row.person.name}</p>
                  <p className="text-sm capitalize text-muted-foreground">
                    {row.role.replaceAll("_", " ")}
                  </p>
                </div>
                <FormField
                  id={`agreement-share-${i}`}
                  label="Share %"
                  error={errors[`share-${i}`]}
                >
                  <Input
                    disabled={busy}
                    inputMode="decimal"
                    value={row.percentage}
                    aria-describedby="agreement-share-help"
                    onChange={(e) =>
                      setRows((old) =>
                        old.map((r, n) =>
                          n === i ? { ...r, percentage: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </FormField>
              </li>
            ))}
          </ul>
          <p id="agreement-share-help" className="text-xs text-muted-foreground">
            Enter a number from 0.01 to 100, with up to 2 decimal places.
          </p>
          <div className="space-y-2 rounded-md bg-muted/40 p-4" role="status">
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span>Allocated</span>
              <span className={total === 10000 ? "font-medium text-primary" : "font-medium"}>
                {Number(total / 100).toFixed(2)}% of 100%
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Allocated share"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(100, Math.max(0, total / 100))}
              className="h-2 overflow-hidden rounded-full bg-background"
            >
              <div
                className={`h-full ${total === 10000 ? "bg-primary" : "bg-amber-500"}`}
                style={{ width: `${Math.min(100, Math.max(0, total / 100))}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {total === 10000
                ? "The split is complete."
                : total < 10000
                  ? `${Number((10000 - total) / 100).toFixed(2)}% left to assign.`
                  : `${Number((total - 10000) / 100).toFixed(2)}% over the limit.`}
            </p>
          </div>
          {errors.total && (
            <p role="alert" className="text-sm text-destructive">
              {errors.total}
            </p>
          )}
        </section>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <section className="space-y-4 rounded-md border border-border p-4">
            <div>
              <p className="text-xs text-muted-foreground">Recording</p>
              <p className="mt-1 font-medium">{trackTitle}</p>
            </div>
            <div>
              <h2 className="font-semibold">Earnings split</h2>
              <ul className="mt-2 divide-y divide-border">
                {rows.map((row) => (
                  <li
                    key={row.person.walletAddress}
                    className="flex flex-wrap justify-between gap-2 py-2 text-sm"
                  >
                    <span>
                      {row.person.name} · {row.role.replaceAll("_", " ")}
                    </span>
                    <span className="font-medium">{row.percentage}%</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-right text-sm font-medium">Total 100%</p>
            </div>
          </section>
          <p className="text-sm text-muted-foreground">
            Saving creates a draft only. You can review it, then send it to each
            contributor for their own approval and signature.
          </p>
          {mode === "revise" && (
            <FormField
              id="agreement-resolution"
              label="What changed?"
              error={errors.resolution}
            >
              <Textarea
                disabled={busy}
                value={resolution}
                maxLength={1000}
                onChange={(e) => setResolution(e.target.value)}
              />
            </FormField>
          )}
          <details className="rounded-md border border-border p-4">
            <summary className="cursor-pointer text-sm font-medium">
              Optional agreement details
            </summary>
            <div className="mt-4 space-y-4">
              <FormField id="agreement-terms" label="Additional terms (optional)">
                <Textarea
                  disabled={busy}
                  value={terms}
                  maxLength={2000}
                  onChange={(e) => setTerms(e.target.value)}
                />
              </FormField>
            </div>
          </details>
        </div>
      )}

      <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-5">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={step === 1 ? onCancel : () => setStep((step - 1) as 1 | 2 | 3)}
          >
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          {step > 1 && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={onCancel}
            >
              Cancel setup
            </Button>
          )}
        </div>
        <Button disabled={busy}>
          {busy
            ? "Saving…"
            : step === 1
              ? "Continue to shares"
              : step === 2
                ? "Review split"
                : "Save draft"}
        </Button>
      </div>
    </form>
  );
}
