(() => {
  'use strict';

  const requestedTheme = new URLSearchParams(window.location.search).get('scoutTheme');
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const theme = requestedTheme === 'dark' || requestedTheme === 'light'
    ? requestedTheme
    : systemTheme;

  document.documentElement.setAttribute('data-theme', theme);
})();
