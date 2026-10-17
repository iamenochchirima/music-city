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
  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
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
    if (mode === "revise" && !resolution.trim())
      invalid.resolution = "Describe the change";
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
  return (
    <form
      onSubmit={save}
      className="space-y-6 rounded-lg border border-border bg-card p-5 sm:p-6"
      aria-label={title}
    >
      <h1 className="text-2xl font-semibold">{title}</h1>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {initialTrackId || current ? (
        <div>
          <p className="text-xs text-muted-foreground">Recording</p>
          <p className="mt-1 font-medium">
            {detail?.context.track.title ??
              tracks.find((t) => t.id === trackId)?.title}
          </p>
        </div>
      ) : (
        <FormField id="agreement-track" label="Recording" error={errors.track}>
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
      <FormSection title="Contributors">
        <div className="divide-y divide-border">
          {rows.map((row, i) => (
            <div
              key={row.person.walletAddress}
              className="grid min-w-0 gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_150px_100px_auto] sm:items-end"
            >
              <div className="min-w-0 self-center">
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
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {royaltyRecipientRoleSchema.options.map((role) => (
                    <option key={role} value={role}>
                      {role.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField
                id={`agreement-share-${i}`}
                label="Share %"
                error={errors[`share-${i}`]}
              >
                <Input
                  disabled={busy}
                  inputMode="decimal"
                  value={row.percentage}
                  onChange={(e) =>
                    setRows((old) =>
                      old.map((r, n) =>
                        n === i ? { ...r, percentage: e.target.value } : r,
                      ),
                    )
                  }
                />
              </FormField>
              <Button
                type="button"
                variant="ghost"
                disabled={busy || rows.length === 1}
                aria-label={`Remove ${row.person.name}`}
                onClick={() => setRows((old) => old.filter((_, n) => n !== i))}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
        <div className="flex justify-end text-sm" role="status">
          <span
            className={total === 10000 ? "text-primary" : "text-destructive"}
          >
            Total {Number(total / 100).toFixed(2)}%
          </span>
        </div>
        {errors.total && (
          <p role="alert" className="text-sm text-destructive">
            {errors.total}
          </p>
        )}
        {rows.length < 20 && (
          <div className="space-y-2">
            <FormField id="agreement-contributor" label="Add contributor">
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
            {query.trim().length >= 2 &&
              !searching &&
              !lookupError &&
              !matches.length && (
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
                          (r) =>
                            r.person.walletAddress === person.walletAddress,
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
      <FormField id="agreement-terms" label="Additional terms (optional)">
        <Textarea
          disabled={busy}
          value={terms}
          maxLength={2000}
          onChange={(e) => setTerms(e.target.value)}
        />
      </FormField>
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
      <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-5">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button disabled={busy}>{busy ? "Saving…" : "Save draft"}</Button>
      </div>
    </form>
  );
}
