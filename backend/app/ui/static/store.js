(function () {
  var STORAGE_KEY = 'es-writer-ui-store';
  var SCHEMA_VERSION = 3;

  // v3 schema
  // {
  //   schemaVersion: number,
  //   profile: { name: string, writing_rules: string(JSON) },
  //   sources: [{id,title,type,content,createdAt}],
  //   pins: { "<sourceId>:<chunkIndex>": true },
  //   chunkPurposeTags: { "<sourceId>:<chunkIndex>": [tag,...] },
  //   episodes: [{..., linkedChunkKeys: []}],
  //   companies: [{..., questionSet: [{type,label,charLimit}], ...}],
  //   drafts: [{id, createdAt, questionType, charLimit, companyId, episodeIds, selectedChunkKeys, response}]
  // }
  function defaultState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      profile: {
        name: '',
        writing_rules: JSON.stringify({
          avoid_teiru: true,
          prefer_omou_over_kangaeru: true,
          avoid_excessive_kanji_compounds: true,
        }),
      },
      sources: [],
      pins: {},
      chunkPurposeTags: {},
      episodes: [],
      companies: [],
      drafts: [],
    };
  }

  function normalizeArray(v) { return Array.isArray(v) ? v : []; }
  function normalizeObject(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }

  function migrate(parsed) {
    var base = defaultState();
    var input = normalizeObject(parsed);
    var out = Object.assign({}, base, input);

    out.profile = Object.assign({}, base.profile, normalizeObject(input.profile));
    out.sources = normalizeArray(input.sources);
    out.pins = normalizeObject(input.pins);
    out.chunkPurposeTags = normalizeObject(input.chunkPurposeTags);
    out.episodes = normalizeArray(input.episodes).map(function (ep) {
      var v = normalizeObject(ep);
      v.linkedChunkKeys = normalizeArray(v.linkedChunkKeys);
      v.actions = normalizeArray(v.actions);
      return v;
    });
    out.companies = normalizeArray(input.companies).map(function (co) {
      var v = normalizeObject(co);
      v.linkedSourceIds = normalizeArray(v.linkedSourceIds);
      v.keyPhrases = normalizeArray(v.keyPhrases);
      v.questionSet = normalizeArray(v.questionSet);
      return v;
    });
    out.drafts = normalizeArray(input.drafts);
    out.schemaVersion = SCHEMA_VERSION;
    return out;
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        // backfill legacy key used in older builds
        raw = localStorage.getItem('es-writer-ui-store-v2');
      }
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      return migrate(parsed);
    } catch (e) {
      return defaultState();
    }
  }

  function save(state) {
    var migrated = migrate(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
  }

  window.esStore = {
    key: STORAGE_KEY,
    schemaVersion: SCHEMA_VERSION,
    load: load,
    save: save,
    defaultState: defaultState,
  };
})();
