"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AppState,
  Company,
  Episode,
  PurposeTag,
  loadState,
  saveState,
  splitChunks,
} from "../lib/storage";

type Tab = "Sources" | "Profile" | "Company" | "Drafts";
const TAGS: PurposeTag[] = ["STAR", "MOTIVATION", "SKILL", "RESULT"];

const emptyState: AppState = {
  sources: [],
  chunks: [],
  profileName: "",
  writingRules: {
    avoidTeiru: true,
    preferOmouOverKangaeru: true,
    avoidExcessiveKanjiCompounds: true,
  },
  episodes: [],
  companies: [],
};

const uid = () => Math.random().toString(36).slice(2, 10);

export default function HomePage() {
  const [tab, setTab] = useState<Tab>("Sources");
  const [state, setState] = useState<AppState>(emptyState);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadState().then((s) => {
      setState(s);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) void saveState(state);
  }, [state, loaded]);

  return (
    <main className="container">
      <nav className="topnav">
        {(["Sources", "Profile", "Company", "Drafts"] as Tab[]).map((t) => (
          <button key={t} className={`tabbtn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>
      {tab === "Sources" && <SourcesScreen state={state} setState={setState} />}
      {tab === "Profile" && <ProfileScreen state={state} setState={setState} />}
      {tab === "Company" && <CompanyScreen state={state} setState={setState} />}
      {tab === "Drafts" && <DraftsScreen />}
    </main>
  );
}

function SourcesScreen({ state, setState }: { state: AppState; setState: (s: AppState) => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => state.chunks.filter((c) => c.text.toLowerCase().includes(search.toLowerCase())),
    [state.chunks, search],
  );

  const addSource = () => {
    if (!body.trim()) return;
    const id = uid();
    const source = { id, title: title.trim() || "Untitled Note", body: body.trim(), createdAt: Date.now() };
    const chunks = splitChunks(id, source.body);
    setState({ ...state, sources: [source, ...state.sources], chunks: [...chunks, ...state.chunks] });
    setTitle("");
    setBody("");
  };

  return (
    <section>
      <h1 className="title">Sources</h1>
      <div className="split">
        <div className="card grid">
          <h3>Add Source (Text/Note)</h3>
          <input className="input" placeholder="Source title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="textarea" placeholder="Paste text. Chunks are split by blank lines." value={body} onChange={(e) => setBody(e.target.value)} />
          <button className="btn primary" onClick={addSource}>Add Source</button>
        </div>
        <div className="card grid">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3>Chunks</h3>
            <input className="input" style={{ maxWidth: 260 }} placeholder="Search chunks" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="list">
            {filtered.length === 0 ? <p className="muted">No chunks yet.</p> : filtered.map((chunk) => (
              <div key={chunk.id} className="card">
                <p>{chunk.text.slice(0, 150)}</p>
                <div className="row">
                  <button
                    className={`btn ${chunk.pinned ? "primary" : ""}`}
                    onClick={() => setState({
                      ...state,
                      chunks: state.chunks.map((c) => (c.id === chunk.id ? { ...c, pinned: !c.pinned } : c)),
                    })}
                  >
                    {chunk.pinned ? "Pinned" : "Pin"}
                  </button>
                  <div className="chips">
                    {TAGS.map((tag) => {
                      const on = chunk.purposeTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          className={`chip ${on ? "on" : ""}`}
                          onClick={() => setState({
                            ...state,
                            chunks: state.chunks.map((c) =>
                              c.id === chunk.id
                                ? { ...c, purposeTags: on ? c.purposeTags.filter((t) => t !== tag) : [...c.purposeTags, tag] }
                                : c,
                            ),
                          })}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProfileScreen({ state, setState }: { state: AppState; setState: (s: AppState) => void }) {
  const [form, setForm] = useState<Omit<Episode, "id">>({
    title: "", situation: "", task: "", action: "", result: "", linkedChunkIds: [],
  });
  const [chunkSearch, setChunkSearch] = useState("");

  const sortedChunks = useMemo(() => {
    const arr = state.chunks.filter((c) => c.text.toLowerCase().includes(chunkSearch.toLowerCase()));
    return [...arr].sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }, [state.chunks, chunkSearch]);

  const addEpisode = () => {
    if (!form.title.trim()) return;
    setState({ ...state, episodes: [{ ...form, id: uid() }, ...state.episodes] });
    setForm({ title: "", situation: "", task: "", action: "", result: "", linkedChunkIds: [] });
  };

  return (
    <section>
      <h1 className="title">Profile</h1>
      <div className="split">
        <div className="card grid">
          <h3>Basic Profile</h3>
          <input className="input" placeholder="Name" value={state.profileName} onChange={(e) => setState({ ...state, profileName: e.target.value })} />
          <h3>Writing Rules</h3>
          {([
            ["avoidTeiru", "Avoid ～ている"],
            ["preferOmouOverKangaeru", "Prefer 思う over 考える"],
            ["avoidExcessiveKanjiCompounds", "Avoid excessive kanji compounds"],
          ] as const).map(([k, label]) => (
            <label key={k} className="row">
              <input
                type="checkbox"
                checked={state.writingRules[k]}
                onChange={(e) => setState({ ...state, writingRules: { ...state.writingRules, [k]: e.target.checked } })}
              />
              {label}
            </label>
          ))}
        </div>

        <div className="card grid">
          <h3>Episode Form</h3>
          <input className="input" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea className="textarea" placeholder="Situation" value={form.situation} onChange={(e) => setForm({ ...form, situation: e.target.value })} />
          <textarea className="textarea" placeholder="Task" value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })} />
          <textarea className="textarea" placeholder="Action" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} />
          <textarea className="textarea" placeholder="Result" value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })} />
          <input className="input" placeholder="Search chunks" value={chunkSearch} onChange={(e) => setChunkSearch(e.target.value)} />
          <div className="list" style={{ maxHeight: 220, overflow: "auto" }}>
            {sortedChunks.map((c) => {
              const linked = form.linkedChunkIds.includes(c.id);
              return (
                <label key={c.id} className="row" style={{ justifyContent: "space-between" }}>
                  <span>{c.pinned ? "📌 " : ""}{c.text.slice(0, 70)}</span>
                  <input
                    type="checkbox"
                    checked={linked}
                    onChange={(e) => setForm({
                      ...form,
                      linkedChunkIds: e.target.checked
                        ? [...form.linkedChunkIds, c.id]
                        : form.linkedChunkIds.filter((id) => id !== c.id),
                    })}
                  />
                </label>
              );
            })}
          </div>
          <button className="btn primary" onClick={addEpisode}>Add Episode</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Episodes</h3>
        <div className="list">
          {state.episodes.length === 0 ? <p className="muted">No episodes yet.</p> : state.episodes.map((ep) => (
            <div key={ep.id} className="card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>{ep.title}</strong>
                <button className="btn" onClick={() => setState({ ...state, episodes: state.episodes.filter((e) => e.id !== ep.id) })}>Delete</button>
              </div>
              <p className="muted">Linked chunks: {ep.linkedChunkIds.length}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CompanyScreen({ state, setState }: { state: AppState; setState: (s: AppState) => void }) {
  const [companyName, setCompanyName] = useState("");
  const [notes, setNotes] = useState("");
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);

  const activeCompany = state.companies.find((c) => c.id === activeCompanyId) ?? null;

  const addCompany = () => {
    if (!companyName.trim()) return;
    const c: Company = { id: uid(), name: companyName.trim(), notes: notes.trim(), linkedSourceIds: [], questions: [] };
    setState({ ...state, companies: [c, ...state.companies] });
    setCompanyName("");
    setNotes("");
  };

  const addQuestion = () => {
    if (!activeCompany) return;
    const next: Company = {
      ...activeCompany,
      questions: [...activeCompany.questions, { id: uid(), questionType: "gakuchika", charLimit: 400 }],
    };
    setState({ ...state, companies: state.companies.map((c) => (c.id === next.id ? next : c)) });
  };

  return (
    <section>
      <h1 className="title">Company</h1>
      <div className="split">
        <div className="card grid">
          <h3>Company CRUD</h3>
          <input className="input" placeholder="Company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          <textarea className="textarea" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button className="btn primary" onClick={addCompany}>Add Company</button>
          <div className="list">
            {state.companies.map((c) => (
              <div key={c.id} className="row" style={{ justifyContent: "space-between" }}>
                <button className="btn" onClick={() => setActiveCompanyId(c.id)}>{c.name}</button>
                <button className="btn" onClick={() => setState({ ...state, companies: state.companies.filter((x) => x.id !== c.id) })}>Delete</button>
              </div>
            ))}
          </div>
        </div>

        <div className="card grid">
          <h3>Linked Sources + Questions</h3>
          {!activeCompany ? <p className="muted">Select a company first.</p> : (
            <>
              <strong>{activeCompany.name}</strong>
              <div className="chips">
                {state.sources.map((s) => {
                  const on = activeCompany.linkedSourceIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      className={`chip ${on ? "on" : ""}`}
                      onClick={() => setState({
                        ...state,
                        companies: state.companies.map((c) => c.id !== activeCompany.id ? c : {
                          ...c,
                          linkedSourceIds: on ? c.linkedSourceIds.filter((id) => id !== s.id) : [...c.linkedSourceIds, s.id],
                        }),
                      })}
                    >
                      {s.title}
                    </button>
                  );
                })}
              </div>
              <button className="btn" onClick={addQuestion}>+ Add Question</button>
              <div className="list">
                {activeCompany.questions.map((q) => (
                  <div key={q.id} className="row">
                    <select
                      className="select"
                      value={q.questionType}
                      onChange={(e) => setState({
                        ...state,
                        companies: state.companies.map((c) => c.id !== activeCompany.id ? c : {
                          ...c,
                          questions: c.questions.map((x) => x.id === q.id ? { ...x, questionType: e.target.value as typeof x.questionType } : x),
                        }),
                      })}
                    >
                      <option value="gakuchika">gakuchika</option>
                      <option value="self_pr">self_pr</option>
                      <option value="motivation">motivation</option>
                      <option value="strengths_weaknesses">strengths_weaknesses</option>
                      <option value="future_plan">future_plan</option>
                      <option value="job_hunting_axis">job_hunting_axis</option>
                    </select>
                    <input
                      className="input"
                      type="number"
                      min={100}
                      max={1200}
                      value={q.charLimit}
                      onChange={(e) => setState({
                        ...state,
                        companies: state.companies.map((c) => c.id !== activeCompany.id ? c : {
                          ...c,
                          questions: c.questions.map((x) => x.id === q.id ? { ...x, charLimit: Number(e.target.value) } : x),
                        }),
                      })}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function DraftsScreen() {
  return (
    <section>
      <h1 className="title">Drafts</h1>
      <div className="card">
        <p className="muted">No backend calls in this prompt. Draft previews will be added next.</p>
      </div>
    </section>
  );
}
