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

const COMPANY_KEY = "es_companies_v2";
const DRAFT_HISTORY_KEY = "es_draft_history_v1";

function loadCompanies() {
  try {
    const raw = localStorage.getItem(COMPANY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((c) => ({
      id: c.id || uuid(),
      company_name: c.company_name || "",
      role: c.role || "",
      company_info: c.company_info || "",
      question_template: c.question_template || "지원 동기 및 기여 가능성을 작성하세요.",
      char_limit: Number(c.char_limit || 400),
      updated_at: c.updated_at || new Date().toISOString(),
    }));
  } catch (_e) {
    return [];
  }
}

function saveCompanies(companies) {
  localStorage.setItem(COMPANY_KEY, JSON.stringify(companies));
}

function loadDraftHistory() {
  try {
    const raw = localStorage.getItem(DRAFT_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    return [];
  }
}

function saveDraftHistory(items) {
  localStorage.setItem(DRAFT_HISTORY_KEY, JSON.stringify(items.slice(0, 30)));
}

function uuid() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toast(message, isError) {
  const list = document.querySelectorAll("#ui-toast");
  list.forEach((el) => {
    el.textContent = message;
    el.style.display = "block";
    el.style.borderColor = isError ? "#a33" : "#2e7d32";
    setTimeout(() => {
      el.style.display = "none";
    }, 2500);
  });
}

async function api(path, options) {
  const res = await fetch(path, options);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `request failed: ${res.status}`);
  }
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res.text();
}

function detailValue(el) {
  return el && typeof el.value === "string" ? el.value.trim() : "";
}

function toInt(value, fallback = 400) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(100, Math.min(1200, Math.round(n)));
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

  if (createBtn) {
    createBtn.addEventListener("click", async () => {
      try {
        const title = createTitle?.value?.trim() || "";
        const rawText = detailValue(createText);
        await api("/v1/sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, raw_text: rawText }),
        });
        if (createTitle) createTitle.value = "";
        if (createText) createText.value = "";
        await loadList();
        toast("saved", false);
      } catch (e) {
        toast(`save failed: ${e.message}`, true);
      }
    });
  }

  if (uploadBtn) {
    uploadBtn.addEventListener("click", async () => {
      try {
        const file = uploadFile?.files?.[0];
        if (!file) throw new Error("file required");
        const fd = new FormData();
        fd.append("file", file);
        await api("/v1/sources/upload", { method: "POST", body: fd });
        await loadList();
        toast("uploaded", false);
      } catch (e) {
        toast(`upload failed: ${e.message}`, true);
      }
    });
  }

  if (updateBtn) {
    updateBtn.addEventListener("click", async () => {
      try {
        if (!currentId) throw new Error("select a source first");
        await api(`/v1/sources/${currentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: detailValue(detailTitle), raw_text: detailValue(detailText) }),
        });
        await loadList();
        toast("updated", false);
      } catch (e) {
        toast(`update failed: ${e.message}`, true);
      }
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      try {
        if (!currentId) throw new Error("select a source first");
        await api(`/v1/sources/${currentId}`, { method: "DELETE" });
        currentId = null;
        if (detailTitle) detailTitle.value = "";
        if (detailText) detailText.value = "";
        if (chunksList) chunksList.innerHTML = "";
        await loadList();
        toast("deleted", false);
      } catch (e) {
        toast(`delete failed: ${e.message}`, true);
      }
    });
  }

  if (chunksBtn) {
    chunksBtn.addEventListener("click", async () => {
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
      } catch (e) {
        toast(`chunk failed: ${e.message}`, true);
      }
    });
  }

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

  function payloadFromForm() {
    return {
      episode: {
        title: detailValue(fields.title),
        situation: detailValue(fields.situation),
        task: detailValue(fields.task),
        action: detailValue(fields.action),
        result: detailValue(fields.result),
        learning: detailValue(fields.learning),
      },
    };
  }

  function fillForm(profile) {
    if (nameEl) nameEl.value = profile.name || "";
    const ep = profile?.payload?.episode || {};
    Object.keys(fields).forEach((key) => {
      const el = fields[key];
      if (el) el.value = ep[key] || "";
    });
  }

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

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      try {
        await api("/v1/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: detailValue(nameEl), payload: payloadFromForm() }),
        });
        await loadProfiles();
        toast("profile saved", false);
      } catch (e) {
        toast(`save failed: ${e.message}`, true);
      }
    });
  }

  if (updateBtn) {
    updateBtn.addEventListener("click", async () => {
      try {
        if (!currentId) throw new Error("select a profile first");
        await api(`/v1/profiles/${currentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: detailValue(nameEl), payload: payloadFromForm() }),
        });
        await loadProfiles();
        toast("profile updated", false);
      } catch (e) {
        toast(`update failed: ${e.message}`, true);
      }
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      try {
        if (!currentId) throw new Error("select a profile first");
        await api(`/v1/profiles/${currentId}`, { method: "DELETE" });
        currentId = null;
        if (nameEl) nameEl.value = "";
        Object.values(fields).forEach((el) => {
          if (el) el.value = "";
        });
        await loadProfiles();
        toast("profile deleted", false);
      } catch (e) {
        toast(`delete failed: ${e.message}`, true);
      }
    });
  }

  loadProfiles().catch((e) => toast(`load failed: ${e.message}`, true));
}

function initCompanyPage() {
  const nameEl = document.getElementById("company-name");
  const roleEl = document.getElementById("company-role");
  const infoEl = document.getElementById("company-info");
  const qTemplateEl = document.getElementById("company-question-template");
  const charLimitEl = document.getElementById("company-char-limit");
  const researchBtn = document.getElementById("company-research-btn");
  const saveBtn = document.getElementById("company-save-btn");

  const listEl = document.getElementById("company-list");
  const emptyEl = document.getElementById("company-empty");
  const dName = document.getElementById("company-detail-name");
  const dRole = document.getElementById("company-detail-role");
  const dInfo = document.getElementById("company-detail-info");
  const dQTemplate = document.getElementById("company-detail-question-template");
  const dCharLimit = document.getElementById("company-detail-char-limit");
  const updateBtn = document.getElementById("company-update-btn");
  const deleteBtn = document.getElementById("company-delete-btn");

  if (!listEl || !emptyEl) return;

  let currentId = null;

  function render() {
    const items = loadCompanies();
    listEl.innerHTML = "";
    emptyEl.style.display = items.length ? "none" : "block";
    items.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn";
      btn.textContent = `${item.company_name} / ${item.role || "직무 미지정"}`;
      btn.addEventListener("click", () => {
        currentId = item.id;
        if (dName) dName.value = item.company_name || "";
        if (dRole) dRole.value = item.role || "";
        if (dInfo) dInfo.value = item.company_info || "";
        if (dQTemplate) dQTemplate.value = item.question_template || "";
        if (dCharLimit) dCharLimit.value = String(item.char_limit || 400);
      });
      listEl.appendChild(btn);
    });
  }

  if (researchBtn) {
    researchBtn.addEventListener("click", async () => {
      try {
        const companyName = detailValue(nameEl);
        if (!companyName) throw new Error("기업명을 먼저 입력하세요");
        researchBtn.disabled = true;
        const result = await api("/v1/company/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company_name: companyName }),
        });
        if (infoEl) infoEl.value = result.company_info || "";
        if (qTemplateEl) qTemplateEl.value = result.question_template || "";
        if (charLimitEl) charLimitEl.value = String(result.char_limit || 400);
        toast("research complete", false);
      } catch (e) {
        toast(`research failed: ${e.message}`, true);
      } finally {
        researchBtn.disabled = false;
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const companyName = detailValue(nameEl);
      if (!companyName) {
        toast("기업명은 필수입니다", true);
        return;
      }
      const items = loadCompanies();
      items.push({
        id: uuid(),
        company_name: companyName,
        role: detailValue(roleEl),
        company_info: detailValue(infoEl),
        question_template: detailValue(qTemplateEl) || "지원 동기 및 기여 가능성을 작성하세요.",
        char_limit: toInt(detailValue(charLimitEl) || "400"),
        updated_at: new Date().toISOString(),
      });
      saveCompanies(items);
      if (nameEl) nameEl.value = "";
      if (roleEl) roleEl.value = "";
      if (infoEl) infoEl.value = "";
      if (qTemplateEl) qTemplateEl.value = "";
      if (charLimitEl) charLimitEl.value = "400";
      render();
      toast("company saved", false);
    });
  }

  if (updateBtn) {
    updateBtn.addEventListener("click", () => {
      if (!currentId) {
        toast("기업을 먼저 선택하세요", true);
        return;
      }
      const items = loadCompanies().map((item) => (item.id === currentId
        ? {
            ...item,
            company_name: detailValue(dName),
            role: detailValue(dRole),
            company_info: detailValue(dInfo),
            question_template: detailValue(dQTemplate),
            char_limit: toInt(detailValue(dCharLimit) || "400"),
            updated_at: new Date().toISOString(),
          }
        : item));
      saveCompanies(items);
      render();
      toast("company updated", false);
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      if (!currentId) {
        toast("기업을 먼저 선택하세요", true);
        return;
      }
      const items = loadCompanies().filter((item) => item.id !== currentId);
      saveCompanies(items);
      currentId = null;
      if (dName) dName.value = "";
      if (dRole) dRole.value = "";
      if (dInfo) dInfo.value = "";
      if (dQTemplate) dQTemplate.value = "";
      if (dCharLimit) dCharLimit.value = "400";
      render();
      toast("company deleted", false);
    });
  }

  render();
}

function initDraftsPage() {
  const companySelect = document.getElementById("draft-company-select");
  const profileSelect = document.getElementById("draft-profile-select");
  const sourcePicker = document.getElementById("draft-source-picker");
  const questionType = document.getElementById("draft-question-type");
  const charLimit = document.getElementById("draft-char-limit");
  const generateBtn = document.getElementById("draft-generate-btn");
  const preview = document.getElementById("draft-preview");
  const charCount = document.getElementById("draft-char-count");
  const qaPanel = document.getElementById("draft-qa-panel");
  const err = document.getElementById("draft-generate-error");
  const historySelect = document.getElementById("draft-history-select");

  const openExport = document.getElementById("draft-open-export");
  const exportModal = document.getElementById("export-modal");
  const exportRunBtn = document.getElementById("export-run-btn");
  const exportOutput = document.getElementById("export-output");
  const exportLevel = document.getElementById("export-compression-level");

  if (!companySelect || !profileSelect || !sourcePicker || !generateBtn || !preview) return;

  let lastClaims = [];

  function renderHistory() {
    if (!historySelect) return;
    const items = loadDraftHistory();
    historySelect.innerHTML = "";
    const first = document.createElement("option");
    first.value = "";
    first.textContent = "히스토리 선택";
    historySelect.appendChild(first);
    items.forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item.id;
      opt.textContent = `${item.company_name} / ${item.created_at}`;
      historySelect.appendChild(opt);
    });
  }

  async function loadSelectors() {
    const companies = loadCompanies();
    companySelect.innerHTML = "";
    companies.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.company_name;
      companySelect.appendChild(opt);
    });

    const profiles = await api("/v1/profiles");
    profileSelect.innerHTML = "";
    profiles.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      profileSelect.appendChild(opt);
    });

    const sources = await api("/v1/sources");
    sourcePicker.innerHTML = "";
    sources.forEach((s) => {
      const label = document.createElement("label");
      label.className = "row";
      label.innerHTML = `<input type="checkbox" value="${s.id}" checked /> <span>${s.title}</span>`;
      sourcePicker.appendChild(label);
    });

    const ready = companies.length > 0 && profiles.length > 0 && sources.length > 0;
    generateBtn.disabled = !ready;
    if (!ready && err) {
      err.textContent = "회사/프로필/소스를 먼저 최소 1개씩 준비해주세요.";
    } else if (err) {
      err.textContent = "";
    }

    renderHistory();
  }

  async function loadSelectedChunks() {
    const checks = sourcePicker.querySelectorAll("input[type='checkbox']:checked");
    const ids = Array.from(checks).map((c) => c.value);
    const chunks = [];
    for (const id of ids) {
      const detail = await api(`/v1/sources/${id}`);
      chunks.push({
        chunk_id: `src:${id}:chunk:1`,
        text: detail.raw_text,
        source_title: detail.title,
        loc_hint: "saved",
        page_start: 0,
        page_end: 0,
        pinned: true,
      });
    }
    return chunks;
  }

  if (historySelect) {
    historySelect.addEventListener("change", () => {
      const id = historySelect.value;
      const hit = loadDraftHistory().find((d) => d.id === id);
      if (!hit) return;
      lastClaims = hit.claims || [];
      preview.textContent = hit.text || "";
      if (charCount) charCount.textContent = `${(hit.text || "").length} 자`;
      if (qaPanel) {
        qaPanel.innerHTML = "";
        (hit.qa_findings || []).forEach((f) => {
          const item = document.createElement("div");
          item.className = `card ${f.level === "blocker" ? "strict" : ""}`;
          item.textContent = `[${f.level}] ${f.message}`;
          qaPanel.appendChild(item);
        });
      }
    });
  }

  if (generateBtn) {
    generateBtn.addEventListener("click", async () => {
      try {
        if (err) err.textContent = "";
        const chunks = await loadSelectedChunks();
        if (!chunks.length) throw new Error("소스를 하나 이상 선택하세요");

        if (!profileSelect.value) throw new Error("프로필을 먼저 선택하세요");
        if (!companySelect.value) throw new Error("회사를 먼저 선택하세요");
        const profile = await api(`/v1/profiles/${profileSelect.value}`);
        const selectedCompany = loadCompanies().find((c) => c.id === companySelect.value);
        if (selectedCompany?.char_limit && charLimit) charLimit.value = String(selectedCompany.char_limit);

        const payload = {
          selected_chunks: chunks,
          selected_episodes: [
            {
              title: profile?.payload?.episode?.title || "",
              action: profile?.payload?.episode?.action || "",
              results_qual: profile?.payload?.episode?.result || "",
              learning: profile?.payload?.episode?.learning || "",
            },
          ],
          company_context: {
            company_name: selectedCompany?.company_name || "貴社",
            role: selectedCompany?.role || "",
            key_phrases: [],
            question_set: [],
          },
          question_type: detailValue(questionType) || "gakuchika",
          char_limit: toInt(detailValue(charLimit) || "400"),
          writing_rules: null,
          question_template: selectedCompany?.question_template || "",
        };

        const result = await api("/v1/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        lastClaims = result.claims || [];
        const text = (lastClaims || []).map((c) => c.text).join(" ");
        const qHeader = selectedCompany?.question_template ? `질문: ${selectedCompany.question_template}

` : "";
        preview.textContent = (qHeader + text) || "생성된 초안이 없습니다.";
        if (charCount) charCount.textContent = `${text.length} 자`;

        if (qaPanel) {
          qaPanel.innerHTML = "";
          (result.qa_findings || []).forEach((f) => {
            const item = document.createElement("div");
            item.className = `card ${f.level === "blocker" ? "strict" : ""}`;
            item.textContent = `[${f.level}] ${f.message}`;
            qaPanel.appendChild(item);
          });
        }

        const history = loadDraftHistory();
        history.unshift({
          id: uuid(),
          created_at: new Date().toLocaleString(),
          company_name: selectedCompany?.company_name || "貴社",
          question_type: payload.question_type,
          text: qHeader + text,
          claims: lastClaims,
          qa_findings: result.qa_findings || [],
        });
        saveDraftHistory(history);
        renderHistory();

        toast("draft generated", false);
      } catch (e) {
        if (err) err.textContent = e.message;
        toast(`generate failed: ${e.message}`, true);
      }
    });
  }

  if (openExport && exportModal) {
    openExport.addEventListener("click", () => exportModal.classList.remove("hidden"));
    exportModal.querySelectorAll("[data-close-export='true']").forEach((el) => {
      el.addEventListener("click", () => exportModal.classList.add("hidden"));
    });
  }

  if (exportRunBtn) {
    exportRunBtn.addEventListener("click", async () => {
      try {
        if (!lastClaims.length) throw new Error("먼저 초안을 생성하세요");
        const payload = {
          claims: lastClaims,
          char_limit: toInt(detailValue(charLimit) || "400"),
          compression_level: Number(detailValue(exportLevel) || "1"),
        };
        const result = await api("/v1/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (exportOutput) {
          exportOutput.textContent = `${result.text}\n\nused: ${result.used_claim_ids.join(", ")}`;
        }
        toast("export complete", false);
      } catch (e) {
        toast(`export failed: ${e.message}`, true);
      }
    });
  }

  loadSelectors().catch((e) => toast(`load failed: ${e.message}`, true));
}
