(function () {
  var PAGE = document.body.getAttribute('data-page');
  document.querySelectorAll('[data-nav]').forEach(function (n) {
    if (n.getAttribute('data-nav') === PAGE) n.classList.add('active');
  });

  var TAGS = ['gakuchika', 'motivation', 'self_pr', 'future_plan', 'result'];
  var COMMON_QUESTIONS = [
    { type: 'gakuchika', label: '学生時代に力を入れたこと', charLimit: 400 },
    { type: 'self_pr', label: '自己PR', charLimit: 400 },
    { type: 'motivation', label: '志望動機', charLimit: 400 },
  ];

  var state = window.esStore.load();

  function save() { window.esStore.save(state); }
  function uid() { return Math.random().toString(36).slice(2, 10); }
  function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function byId(id) { return document.getElementById(id); }
  function safeId(v) { return String(v).replace(/[^a-zA-Z0-9_-]/g, '_'); }
  function toast(msg) {
    var wrap = document.querySelector('.toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
    var n = document.createElement('div'); n.className = 'toast'; n.textContent = msg; wrap.appendChild(n);
    setTimeout(function () { n.remove(); }, 2600);
  }

  function deriveChunks() {
    var out = [];
    state.sources.forEach(function (s) {
      s.content.split(/\n\s*\n/g).map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (p, i) {
        var idx = i + 1;
        var key = s.id + ':' + idx;
        out.push({ key: key, sourceId: s.id, chunkIndex: idx, text: p, sourceTitle: s.title });
      });
    });
    return out;
  }

  function pinsFirst(chunks) {
    return chunks.slice().sort(function (a, b) {
      return (state.pins[b.key] ? 1 : 0) - (state.pins[a.key] ? 1 : 0);
    });
  }

  function openModal(id) { byId(id).classList.remove('hidden'); }
  function closeModal(id) { byId(id).classList.add('hidden'); }

  function renderSources() {
    var selectedSourceId = state.sources[0] ? state.sources[0].id : null;
    var selectedChunk = null;

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
      var chunks = deriveChunks().filter(function (c) { return c.sourceId === selectedSourceId; });
      chunks = chunks.filter(function (c) { return c.text.toLowerCase().indexOf(search) >= 0; });
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
        row.className = 'chunk-card grouped';
        row.id = 'chunk-' + safeId(c.key);
        row.innerHTML = '<div class="row-between"><strong>' + esc(c.key) + '</strong><button class="btn" data-open-chunk="' + c.key + '">열기</button></div><p>' + esc(c.text.slice(0, 120)) + '</p><div class="row"><button class="btn ' + (state.pins[c.key] ? 'primary' : '') + '" data-pin="' + c.key + '">' + (state.pins[c.key] ? '고정됨' : '고정') + '</button><span class="muted">Link: ' + esc(c.key) + '</span><button class="btn" data-copy="' + c.key + '">복사</button></div><div class="chips">' + tagChips + '</div>';
        list.appendChild(row);
      });
    }

    function syncChunkModal() {
      if (!selectedChunk) return;
      byId('chunk-modal-text').textContent = selectedChunk.text;
      byId('chunk-modal-key').textContent = selectedChunk.key;
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
      if (!title || !content) {
        err.textContent = '제목과 내용은 필수입니다.';
        return;
      }
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
        state.episodes.forEach(function (ep) {
          ep.linkedChunkKeys = (ep.linkedChunkKeys || []).filter(function (k) { return k.indexOf(del + ':') !== 0; });
        });
        state.companies.forEach(function (c) {
          c.linkedSourceIds = (c.linkedSourceIds || []).filter(function (id) { return id !== del; });
        });
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
      if (openChunk) {
        selectedChunk = deriveChunks().find(function (c) { return c.key === openChunk; }) || null;
        syncChunkModal(); openModal('chunk-modal');
      }
    });

    byId('chunk-modal').addEventListener('click', function (e) {
      if (e.target.getAttribute('data-close-chunk-modal') === 'true') closeModal('chunk-modal');
      if (e.target.id === 'chunk-modal-pin' && selectedChunk) {
        state.pins[selectedChunk.key] = !state.pins[selectedChunk.key];
        if (!state.pins[selectedChunk.key]) delete state.pins[selectedChunk.key];
        save(); syncChunkModal(); drawChunks();
      }
      if (e.target.id === 'chunk-modal-copy-key' && selectedChunk) {
        navigator.clipboard && navigator.clipboard.writeText(selectedChunk.key);
        toast('청크 키를 복사했습니다.');
      }
      var modalTag = e.target.getAttribute('data-modal-tag');
      if (modalTag && selectedChunk) {
        var arr = state.chunkPurposeTags[selectedChunk.key] || [];
        if (arr.indexOf(modalTag) >= 0) arr = arr.filter(function (x) { return x !== modalTag; }); else arr.push(modalTag);
        state.chunkPurposeTags[selectedChunk.key] = arr;
        save(); syncChunkModal(); drawChunks();
      }
    });

    drawSources();
    drawChunks();
  }

  function renderProfile() {
    var editingId = null;
    var linkedTemp = [];

    function parseRules() {
      try { return JSON.parse(state.profile.writing_rules || '{}'); } catch (e) { return {}; }
    }
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

    function renderLinkedChipPreview() {
      byId('ep-linked-chunks').innerHTML = linkedTemp.map(function (k) { return '<span class="chip on">' + esc(k) + '</span>'; }).join('');
    }

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
      editingId = null;
      byId('episode-modal-title').textContent = '에피소드 추가';
      byId('episode-form-error').textContent = '';
      fillEpisode({});
      openModal('episode-modal');
    });

    byId('episode-list').addEventListener('click', function (e) {
      var edit = e.target.getAttribute('data-edit');
      var del = e.target.getAttribute('data-del');
      if (edit) {
        var ep = state.episodes.find(function (x) { return x.id === edit; });
        if (!ep) return;
        editingId = edit;
        byId('episode-modal-title').textContent = '에피소드 수정';
        byId('episode-form-error').textContent = '';
        fillEpisode(ep);
        openModal('episode-modal');
      }
      if (del) {
        state.episodes = state.episodes.filter(function (x) { return x.id !== del; });
        save(); drawEpisodes();
      }
    });

    byId('episode-modal').addEventListener('click', function (e) {
      if (e.target.getAttribute('data-close-modal') === 'true') closeModal('episode-modal');
    });

    byId('open-evidence-picker').addEventListener('click', function () {
      drawEvidencePicker();
      openModal('evidence-modal');
    });
    byId('evidence-search').addEventListener('input', drawEvidencePicker);
    byId('evidence-picker').addEventListener('change', function (e) {
      var ck = e.target.getAttribute('data-ck');
      if (!ck) return;
      if (e.target.checked && linkedTemp.indexOf(ck) < 0) linkedTemp.push(ck);
      if (!e.target.checked) linkedTemp = linkedTemp.filter(function (x) { return x !== ck; });
    });
    byId('evidence-apply').addEventListener('click', function () {
      renderLinkedChipPreview();
      closeModal('evidence-modal');
    });
    byId('evidence-modal').addEventListener('click', function (e) {
      if (e.target.getAttribute('data-close-evidence-modal') === 'true') closeModal('evidence-modal');
    });

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
      if (!ep.title || !ep.period) {
        byId('episode-form-error').textContent = '제목과 기간은 필수입니다.';
        return;
      }
      if (editingId) state.episodes = state.episodes.map(function (x) { return x.id === editingId ? ep : x; });
      else state.episodes.unshift(ep);
      save(); closeModal('episode-modal'); drawEpisodes();
    });

    drawProfile();
    drawEpisodes();
  }

  function renderCompany() {
    var editingId = null;

    function activeCompany() {
      return state.companies[0] || null;
    }

    function drawCompanies() {
      var list = byId('company-list');
      var empty = byId('company-empty');
      list.innerHTML = '';
      empty.classList.toggle('hidden', state.companies.length > 0);
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
      var sourceLinks = byId('company-source-links');
      var phraseList = byId('company-phrase-list');
      var qList = byId('company-question-list');

      if (!c) {
        sourceLinks.innerHTML = '<div class="empty-state">기업을 선택하세요.</div>';
        phraseList.innerHTML = '';
        qList.innerHTML = '';
        return;
      }

      sourceLinks.innerHTML = '';
      state.sources.forEach(function (s) {
        var on = (c.linkedSourceIds || []).indexOf(s.id) >= 0;
        var row = document.createElement('label');
        row.className = 'row-between';
        row.innerHTML = '<span>' + esc(s.title) + '</span><input type="checkbox" data-link-src="' + s.id + '" ' + (on ? 'checked' : '') + ' />';
        sourceLinks.appendChild(row);
      });

      phraseList.innerHTML = (c.keyPhrases || []).map(function (p, i) {
        return '<button class="chip on" data-del-phrase="' + i + '">' + esc(p) + ' ×</button>';
      }).join('');

      qList.innerHTML = '';
      (c.questionSet || []).forEach(function (q, idx) {
        var row = document.createElement('div');
        row.className = 'row';
        row.innerHTML = '<input class="input" data-q-type="' + idx + '" value="' + esc(q.type) + '" /><input class="input" data-q-label="' + idx + '" value="' + esc(q.label) + '" /><input class="input" data-q-limit="' + idx + '" type="number" value="' + Number(q.charLimit || 400) + '" /><button class="btn" data-q-del="' + idx + '">삭제</button>';
        qList.appendChild(row);
      });
      if ((c.questionSet || []).length === 0) qList.innerHTML = '<div class="empty-state">질문 세트가 없습니다.</div>';
    }

    byId('company-add-btn').addEventListener('click', function () {
      editingId = null;
      byId('company-modal-title').textContent = '기업 추가';
      byId('company-form-error').textContent = '';
      byId('company-name').value = '';
      byId('company-role').value = '';
      openModal('company-modal');
    });

    byId('company-save-btn').addEventListener('click', function () {
      var name = byId('company-name').value.trim();
      var role = byId('company-role').value.trim();
      if (!name) { byId('company-form-error').textContent = '기업명은 필수입니다.'; return; }
      if (editingId) {
        state.companies = state.companies.map(function (c) { return c.id === editingId ? Object.assign({}, c, { name: name, role: role }) : c; });
      } else {
        state.companies.unshift({ id: uid(), name: name, role: role, linkedSourceIds: [], keyPhrases: [], questionSet: [] });
      }
      save(); closeModal('company-modal'); drawCompanies(); drawDetail();
    });

    byId('company-modal').addEventListener('click', function (e) {
      if (e.target.getAttribute('data-close-company-modal') === 'true') closeModal('company-modal');
    });

    byId('company-list').addEventListener('click', function (e) {
      var edit = e.target.getAttribute('data-edit');
      var del = e.target.getAttribute('data-del');
      var up = e.target.getAttribute('data-up');
      if (edit) {
        var c = state.companies.find(function (x) { return x.id === edit; });
        if (!c) return;
        editingId = edit;
        byId('company-modal-title').textContent = '기업 수정';
        byId('company-name').value = c.name || '';
        byId('company-role').value = c.role || '';
        byId('company-form-error').textContent = '';
        openModal('company-modal');
      }
      if (del) {
        state.companies = state.companies.filter(function (x) { return x.id !== del; });
        save(); drawCompanies(); drawDetail();
      }
      if (up) {
        var idx = state.companies.findIndex(function (x) { return x.id === up; });
        if (idx > 0) {
          var c = state.companies.splice(idx, 1)[0];
          state.companies.unshift(c);
          save(); drawCompanies(); drawDetail();
        }
      }
    });

    byId('company-phrase-add').addEventListener('click', function () {
      var c = activeCompany(); if (!c) return;
      var val = byId('company-phrase-input').value.trim();
      if (!val) return;
      c.keyPhrases = c.keyPhrases || [];
      c.keyPhrases.push(val);
      byId('company-phrase-input').value = '';
      save(); drawDetail();
    });

    byId('company-detail-section').addEventListener('click', function (e) {
      var c = activeCompany(); if (!c) return;
      var delPhrase = e.target.getAttribute('data-del-phrase');
      var qDel = e.target.getAttribute('data-q-del');
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
      var qt = e.target.getAttribute('data-q-type');
      var ql = e.target.getAttribute('data-q-label');
      var qm = e.target.getAttribute('data-q-limit');
      if (qt !== null) c.questionSet[Number(qt)].type = e.target.value;
      if (ql !== null) c.questionSet[Number(ql)].label = e.target.value;
      if (qm !== null) c.questionSet[Number(qm)].charLimit = Number(e.target.value || 400);
      save();
    });

    byId('company-question-add').addEventListener('click', function () {
      var c = activeCompany(); if (!c) return;
      c.questionSet = c.questionSet || [];
      var seed = COMMON_QUESTIONS[c.questionSet.length % COMMON_QUESTIONS.length];
      c.questionSet.push({ type: seed.type, label: seed.label, charLimit: seed.charLimit });
      save(); drawDetail();
    });

    drawCompanies();
    drawDetail();
  }

  if (PAGE === 'sources') renderSources();
  if (PAGE === 'profile') renderProfile();
  if (PAGE === 'company') renderCompany();
})();
