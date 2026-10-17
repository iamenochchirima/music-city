import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
  useLocation,
} from "react-router-dom";
import type { AgreementDetail, TrackSummary } from "@music-city/shared";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { tracksApi } from "@/features/music/lib/tracks-api";
import { agreementApi, agreementStateLabel } from "./agreement-api";
import { useAgreementResource } from "./use-agreement-resource";
import { AgreementEditor } from "./agreement-editor";
import { AgreementDetailPanel } from "./agreement-detail";

type Session = NonNullable<ReturnType<typeof useAuth>["session"]>;
export function AgreementsOverview() {
  const { session, connectWallet } = useAuth();
  if (!session?.token)
    return (
      <section className="studio-theme space-y-4 py-4">
        <h1 className="text-2xl font-semibold text-foreground">
          Royalty agreements
        </h1>
        <Button onClick={() => void connectWallet()}>
          Sign in to continue
        </Button>
      </section>
    );
  return <SignedInAgreements key={session.walletAddress} session={session} />;
}
function SignedInAgreements({ session }: { session: Session }) {
  const { agreementId } = useParams();
  const [search] = useSearchParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const creating = pathname.endsWith("/new");
  const [editor, setEditor] = useState<"edit" | "revise" | null>(null);
  const [busy, setBusy] = useState(false);
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [resolvingTrack, setResolvingTrack] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);
  const token = session.token!;
  const list = useAgreementResource(
    `list:${token}`,
    () => agreementApi.list(token),
    busy || !!editor || creating || !!agreementId,
  );
  const resource = useAgreementResource<AgreementDetail | null>(
    `${token}:${agreementId ?? ""}`,
    () =>
      agreementId
        ? agreementApi.detail(token, agreementId)
        : Promise.resolve(null),
    busy || !!editor || !agreementId,
  );
  useEffect(() => {
    setEditor(null);
    setBusy(false);
  }, [agreementId, creating]);
  useEffect(() => {
    if (!session.artistAccess) return;
    let active = true;
    void tracksApi
      .listMyTracks(token)
      .then((items) => {
        if (active) {
          setTracks(items);
          setTrackError(null);
        }
      })
      .catch((e) => {
        if (active)
          setTrackError(
            e instanceof Error ? e.message : "Could not load recordings",
          );
      });
    return () => {
      active = false;
    };
  }, [token, session.artistAccess]);
  const trackId = search.get("track") ?? undefined;
  useEffect(() => {
    if (!creating || !trackId) {
      setResolvingTrack(false);
      return;
    }
    let active = true;
    setResolvingTrack(true);
    void agreementApi
      .forTrack(token, trackId)
      .then((result) => {
        if (active && result.id)
          navigate(`/account/agreements/${result.id}`, { replace: true });
      })
      .catch((e) => {
        if (active)
          setTrackError(
            e instanceof Error ? e.message : "Could not open the recording",
          );
      })
      .finally(() => {
        if (active) setResolvingTrack(false);
      });
    return () => {
      active = false;
    };
  }, [creating, trackId, token, navigate]);

  function saved(id: string) {
    setEditor(null);
    navigate(`/account/agreements/${id}`);
    void resource.refresh();
    void list.refresh();
  }
  const detail = resource.value;
  const owner = detail?.context.owner ?? {
    walletAddress: session.walletAddress,
    profileId: "",
    name: session.displayName || "You",
  };
  const title = (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
      <h1 className="text-2xl font-semibold">Royalty agreements</h1>
      {session.artistAccess && tracks.length > 0 && (
        <Button asChild>
          <Link to="/account/agreements/new">New agreement</Link>
        </Button>
      )}
    </div>
  );
  return (
    <div className="studio-theme space-y-6 text-foreground">
      {(agreementId || creating) && (
        <Link
          to="/account/agreements"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          All agreements
        </Link>
      )}
      {creating || editor ? (
        resolvingTrack ? (
          <p role="status">Opening agreement…</p>
        ) : trackError ? (
          <p role="alert">{trackError}</p>
        ) : !session.artistAccess ? (
          <p>
            Create agreements from an artist account. You can still respond to
            proposals.
          </p>
        ) : !tracks.length ? (
          <p role="status">Loading recordings…</p>
        ) : creating && trackId && !tracks.some((t) => t.id === trackId) ? (
          <p role="alert">Recording not found</p>
        ) : (
          <AgreementEditor
            key={`${agreementId ?? "new"}:${editor ?? "create"}`}
            token={token}
            owner={owner}
            tracks={tracks}
            trackId={trackId}
            detail={detail ?? undefined}
            mode={editor ?? "create"}
            onSaved={saved}
            onCancel={() => {
              setEditor(null);
              if (creating) navigate("/account/agreements");
            }}
          />
        )
      ) : agreementId ? (
        <>
          {resource.loading && (
            <p role="status" className="flex items-center gap-2">
              <LoaderCircle className="size-4 animate-spin" />
              Loading agreement…
            </p>
          )}
          {resource.error && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3 text-sm"
            >
              <span>
                {detail ? "Status check interrupted" : resource.error}
              </span>
              <Button variant="outline" onClick={() => void resource.refresh()}>
                Retry status check
              </Button>
            </div>
          )}
          {detail && (
            <AgreementDetailPanel
              key={detail.id}
              detail={detail}
              token={token}
              versionNumber={
                search.has("version")
                  ? Number(search.get("version"))
                  : undefined
              }
              onRefresh={resource.refresh}
              onEdit={setEditor}
              onBusy={setBusy}
            />
          )}
        </>
      ) : (
        <>
          {title}
          {list.error && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3 text-sm"
            >
              <span>{list.error}</span>
              <Button variant="outline" onClick={() => void list.refresh()}>
                Try again
              </Button>
            </div>
          )}
          {list.loading ? (
            <p role="status">Loading agreements…</p>
          ) : !list.value?.items.length && !list.error ? (
            <div className="space-y-3 py-8">
              <h2 className="font-medium">No agreements yet</h2>
              <p className="text-sm text-muted-foreground">
                Proposals for your account will appear here.
              </p>
              {session.artistAccess && !tracks.length && (
                <Button asChild variant="outline">
                  <Link to="/dashboard/tracks">Go to recordings</Link>
                </Button>
              )}
            </div>
          ) : list.value?.items.length ? (
            <ul className="divide-y divide-border">
              {list.value.items.map((item) => (
                <li key={item.id}>
                  <Link
                    to={`/account/agreements/${item.id}`}
                    className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="min-w-0">
                      <h2 className="break-words font-medium">
                        {item.context.track.title}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.context.owner.name} · Version{" "}
                        {item.current.proposal.version}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {agreementStateLabel(item.current.state)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}
