document.addEventListener("DOMContentLoaded", () => {
  console.log("app.js loaded");

  const page = document.body?.dataset?.page;
  const nav = document.querySelector(`[data-nav="${page}"]`);
  if (nav) nav.classList.add("active");

  if (page === "sources") initSourcesPage();
  if (page === "profile") initProfilePage();
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
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res.text();
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

function detailValue(el) {
  return el && typeof el.value === "string" ? el.value.trim() : "";
}
