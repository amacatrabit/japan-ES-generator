(function () {
  var PAGE = document.body.getAttribute('data-page');
  document.querySelectorAll('[data-nav]').forEach(function (n) {
    if (n.getAttribute('data-nav') === PAGE) n.classList.add('active');
  });

  var TAGS = ['gakuchika', 'motivation', 'self_pr', 'future_plan', 'result'];
  var QUESTION_TYPES = ['gakuchika', 'self_pr', 'motivation', 'strengths_weaknesses', 'future_plan', 'job_hunting_axis'];
  var state = window.esStore.load();

  function save() { window.esStore.save(state); }
  function uid() { return Math.random().toString(36).slice(2, 10); }
  function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function byId(id) { return document.getElementById(id); }
  function safeId(v) { return String(v).replace(/[^a-zA-Z0-9_-]/g, '_'); }
  function openModal(id) { byId(id).classList.remove('hidden'); }
  function closeModal(id) { byId(id).classList.add('hidden'); }

  function toast(msg, onRetry) {
    var wrap = document.querySelector('.toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
    var n = document.createElement('div'); n.className = 'toast';
    n.innerHTML = '<div>' + esc(msg) + '</div>';
    if (typeof onRetry === 'function') {
      var b = document.createElement('button'); b.className = 'btn'; b.textContent = '재시도'; b.style.marginTop = '8px';
      b.addEventListener('click', function () { onRetry(); });
      n.appendChild(b);
    }
    wrap.appendChild(n);
    setTimeout(function () { n.remove(); }, 3500);
  }

  function deriveChunks() {
    var out = [];
    state.sources.forEach(function (s) {
      s.content.split(/\n\s*\n/g).map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (p, i) {
        var idx = i + 1;
        out.push({
          key: s.id + ':' + idx,
          sourceId: s.id,
          chunkIndex: idx,
          text: p,
          sourceTitle: s.title,
          stableChunkId: 'src:' + s.id + ':chunk:' + idx,
        });
      });
    });
    return out;
  }

  function pinsFirst(chunks) {
    return chunks.slice().sort(function (a, b) {
      return (state.pins[b.key] ? 1 : 0) - (state.pins[a.key] ? 1 : 0);
    });
  }

  function parseHashChunk() {
    var h = window.location.hash || '';
    if (!h) return null;
    if (h.indexOf('#src=') === 0) {
      var q = new URLSearchParams(h.slice(1));
      var src = q.get('src');
      var chunk = q.get('chunk');
      if (src && chunk) return { sourceId: src, chunkIndex: Number(chunk), key: src + ':' + Number(chunk) };
    }
    return null;
  }

  function renderSources() {
    var selectedSourceId = state.sources[0] ? state.sources[0].id : null;
    var selectedChunk = null;
    var hashTarget = parseHashChunk();
    if (hashTarget) selectedSourceId = hashTarget.sourceId;

    function drawSources() {
      var list = byId('source-list');
      var empty = byId('source-list-empty');
      list.innerHTML = '';
      empty.classList.toggle('hidden', state.sources.length > 0);
      state.sources.forEach(function (s) {
        var card = document.createElement('div');
        card.className = 'source-card';
        card.innerHTML = '<div class="row-between"><strong>' + esc(s.title) + '</strong><div class="row"><button class="btn" data-open="' + s.id + '">열기</button><button class="btn" data-del="' + s.id + '">삭제</button></div></div><div class="muted">' + esc(s.type) + ' · ' + new Date(s.createdAt).toLocaleString() + '</div>';
        list.appendChild(card);
      });
    }

    function drawChunks() {
      var search = (byId('chunk-search').value || '').toLowerCase();
      var chunks = deriveChunks().filter(function (c) { return c.sourceId === selectedSourceId; })
        .filter(function (c) { return c.text.toLowerCase().indexOf(search) >= 0; });
      var list = byId('chunk-list');
      var empty = byId('chunk-list-empty');
      list.innerHTML = '';
      empty.classList.toggle('hidden', chunks.length > 0 || !selectedSourceId);
      var source = state.sources.find(function (s) { return s.id === selectedSourceId; });
      byId('source-detail-title').textContent = source ? ('소스 상세 — ' + source.title) : '소스 상세';

      chunks.forEach(function (c) {
        var tags = state.chunkPurposeTags[c.key] || [];
        var tagChips = TAGS.map(function (t) { return '<button class="chip ' + (tags.indexOf(t) >= 0 ? 'on' : '') + '" data-tag="' + t + '" data-key="' + c.key + '">' + t + '</button>'; }).join('');
        var row = document.createElement('div');
        row.className = 'chunk-card grouped' + (hashTarget && hashTarget.key === c.key ? ' highlight' : '');
        row.id = 'chunk-' + safeId(c.key);
        row.innerHTML = '<div class="row-between"><strong>' + esc(c.stableChunkId) + '</strong><button class="btn" data-open-chunk="' + c.key + '">열기</button></div><p>' + esc(c.text.slice(0, 120)) + '</p><div class="row"><button class="btn ' + (state.pins[c.key] ? 'primary' : '') + '" data-pin="' + c.key + '">' + (state.pins[c.key] ? '고정됨' : '고정') + '</button><span class="muted">Link: ' + esc(c.key) + '</span><button class="btn" data-copy="' + c.stableChunkId + '">복사</button></div><div class="chips">' + tagChips + '</div>';
        list.appendChild(row);
      });
      if (hashTarget) {
        var el = byId('chunk-' + safeId(hashTarget.key));
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    function syncChunkModal() {
      if (!selectedChunk) return;
      byId('chunk-modal-text').textContent = selectedChunk.text;
      byId('chunk-modal-key').textContent = selectedChunk.stableChunkId;
      byId('chunk-modal-pin').textContent = state.pins[selectedChunk.key] ? '고정 해제' : '고정';
      var tags = state.chunkPurposeTags[selectedChunk.key] || [];
      byId('chunk-modal-tags').innerHTML = TAGS.map(function (t) { return '<button class="chip ' + (tags.indexOf(t) >= 0 ? 'on' : '') + '" data-modal-tag="' + t + '">' + t + '</button>'; }).join('');
    }

    byId('source-add-btn').addEventListener('click', function () {
      var title = (byId('source-title').value || '').trim();
      var content = (byId('source-content').value || '').trim();
      var typeNode = document.querySelector('input[name="source-type"]:checked');
      var type = typeNode ? typeNode.value : 'note';
      var err = byId('source-form-error');
      if (!title || !content) { err.textContent = '제목과 내용은 필수입니다.'; return; }
      err.textContent = '';
      var src = { id: uid(), title: title, type: type, content: content, createdAt: Date.now() };
      state.sources.unshift(src);
      selectedSourceId = src.id;
      byId('source-title').value = ''; byId('source-content').value = '';
      save(); drawSources(); drawChunks();
    });

    byId('source-list').addEventListener('click', function (e) {
      var open = e.target.getAttribute('data-open');
      var del = e.target.getAttribute('data-del');
      if (open) { selectedSourceId = open; drawChunks(); }
      if (del) {
        state.sources = state.sources.filter(function (s) { return s.id !== del; });
        Object.keys(state.pins).forEach(function (k) { if (k.indexOf(del + ':') === 0) delete state.pins[k]; });
        Object.keys(state.chunkPurposeTags).forEach(function (k) { if (k.indexOf(del + ':') === 0) delete state.chunkPurposeTags[k]; });
        state.episodes.forEach(function (ep) { ep.linkedChunkKeys = (ep.linkedChunkKeys || []).filter(function (k) { return k.indexOf(del + ':') !== 0; }); });
        state.companies.forEach(function (c) { c.linkedSourceIds = (c.linkedSourceIds || []).filter(function (id) { return id !== del; }); });
        selectedSourceId = state.sources[0] ? state.sources[0].id : null;
        save(); drawSources(); drawChunks();
      }
    });

    byId('chunk-search').addEventListener('input', drawChunks);
    byId('chunk-list').addEventListener('click', function (e) {
      var pin = e.target.getAttribute('data-pin');
      var key = e.target.getAttribute('data-key');
      var tag = e.target.getAttribute('data-tag');
      var copy = e.target.getAttribute('data-copy');
      var openChunk = e.target.getAttribute('data-open-chunk');
      if (pin) { state.pins[pin] = !state.pins[pin]; if (!state.pins[pin]) delete state.pins[pin]; save(); drawChunks(); }
      if (key && tag) {
        var arr = state.chunkPurposeTags[key] || [];
        if (arr.indexOf(tag) >= 0) arr = arr.filter(function (x) { return x !== tag; }); else arr.push(tag);
        state.chunkPurposeTags[key] = arr; save(); drawChunks();
      }
      if (copy) { navigator.clipboard && navigator.clipboard.writeText(copy); toast('청크 키를 복사했습니다.'); }
      if (openChunk) { selectedChunk = deriveChunks().find(function (c) { return c.key === openChunk; }) || null; syncChunkModal(); openModal('chunk-modal'); }
    });

    byId('chunk-modal').addEventListener('click', function (e) {
      if (e.target.getAttribute('data-close-chunk-modal') === 'true') closeModal('chunk-modal');
      if (e.target.id === 'chunk-modal-pin' && selectedChunk) {
        state.pins[selectedChunk.key] = !state.pins[selectedChunk.key]; if (!state.pins[selectedChunk.key]) delete state.pins[selectedChunk.key];
        save(); syncChunkModal(); drawChunks();
      }
      if (e.target.id === 'chunk-modal-copy-key' && selectedChunk) { navigator.clipboard && navigator.clipboard.writeText(selectedChunk.stableChunkId); toast('청크 키를 복사했습니다.'); }
      var modalTag = e.target.getAttribute('data-modal-tag');
      if (modalTag && selectedChunk) {
        var arr = state.chunkPurposeTags[selectedChunk.key] || [];
        if (arr.indexOf(modalTag) >= 0) arr = arr.filter(function (x) { return x !== modalTag; }); else arr.push(modalTag);
        state.chunkPurposeTags[selectedChunk.key] = arr; save(); syncChunkModal(); drawChunks();
      }
    });

    drawSources(); drawChunks();
  }

  function renderProfile() {
    var editingId = null;
    var linkedTemp = [];

    function parseRules() { try { return JSON.parse(state.profile.writing_rules || '{}'); } catch (e) { return {}; } }
    function saveRules(r) { state.profile.writing_rules = JSON.stringify(r); save(); }

    function drawProfile() {
      byId('profile-name').value = state.profile.name || '';
      var rules = parseRules();
      byId('rule-avoid-teiru').checked = !!rules.avoid_teiru;
      byId('rule-prefer-omou').checked = !!rules.prefer_omou_over_kangaeru;
      byId('rule-avoid-kanji').checked = !!rules.avoid_excessive_kanji_compounds;
    }

    function drawEpisodes() {
      var list = byId('episode-list');
      var empty = byId('episode-empty');
      list.innerHTML = '';
      empty.classList.toggle('hidden', state.episodes.length > 0);
      state.episodes.forEach(function (ep) {
        var cnt = (ep.linkedChunkKeys || []).length;
        var card = document.createElement('div');
        card.className = 'episode-card';
        card.innerHTML = '<div class="row-between"><strong>' + esc(ep.title) + '</strong><div class="row"><span class="badge strict">근거 ' + cnt + '</span><button class="btn" data-edit="' + ep.id + '">수정</button><button class="btn" data-del="' + ep.id + '">삭제</button></div></div><div class="muted">' + esc(ep.period || '') + '</div>';
        list.appendChild(card);
      });
    }

    function fillEpisode(ep) {
      byId('ep-title').value = ep.title || '';
      byId('ep-period').value = ep.period || '';
      byId('ep-context').value = ep.context || '';
      byId('ep-role').value = ep.role || '';
      byId('ep-goal').value = ep.goal || '';
      byId('ep-problem').value = ep.problem || '';
      byId('ep-action1').value = (ep.actions && ep.actions[0]) || '';
      byId('ep-action2').value = (ep.actions && ep.actions[1]) || '';
      byId('ep-action3').value = (ep.actions && ep.actions[2]) || '';
      byId('ep-results-quant').value = ep.resultsQuant || '';
      byId('ep-results-qual').value = ep.resultsQual || '';
      byId('ep-learning').value = ep.learning || '';
      linkedTemp = (ep.linkedChunkKeys || []).slice();
      renderLinkedChipPreview();
    }

    function renderLinkedChipPreview() { byId('ep-linked-chunks').innerHTML = linkedTemp.map(function (k) { return '<span class="chip on">' + esc(k) + '</span>'; }).join(''); }

    function drawEvidencePicker() {
      var search = (byId('evidence-search').value || '').toLowerCase();
      var chunks = pinsFirst(deriveChunks()).filter(function (c) { return c.text.toLowerCase().indexOf(search) >= 0; });
      var picker = byId('evidence-picker');
      picker.innerHTML = '';
      chunks.forEach(function (c) {
        var checked = linkedTemp.indexOf(c.key) >= 0;
        var row = document.createElement('label');
        row.className = 'row-between';
        row.innerHTML = '<span>' + (state.pins[c.key] ? '📌 ' : '') + esc(c.text.slice(0, 80)) + '</span><input type="checkbox" data-ck="' + c.key + '" ' + (checked ? 'checked' : '') + ' />';
        picker.appendChild(row);
      });
    }

    byId('profile-name').addEventListener('change', function () { state.profile.name = byId('profile-name').value.trim(); save(); });
    ['rule-avoid-teiru', 'rule-prefer-omou', 'rule-avoid-kanji'].forEach(function (id) {
      byId(id).addEventListener('change', function () {
        var r = parseRules();
        r.avoid_teiru = byId('rule-avoid-teiru').checked;
        r.prefer_omou_over_kangaeru = byId('rule-prefer-omou').checked;
        r.avoid_excessive_kanji_compounds = byId('rule-avoid-kanji').checked;
        saveRules(r);
      });
    });

    byId('episode-add-btn').addEventListener('click', function () {
      editingId = null; byId('episode-modal-title').textContent = '에피소드 추가'; byId('episode-form-error').textContent = ''; fillEpisode({}); openModal('episode-modal');
    });

    byId('episode-list').addEventListener('click', function (e) {
      var edit = e.target.getAttribute('data-edit');
      var del = e.target.getAttribute('data-del');
      if (edit) { var ep = state.episodes.find(function (x) { return x.id === edit; }); if (!ep) return; editingId = edit; byId('episode-modal-title').textContent = '에피소드 수정'; byId('episode-form-error').textContent = ''; fillEpisode(ep); openModal('episode-modal'); }
      if (del) { state.episodes = state.episodes.filter(function (x) { return x.id !== del; }); save(); drawEpisodes(); }
    });

    byId('episode-modal').addEventListener('click', function (e) { if (e.target.getAttribute('data-close-modal') === 'true') closeModal('episode-modal'); });
    byId('open-evidence-picker').addEventListener('click', function () { drawEvidencePicker(); openModal('evidence-modal'); });
    byId('evidence-search').addEventListener('input', drawEvidencePicker);
    byId('evidence-picker').addEventListener('change', function (e) {
      var ck = e.target.getAttribute('data-ck'); if (!ck) return;
      if (e.target.checked && linkedTemp.indexOf(ck) < 0) linkedTemp.push(ck);
      if (!e.target.checked) linkedTemp = linkedTemp.filter(function (x) { return x !== ck; });
    });
    byId('evidence-apply').addEventListener('click', function () { renderLinkedChipPreview(); closeModal('evidence-modal'); });
    byId('evidence-modal').addEventListener('click', function (e) { if (e.target.getAttribute('data-close-evidence-modal') === 'true') closeModal('evidence-modal'); });

    byId('episode-save-btn').addEventListener('click', function () {
      var ep = {
        id: editingId || uid(),
        title: byId('ep-title').value.trim(),
        period: byId('ep-period').value.trim(),
        context: byId('ep-context').value.trim(),
        role: byId('ep-role').value.trim(),
        goal: byId('ep-goal').value.trim(),
        problem: byId('ep-problem').value.trim(),
        actions: [byId('ep-action1').value.trim(), byId('ep-action2').value.trim(), byId('ep-action3').value.trim()].filter(Boolean),
        resultsQuant: byId('ep-results-quant').value.trim(),
        resultsQual: byId('ep-results-qual').value.trim(),
        learning: byId('ep-learning').value.trim(),
        linkedChunkKeys: linkedTemp.slice(),
      };
      if (!ep.title || !ep.period) { byId('episode-form-error').textContent = '제목과 기간은 필수입니다.'; return; }
      if (editingId) state.episodes = state.episodes.map(function (x) { return x.id === editingId ? ep : x; }); else state.episodes.unshift(ep);
      save(); closeModal('episode-modal'); drawEpisodes();
    });

    drawProfile(); drawEpisodes();
  }

  function renderCompany() {
    var editingId = null;
    function activeCompany() { return state.companies[0] || null; }

    function drawCompanies() {
      var list = byId('company-list'); var empty = byId('company-empty');
      list.innerHTML = ''; empty.classList.toggle('hidden', state.companies.length > 0);
      state.companies.forEach(function (c) {
        var card = document.createElement('div');
        card.className = 'company-card';
        card.innerHTML = '<div class="row-between"><strong>' + esc(c.name) + '</strong><div class="row"><button class="btn" data-edit="' + c.id + '">수정</button><button class="btn" data-up="' + c.id + '">선택</button><button class="btn" data-del="' + c.id + '">삭제</button></div></div><div class="muted">' + esc(c.role || '') + '</div>';
        list.appendChild(card);
      });
    }

    function drawDetail() {
      var c = activeCompany();
      byId('company-detail-title').textContent = c ? ('기업 상세 — ' + c.name) : '기업 상세';
      var sourceLinks = byId('company-source-links'); var phraseList = byId('company-phrase-list'); var qList = byId('company-question-list');
      if (!c) { sourceLinks.innerHTML = '<div class="empty-state">기업을 선택하세요.</div>'; phraseList.innerHTML = ''; qList.innerHTML = ''; return; }

      sourceLinks.innerHTML = '';
      state.sources.forEach(function (s) {
        var on = (c.linkedSourceIds || []).indexOf(s.id) >= 0;
        var row = document.createElement('label'); row.className = 'row-between';
        row.innerHTML = '<span>' + esc(s.title) + '</span><input type="checkbox" data-link-src="' + s.id + '" ' + (on ? 'checked' : '') + ' />';
        sourceLinks.appendChild(row);
      });

      phraseList.innerHTML = (c.keyPhrases || []).map(function (p, i) { return '<button class="chip on" data-del-phrase="' + i + '">' + esc(p) + ' ×</button>'; }).join('');

      qList.innerHTML = '';
      (c.questionSet || []).forEach(function (q, idx) {
        var row = document.createElement('div'); row.className = 'row';
        row.innerHTML = '<input class="input" data-q-type="' + idx + '" value="' + esc(q.type) + '" /><input class="input" data-q-label="' + idx + '" value="' + esc(q.label) + '" /><input class="input" data-q-limit="' + idx + '" type="number" value="' + Number(q.charLimit || 400) + '" /><button class="btn" data-q-del="' + idx + '">삭제</button>';
        qList.appendChild(row);
      });
      if ((c.questionSet || []).length === 0) qList.innerHTML = '<div class="empty-state">질문 세트가 없습니다.</div>';
    }

    byId('company-add-btn').addEventListener('click', function () {
      editingId = null; byId('company-modal-title').textContent = '기업 추가'; byId('company-form-error').textContent = ''; byId('company-name').value = ''; byId('company-role').value = ''; openModal('company-modal');
    });
    byId('company-save-btn').addEventListener('click', function () {
      var name = byId('company-name').value.trim(); var role = byId('company-role').value.trim();
      if (!name) { byId('company-form-error').textContent = '기업명은 필수입니다.'; return; }
      if (editingId) state.companies = state.companies.map(function (c) { return c.id === editingId ? Object.assign({}, c, { name: name, role: role }) : c; });
      else state.companies.unshift({ id: uid(), name: name, role: role, linkedSourceIds: [], keyPhrases: [], questionSet: [] });
      save(); closeModal('company-modal'); drawCompanies(); drawDetail();
    });
    byId('company-modal').addEventListener('click', function (e) { if (e.target.getAttribute('data-close-company-modal') === 'true') closeModal('company-modal'); });

    byId('company-list').addEventListener('click', function (e) {
      var edit = e.target.getAttribute('data-edit'); var del = e.target.getAttribute('data-del'); var up = e.target.getAttribute('data-up');
      if (edit) {
        var c = state.companies.find(function (x) { return x.id === edit; }); if (!c) return;
        editingId = edit; byId('company-modal-title').textContent = '기업 수정'; byId('company-name').value = c.name || ''; byId('company-role').value = c.role || ''; byId('company-form-error').textContent = ''; openModal('company-modal');
      }
      if (del) { state.companies = state.companies.filter(function (x) { return x.id !== del; }); save(); drawCompanies(); drawDetail(); }
      if (up) { var idx = state.companies.findIndex(function (x) { return x.id === up; }); if (idx > 0) { var c2 = state.companies.splice(idx, 1)[0]; state.companies.unshift(c2); save(); drawCompanies(); drawDetail(); } }
    });

    byId('company-phrase-add').addEventListener('click', function () {
      var c = activeCompany(); if (!c) return; var v = byId('company-phrase-input').value.trim(); if (!v) return;
      c.keyPhrases = c.keyPhrases || []; c.keyPhrases.push(v); byId('company-phrase-input').value = ''; save(); drawDetail();
    });

    byId('company-detail-section').addEventListener('click', function (e) {
      var c = activeCompany(); if (!c) return;
      var delPhrase = e.target.getAttribute('data-del-phrase'); var qDel = e.target.getAttribute('data-q-del');
      if (delPhrase !== null) { c.keyPhrases.splice(Number(delPhrase), 1); save(); drawDetail(); }
      if (qDel !== null) { c.questionSet.splice(Number(qDel), 1); save(); drawDetail(); }
    });

    byId('company-detail-section').addEventListener('change', function (e) {
      var c = activeCompany(); if (!c) return;
      var src = e.target.getAttribute('data-link-src');
      if (src) {
        c.linkedSourceIds = c.linkedSourceIds || [];
        if (e.target.checked && c.linkedSourceIds.indexOf(src) < 0) c.linkedSourceIds.push(src);
        if (!e.target.checked) c.linkedSourceIds = c.linkedSourceIds.filter(function (id) { return id !== src; });
      }
      var qt = e.target.getAttribute('data-q-type'); var ql = e.target.getAttribute('data-q-label'); var qm = e.target.getAttribute('data-q-limit');
      if (qt !== null) c.questionSet[Number(qt)].type = e.target.value;
      if (ql !== null) c.questionSet[Number(ql)].label = e.target.value;
      if (qm !== null) c.questionSet[Number(qm)].charLimit = Number(e.target.value || 400);
      save();
    });

    byId('company-question-add').addEventListener('click', function () {
      var c = activeCompany(); if (!c) return;
      c.questionSet = c.questionSet || [];
      var seed = { type: QUESTION_TYPES[c.questionSet.length % QUESTION_TYPES.length], label: '질문', charLimit: 400 };
      c.questionSet.push(seed); save(); drawDetail();
    });

    drawCompanies(); drawDetail();
  }

  function renderDrafts() {
    var wizard = { step: 1, questionType: 'gakuchika', charLimit: 400, companyId: '', episodeIds: [], selectedChunkKeys: [], purposeFilters: [] };
    var activeDraftId = state.drafts[0] ? state.drafts[0].id : '';

    function updateStepUI() {
      document.querySelectorAll('.wizard-step').forEach(function (s) {
        s.classList.toggle('hidden', s.id !== 'wizard-step-' + wizard.step);
      });
      document.querySelectorAll('.step').forEach(function (s) {
        s.classList.toggle('active', Number(s.getAttribute('data-step')) === wizard.step);
      });
      byId('draft-prev-step').disabled = wizard.step === 1;
      byId('draft-next-step').classList.toggle('hidden', wizard.step === 5);
    }

    function drawCompanyOptions() {
      var sel = byId('draft-company-select');
      sel.innerHTML = '<option value="">(선택 안 함)</option>';
      state.companies.forEach(function (c) {
        var o = document.createElement('option'); o.value = c.id; o.textContent = c.name; sel.appendChild(o);
      });
      sel.value = wizard.companyId;
    }

    function drawEpisodePicker() {
      var wrap = byId('draft-episode-picker');
      wrap.innerHTML = '';
      if (!state.episodes.length) { wrap.innerHTML = '<div class="muted">에피소드가 없습니다.</div>'; return; }
      state.episodes.forEach(function (ep) {
        var checked = wizard.episodeIds.indexOf(ep.id) >= 0;
        var row = document.createElement('label');
        row.className = 'row-between';
        row.innerHTML = '<span>' + esc(ep.title) + '</span><input type="checkbox" data-ep="' + ep.id + '" ' + (checked ? 'checked' : '') + ' />';
        wrap.appendChild(row);
      });
    }

    function drawPurposeFilters() {
      var wrap = byId('draft-purpose-filter');
      wrap.innerHTML = TAGS.map(function (t) {
        return '<button class="chip ' + (wizard.purposeFilters.indexOf(t) >= 0 ? 'on' : '') + '" data-filter-tag="' + t + '">' + t + '</button>';
      }).join('');
    }

    function drawChunkPicker() {
      var search = (byId('draft-chunk-search').value || '').toLowerCase();
      var chunks = pinsFirst(deriveChunks()).filter(function (c) { return c.text.toLowerCase().indexOf(search) >= 0; });
      if (wizard.purposeFilters.length) {
        chunks = chunks.filter(function (c) {
          var tags = state.chunkPurposeTags[c.key] || [];
          return wizard.purposeFilters.some(function (t) { return tags.indexOf(t) >= 0; });
        });
      }
      var wrap = byId('draft-chunk-picker');
      wrap.innerHTML = '';
      if (!chunks.length) { wrap.innerHTML = '<div class="muted">선택 가능한 청크가 없습니다.</div>'; return; }
      chunks.forEach(function (c) {
        var checked = wizard.selectedChunkKeys.indexOf(c.key) >= 0;
        var row = document.createElement('label');
        row.className = 'row-between';
        row.innerHTML = '<span>' + (state.pins[c.key] ? '📌 ' : '') + esc(c.text.slice(0, 90)) + '</span><input type="checkbox" data-ck="' + c.key + '" ' + (checked ? 'checked' : '') + ' />';
        wrap.appendChild(row);
      });
    }

    function mergedWritingRules() {
      var profileRules = {};
      try { profileRules = JSON.parse(state.profile.writing_rules || '{}'); } catch (e) { profileRules = {}; }
      return Object.assign({
        avoid_teiru: true,
        prefer_omou_over_kangaeru: true,
        avoid_excessive_kanji_compounds: true,
      }, profileRules);
    }

    function buildSelectedChunks() {
      var map = {};
      deriveChunks().forEach(function (c) { map[c.key] = c; });
      return wizard.selectedChunkKeys.map(function (k) { return map[k]; }).filter(Boolean).map(function (c) {
        return {
          chunk_id: c.stableChunkId,
          text: c.text,
          source_title: c.sourceTitle,
          loc_hint: 'note',
          page_start: 0,
          page_end: 0,
          pinned: !!state.pins[c.key],
        };
      });
    }

    function buildSelectedEpisodes() {
      return state.episodes.filter(function (e) { return wizard.episodeIds.indexOf(e.id) >= 0; }).map(function (e) {
        return {
          title: e.title,
          period: e.period,
          context: e.context,
          role: e.role,
          goal: e.goal,
          problem: e.problem,
          actions: e.actions,
          results_quant: e.resultsQuant,
          results_qual: e.resultsQual,
          learning: e.learning,
          linked_chunk_keys: e.linkedChunkKeys,
        };
      });
    }

    function buildCompanyContext() {
      var c = state.companies.find(function (x) { return x.id === wizard.companyId; });
      if (!c) return {};
      return {
        company_name: c.name,
        role: c.role,
        key_phrases: c.keyPhrases || [],
        question_set: c.questionSet || [],
      };
    }

    function strictPreview(claims) {
      return (claims || []).filter(function (c) { return c.export_allowed; }).map(function (c) { return c.text; }).join('');
    }

    function groupQa(findings) {
      var g = { blocker: [], warn: [], info: [] };
      (findings || []).forEach(function (f) {
        var lvl = f.level || 'info';
        if (!g[lvl]) g[lvl] = [];
        g[lvl].push(f);
      });
      return g;
    }

    function suggestion(code) {
      var c = String(code || '').toUpperCase();
      if (c === 'MISSING_EVIDENCE') return '근거 청크를 추가/고정하고 다시 생성하세요.';
      if (c === 'MISSING_QUANT') return '정량 수치(횟수, %, 기간)를 추가하세요.';
      if (c === 'BANNED_PHRASE') return '금지 표현을 구체 행동/성과 문장으로 교체하세요.';
      if (c === 'PASSIVE_STANCE') return '수동 표현을 주도적 표현으로 바꾸세요.';
      if (c === 'ABSTRACT_SUFFIX') return '추상 명사를 구체적 실행 문장으로 바꾸세요.';
      return '관련 주장과 근거 연결을 재검토하세요.';
    }

    async function generate() {
      byId('draft-generate-error').textContent = '';
      byId('draft-error-panel').textContent = '';
      if (!wizard.selectedChunkKeys.length) {
        byId('draft-generate-error').textContent = '근거 청크를 최소 1개 선택하세요.';
        return;
      }
      var payload = {
        selected_chunks: buildSelectedChunks(),
        selected_episodes: buildSelectedEpisodes(),
        company_context: buildCompanyContext(),
        question_type: wizard.questionType,
        char_limit: wizard.charLimit,
        writing_rules: mergedWritingRules(),
      };
      try {
        var res = await fetch('/v1/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) {
          var err = await safeJson(res);
          byId('draft-generate-error').textContent = (err.detail || '생성 실패') + ' (status ' + res.status + ')';
          return;
        }
        var data = await res.json();
        var draft = {
          id: uid(),
          createdAt: Date.now(),
          questionType: wizard.questionType,
          charLimit: wizard.charLimit,
          companyId: wizard.companyId || null,
          episodeIds: wizard.episodeIds.slice(),
          selectedChunkKeys: wizard.selectedChunkKeys.slice(),
          response: {
            outline: data.outline || [],
            claims: data.claims || [],
            qa_findings: data.qa_findings || [],
            strict_preview_text: strictPreview(data.claims || []),
          },
        };
        state.drafts.unshift(draft);
        activeDraftId = draft.id;
        save();
        drawReview();
        toast('초안 생성 완료');
      } catch (e) {
        byId('draft-generate-error').textContent = '백엔드 연결 실패';
        toast('백엔드 연결 실패', generate);
      }
    }

    function drawHistorySelect() {
      var sel = byId('draft-history-select');
      sel.innerHTML = '';
      if (!state.drafts.length) {
        sel.innerHTML = '<option value="">초안 없음</option>';
        return;
      }
      state.drafts.forEach(function (d) {
        var o = document.createElement('option');
        o.value = d.id;
        o.textContent = new Date(d.createdAt).toLocaleString() + ' · ' + d.questionType;
        sel.appendChild(o);
      });
      if (!activeDraftId) activeDraftId = state.drafts[0].id;
      sel.value = activeDraftId;
    }

    function drawReview() {
      drawHistorySelect();
      var d = state.drafts.find(function (x) { return x.id === activeDraftId; }) || null;
      var preview = d ? (d.response.strict_preview_text || '') : '';
      byId('draft-preview').textContent = preview || '아직 초안이 없습니다.';
      byId('draft-char-count').textContent = preview.length + ' 자';

      var claimsWrap = byId('draft-claims');
      claimsWrap.innerHTML = '';
      if (!d) { claimsWrap.innerHTML = '<div class="empty-state">초안을 생성하세요.</div>'; }
      else {
        (d.response.claims || []).forEach(function (c, idx) {
          var badge = c.export_allowed ? '<span class="badge exportable">✅ Exportable</span>' : '<span class="badge needs-evidence">⚠️ Needs Evidence</span>';
          var evidence = (c.evidence || []).map(function (ev) {
            var m = /^src:(.+):chunk:(\d+)$/.exec(ev.chunk_id || '');
            var jump = m ? '/sources#src=' + encodeURIComponent(m[1]) + '&chunk=' + encodeURIComponent(m[2]) : '/sources';
            return '<li><a href="' + jump + '">Jump to chunk</a> · ' + esc(ev.chunk_id) + '</li>';
          }).join('') || '<li class="muted">근거 없음</li>';
          var node = document.createElement('details');
          node.className = 'card';
          node.innerHTML = '<summary class="row-between"><span><strong>Claim ' + (idx + 1) + '</strong> ' + esc(c.text) + '</span>' + badge + '</summary><ul>' + evidence + '</ul>';
          claimsWrap.appendChild(node);
        });
      }

      var qaWrap = byId('draft-qa-panel');
      qaWrap.innerHTML = '';
      if (!d) { qaWrap.innerHTML = '<div class="empty-state">QA 결과 없음</div>'; }
      else {
        var grouped = groupQa(d.response.qa_findings || []);
        ['blocker', 'warn', 'info'].forEach(function (lvl) {
          if (!grouped[lvl].length) return;
          var items = grouped[lvl].map(function (f) {
            var claimLink = f.claim_id ? (' <a href="#" data-claim-link="' + esc(f.claim_id) + '">(관련 주장)</a>') : '';
            return '<li><strong>' + esc(f.code) + '</strong>: ' + esc(f.message || '') + claimLink + '<div class="muted">제안: ' + esc(suggestion(f.code)) + '</div></li>';
          }).join('');
          var g = document.createElement('div');
          g.className = 'qa-group';
          g.innerHTML = '<div class="qa-title">' + lvl.toUpperCase() + '</div><ul>' + items + '</ul>';
          qaWrap.appendChild(g);
        });
      }
    }

    async function runExport() {
      var d = state.drafts.find(function (x) { return x.id === activeDraftId; });
      if (!d) { byId('export-error').textContent = '초안을 먼저 생성하세요.'; return; }
      var mode = byId('export-mode').value;
      var compression = Number(byId('export-compression').value || 1);
      var claims = (d.response.claims || []).slice();
      if (mode === 'strict') claims = claims.filter(function (c) { return c.export_allowed; });
      var payload = { claims: claims, char_limit: d.charLimit, compression_level: compression };
      try {
        var res = await fetch('/v1/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) {
          var err = await safeJson(res);
          byId('export-error').textContent = (err.detail || '내보내기 실패') + ' (status ' + res.status + ')';
          return;
        }
        var data = await res.json();
        byId('export-result').value = data.text || '';
        byId('export-error').textContent = '';
      } catch (e) {
        byId('export-error').textContent = '백엔드 연결 실패';
        toast('백엔드 연결 실패', runExport);
      }
    }

    byId('draft-question-type').addEventListener('change', function (e) { wizard.questionType = e.target.value; });
    byId('draft-char-limit').addEventListener('input', function (e) { wizard.charLimit = Number(e.target.value || 400); });
    byId('draft-company-select').addEventListener('change', function (e) { wizard.companyId = e.target.value; });
    document.querySelectorAll('[data-char-preset]').forEach(function (b) { b.addEventListener('click', function () { var v = Number(b.getAttribute('data-char-preset')); byId('draft-char-limit').value = v; wizard.charLimit = v; }); });
    byId('draft-next-step').addEventListener('click', function () { if (wizard.step < 5) wizard.step += 1; updateStepUI(); });
    byId('draft-prev-step').addEventListener('click', function () { if (wizard.step > 1) wizard.step -= 1; updateStepUI(); });

    byId('draft-episode-picker').addEventListener('change', function (e) {
      var id = e.target.getAttribute('data-ep'); if (!id) return;
      if (e.target.checked && wizard.episodeIds.indexOf(id) < 0) wizard.episodeIds.push(id);
      if (!e.target.checked) wizard.episodeIds = wizard.episodeIds.filter(function (x) { return x !== id; });
    });

    byId('draft-purpose-filter').addEventListener('click', function (e) {
      var t = e.target.getAttribute('data-filter-tag'); if (!t) return;
      if (wizard.purposeFilters.indexOf(t) >= 0) wizard.purposeFilters = wizard.purposeFilters.filter(function (x) { return x !== t; });
      else wizard.purposeFilters.push(t);
      drawPurposeFilters(); drawChunkPicker();
    });

    byId('draft-chunk-search').addEventListener('input', drawChunkPicker);
    byId('draft-chunk-picker').addEventListener('change', function (e) {
      var ck = e.target.getAttribute('data-ck'); if (!ck) return;
      if (e.target.checked && wizard.selectedChunkKeys.indexOf(ck) < 0) wizard.selectedChunkKeys.push(ck);
      if (!e.target.checked) wizard.selectedChunkKeys = wizard.selectedChunkKeys.filter(function (x) { return x !== ck; });
    });

    byId('draft-generate-btn').addEventListener('click', generate);
    byId('draft-history-select').addEventListener('change', function (e) { activeDraftId = e.target.value; drawReview(); });
    byId('draft-open-export').addEventListener('click', function () { byId('export-error').textContent = ''; openModal('export-modal'); });
    byId('export-modal').addEventListener('click', function (e) { if (e.target.getAttribute('data-close-export') === 'true') closeModal('export-modal'); });
    byId('export-run-btn').addEventListener('click', runExport);
    byId('export-copy-btn').addEventListener('click', function () {
      var t = byId('export-result');
      t.select();
      try { document.execCommand('copy'); toast('복사 완료'); } catch (e) { toast('복사 실패'); }
    });

    drawCompanyOptions(); drawEpisodePicker(); drawPurposeFilters(); drawChunkPicker(); drawReview(); updateStepUI();
  }

  async function safeJson(res) { try { return await res.json(); } catch (e) { return {}; } }

  if (PAGE === 'sources') renderSources();
  if (PAGE === 'profile') renderProfile();
  if (PAGE === 'company') renderCompany();
  if (PAGE === 'drafts') renderDrafts();
})();
