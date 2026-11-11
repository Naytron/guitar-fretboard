(function () {
  'use strict';

  const desktop = matchMedia('(min-width: 601px)');
  const sync = () => {
    document.querySelectorAll('[data-responsive-details]').forEach((panel) => {
      panel.open = desktop.matches;
    });
  };
  sync();
  desktop.addEventListener('change', sync);
})();
