/*
 * Shareable page state — mirrors the diagram controls into the URL query string
 * so any key/scale/mode/progression view can be bookmarked or sent to someone.
 * Only values that differ from the page defaults are written, keeping links short.
 */
const PageState = (() => {
  'use strict';

  let controls = {};
  const defaults = {};

  function valueOf(element) {
    return element.type === 'checkbox' ? String(element.checked) : element.value;
  }

  function accepts(element, raw) {
    if (element.tagName === 'SELECT') return [...element.options].some(option => option.value === raw);
    if (element.type === 'range' || element.type === 'number') {
      const value = Number(raw);
      return raw !== '' && Number.isFinite(value) && value >= Number(element.min || -Infinity) && value <= Number(element.max || Infinity);
    }
    if (element.type === 'checkbox') return raw === 'true' || raw === 'false';
    return typeof raw === 'string' && raw.length <= 40;
  }

  function apply(element, raw) {
    if (element.type === 'checkbox') element.checked = raw === 'true';
    else element.value = raw;
  }

  /* Capture defaults and restore any valid values from the current URL. */
  function bind(map) {
    controls = map;
    const params = new URLSearchParams(location.search);
    for (const [param, element] of Object.entries(controls)) {
      if (!element) continue;
      defaults[param] = valueOf(element);
      const raw = params.get(param);
      if (raw !== null && accepts(element, raw)) apply(element, raw);
    }
  }

  /* Write the current selection back into the URL without adding history entries. */
  function sync() {
    const params = new URLSearchParams(location.search);
    for (const [param, element] of Object.entries(controls)) {
      if (!element) continue;
      const value = valueOf(element);
      if (value === defaults[param]) params.delete(param);
      else params.set(param, value);
    }
    const query = params.toString();
    const url = `${location.pathname}${query ? `?${query}` : ''}${location.hash}`;
    if (url !== `${location.pathname}${location.search}${location.hash}`) history.replaceState(null, '', url);
  }

  async function copyLink(status) {
    const href = location.href;
    try {
      await navigator.clipboard.writeText(href);
      status.textContent = 'Link copied — paste it anywhere.';
    } catch {
      status.textContent = `Copy this link: ${href}`;
    }
    status.classList.add('visible');
    setTimeout(() => status.classList.remove('visible'), 4000);
  }

  function wireShare() {
    const button = document.getElementById('share-link');
    const status = document.getElementById('share-status');
    if (!button || !status) return;
    button.addEventListener('click', () => copyLink(status));
  }

  return { bind, sync, wireShare };
})();
