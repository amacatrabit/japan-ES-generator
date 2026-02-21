(function () {
  var KEY = 'es-writer-ui-store-v1';

  function load(fallback) {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function save(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  window.esStore = {
    key: KEY,
    load: load,
    save: save,
  };
})();
