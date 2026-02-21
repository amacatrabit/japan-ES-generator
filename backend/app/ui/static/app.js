(function () {
  var PAGE = document.body.getAttribute('data-page');
  var navLinks = document.querySelectorAll('[data-nav]');
  navLinks.forEach(function (link) {
    if (link.getAttribute('data-nav') === PAGE) link.classList.add('active');
  });

  var KEY = 'es-writer-ui-store-v1';
  var QUESTION_TYPES = ['gakuchika', 'self_pr', 'motivation', 'strengths_weaknesses', 'future_plan', 'job_hunting_axis'];
  var PURPOSE_TAGS = ['gakuchika', 'motivation', 'self_pr', 'future_plan', 'result'];

  function uid() { return Math.random().toString(36).slice(2, 10); }

  function defaultStore() {
    return {
      profile: {
        name: '',
        writingRules: {
          avoidTeiru: true,
          preferOmouOverKangaeru: true,
          avoidExcessiveKanjiCompounds: true,
        }
      },
      sources: [],
      pinnedChunks: [],
      chunkTags: {},
      episodes: [],
      companies: [],
      drafts: []
    };
  }

  function loadStore() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return defaultStore();
      var parsed = JSON.parse(raw);
      return Object.assign(defaultStore(), parsed, {
        profile: Object.assign(defaultStore().profile, parsed.profile || {}),
      });
    } catch (e) {
      return defaultStore();
    }
  }

  function saveStore(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function deriveChunks(sources) {
    var chunks = [];
    sources.forEach(function (source) {
      source.content.split(/\n\s*\n/g).map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (paragraph, idx) {
        var chunkNumber = idx + 1;
        var key = 'src:' + source.id + ':chunk:' + chunkNumber;
        chunks.push({ key: key, sourceId: source.id, sourceTitle: source.title, chunkIndex: chunkNumber, preview: paragraph });
      });
    });
    return chunks;
  }

  function parseSourceIdFromChunkKey(key) {
    var m = /^src:(.+):chunk:\d+$/.exec(key || '');
    return m ? m[1] : null;
  }

  var state = loadStore();

  function renderSourcesPage() {
    var sourceList = document.getElementById('source-list');
    var sourceEmpty = document.getElementById('source-list-empty');
    var chunkList = document.getElementById('chunk-list');
    var chunkEmpty = document.getElementById('chunk-list-empty');
    var detailTitle = document.getElementById('source-detail-title');
    var selectedSourceId = state.sources[0] ? state.sources[0].id : null;
    var highlightedChunkKey = null;

    function fromHash() {
      var hash = window.location.hash || '';
      if (hash.indexOf('#chunk=') === 0) {
        var key = decodeURIComponent(hash.slice(7));
        var srcId = parseSourceIdFromChunkKey(key);
        if (srcId) selectedSourceId = srcId;
        highlightedChunkKey = key;
      }
    }

    function drawSources() {
      sourceList.innerHTML = '';
      sourceEmpty.classList.toggle('hidden', state.sources.length > 0);
      state.sources.forEach(function (source) {
        var el = document.createElement('div');
        el.className = 'source-card';
        el.innerHTML = '<div class="row-between"><strong>' + escapeHtml(source.title) + '</strong><div class="row"><button class="btn" data-open-source="' + source.id + '">열기</button><button class="btn" data-del-source="' + source.id + '">삭제</button></div></div><p class="muted">' + new Date(source.createdAt).toLocaleString() + '</p>';
        sourceList.appendChild(el);
      });
    }

    function drawChunks() {
      var search = (document.getElementById('chunk-search').value || '').toLowerCase();
      var chunks = deriveChunks(state.sources)
        .filter(function (c) { return c.sourceId === selectedSourceId; })
        .filter(function (c) { return c.preview.toLowerCase().indexOf(search) >= 0; });

      chunkList.innerHTML = '';
      chunkEmpty.classList.toggle('hidden', chunks.length > 0 || !selectedSourceId);
      var selectedSource = state.sources.find(function (s) { return s.id === selectedSourceId; });
      detailTitle.textContent = selectedSource ? '소스 상세 — ' + selectedSource.title : '소스 상세';

      chunks.forEach(function (chunk) {
        var pinned = state.pinnedChunks.indexOf(chunk.key) >= 0;
        var tags = state.chunkTags[chunk.key] || [];
        var chipHtml = PURPOSE_TAGS.map(function (tag) {
          return '<button class="chip ' + (tags.indexOf(tag) >= 0 ? 'on' : '') + '" data-tag-chunk="' + chunk.key + '" data-tag="' + tag + '">' + tag + '</button>';
        }).join('');
        var el = document.createElement('div');
        el.className = 'chunk-card grouped' + (highlightedChunkKey === chunk.key ? ' highlight' : '');
        el.setAttribute('id', 'chunk-' + safeId(chunk.key));
        el.innerHTML = '<p>' + escapeHtml(chunk.preview.slice(0, 180)) + '</p><div class="row"><button class="btn ' + (pinned ? 'primary' : '') + '" data-pin-chunk="' + chunk.key + '">' + (pinned ? '고정됨' : '고정') + '</button><div class="chips">' + chipHtml + '</div></div>';
        chunkList.appendChild(el);
      });

      if (highlightedChunkKey) {
        var target = document.getElementById('chunk-' + safeId(highlightedChunkKey));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    document.getElementById('source-add-btn').addEventListener('click', function () {
      var titleEl = document.getElementById('source-title');
      var contentEl = document.getElementById('source-content');
      var errorEl = document.getElementById('source-form-error');
      var title = titleEl.value.trim();
      var content = contentEl.value.trim();
      if (!title || !content) {
        errorEl.textContent = '제목과 내용은 필수입니다.';
        return;
      }
      errorEl.textContent = '';
      var source = { id: uid(), title: title, type: 'text', content: content, createdAt: Date.now() };
      state.sources.unshift(source);
      selectedSourceId = source.id;
      highlightedChunkKey = null;
      saveStore(state);
      titleEl.value = '';
      contentEl.value = '';
      drawSources();
      drawChunks();
    });

    document.getElementById('chunk-search').addEventListener('input', drawChunks);

    sourceList.addEventListener('click', function (e) {
      var openId = e.target.getAttribute('data-open-source');
      var delId = e.target.getAttribute('data-del-source');
      if (openId) {
        selectedSourceId = openId;
        highlightedChunkKey = null;
        drawChunks();
      }
      if (delId) {
        state.sources = state.sources.filter(function (s) { return s.id !== delId; });
        state.pinnedChunks = state.pinnedChunks.filter(function (key) { return parseSourceIdFromChunkKey(key) !== delId; });
        Object.keys(state.chunkTags).forEach(function (key) { if (parseSourceIdFromChunkKey(key) === delId) delete state.chunkTags[key]; });
        state.episodes.forEach(function (ep) {
          ep.linkedChunkKeys = (ep.linkedChunkKeys || []).filter(function (key) { return parseSourceIdFromChunkKey(key) !== delId; });
        });
        state.companies.forEach(function (c) {
          c.linkedSourceIds = (c.linkedSourceIds || []).filter(function (id) { return id !== delId; });
        });
        selectedSourceId = state.sources[0] ? state.sources[0].id : null;
        highlightedChunkKey = null;
        saveStore(state);
        drawSources();
        drawChunks();
      }
    });

    chunkList.addEventListener('click', function (e) {
      var chunkKey = e.target.getAttribute('data-pin-chunk');
      if (chunkKey) {
        var idx = state.pinnedChunks.indexOf(chunkKey);
        if (idx >= 0) state.pinnedChunks.splice(idx, 1); else state.pinnedChunks.push(chunkKey);
        saveStore(state);
        drawChunks();
      }
      var tagChunk = e.target.getAttribute('data-tag-chunk');
      var tag = e.target.getAttribute('data-tag');
      if (tagChunk && tag) {
        var list = state.chunkTags[tagChunk] || [];
        if (list.indexOf(tag) >= 0) list = list.filter(function (t) { return t !== tag; }); else list.push(tag);
        state.chunkTags[tagChunk] = list;
        saveStore(state);
        drawChunks();
      }
    });

    fromHash();
    window.addEventListener('hashchange', function () { fromHash(); drawChunks(); });
    drawSources();
    drawChunks();
  }

  function renderProfilePage() {
    var nameEl = document.getElementById('profile-name');
    var ruleTeiru = document.getElementById('rule-avoid-teiru');
    var ruleOmou = document.getElementById('rule-prefer-omou');
    var ruleKanji = document.getElementById('rule-avoid-kanji');
    var episodeList = document.getElementById('episode-list');
    var episodeEmpty = document.getElementById('episode-empty');
    var modal = document.getElementById('episode-modal');
    var editingId = null;

    nameEl.value = state.profile.name || '';
    ruleTeiru.checked = !!state.profile.writingRules.avoidTeiru;
    ruleOmou.checked = !!state.profile.writingRules.preferOmouOverKangaeru;
    ruleKanji.checked = !!state.profile.writingRules.avoidExcessiveKanjiCompounds;

    function persistProfile() {
      state.profile.name = nameEl.value.trim();
      state.profile.writingRules.avoidTeiru = ruleTeiru.checked;
      state.profile.writingRules.preferOmouOverKangaeru = ruleOmou.checked;
      state.profile.writingRules.avoidExcessiveKanjiCompounds = ruleKanji.checked;
      saveStore(state);
    }
    [nameEl, ruleTeiru, ruleOmou, ruleKanji].forEach(function (el) { el.addEventListener('change', persistProfile); });

    function selectedEpisodeChunkKeys() {
      var checks = document.querySelectorAll('[data-ep-link-chunk]');
      var keys = [];
      checks.forEach(function (c) { if (c.checked) keys.push(c.getAttribute('data-ep-link-chunk')); });
      return keys;
    }

    function getEpisodeForm() {
      return {
        title: val('ep-title'),
        period: val('ep-period'),
        context: val('ep-context'),
        role: val('ep-role'),
        goal: val('ep-goal'),
        problem: val('ep-problem'),
        actions: [val('ep-action1'), val('ep-action2'), val('ep-action3')].filter(Boolean),
        results: val('ep-results'),
        learning: val('ep-learning'),
        linkedChunkKeys: selectedEpisodeChunkKeys(),
      };
    }

    function fillEpisodeForm(ep) {
      setVal('ep-title', ep.title || '');
      setVal('ep-period', ep.period || '');
      setVal('ep-context', ep.context || '');
      setVal('ep-role', ep.role || '');
      setVal('ep-goal', ep.goal || '');
      setVal('ep-problem', ep.problem || '');
      setVal('ep-action1', (ep.actions && ep.actions[0]) || '');
      setVal('ep-action2', (ep.actions && ep.actions[1]) || '');
      setVal('ep-action3', (ep.actions && ep.actions[2]) || '');
      setVal('ep-results', ep.results || '');
      setVal('ep-learning', ep.learning || '');
      drawChunkPicker(ep.linkedChunkKeys || []);
    }

    function clearEpisodeForm() {
      fillEpisodeForm({});
      document.getElementById('episode-form-error').textContent = '';
    }

    function drawChunkPicker(selectedKeys) {
      var picker = document.getElementById('ep-chunk-picker');
      var search = (document.getElementById('ep-chunk-search').value || '').toLowerCase();
      var chunks = deriveChunks(state.sources).filter(function (c) { return c.preview.toLowerCase().indexOf(search) >= 0; });
      chunks.sort(function (a, b) {
        return (state.pinnedChunks.indexOf(b.key) >= 0 ? 1 : 0) - (state.pinnedChunks.indexOf(a.key) >= 0 ? 1 : 0);
      });
      picker.innerHTML = '';
      chunks.forEach(function (chunk) {
        var checked = selectedKeys.indexOf(chunk.key) >= 0;
        var row = document.createElement('label');
        row.className = 'row-between';
        row.innerHTML = '<span>' + (state.pinnedChunks.indexOf(chunk.key) >= 0 ? '📌 ' : '') + escapeHtml(chunk.preview.slice(0, 80)) + '</span>' + '<input type="checkbox" data-ep-link-chunk="' + chunk.key + '" ' + (checked ? 'checked' : '') + ' />';
        picker.appendChild(row);
      });
    }

    function drawEpisodes() {
      episodeList.innerHTML = '';
      episodeEmpty.classList.toggle('hidden', state.episodes.length > 0);
      state.episodes.forEach(function (ep) {
        var el = document.createElement('div');
        el.className = 'episode-card grouped';
        el.innerHTML = '<div class="row-between"><strong>' + escapeHtml(ep.title) + '</strong><div class="row"><button class="btn" data-ep-edit="' + ep.id + '">Edit</button><button class="btn" data-ep-del="' + ep.id + '">삭제</button></div></div><div class="muted">Linked evidence: ' + (ep.linkedChunkKeys || []).length + '</div>';
        episodeList.appendChild(el);
      });
    }

    document.getElementById('episode-add-btn').addEventListener('click', function () {
      editingId = null;
      document.getElementById('episode-modal-title').textContent = 'Add Episode';
      clearEpisodeForm();
      modal.classList.remove('hidden');
    });

    episodeList.addEventListener('click', function (e) {
      var editId = e.target.getAttribute('data-ep-edit');
      var delId = e.target.getAttribute('data-ep-del');
      if (editId) {
        var ep = state.episodes.find(function (x) { return x.id === editId; });
        if (!ep) return;
        editingId = editId;
        document.getElementById('episode-modal-title').textContent = 'Edit Episode';
        fillEpisodeForm(ep);
        modal.classList.remove('hidden');
      }
      if (delId) {
        state.episodes = state.episodes.filter(function (x) { return x.id !== delId; });
        saveStore(state);
        drawEpisodes();
      }
    });

    modal.addEventListener('click', function (e) {
      if (e.target.getAttribute('data-close-modal') === 'true') modal.classList.add('hidden');
    });

    document.getElementById('ep-chunk-search').addEventListener('input', function () {
      var base = editingId ? (state.episodes.find(function (x) { return x.id === editingId; }) || { linkedChunkKeys: [] }).linkedChunkKeys : selectedEpisodeChunkKeys();
      drawChunkPicker(base || []);
    });

    document.getElementById('episode-save-btn').addEventListener('click', function () {
      var errorEl = document.getElementById('episode-form-error');
      var ep = getEpisodeForm();
      if (!ep.title || !ep.period) {
        errorEl.textContent = '제목과 기간은 필수입니다.';
        return;
      }
      errorEl.textContent = '';
      if (editingId) {
        state.episodes = state.episodes.map(function (x) { return x.id === editingId ? Object.assign({ id: x.id }, ep) : x; });
      } else {
        state.episodes.unshift(Object.assign({ id: uid() }, ep));
      }
      saveStore(state);
      modal.classList.add('hidden');
      drawEpisodes();
    });

    drawEpisodes();
  }

  function renderCompanyPage() {
    var list = document.getElementById('company-list');
    var empty = document.getElementById('company-empty');
    var activeCompanyId = state.companies[0] ? state.companies[0].id : null;

    function activeCompany() { return state.companies.find(function (c) { return c.id === activeCompanyId; }) || null; }

    function drawCompanies() {
      list.innerHTML = '';
      empty.classList.toggle('hidden', state.companies.length > 0);
      state.companies.forEach(function (c) {
        var el = document.createElement('div');
        el.className = 'company-card';
        el.innerHTML = '<div class="row-between"><strong>' + escapeHtml(c.name) + '</strong><div class="row"><button class="btn" data-company-open="' + c.id + '">열기</button><button class="btn" data-company-del="' + c.id + '">삭제</button></div></div><div class="muted">' + escapeHtml(c.role || '-') + '</div>';
        list.appendChild(el);
      });
    }

    function drawDetail() {
      var detailTitle = document.getElementById('company-detail-title');
      var phraseList = document.getElementById('company-phrase-list');
      var sourceLinks = document.getElementById('company-source-links');
      var questionList = document.getElementById('company-question-list');
      var company = activeCompany();
      if (!company) {
        detailTitle.textContent = '기업 상세';
        phraseList.innerHTML = '';
        sourceLinks.innerHTML = '<div class="empty-state">기업을 먼저 선택하세요.</div>';
        questionList.innerHTML = '';
        return;
      }
      detailTitle.textContent = '기업 상세 — ' + company.name;

      phraseList.innerHTML = '';
      (company.keyPhrases || []).forEach(function (phrase, idx) {
        var chip = document.createElement('button');
        chip.className = 'chip on';
        chip.textContent = phrase + ' ×';
        chip.setAttribute('data-phrase-del', String(idx));
        phraseList.appendChild(chip);
      });

      sourceLinks.innerHTML = '';
      if (state.sources.length === 0) {
        sourceLinks.innerHTML = '<div class="empty-state">연결할 소스가 없습니다.</div>';
      } else {
        state.sources.forEach(function (s) {
          var linked = (company.linkedSourceIds || []).indexOf(s.id) >= 0;
          var row = document.createElement('label');
          row.className = 'row-between';
          row.innerHTML = '<span>' + escapeHtml(s.title) + '</span><input type="checkbox" data-link-source="' + s.id + '" ' + (linked ? 'checked' : '') + ' />';
          sourceLinks.appendChild(row);
        });
      }

      questionList.innerHTML = '';
      if ((company.questionSet || []).length === 0) {
        questionList.innerHTML = '<div class="empty-state">질문이 없습니다.</div>';
      } else {
        company.questionSet.forEach(function (q) {
          var opts = QUESTION_TYPES.map(function (type) {
            return '<option value="' + type + '" ' + (q.questionType === type ? 'selected' : '') + '>' + type + '</option>';
          }).join('');
          var row = document.createElement('div');
          row.className = 'row';
          row.innerHTML = '<select class="input" data-q-type="' + q.id + '">' + opts + '</select><input class="input" type="number" min="100" max="1200" value="' + q.charLimit + '" data-q-limit="' + q.id + '" /><button class="btn" data-q-del="' + q.id + '">삭제</button>';
          questionList.appendChild(row);
        });
      }
    }

    document.getElementById('company-add-btn').addEventListener('click', function () {
      var name = val('company-name');
      var role = val('company-role');
      var err = document.getElementById('company-form-error');
      if (!name) {
        err.textContent = '기업명은 필수입니다.';
        return;
      }
      err.textContent = '';
      var company = { id: uid(), name: name, role: role, linkedSourceIds: [], keyPhrases: [], questionSet: [] };
      state.companies.unshift(company);
      activeCompanyId = company.id;
      setVal('company-name', '');
      setVal('company-role', '');
      saveStore(state);
      drawCompanies();
      drawDetail();
    });

    list.addEventListener('click', function (e) {
      var open = e.target.getAttribute('data-company-open');
      var del = e.target.getAttribute('data-company-del');
      if (open) { activeCompanyId = open; drawDetail(); }
      if (del) {
        state.companies = state.companies.filter(function (c) { return c.id !== del; });
        activeCompanyId = state.companies[0] ? state.companies[0].id : null;
        saveStore(state);
        drawCompanies();
        drawDetail();
      }
    });

    document.getElementById('company-phrase-add').addEventListener('click', function () {
      var input = document.getElementById('company-phrase-input');
      var company = activeCompany();
      if (!company || !input.value.trim()) return;
      company.keyPhrases = company.keyPhrases || [];
      company.keyPhrases.push(input.value.trim());
      input.value = '';
      saveStore(state);
      drawDetail();
    });

    document.getElementById('company-detail-section').addEventListener('click', function (e) {
      var company = activeCompany();
      if (!company) return;
      var pidx = e.target.getAttribute('data-phrase-del');
      if (pidx !== null) {
        company.keyPhrases.splice(Number(pidx), 1);
        saveStore(state);
        drawDetail();
      }
      var qdel = e.target.getAttribute('data-q-del');
      if (qdel) {
        company.questionSet = company.questionSet.filter(function (q) { return q.id !== qdel; });
        saveStore(state);
        drawDetail();
      }
    });

    document.getElementById('company-detail-section').addEventListener('change', function (e) {
      var company = activeCompany();
      if (!company) return;
      var sourceId = e.target.getAttribute('data-link-source');
      if (sourceId) {
        var on = e.target.checked;
        if (on && company.linkedSourceIds.indexOf(sourceId) < 0) company.linkedSourceIds.push(sourceId);
        if (!on) company.linkedSourceIds = company.linkedSourceIds.filter(function (id) { return id !== sourceId; });
      }
      var qTypeId = e.target.getAttribute('data-q-type');
      if (qTypeId) company.questionSet = company.questionSet.map(function (q) { return q.id === qTypeId ? Object.assign({}, q, { questionType: e.target.value }) : q; });
      var qLimitId = e.target.getAttribute('data-q-limit');
      if (qLimitId) {
        var limit = Number(e.target.value || 400);
        company.questionSet = company.questionSet.map(function (q) { return q.id === qLimitId ? Object.assign({}, q, { charLimit: limit }) : q; });
      }
      saveStore(state);
      drawDetail();
    });

    document.getElementById('company-question-add').addEventListener('click', function () {
      var company = activeCompany();
      if (!company) return;
      company.questionSet.push({ id: uid(), questionType: 'gakuchika', charLimit: 400 });
      saveStore(state);
      drawDetail();
    });

    drawCompanies();
    drawDetail();
  }

  function renderDraftsPage() {
    var wizard = {
      step: 1,
      questionType: 'gakuchika',
      charLimit: 400,
      episodeIds: [],
      chunkKeys: [],
      companyId: '',
    };
    var currentDraftId = state.drafts[0] ? state.drafts[0].id : '';

    var qSelect = document.getElementById('draft-question-type');
    var charInput = document.getElementById('draft-char-limit');
    var companySelect = document.getElementById('draft-company-select');

    function syncWizardUI() {
      document.querySelectorAll('.wizard-step').forEach(function (node) {
        node.classList.toggle('hidden', node.id !== 'wizard-step-' + wizard.step);
      });
      document.querySelectorAll('.step').forEach(function (node) {
        node.classList.toggle('active', Number(node.getAttribute('data-step')) === wizard.step);
      });
      document.getElementById('draft-prev-step').disabled = wizard.step === 1;
      document.getElementById('draft-next-step').classList.toggle('hidden', wizard.step === 4);
    }

    function refreshCompanyOptions() {
      companySelect.innerHTML = '<option value="">(선택 안 함)</option>';
      state.companies.forEach(function (c) {
        var opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        companySelect.appendChild(opt);
      });
      companySelect.value = wizard.companyId;
    }

    function drawEpisodePicker() {
      var el = document.getElementById('draft-episode-picker');
      el.innerHTML = '';
      if (state.episodes.length === 0) {
        el.innerHTML = '<div class="muted">선택 가능한 에피소드가 없습니다. 프로필에서 에피소드를 추가하세요.</div>';
        return;
      }
      state.episodes.forEach(function (ep) {
        var checked = wizard.episodeIds.indexOf(ep.id) >= 0;
        var row = document.createElement('label');
        row.className = 'row-between';
        row.innerHTML = '<span>' + escapeHtml(ep.title) + '</span><input type="checkbox" data-draft-ep="' + ep.id + '" ' + (checked ? 'checked' : '') + ' />';
        el.appendChild(row);
      });
    }

    function drawChunkPicker() {
      var el = document.getElementById('draft-chunk-picker');
      var search = (document.getElementById('draft-chunk-search').value || '').toLowerCase();
      var chunks = deriveChunks(state.sources).filter(function (c) { return c.preview.toLowerCase().indexOf(search) >= 0; });
      chunks.sort(function (a, b) {
        return (state.pinnedChunks.indexOf(b.key) >= 0 ? 1 : 0) - (state.pinnedChunks.indexOf(a.key) >= 0 ? 1 : 0);
      });
      el.innerHTML = '';
      if (chunks.length === 0) {
        el.innerHTML = '<div class="muted">선택 가능한 청크가 없습니다. 먼저 소스를 추가하세요.</div>';
        return;
      }
      chunks.forEach(function (chunk) {
        var checked = wizard.chunkKeys.indexOf(chunk.key) >= 0;
        var row = document.createElement('label');
        row.className = 'row-between';
        row.innerHTML = '<span>' + (state.pinnedChunks.indexOf(chunk.key) >= 0 ? '📌 ' : '') + escapeHtml(chunk.preview.slice(0, 90)) + '</span><input type="checkbox" data-draft-chunk="' + chunk.key + '" ' + (checked ? 'checked' : '') + ' />';
        el.appendChild(row);
      });
    }

    function strictPreviewText(draft) {
      if (!draft || !draft.response) return '';
      var allowed = (draft.response.claims || []).filter(function (c) { return c.export_allowed; });
      return allowed.map(function (c) { return c.text; }).join('');
    }

    function drawDraftHistoryOptions() {
      var select = document.getElementById('draft-history-select');
      select.innerHTML = '';
      if (state.drafts.length === 0) {
        select.innerHTML = '<option value="">초안이 없습니다</option>';
        return;
      }
      state.drafts.forEach(function (d) {
        var opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = new Date(d.createdAt).toLocaleString() + ' / ' + d.request.question_type;
        select.appendChild(opt);
      });
      if (!currentDraftId) currentDraftId = state.drafts[0].id;
      select.value = currentDraftId;
    }

    function suggestionForFinding(f) {
      var code = (f.code || '').toUpperCase();
      if (code === 'MISSING_EVIDENCE') return '소스에서 근거 청크를 추가/고정한 뒤 다시 생성하세요.';
      if (code === 'BANNED_PHRASE') return '구체적 사실과 측정 가능한 맥락으로 다시 작성하세요.';
      if (code === 'MISSING_QUANT') return '숫자, 기간, 빈도, 비교 표현을 추가하세요.';
      if (code === 'PASSIVE_STANCE') return '주도적 행동과 책임이 드러나게 다시 표현하세요.';
      if (code === 'ABSTRACT_SUFFIX') return '추상 표현 대신 구체적 행동/성과로 바꾸세요.';
      return '관련 주장을 검토하고 근거 기반 표현으로 다듬으세요.';
    }

    function drawReview() {
      drawDraftHistoryOptions();
      var draft = state.drafts.find(function (d) { return d.id === currentDraftId; }) || null;
      var preview = strictPreviewText(draft);
      document.getElementById('draft-preview').textContent = preview || '아직 초안이 없습니다.';
      document.getElementById('draft-char-count').textContent = String(preview.length) + ' 자';

      var claimsEl = document.getElementById('draft-claims');
      claimsEl.innerHTML = '';
      if (!draft) {
        claimsEl.innerHTML = '<div class="empty-state">검토할 초안을 먼저 생성하세요.</div>';
      } else {
        (draft.response.claims || []).forEach(function (claim, idx) {
          var badge = claim.export_allowed ? '<span class="badge exportable">✅ Exportable</span>' : '<span class="badge needs-evidence">⚠️ Needs Evidence</span>';
          var evidence = (claim.evidence || []).map(function (e) {
            return '<li><a href="/sources#chunk=' + encodeURIComponent(e.chunk_id) + '">청크로 이동</a> — ' + escapeHtml(e.quote || '') + '</li>';
          }).join('') || '<li class="muted">근거 참조가 없습니다.</li>';
          var el = document.createElement('details');
          el.className = 'claim-card card';
          el.innerHTML = '<summary class="row-between"><span><strong>주장 ' + (idx + 1) + '</strong> ' + escapeHtml(claim.text) + '</span>' + badge + '</summary><ul>' + evidence + '</ul>';
          claimsEl.appendChild(el);
        });
      }

      var qaPanel = document.getElementById('draft-qa-panel');
      qaPanel.innerHTML = '';
      if (!draft) {
        qaPanel.innerHTML = '<div class="empty-state">생성 후 QA 결과가 표시됩니다.</div>';
      } else {
        var groups = { blocker: [], warn: [], info: [] };
        (draft.response.qa_findings || []).forEach(function (f) {
          var lvl = f.level || 'info';
          if (!groups[lvl]) groups[lvl] = [];
          groups[lvl].push(f);
        });
        ['blocker', 'warn', 'info'].forEach(function (lvl) {
          var findings = groups[lvl] || [];
          if (!findings.length) return;
          var wrap = document.createElement('div');
          wrap.className = 'qa-group';
          var items = findings.map(function (f) {
            var suggestion = suggestionForFinding(f);
            return '<li><strong>' + escapeHtml(f.code) + ':</strong> ' + escapeHtml(f.message || '') + (f.claim_id ? ' <span class="muted">(claim ' + escapeHtml(f.claim_id) + ')</span>' : '') + '<div class="muted">제안: ' + escapeHtml(suggestion) + '</div></li>';
          }).join('');
          wrap.innerHTML = '<div class="qa-title">' + ({blocker:'차단',warn:'경고',info:'정보'}[lvl] || lvl) + '</div><ul>' + items + '</ul>';
          qaPanel.appendChild(wrap);
        });
      }
    }

    function currentCompanyContext() {
      var company = state.companies.find(function (c) { return c.id === wizard.companyId; });
      if (!company) return {};
      return {
        company_name: company.name,
        role: company.role,
        key_phrases: company.keyPhrases || [],
        question_set: company.questionSet || [],
      };
    }

    function selectedEpisodes() {
      return state.episodes.filter(function (ep) { return wizard.episodeIds.indexOf(ep.id) >= 0; });
    }

    function selectedChunksForApi() {
      var chunks = deriveChunks(state.sources).filter(function (c) { return wizard.chunkKeys.indexOf(c.key) >= 0; });
      return chunks.map(function (c) {
        return {
          chunk_id: c.key,
          text: c.preview,
          source_title: c.sourceTitle,
          loc_hint: 'note',
          page_start: 0,
          page_end: 0,
          pinned: state.pinnedChunks.indexOf(c.key) >= 0,
        };
      });
    }

    function showError(targetId, msg) {
      var el = document.getElementById(targetId);
      if (el) el.textContent = msg;
      toast(msg);
    }

    async function generateDraft() {
      document.getElementById('draft-generate-error').textContent = '';
      if (wizard.chunkKeys.length === 0) {
        showError('draft-generate-error', '근거 청크를 최소 1개 선택하세요.');
        return;
      }
      var payload = {
        selected_chunks: selectedChunksForApi(),
        selected_episodes: selectedEpisodes(),
        company_context: currentCompanyContext(),
        question_type: wizard.questionType,
        char_limit: wizard.charLimit,
        writing_rules: state.profile.writingRules,
      };

      try {
        var res = await fetch('/v1/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          var errBody = await safeJson(res);
          showError('draft-generate-error', (errBody.detail || '생성에 실패했습니다') + ' (status ' + res.status + ')');
          return;
        }
        var data = await res.json();
        var draft = { id: uid(), createdAt: Date.now(), request: payload, response: data };
        state.drafts.unshift(draft);
        currentDraftId = draft.id;
        saveStore(state);
        drawReview();
        toast('초안이 생성되었습니다.');
      } catch (e) {
        showError('draft-generate-error', '백엔드에 연결할 수 없습니다. 다시 시도하세요.');
        toast('초안 생성 중 백엔드 연결에 실패했습니다.', { onRetry: generateDraft });
      }
    }

    async function runExport() {
      var draft = state.drafts.find(function (d) { return d.id === currentDraftId; });
      if (!draft) {
        showError('export-error', '먼저 초안을 생성하세요.');
        return;
      }
      var mode = document.getElementById('export-mode').value;
      var compression = Number(document.getElementById('export-compression').value || 1);
      var claims = draft.response.claims || [];
      if (mode === 'strict') {
        claims = claims.filter(function (c) { return c.export_allowed; });
      }
      var payload = { claims: claims, char_limit: wizard.charLimit, compression_level: compression };
      try {
        var res = await fetch('/v1/export', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (!res.ok) {
          var errBody = await safeJson(res);
          showError('export-error', (errBody.detail || '내보내기에 실패했습니다') + ' (status ' + res.status + ')');
          return;
        }
        var data = await res.json();
        document.getElementById('export-result').value = data.text || '';
        document.getElementById('export-error').textContent = '';
      } catch (e) {
        showError('export-error', '내보내기 중 백엔드에 연결할 수 없습니다. 다시 시도하세요.');
        toast('내보내기 중 백엔드 연결에 실패했습니다.', { onRetry: runExport });
      }
    }

    qSelect.addEventListener('change', function () { wizard.questionType = qSelect.value; });
    charInput.addEventListener('input', function () { wizard.charLimit = Number(charInput.value || 400); });
    companySelect.addEventListener('change', function () { wizard.companyId = companySelect.value; });
    document.querySelectorAll('[data-char-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var v = Number(btn.getAttribute('data-char-preset'));
        charInput.value = String(v);
        wizard.charLimit = v;
      });
    });

    document.getElementById('draft-next-step').addEventListener('click', function () {
      if (wizard.step < 4) wizard.step += 1;
      syncWizardUI();
    });
    document.getElementById('draft-prev-step').addEventListener('click', function () {
      if (wizard.step > 1) wizard.step -= 1;
      syncWizardUI();
    });

    document.getElementById('draft-episode-picker').addEventListener('change', function (e) {
      var id = e.target.getAttribute('data-draft-ep');
      if (!id) return;
      if (e.target.checked && wizard.episodeIds.indexOf(id) < 0) wizard.episodeIds.push(id);
      if (!e.target.checked) wizard.episodeIds = wizard.episodeIds.filter(function (x) { return x !== id; });
    });

    document.getElementById('draft-chunk-search').addEventListener('input', drawChunkPicker);
    document.getElementById('draft-chunk-picker').addEventListener('change', function (e) {
      var key = e.target.getAttribute('data-draft-chunk');
      if (!key) return;
      if (e.target.checked && wizard.chunkKeys.indexOf(key) < 0) wizard.chunkKeys.push(key);
      if (!e.target.checked) wizard.chunkKeys = wizard.chunkKeys.filter(function (x) { return x !== key; });
    });

    document.getElementById('draft-generate-btn').addEventListener('click', generateDraft);
    document.getElementById('draft-history-select').addEventListener('change', function (e) {
      currentDraftId = e.target.value;
      drawReview();
    });

    document.getElementById('draft-open-export').addEventListener('click', function () {
      document.getElementById('export-modal').classList.remove('hidden');
      document.getElementById('export-error').textContent = '';
    });
    document.getElementById('export-modal').addEventListener('click', function (e) {
      if (e.target.getAttribute('data-close-export') === 'true') {
        document.getElementById('export-modal').classList.add('hidden');
      }
    });
    document.getElementById('export-run-btn').addEventListener('click', runExport);
    document.getElementById('export-copy-btn').addEventListener('click', function () {
      var area = document.getElementById('export-result');
      area.select();
      try {
        document.execCommand('copy');
        toast('내보내기 텍스트를 복사했습니다.');
      } catch (e) {
        toast('복사에 실패했습니다. 직접 텍스트를 선택해 복사하세요.');
      }
    });

    refreshCompanyOptions();
    drawEpisodePicker();
    drawChunkPicker();
    drawReview();
    syncWizardUI();
  }

  function toast(message, options) {
    var wrap = document.querySelector('.toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    var node = document.createElement('div');
    node.className = 'toast';
    var text = document.createElement('div');
    text.textContent = message;
    node.appendChild(text);
    if (options && typeof options.onRetry === 'function') {
      var retry = document.createElement('button');
      retry.className = 'btn';
      retry.textContent = '재시도';
      retry.style.marginTop = '8px';
      retry.addEventListener('click', function () { options.onRetry(); });
      node.appendChild(retry);
    }
    wrap.appendChild(node);
    setTimeout(function () { node.remove(); }, 4500);
  }

  function safeId(value) { return String(value).replace(/[^a-zA-Z0-9_-]/g, '_'); }
  function val(id) { return (document.getElementById(id).value || '').trim(); }
  function setVal(id, value) { document.getElementById(id).value = value; }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }
  async function safeJson(res) {
    try { return await res.json(); } catch (e) { return {}; }
  }

  if (PAGE === 'sources') renderSourcesPage();
  if (PAGE === 'profile') renderProfilePage();
  if (PAGE === 'company') renderCompanyPage();
  if (PAGE === 'drafts') renderDraftsPage();
})();
