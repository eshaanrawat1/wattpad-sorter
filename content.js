(function (root) {
  'use strict';

  var READS_REGEX = /^\s*Reads\s+([\d,]+)/i;
  var STATE = {
    nextIndex: 0,
    sortDir: 'desc',
    sortActive: false,
    listContainer: null,
    cardObserver: null,
    isSorting: false,
    pollTimer: null,
  };

  var CYCLE = { neutral: 'desc', desc: 'asc', asc: 'neutral' };
  var ICONS = {
    neutral: '<i class="ti ti-arrows-sort" aria-hidden="true"></i>',
    desc:    '<i class="ti ti-sort-descending" aria-hidden="true"></i>',
    asc:     '<i class="ti ti-sort-ascending" aria-hidden="true"></i>',
  };

  var lastViewState = 'neutral';

  // Parsing

  function parseReadCount(text) {
    var match = text && String(text).match(READS_REGEX);
    if (!match) return null;
    var n = parseInt(match[1].replace(/,/g, ''), 10);
    return Number.isNaN(n) ? null : n;
  }

  function findReadSpans(rootNode) {
    if (!rootNode || !rootNode.querySelectorAll) return [];
    return Array.from(rootNode.querySelectorAll('span.sr-only'))
      .filter(function (s) { return parseReadCount(s.textContent) !== null; });
  }

  // DOM helpers

  function getCard(span) {
    return span.closest('li.FVPgf') || span.closest('li') || span.parentElement;
  }

  function getContainer(card) {
    return card && (card.closest('ul.t9bBC') || card.parentElement);
  }

  // Indexing

  function indexCards(spans) {
    spans.forEach(function (span) {
      var count = parseReadCount(span.textContent);
      if (count === null) return;
      var card = getCard(span);
      if (!card) return;
      if (!card.dataset.wrReads) card.dataset.wrReads = count;
      if (!card.dataset.wrIndex) card.dataset.wrIndex = STATE.nextIndex++;
      var container = getContainer(card);
      if (container && (!STATE.listContainer || !STATE.listContainer.contains(card))) {
        STATE.listContainer = container;
      }
    });
  }

  // Sorting

  function applySort() {
    if (!STATE.listContainer || STATE.isSorting) return;
    var cards = Array.from(STATE.listContainer.querySelectorAll('[data-wr-reads]'));
    if (!cards.length) return;
    STATE.isSorting = true;
    if (STATE.cardObserver) STATE.cardObserver.disconnect();
    var dir = STATE.sortDir === 'asc' ? 1 : -1;
    cards.sort(function (a, b) {
      var diff = (Number(a.dataset.wrReads) - Number(b.dataset.wrReads)) * dir;
      return diff !== 0 ? diff : Number(a.dataset.wrIndex) - Number(b.dataset.wrIndex);
    });
    cards.forEach(function (c) { STATE.listContainer.appendChild(c); });
    if (STATE.cardObserver) {
      STATE.cardObserver.observe(root.document.body, { childList: true, subtree: true });
    }
    STATE.isSorting = false;
  }

  function restoreOrder() {
    if (!STATE.listContainer) return;
    Array.from(STATE.listContainer.querySelectorAll('[data-wr-reads]'))
      .sort(function (a, b) { return Number(a.dataset.wrIndex) - Number(b.dataset.wrIndex); })
      .forEach(function (c) { STATE.listContainer.appendChild(c); });
  }

  function scanAndSort(rootNode) {
    var spans = findReadSpans(rootNode);
    if (!spans.length) return;
    indexCards(spans);
    if (STATE.sortActive) applySort();
  }

  // Styles

  function ensureStyles(doc) {
    if (doc.getElementById('wr-sort-styles')) return;

    var link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css';
    doc.head.appendChild(link);

    var style = doc.createElement('style');
    style.id = 'wr-sort-styles';
    style.textContent =
      '.wr-views-toggle{' +
        'display:inline-flex;align-items:center;justify-content:center;' +
        'min-width:26px;height:26px;padding:0;' +
        'border:1.5px solid #ff6122;background:rgba(255,97,34,.08);' +
        'color:#ff6122;border-radius:999px;' +
        'cursor:pointer;vertical-align:middle;margin-left:6px;' +
      '}' +
      '.wr-views-toggle:hover{background:rgba(255,97,34,.16);}' +
      '.wr-views-toggle:active{transform:translateY(1px);}' +
      '.wr-views-toggle i{font-size:14px;line-height:1;pointer-events:none;}';
    doc.head.appendChild(style);
  }

  // Toggle button

  function makeToggleBtn(doc) {
    var btn = doc.createElement('button');
    btn.id = 'wr-views-toggle';
    btn.className = 'wr-views-toggle';
    btn.type = 'button';
    btn.title = 'Sort by views';
    btn.dataset.wrViewState = lastViewState;
    btn.innerHTML = ICONS[lastViewState];

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      lastViewState = CYCLE[lastViewState];
      btn.dataset.wrViewState = lastViewState;
      btn.innerHTML = ICONS[lastViewState];
      btn.title = lastViewState === 'neutral' ? 'Sort by views' : 'Sort by views: ' + lastViewState;
      STATE.sortActive = lastViewState !== 'neutral';
      STATE.sortDir = lastViewState === 'asc' ? 'asc' : 'desc';
      scanAndSort(root.document);
      if (STATE.sortActive) applySort(); else restoreOrder();
    });

    return btn;
  }

  function ensureToggle(doc) {
    if (!doc) return;
    var sortBar = doc.querySelector("[data-testid='sort-by-dropdown']");
    if (!sortBar) return;
    var sortRow = sortBar.parentElement;
    if (!sortRow) return;

    var wrapper = doc.getElementById('wr-sort-wrapper');
    if (wrapper && wrapper.contains(sortBar) && wrapper.contains(doc.getElementById('wr-views-toggle'))) return;

    ensureStyles(doc);

    if (wrapper && wrapper.parentElement) {
      while (wrapper.firstChild) wrapper.parentElement.insertBefore(wrapper.firstChild, wrapper);
      wrapper.parentElement.removeChild(wrapper);
    }

    wrapper = doc.createElement('div');
    wrapper.id = 'wr-sort-wrapper';
    wrapper.style.cssText = 'display:inline-flex;align-items:center;';
    sortRow.insertBefore(wrapper, sortBar);
    wrapper.appendChild(sortBar);
    wrapper.appendChild(makeToggleBtn(doc));
  }

  // Poll + observer

  function startPoll(doc) {
    if (STATE.pollTimer) return;
    STATE.pollTimer = setInterval(function () {
      ensureToggle(doc);
    }, 200);
  }

  function observeCards(doc) {
    if (STATE.cardObserver) return;
    STATE.cardObserver = new MutationObserver(function (mutations) {
      if (STATE.isSorting) return;
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node && node.querySelectorAll) scanAndSort(node);
        });
      });
    });
    STATE.cardObserver.observe(doc.body, { childList: true, subtree: true });
  }

  // Init

  var api = { parseReadCount: parseReadCount, findReadSpans: findReadSpans };
  if (typeof module !== 'undefined') module.exports = api;

  if (root && root.document && !root.__wattpadViewsSorterLoaded) {
    root.__wattpadViewsSorterLoaded = true;
    observeCards(root.document);
    scanAndSort(root.document);
    ensureToggle(root.document);
    startPoll(root.document);
  }

})(typeof window !== 'undefined' ? window : null);