import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { post, readAsBase64, usePoll } from "./api";
import { Mosaic, Reel, SongScreen } from "./Reel";
import type { Engine, Fact, Gate, Setup, Stage, VideoSummary, VideoView } from "../types";

const STAGE_LABELS: Record<Stage, string> = { facts: "Facts", story: "Story", song: "Song", scene: "Animation", frames: "Frames", render: "Final" };
const WORKING_LINES: Record<Stage, string> = { facts: "Researching the facts", story: "Writing the story", song: "Writing the song", scene: "Building the animation", frames: "Rendering sample frames", render: "Rendering the final video" };
const CONFIDENCE: Record<Fact["confidence"], string> = { primary: "Primary source", secondary: "Secondary source", "single-source": "Only one source", assumed: "Assumed", illustrative: "Illustrative" };
const WEAK = new Set<Fact["confidence"]>(["single-source", "assumed", "illustrative"]);
const GATE_LINES: Record<Gate, string> = { facts: "Check the facts", song: "Listen to the song", frames: "Look through the frames" };
const POLL_MS = 1500;
const FALLBACK_COLORS = ["#ffd84a", "#86f0c2", "#7f83f2", "#ff9ec7", "#6fd3ff"];

const useHash = () => {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const update = () => setHash(window.location.hash);
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return hash;
};

const go = (hash: string) => {
  window.location.hash = hash;
};

const elapsed = (seconds: number) => (seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`);

const statusLine = (v: VideoSummary) => {
  if (v.phase === "working") return "Being made now";
  if (v.phase === "waiting" && v.gate) return `Waiting for you: ${v.gate}`;
  if (v.phase === "blocked") return "Stopped, needs you";
  if (v.phase === "paused") return "Paused";
  return "Finished";
};

const Problem: React.FC<{ message?: string }> = ({ message }) => (message ? <p className="problem" role="alert">{message}</p> : null);

/** Runs an action, showing its failure in place. */
const useAction = () => {
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { error, busy, run };
};

const Connect: React.FC<{ setup: Setup; onDone: () => void }> = ({ setup, onDone }) => {
  const [key, setKey] = useState("");
  const { error, busy, run } = useAction();
  return (
    <section className="connect">
      <h2>Connect Claude</h2>
      <p>Video Gen uses your own Claude account to research and write each video. Do this once.</p>
      {setup.plan === "not-installed" ? (
        <p>To use a Claude plan, install Claude Code first, then come back to this page.</p>
      ) : (
        <div className="connect-option">
          <h3>Use your Claude plan</h3>
          <p>Sign in on Anthropic's page in a new tab. Videos then count towards your plan's usage.</p>
          <button className="btn" disabled={busy} onClick={() => void run(() => post("/api/setup/sign-in"))}>Sign in to Claude</button>
        </div>
      )}
      <form
        className="connect-option"
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            await post("/api/setup/key", { key });
            setKey("");
            onDone();
          });
        }}
      >
        <h3>{setup.plan === "not-installed" ? "Use an API key" : "Or use an API key"}</h3>
        <label htmlFor="api-key">Your key is saved on this computer and only your account can read it. You're billed for what each video uses.</label>
        <input id="api-key" type="password" autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} />
        <button className="btn quiet" disabled={busy || key.length === 0}>Save key</button>
      </form>
      <Problem message={error} />
    </section>
  );
};

const NewVideo: React.FC<{ setup: Setup; refreshSetup: () => void }> = ({ setup, refreshSetup }) => {
  const [brief, setBrief] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [over, setOver] = useState(false);
  const [limit, setLimit] = useState("10");
  const signedIn = setup.plan === "signed-in";
  const [choice, setChoice] = useState<Engine>();
  const engine: Engine | undefined = choice ?? (signedIn ? "claude-code" : setup.hasKey ? "api" : undefined);
  const { error, busy, run } = useAction();
  const input = useRef<HTMLInputElement>(null);
  const add = (list: FileList | null) => {
    if (list) setFiles((current) => [...current, ...Array.from(list).filter((f) => !current.some((c) => c.name === f.name))]);
  };
  const start = () =>
    run(async () => {
      const uploads = await Promise.all(files.map(async (file) => ({ name: file.name, data: await readAsBase64(file) })));
      const { slug } = await post<{ slug: string }>("/api/videos", { brief, engine, uploads, maxUsd: engine === "api" ? Number(limit) : undefined });
      go(`#/video/${slug}`);
    });

  return (
    <main className="split">
      <Reel caption={brief.trim() || "Your video starts here"}>
        <Mosaic seed="new video" progress={0} colors={FALLBACK_COLORS} />
      </Reel>
      <div className="step">
        <h1>What should the video explain?</h1>
        {!engine ? (
          <Connect setup={setup} onDone={refreshSetup} />
        ) : (
          <>
            <label htmlFor="brief" className="sr-only">Describe the video</label>
            <textarea id="brief" rows={4} value={brief} maxLength={2000} placeholder="How a black hole bends light" onChange={(e) => setBrief(e.target.value)} />
            <div
              className={over ? "drop over" : "drop"}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                add(e.dataTransfer.files);
              }}
            >
              <p>Have notes or articles? Add them and the video will use them as sources. Text, Markdown, CSV or PDF.</p>
              <button type="button" className="btn quiet" onClick={() => input.current?.click()}>Add files</button>
              <input ref={input} type="file" multiple hidden accept=".txt,.md,.csv,.pdf" onChange={(e) => add(e.target.files)} />
              {files.length > 0 ? (
                <ul className="files">
                  {files.map((file) => (
                    <li key={file.name}>
                      {file.name}
                      <button type="button" className="link" aria-label={`Remove ${file.name}`} onClick={() => setFiles((c) => c.filter((f) => f !== file))}>Remove</button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="fine">Only add files you have the right to use. They're sent to Anthropic for Claude to read, and aren't shared with anyone else.</p>
            </div>
            {signedIn && setup.hasKey ? (
              <fieldset className="choice">
                <legend>Pay for it with</legend>
                <label><input type="radio" name="engine" checked={engine === "claude-code"} onChange={() => setChoice("claude-code")} /> My Claude plan</label>
                <label><input type="radio" name="engine" checked={engine === "api"} onChange={() => setChoice("api")} /> My API key</label>
              </fieldset>
            ) : null}
            {engine === "api" ? (
              <label className="limit">
                Stop if it costs more than $
                <input type="number" min={1} max={200} value={limit} onChange={(e) => setLimit(e.target.value)} />
              </label>
            ) : null}
            {setup.runningSlug ? <p>Another video is being made. You can start this one when that finishes.</p> : null}
            <Problem message={error} />
            <button className="btn big" disabled={busy || brief.trim().length < 10 || Boolean(setup.runningSlug)} onClick={() => void start()}>Start video</button>
            <p className="fine">Takes about half an hour. It stops three times for you to check the work.</p>
            {setup.graphics.state === "ready" && setup.graphics.mode === "software" ? <p className="fine">This computer has no graphics card the renderer can use. Videos still work but take longer to render.</p> : null}
            {setup.graphics.state === "failed" ? <Problem message={`Rendering won't work on this computer yet: ${setup.graphics.message}`} /> : null}
          </>
        )}
      </div>
    </main>
  );
};

const StageBar: React.FC<{ video: VideoView }> = ({ video }) => (
  <ol className="stages">
    {video.stages.map((stage) => (
      <li key={stage.id} className={`stage ${stage.state}`} aria-current={stage.state === "current" || stage.state === "waiting" ? "step" : undefined}>
        <span className="stage-block" />
        {STAGE_LABELS[stage.id]}
      </li>
    ))}
  </ol>
);

const SendBack: React.FC<{ slug: string; stage: Stage; label: string; hint: string }> = ({ slug, stage, label, hint }) => {
  const [note, setNote] = useState("");
  const { error, busy, run } = useAction();
  return (
    <details className="send-back">
      <summary>{label}</summary>
      <label htmlFor="note">{hint}</label>
      <textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      <Problem message={error} />
      <button className="btn quiet" disabled={busy || note.trim().length === 0} onClick={() => void run(() => post(`/api/videos/${slug}/revise`, { stage, note }))}>Send back</button>
    </details>
  );
};

const Approve: React.FC<{ slug: string; gate: Gate }> = ({ slug, gate }) => {
  const { error, busy, run } = useAction();
  return (
    <>
      <Problem message={error} />
      <button className="btn big" disabled={busy} onClick={() => void run(() => post(`/api/videos/${slug}/approve`, { gate }))}>Approve {gate}</button>
    </>
  );
};

const Source: React.FC<{ source: string }> = ({ source }) => {
  if (source.startsWith("upload:")) return <>{source.slice("upload:".length)}</>;
  try {
    const url = new URL(source);
    if (url.protocol === "https:" || url.protocol === "http:") return <a href={url.href} target="_blank" rel="noreferrer noopener">{url.hostname.replace(/^www\./, "")}</a>;
  } catch {
    // Not a link, so it's shown as plain text.
  }
  return <>{source}</>;
};

const factValue = (fact: Fact) => `${Array.isArray(fact.value) ? fact.value.join(", ") : fact.value}${fact.unit ? ` ${fact.unit}` : ""}`;

const Facts: React.FC<{ facts: Fact[] }> = ({ facts }) => (
  <ul className="facts">
    {facts.map((fact) => (
      <li key={fact.id}>
        <p className="fact-value">{factValue(fact)}</p>
        <p>{fact.claim}</p>
        <p className="fine">
          <span className={WEAK.has(fact.confidence) ? "weak" : undefined}>{CONFIDENCE[fact.confidence]}</span>
          {fact.sources.map((source) => (
            <span key={source} className="source"><Source source={source} /></span>
          ))}
        </p>
        {fact.note ? <p className="fine">{fact.note}</p> : null}
      </li>
    ))}
  </ul>
);

const Cost: React.FC<{ video: VideoView }> = ({ video }) => {
  if (video.costUsd === 0) return null;
  return <p className="fine">{video.engine === "claude-code" ? `Included in your Claude plan. Worth $${video.costUsd.toFixed(2)} at API prices so far.` : `$${video.costUsd.toFixed(2)} spent of your $${video.maxUsd.toFixed(2)} limit.`}</p>;
};

const Details: React.FC<{ video: VideoView }> = ({ video }) =>
  video.log.length > 0 ? (
    <details className="log">
      <summary>Show details</summary>
      <pre>{video.log.join("\n")}</pre>
    </details>
  ) : null;

const Stopped: React.FC<{ video: VideoView }> = ({ video }) => {
  const { error, busy, run } = useAction();
  const blocked = video.blocked;
  const [limit, setLimit] = useState(String(Math.ceil(video.maxUsd + 5)));
  if (!blocked) {
    return (
      <>
        <h2>Paused partway through</h2>
        <p>Nothing is lost. It picks up from the last finished step.</p>
        <Problem message={video.failure} />
        <Problem message={error} />
        <button className="btn big" disabled={busy} onClick={() => void run(() => post(`/api/videos/${video.slug}/continue`))}>Continue</button>
      </>
    );
  }
  return (
    <>
      <h2>Stopped at {STAGE_LABELS[blocked.stage].toLowerCase()}</h2>
      <Problem message={blocked.message} />
      <Problem message={error} />
      {blocked.overBudget ? (
        <>
          <label className="limit">
            Raise the limit to $
            <input type="number" min={1} max={200} value={limit} onChange={(e) => setLimit(e.target.value)} />
          </label>
          <button className="btn big" disabled={busy} onClick={() => void run(() => post(`/api/videos/${video.slug}/revise`, { stage: blocked.stage, note: "", maxUsd: Number(limit) }))}>Raise limit and try again</button>
        </>
      ) : (
        <button className="btn big" disabled={busy} onClick={() => void run(() => post(`/api/videos/${video.slug}/revise`, { stage: blocked.stage, note: "" }))}>Try again</button>
      )}
      <SendBack slug={video.slug} stage={blocked.stage} label="Try again with a note" hint="What should be different this time?" />
    </>
  );
};

const VideoPage: React.FC<{ slug: string }> = ({ slug }) => {
  const { value: video, missing } = usePoll<VideoView>(`/api/videos/${slug}`, POLL_MS);
  const audio = useRef<HTMLAudioElement>(null);
  const [still, setStill] = useState(0);
  const stop = useAction();
  const song = useAction();

  if (missing) return <main className="step"><h1>That video doesn't exist</h1><a className="btn" href="#/">See your videos</a></main>;
  if (!video) return null;

  const stills = video.stills ?? [];
  const showing = stills[Math.min(still, stills.length - 1)];
  const working = video.phase === "working";
  const media = `/media/${slug}`;

  let screen = <Mosaic seed={slug} progress={video.progress} colors={video.colors} moving={working} />;
  let caption: string | undefined = video.title;
  if (!working && video.gate === "song" && video.hasAudio) {
    screen = <SongScreen audio={audio} src={`${media}/audio.wav`} color={video.colors[0]} />;
    caption = undefined;
  } else if (!working && video.gate === "frames" && showing) {
    screen = <img className="reel-fill" src={`${media}/${showing}`} alt={`Frame ${still + 1} of ${stills.length}`} />;
    caption = undefined;
  } else if (!working && video.phase === "done" && video.hasVideo) {
    screen = <video className="reel-fill" src={`${media}/video.mp4`} controls playsInline />;
    caption = undefined;
  }

  return (
    <main className="split">
      <Reel caption={caption}>{screen}</Reel>
      <div className="step">
        <h1>{video.title}</h1>
        <StageBar video={video} />

        {working && video.activity ? (
          <>
            <h2>{WORKING_LINES[video.activity.stage]}</h2>
            <p>{video.activity.detail.charAt(0).toUpperCase() + video.activity.detail.slice(1)}. {elapsed(video.activity.seconds)} so far.</p>
            <p className="fine">You can close this page and come back. Keep the Video Gen window open.</p>
            <Problem message={stop.error} />
            {video.canStop ? <button className="btn quiet" disabled={stop.busy} onClick={() => void stop.run(() => post(`/api/videos/${slug}/stop`))}>Stop</button> : null}
          </>
        ) : null}

        {!working && video.gate === "facts" ? (
          <>
            <h2>{GATE_LINES.facts}</h2>
            <p>Everything in the video comes from these. Open the sources for anything that looks wrong.</p>
            <Facts facts={video.facts ?? []} />
            <Approve slug={slug} gate="facts" />
            <SendBack slug={slug} stage="facts" label="Change the facts" hint="What should change?" />
          </>
        ) : null}

        {!working && video.gate === "song" ? (
          <>
            <h2>{GATE_LINES.song}</h2>
            <p>The animation is built around this song, so it can't change afterwards.</p>
            <audio ref={audio} src={`${media}/audio.wav`} controls />
            <Problem message={song.error} />
            <div className="actions">
              <Approve slug={slug} gate="song" />
              <button className="btn quiet" disabled={song.busy} onClick={() => void song.run(() => post(`/api/videos/${slug}/revise`, { stage: "song", note: "another" }))}>Try another song</button>
            </div>
          </>
        ) : null}

        {!working && video.gate === "frames" ? (
          <>
            <h2>{GATE_LINES.frames}</h2>
            <p>One frame from each shot. Check that each one shows what it should.</p>
            <div className="thumbs">
              {stills.map((name, i) => (
                <button key={name} className={i === still ? "thumb on" : "thumb"} aria-label={`Show frame ${i + 1}`} aria-pressed={i === still} onClick={() => setStill(i)}>
                  <img src={`${media}/${name}`} alt="" />
                </button>
              ))}
            </div>
            <Approve slug={slug} gate="frames" />
            <SendBack slug={slug} stage="scene" label="Change the animation" hint="What should change? Say which shot you mean." />
          </>
        ) : null}

        {!working && (video.phase === "paused" || video.phase === "blocked") ? <Stopped video={video} /> : null}

        {!working && video.phase === "done" ? (
          <>
            <h2>Your video is ready</h2>
            {video.hasVideo ? <a className="btn big" href={`${media}/video.mp4?download=1`} download={`${slug}.mp4`}>Download video</a> : null}
            {video.brief ? <SendBack slug={slug} stage="scene" label="Change the animation" hint="What should change? Say which shot you mean." /> : null}
          </>
        ) : null}

        <Cost video={video} />
        <Details video={video} />
      </div>
    </main>
  );
};

const Library: React.FC<{ setup: Setup; videos: VideoSummary[] }> = ({ videos }) => (
  <main className="library">
    <h1>Your videos</h1>
    <ul className="tiles">
      {videos.map((video) => (
        <li key={video.slug}>
          <a href={`#/video/${video.slug}`}>
            <Reel small>{video.hasVideo && video.phase === "done" ? <video className="reel-fill" src={`/media/${video.slug}/video.mp4#t=4`} preload="metadata" muted /> : <Mosaic seed={video.slug} progress={video.progress} colors={video.colors} moving={video.phase === "working"} />}</Reel>
            <span className="tile-title">{video.title}</span>
            <span className={video.phase === "waiting" || video.phase === "blocked" ? "tile-status needs" : "tile-status"}>{statusLine(video)}</span>
          </a>
        </li>
      ))}
    </ul>
  </main>
);

const App: React.FC = () => {
  const hash = useHash();
  const setup = usePoll<Setup>("/api/setup", 4000);
  const videos = usePoll<VideoSummary[]>("/api/videos", 4000);
  const match = /^#\/video\/([a-z0-9-]+)$/.exec(hash);
  const showNew = hash === "#/new" || (!match && videos.value?.length === 0);
  if (!setup.value || !videos.value) return null;
  return (
    <>
      <header className="top">
        <a className="brand" href="#/">Video Gen</a>
        <nav>
          <a href="#/" aria-current={!match && !showNew ? "page" : undefined}>Your videos</a>
          <a href="#/new" aria-current={showNew ? "page" : undefined}>New video</a>
        </nav>
      </header>
      {match ? <VideoPage key={match[1]} slug={match[1]} /> : showNew ? <NewVideo setup={setup.value} refreshSetup={() => void setup.refresh()} /> : <Library setup={setup.value} videos={videos.value} />}
    </>
  );
};

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
