import { useEffect, useRef, useState } from "react";
import { CASES } from "../../data/cases";
import { api } from "../../utils/api";
import CourtStage from "../CourtStage";
import CaseSetup from "../CaseSetup";
import BringCase from "../BringCase";
import GameDialog from "../GameDialog";
import ConnectionSettings from "../ConnectionSettings";
import "./Lobby.css";

export default function Lobby() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState({ items: [], total: 0, categories: [] });
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [selected, setSelected] = useState(null);
  const [importing, setImporting] = useState(false);
  const [settings, setSettings] = useState(false);
  const [help, setHelp] = useState(false);
  const [reload, setReload] = useState(0);
  const searchRef = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setLoading(true);
      api(
        `/cases?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}&offset=${offset}&limit=9`,
        undefined,
        controller.signal,
      )
        .then((result) => {
          setData(result);
          setOffline(false);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          const items = CASES.filter((item) =>
            `${item.title} ${item.subtitle} ${item.facts}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          ).map((item) => ({
            ...item,
            source_label: "Fictional quick drill",
            brief_note:
              "A fictional warm-up proposition from the original practice set.",
          }));
          setData({ items, total: items.length, categories: [] });
          setOffline(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 180);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, category, offset, reload]);
  const browse = () => {
    document
      .getElementById("case-library")
      ?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    searchRef.current?.focus({ preventScroll: true });
  };
  return (
    <div className="game-home">
      <header className="game-header">
        <a className="game-logo" href="/" aria-label="Themis home">
          <span className="logo-mark">T</span>THEMIS
          <span className="logo-subtitle">MOOT COURT</span>
        </a>
        <nav aria-label="Main navigation">
          <button className="nav-active" onClick={browse}>
            Case files
          </button>
          <button onClick={() => setHelp(true)}>How to play</button>
          <button
            className="icon-button"
            aria-label="Open settings"
            onClick={() => setSettings(true)}
          >
            ⚙
          </button>
        </nav>
      </header>
      <main className="home-main">
        <section className="game-welcome">
          <div className="welcome-stage">
            <CourtStage compact>
              <div className="stage-title">
                <span>TAKE YOUR PLACE AT THE BENCH</span>
                <h1>
                  All rise.
                  <br />
                  <em>You’re up.</em>
                </h1>
              </div>
              <div className="preview-dialogue">
                <span className="dialogue-name">THE BENCH</span>
                <p>Well, counsel. Shall we hear your case?</p>
                <span aria-hidden="true">▼</span>
              </div>
            </CourtStage>
          </div>
          <div className="play-menu">
            <span className="small-caps">THE COURT IS OPEN</span>
            <h2>
              A battle of
              <br />
              <span>better arguments.</span>
            </h2>
            <p>
              Pick a side. Read the room.
              <br />
              Give the bench something to think about.
            </p>
            <button className="primary-button big-play" onClick={browse}>
              <span>Choose a case</span>
              <span aria-hidden="true">▶</span>
            </button>
            <button
              className="import-button"
              onClick={() => setImporting(true)}
            >
              <span className="mini-folder" aria-hidden="true">
                ▤
              </span>
              <span>
                <strong>Bring your own case</strong>
                <small>Your moot proposition. Ready to play.</small>
              </span>
              <span aria-hidden="true">↗</span>
            </button>
            <div className="play-menu-bottom">
              <span>
                <i className="status-dot" /> SOLO OR LOCAL DUEL
              </span>
              <span>3 ROUNDS</span>
            </div>
          </div>
        </section>
        <section
          className="case-library"
          id="case-library"
          aria-labelledby="library-title"
        >
          <div className="library-title-row">
            <div>
              <span className="small-caps">FROM THE RECORD ROOM</span>
              <h2 id="library-title">
                Choose your next case
                <span className="count-bubble">
                  {loading ? "…" : data.total}
                </span>
              </h2>
            </div>
            <button className="quiet-button" onClick={() => setImporting(true)}>
              + Your case file
            </button>
          </div>
          <div className="library-tools">
            <label className="library-search">
              <span aria-hidden="true">⌕</span>
              <input
                ref={searchRef}
                aria-label="Search cases"
                placeholder="Search a case, right, article or legal issue…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOffset(0);
                }}
                maxLength={200}
              />
              {query && (
                <button
                  className="icon-button"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery("");
                    setOffset(0);
                  }}
                >
                  ×
                </button>
              )}
            </label>
            <label className="category-filter">
              <span className="sr-only">Filter by category</span>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setOffset(0);
                }}
              >
                <option value="">All subjects</option>
                {data.categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {offline && (
            <div className="library-notice" role="status">
              The record room is offline. These quick drills are available while
              you reconnect.{" "}
              <button
                onClick={() => {
                  setCategory("");
                  setOffset(0);
                  setReload((r) => r + 1);
                }}
              >
                Retry library
              </button>
            </div>
          )}
          <div
            className={`case-shelf ${loading ? "shelf-loading" : ""}`}
            aria-busy={loading}
          >
            {loading
              ? Array.from({ length: 6 }, (_, i) => (
                  <div className="case-skeleton" key={i} aria-hidden="true" />
                ))
              : data.items.map((item, i) => (
                  <button
                    className={`game-case-card case-color-${i % 3}`}
                    key={item.id}
                    onClick={() => setSelected(item)}
                  >
                    <div className="folder-tab">{item.year || "CASE FILE"}</div>
                    <div className="case-card-paper">
                      <div className="case-card-meta">
                        <span>{item.category}</span>
                        <span aria-hidden="true">↗</span>
                      </div>
                      <h3>{item.title}</h3>
                      <p>{item.issues?.[0] || item.subtitle}</p>
                      <div className="case-card-bottom">
                        <span>{item.source_label || "Court archive"}</span>
                        <span>OPEN FILE →</span>
                      </div>
                    </div>
                  </button>
                ))}
          </div>
          {!loading && data.total === 0 && (
            <div className="empty-library">
              <span aria-hidden="true">▤</span>
              <h3>No matching files.</h3>
              <p>
                Try a case name, a right or an article number. Or bring your own
                proposition.
              </p>
              <button
                className="quiet-button"
                onClick={() => {
                  setQuery("");
                  setCategory("");
                  setOffset(0);
                }}
              >
                Clear filters
              </button>
              <a
                href={`https://indiankanoon.org/search/?formInput=${encodeURIComponent(query)}`}
                target="_blank"
                rel="noreferrer"
              >
                Search Indian Kanoon ↗
              </a>
            </div>
          )}
          {!loading && !offline && data.total > 9 && (
            <div className="library-pagination">
              <span>
                {offset + 1}–{Math.min(offset + 9, data.total)} of {data.total}{" "}
                matters
              </span>
              <div className="button-row">
                <button
                  className="quiet-button"
                  disabled={offset === 0}
                  onClick={() => setOffset((n) => Math.max(0, n - 9))}
                >
                  ← Previous
                </button>
                <button
                  className="quiet-button"
                  disabled={offset + 9 >= data.total}
                  onClick={() => setOffset((n) => n + 9)}
                >
                  Next files →
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
      {selected && (
        <CaseSetup selectedCase={selected} onClose={() => setSelected(null)} />
      )}
      {importing && (
        <BringCase
          onClose={() => setImporting(false)}
          onReady={(item) => {
            setImporting(false);
            setSelected(item);
          }}
        />
      )}
      {settings && (
        <GameDialog title="Settings" onClose={() => setSettings(false)}>
          <h2>Behind the bench</h2>
          <ConnectionSettings expanded />
        </GameDialog>
      )}
      {help && (
        <GameDialog title="How to play" onClose={() => setHelp(false)}>
          <div className="how-to">
            <h2>
              Think fast.
              <br />
              Take your time.
            </h2>
            <ol>
              <li>
                <strong>Pick the fight.</strong>
                <p>
                  Open an archive case or bring a moot proposition. Read the
                  facts, issues and positions before choosing a side.
                </p>
              </li>
              <li>
                <strong>Make your opening.</strong>
                <p>
                  Play solo against computer counsel or share a device with a
                  friend. The petitioner always opens.
                </p>
              </li>
              <li>
                <strong>Face the bench.</strong>
                <p>
                  Submit an argument. Read the ruling and answer any question.
                  Continue when you’re ready—there’s no countdown.
                </p>
              </li>
              <li>
                <strong>Finish the hearing.</strong>
                <p>
                  Three rounds: opening, rebuttal and closing. Your scorecard
                  and court record are yours to download.
                </p>
              </li>
            </ol>
            <p className="form-note">
              Courtroom practice, not a real ruling. Archive briefs may include
              the historical outcome; argue the supplied issue, not a memorised
              winner. Session work clears when this tab reloads.
            </p>
            <button
              className="primary-button"
              onClick={() => {
                setHelp(false);
                browse();
              }}
            >
              Got it. Find a case →
            </button>
          </div>
        </GameDialog>
      )}
    </div>
  );
}
