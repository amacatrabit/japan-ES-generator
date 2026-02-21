(function () {
  var KEY = 'es-writer-ui-store-v2';

  function defaultState() {
    return {
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
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      return Object.assign(defaultState(), parsed, {
        profile: Object.assign(defaultState().profile, parsed.profile || {}),
      });
    } catch (e) {
      return defaultState();
    }
  }

  function save(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  window.esStore = { key: KEY, load: load, save: save, defaultState: defaultState };
})();
