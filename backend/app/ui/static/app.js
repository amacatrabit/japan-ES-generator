document.addEventListener("DOMContentLoaded", () => {
  console.log("app.js loaded");

  const page = document.body?.dataset?.page;
  const nav = document.querySelector(`[data-nav="${page}"]`);
  if (nav) nav.classList.add("active");

  if (page === "sources") initSourcesPage();
  if (page === "profile") initProfilePage();
  if (page === "company") initCompanyPage();
  if (page === "drafts") initDraftsPage();
});

function toast(message, isError) {
  const el = document.getElementById("ui-toast");
  if (!el) return;
  el.textContent = message;
  el.style.display = "block";
  el.style.borderColor = isError ? "#a33" : "#2e7d32";
  setTimeout(() => {
    el.style.display = "none";
  }, 2500);
}

async function api(path, options) {
  const res = await fetch(path, options);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `request failed: ${res.status}`);
  }
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return res.text();
}

function detailValue(el) {
  return el && typeof el.value === "string" ? el.value.trim() : "";
}

function initSourcesPage() {
  const createTitle = document.getElementById("source-create-title");
  const createText = document.getElementById("source-create-text");
  const createBtn = document.getElementById("source-create-btn");
  const uploadFile = document.getElementById("source-upload-file");
  const uploadBtn = document.getElementById("source-upload-btn");
  const listEl = document.getElementById("source-list");
  const emptyEl = document.getElementById("source-list-empty");
  const detailTitle = document.getElementById("source-detail-title");
  const detailText = document.getElementById("source-detail-text");
  const updateBtn = document.getElementById("source-update-btn");
  const deleteBtn = document.getElementById("source-delete-btn");
  const chunksBtn = document.getElementById("source-chunks-btn");
  const chunksList = document.getElementById("source-chunks-list");
  if (!listEl || !emptyEl) return;

  let currentId = null;

  async function loadList() {
    const items = await api("/v1/sources");
    listEl.innerHTML = "";
    emptyEl.style.display = items.length ? "none" : "block";
    items.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn";
      btn.textContent = `${item.title} (${new Date(item.updated_at).toLocaleString()})`;
      btn.addEventListener("click", async () => {
        const full = await api(`/v1/sources/${item.id}`);
        currentId = item.id;
        if (detailTitle) detailTitle.value = full.title;
        if (detailText) detailText.value = full.raw_text;
      });
      listEl.appendChild(btn);
    });
  }

  if (createBtn) createBtn.addEventListener("click", async () => {
    try {
      await api("/v1/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: detailValue(createTitle), raw_text: detailValue(createText) }),
      });
      if (createTitle) createTitle.value = "";
      if (createText) createText.value = "";
      await loadList();
      toast("saved", false);
    } catch (e) { toast(`save failed: ${e.message}`, true); }
  });

  if (uploadBtn) uploadBtn.addEventListener("click", async () => {
    try {
      const file = uploadFile?.files?.[0];
      if (!file) throw new Error("file required");
      const fd = new FormData();
      fd.append("file", file);
      await api("/v1/sources/upload", { method: "POST", body: fd });
      await loadList();
      toast("uploaded", false);
    } catch (e) { toast(`upload failed: ${e.message}`, true); }
  });

  if (updateBtn) updateBtn.addEventListener("click", async () => {
    try {
      if (!currentId) throw new Error("select a source first");
      await api(`/v1/sources/${currentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: detailValue(detailTitle), raw_text: detailValue(detailText) }),
      });
      await loadList();
      toast("updated", false);
    } catch (e) { toast(`update failed: ${e.message}`, true); }
  });

  if (deleteBtn) deleteBtn.addEventListener("click", async () => {
    try {
      if (!currentId) throw new Error("select a source first");
      await api(`/v1/sources/${currentId}`, { method: "DELETE" });
      currentId = null;
      if (detailTitle) detailTitle.value = "";
      if (detailText) detailText.value = "";
      if (chunksList) chunksList.innerHTML = "";
      await loadList();
      toast("deleted", false);
    } catch (e) { toast(`delete failed: ${e.message}`, true); }
  });

  if (chunksBtn) chunksBtn.addEventListener("click", async () => {
    try {
      if (!currentId) throw new Error("select a source first");
      const chunks = await api(`/v1/sources/${currentId}/chunks`, { method: "POST" });
      if (!chunksList) return;
      chunksList.innerHTML = "";
      chunks.forEach((chunk) => {
        const item = document.createElement("div");
        item.className = "card";
        item.textContent = `${chunk.chunk_id}: ${chunk.text}`;
        chunksList.appendChild(item);
      });
    } catch (e) { toast(`chunk failed: ${e.message}`, true); }
  });

  loadList().catch((e) => toast(`load failed: ${e.message}`, true));
}

function initProfilePage() {
  const nameEl = document.getElementById("profile-name");
  const saveBtn = document.getElementById("profile-save-btn");
  const updateBtn = document.getElementById("profile-update-btn");
  const deleteBtn = document.getElementById("profile-delete-btn");
  const listEl = document.getElementById("profile-list");
  const emptyEl = document.getElementById("profile-list-empty");
  const fields = {
    title: document.getElementById("ep-title"),
    situation: document.getElementById("ep-situation"),
    task: document.getElementById("ep-task"),
    action: document.getElementById("ep-action"),
    result: document.getElementById("ep-result"),
    learning: document.getElementById("ep-learning"),
  };
  if (!listEl || !emptyEl) return;
  let currentId = null;

  const payloadFromForm = () => ({ episode: {
    title: detailValue(fields.title), situation: detailValue(fields.situation), task: detailValue(fields.task),
    action: detailValue(fields.action), result: detailValue(fields.result), learning: detailValue(fields.learning),
  }});

  const fillForm = (profile) => {
    if (nameEl) nameEl.value = profile.name || "";
    const ep = profile?.payload?.episode || {};
    Object.keys(fields).forEach((key) => { if (fields[key]) fields[key].value = ep[key] || ""; });
  };

  async function loadProfiles() {
    const items = await api("/v1/profiles");
    listEl.innerHTML = "";
    emptyEl.style.display = items.length ? "none" : "block";
    items.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn";
      btn.textContent = `${item.name} (${new Date(item.updated_at).toLocaleString()})`;
      btn.addEventListener("click", async () => {
        const full = await api(`/v1/profiles/${item.id}`);
        currentId = item.id;
        fillForm(full);
      });
      listEl.appendChild(btn);
    });
  }

  if (saveBtn) saveBtn.addEventListener("click", async () => {
    try {
      await api("/v1/profiles", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: detailValue(nameEl), payload: payloadFromForm() }),
      });
      await loadProfiles();
      toast("profile saved", false);
    } catch (e) { toast(`save failed: ${e.message}`, true); }
  });

  if (updateBtn) updateBtn.addEventListener("click", async () => {
    try {
      if (!currentId) throw new Error("select a profile first");
      await api(`/v1/profiles/${currentId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: detailValue(nameEl), payload: payloadFromForm() }),
      });
      await loadProfiles();
      toast("profile updated", false);
    } catch (e) { toast(`update failed: ${e.message}`, true); }
  });

  if (deleteBtn) deleteBtn.addEventListener("click", async () => {
    try {
      if (!currentId) throw new Error("select a profile first");
      await api(`/v1/profiles/${currentId}`, { method: "DELETE" });
      currentId = null;
      if (nameEl) nameEl.value = "";
      Object.values(fields).forEach((el) => { if (el) el.value = ""; });
      await loadProfiles();
      toast("profile deleted", false);
    } catch (e) { toast(`delete failed: ${e.message}`, true); }
  });

  loadProfiles().catch((e) => toast(`load failed: ${e.message}`, true));
}

function initCompanyPage() {
  const nameEl = document.getElementById("company-name-input");
  const roleEl = document.getElementById("company-role-input");
  const summaryEl = document.getElementById("company-research-input");
  const questionsEl = document.getElementById("company-questions-input");
  const saveBtn = document.getElementById("company-save-btn");
  const genBtn = document.getElementById("company-generate-btn");
  const deleteBtn = document.getElementById("company-delete-btn");
  const listEl = document.getElementById("company-list");
  const emptyEl = document.getElementById("company-list-empty");
  if (!listEl || !emptyEl) return;
  let currentId = null;

  const parseQuestions = () => detailValue(questionsEl).split("\n").map((x) => x.trim()).filter(Boolean);
  const fill = (c) => {
    if (nameEl) nameEl.value = c.company_name || "";
    if (roleEl) roleEl.value = c.role || "";
    if (summaryEl) summaryEl.value = c.research_summary || "";
    if (questionsEl) questionsEl.value = (c.question_templates || []).join("\n");
  };

  async function loadCompanies() {
    const items = await api("/v1/companies");
    listEl.innerHTML = "";
    emptyEl.style.display = items.length ? "none" : "block";
    items.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn";
      btn.textContent = `${item.company_name} / ${item.role}`;
      btn.addEventListener("click", async () => {
        const full = await api(`/v1/companies/${item.id}`);
        currentId = item.id;
        fill(full);
      });
      listEl.appendChild(btn);
    });
  }

  if (saveBtn) saveBtn.addEventListener("click", async () => {
    try {
      const payload = {
        company_name: detailValue(nameEl), role: detailValue(roleEl),
        research_summary: detailValue(summaryEl), question_templates: parseQuestions(),
      };
      if (currentId) {
        await api(`/v1/companies/${currentId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      } else {
        const created = await api("/v1/companies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        currentId = created.id;
      }
      await loadCompanies();
      toast("company saved", false);
    } catch (e) { toast(`save failed: ${e.message}`, true); }
  });

  if (genBtn) genBtn.addEventListener("click", async () => {
    try {
      if (!currentId) throw new Error("select/save company first");
      const updated = await api(`/v1/companies/${currentId}/research/generate`, { method: "POST" });
      fill(updated);
      await loadCompanies();
      toast("research generated", false);
    } catch (e) { toast(`generate failed: ${e.message}`, true); }
  });

  if (deleteBtn) deleteBtn.addEventListener("click", async () => {
    try {
      if (!currentId) throw new Error("select company first");
      await api(`/v1/companies/${currentId}`, { method: "DELETE" });
      currentId = null;
      [nameEl, roleEl, summaryEl, questionsEl].forEach((el) => { if (el) el.value = ""; });
      await loadCompanies();
      toast("company deleted", false);
    } catch (e) { toast(`delete failed: ${e.message}`, true); }
  });

  loadCompanies().catch((e) => toast(`load failed: ${e.message}`, true));
}

function initDraftsPage() {
  const questionTypeEl = document.getElementById("draft-question-type");
  const charLimitEl = document.getElementById("draft-char-limit");
  const companySelectEl = document.getElementById("draft-company-select");
  const generateBtn = document.getElementById("draft-generate-btn");
  const previewEl = document.getElementById("draft-preview");
  const saveHistoryBtn = document.getElementById("draft-save-history-btn");
  const historyListEl = document.getElementById("draft-history-list");
  const historyEmptyEl = document.getElementById("draft-history-empty");
  if (!previewEl || !historyListEl || !historyEmptyEl) return;

  let lastGenerated = null;

  async function loadCompaniesForSelect() {
    if (!companySelectEl) return;
    const companies = await api("/v1/companies");
    companySelectEl.innerHTML = "<option value=''>기업 선택(선택)</option>";
    companies.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.company_name;
      companySelectEl.appendChild(opt);
    });
  }

  async function loadHistory() {
    const items = await api("/v1/drafts/history");
    historyListEl.innerHTML = "";
    historyEmptyEl.style.display = items.length ? "none" : "block";
    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "row";
      const openBtn = document.createElement("button");
      openBtn.className = "btn";
      openBtn.textContent = `${item.question_type} / ${item.char_limit}`;
      openBtn.addEventListener("click", async () => {
        const full = await api(`/v1/drafts/history/${item.id}`);
        previewEl.textContent = full.draft_text || "";
      });
      const delBtn = document.createElement("button");
      delBtn.className = "btn";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", async () => {
        await api(`/v1/drafts/history/${item.id}`, { method: "DELETE" });
        await loadHistory();
      });
      row.appendChild(openBtn);
      row.appendChild(delBtn);
      historyListEl.appendChild(row);
    });
  }

  if (generateBtn) generateBtn.addEventListener("click", async () => {
    try {
      const sources = await api("/v1/sources");
      if (!sources.length) throw new Error("at least one source required");
      const first = await api(`/v1/sources/${sources[0].id}`);
      const payload = {
        selected_chunks: [{ chunk_id: `s-${first.id}`, text: first.raw_text, source_title: first.title, loc_hint: "db", page_start: 0, page_end: 0, pinned: true }],
        selected_episodes: [{ title: "保存データから生成", action: "根拠に基づいて要約" }],
        company_context: companySelectEl && companySelectEl.value ? { company_name: companySelectEl.options[companySelectEl.selectedIndex].text } : null,
        question_type: detailValue(questionTypeEl) || "gakuchika",
        char_limit: Number(detailValue(charLimitEl) || "400"),
        writing_rules: null,
      };
      const generated = await api("/v1/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const text = (generated.claims || []).map((c) => c.text).join(" ");
      previewEl.textContent = text || "(empty)";
      lastGenerated = {
        question_type: payload.question_type,
        char_limit: payload.char_limit,
        company_id: companySelectEl ? companySelectEl.value || null : null,
        draft_text: text,
        claims: generated.claims || [],
        qa_findings: generated.qa_findings || [],
      };
      toast("draft generated", false);
    } catch (e) { toast(`generate failed: ${e.message}`, true); }
  });

  if (saveHistoryBtn) saveHistoryBtn.addEventListener("click", async () => {
    try {
      if (!lastGenerated) throw new Error("generate first");
      await api("/v1/drafts/history", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lastGenerated),
      });
      await loadHistory();
      toast("history saved", false);
    } catch (e) { toast(`save failed: ${e.message}`, true); }
  });

  Promise.all([loadCompaniesForSelect(), loadHistory()]).catch((e) => toast(`load failed: ${e.message}`, true));
}
