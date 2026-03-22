(function (root) {
  'use strict';

  var READS_REGEX = /^\s*Reads\s+([\d,]+)/i;
  var STATE = {
    nextIndex: 0,
    sortDir: 'desc',
    sortActive: false,
    listContainer: null,
    observer: null,
    menuObserver: null,
    dropdownObserver: null,
    isSorting: false,
    pendingScan: null,
    toggleBootTimer: null
  };

  function parseReadCount(text) {
    if (!text) return null;
    var match = String(text).match(READS_REGEX);
    if (!match) return null;
    var numeric = match[1].replace(/,/g, '');
    var value = parseInt(numeric, 10);
    return Number.isNaN(value) ? null : value;
  }

  function findReadSpans(rootNode) {
    var scope = rootNode || (root && root.document) || null;
    if (!scope || !scope.querySelectorAll) return [];
    var spans = Array.prototype.slice.call(
      scope.querySelectorAll('span.sr-only')
    );
    return spans.filter(function (span) {
      return parseReadCount(span.textContent) !== null;
    });
  }

  function getCardElement(readSpan) {
    if (!readSpan || !readSpan.closest) return null;
    return (
      readSpan.closest('li.FVPgf') ||
      readSpan.closest(
        "[data-qa='story-card'], article, .story-card, .card"
      ) ||
      readSpan.closest('li') ||
      readSpan.parentElement
    );
  }

  function getListContainer(card) {
    if (!card || !card.closest) return null;
    return (
      card.closest('ul.t9bBC') ||
      card.closest("[data-qa='story-list'], ul, ol, [role='list']") ||
      card.parentElement ||
      null
    );
  }

  function indexCardsFromSpans(readSpans) {
    readSpans.forEach(function (span) {
      var count = parseReadCount(span.textContent);
      if (count === null) return;
      var card = getCardElement(span);
      if (!card) return;
      if (!card.dataset.wrReads) {
        card.dataset.wrReads = String(count);
      }
      if (!card.dataset.wrIndex) {
        card.dataset.wrIndex = String(STATE.nextIndex++);
      }
      var container = getListContainer(card);
      if (!STATE.listContainer || (container && !STATE.listContainer.contains(card))) {
        STATE.listContainer = container;
      }
    });
  }

  function sortCards(cards, direction) {
    if (!cards || !cards.length) return [];
    var dir = direction === 'asc' ? 1 : -1;
    return cards.sort(function (a, b) {
      var ra = Number(a.dataset.wrReads);
      var rb = Number(b.dataset.wrReads);
      if (ra < rb) return -1 * dir;
      if (ra > rb) return 1 * dir;
      var ia = Number(a.dataset.wrIndex);
      var ib = Number(b.dataset.wrIndex);
      return ia - ib;
    });
  }

  function getCardsInContainer(container) {
    if (!container || !container.querySelectorAll) return [];
    var nodes = Array.prototype.slice.call(
      container.querySelectorAll("[data-wr-reads]")
    );
    return nodes;
  }

  function applySort() {
    if (!STATE.listContainer) return;
    var cards = getCardsInContainer(STATE.listContainer);
    if (!cards.length) return;
    if (STATE.isSorting) return;
    STATE.isSorting = true;
    if (STATE.observer) STATE.observer.disconnect();
    var sorted = sortCards(cards, STATE.sortDir);
    sorted.forEach(function (card) {
      STATE.listContainer.appendChild(card);
    });
    var observeTarget =
      (root && root.document && root.document.body) || STATE.listContainer;
    if (STATE.observer && observeTarget) {
      STATE.observer.observe(observeTarget, {
        childList: true,
        subtree: true
      });
    }
    STATE.isSorting = false;
  }

  function ensureStyles(doc) {
    if (!doc || doc.getElementById('wr-sort-styles')) return;
    var style = doc.createElement('style');
    style.id = 'wr-sort-styles';
    style.textContent =
      '.wr-sort-button{' +
      'margin-left:8px;' +
      'padding:6px 10px;' +
      'border:1px solid #c7c7c7;' +
      'background:#fff;' +
      'border-radius:16px;' +
      'font-size:12px;' +
      'line-height:1;' +
      'cursor:pointer;' +
      '}' +
      '.wr-sort-button:hover{border-color:#8a8a8a;}' +
      '.wr-sort-item{' +
      'padding:8px 12px;' +
      'cursor:pointer;' +
      'list-style:none;' +
      '}' +
      '.wr-sort-item:hover{background:#f2f2f2;}' +
      '.wr-sort-arrow{' +
      'margin-left:6px;' +
      'font-size:12px;' +
      'cursor:pointer;' +
      'user-select:none;' +
      '}' +
      '.wr-sort-arrow.hidden{display:none;}' +
      '.wr-sort-bar{' +
      'display:inline-flex !important;' +
      'align-items:center !important;' +
      'gap:6px;' +
      'flex-wrap:nowrap;' +
      'white-space:nowrap;' +
      '}' +
      '.wr-sort-controls{' +
      'display:inline-flex;' +
      'align-items:center;' +
      'gap:6px;' +
      'flex-wrap:nowrap;' +
      '}' +
      '.wr-views-toggle{' +
      'min-width:22px;' +
      'height:22px;' +
      'padding:0 6px;' +
      'border:1px solid #ff6122;' +
      'background:rgba(255,97,34,0.08);' +
      'color:#ff6122;' +
      'border-radius:999px;' +
      'font-size:11px;' +
      'line-height:22px;' +
      'text-align:center;' +
      'cursor:pointer;' +
      '}' +
      '.wr-views-toggle:hover{' +
      'background:rgba(255,97,34,0.16);' +
      '}' +
      '.wr-views-toggle:active{' +
      'transform:translateY(1px);' +
      '}';
    doc.head.appendChild(style);
  }

  function findSortBar(doc) {
    return (
      doc.querySelector("[data-testid='sort-by-dropdown']") ||
      doc.querySelector('#sort-by-dropdown') ||
      doc.querySelector("[data-qa='sort-bar']") ||
      doc.querySelector('.filters') ||
      doc.querySelector('.sorts') ||
      null
    );
  }

  function findSortButton(sortBar) {
    if (!sortBar) return null;
    return sortBar.querySelector('button') || null;
  }

  function getSortLabelNode(sortButton) {
    if (!sortButton) return null;
    var node = sortButton.querySelector('#wr-sort-label');
    if (!node) {
      var caret =
        sortButton.querySelector("[data-testid='caret']") || null;
      Array.prototype.slice
        .call(sortButton.childNodes)
        .forEach(function (child) {
          if (child === caret) return;
          if (child.id === 'wr-sort-label') return;
          if (child.id === 'wr-sort-arrow') return;
          sortButton.removeChild(child);
        });
      node = document.createElement('span');
      node.id = 'wr-sort-label';
      if (caret) {
        sortButton.insertBefore(node, caret);
      } else {
        sortButton.insertBefore(node, sortButton.firstChild);
      }
    }
    return node;
  }

  function getArrowNode(sortButton) {
    if (!sortButton) return null;
    var arrow = sortButton.querySelector('#wr-sort-arrow');
    if (!arrow) {
      arrow = document.createElement('span');
      arrow.id = 'wr-sort-arrow';
      arrow.className = 'wr-sort-arrow hidden';
      arrow.textContent = '▼';
      var caret =
        sortButton.querySelector("[data-testid='caret']") || null;
      if (caret) {
        sortButton.insertBefore(arrow, caret);
      } else {
        sortButton.appendChild(arrow);
      }
    }
    return arrow;
  }

  function setHeaderSelection(sortButton, label) {
    if (!sortButton) return;
    var labelNode = getSortLabelNode(sortButton);
    labelNode.textContent = 'Sort by: ' + label + ' ';
  }

  function setArrowVisible(sortButton, visible) {
    var arrow = getArrowNode(sortButton);
    if (!arrow) return;
    arrow.classList.toggle('hidden', !visible);
    arrow.textContent = STATE.sortDir === 'desc' ? '▼' : '▲';
  }

  function applyViewsState(button) {
    if (!button) return;
    var state = button.dataset.wrViewState || 'desc';
    if (state === 'desc') {
      button.textContent = '▼';
      STATE.sortDir = 'desc';
      STATE.sortActive = true;
      scanAndMaybeSort(root.document);
      applySort();
      return;
    }
    if (state === 'asc') {
      button.textContent = '▲';
      STATE.sortDir = 'asc';
      STATE.sortActive = true;
      scanAndMaybeSort(root.document);
      applySort();
      return;
    }
    button.textContent = '⇅';
    STATE.sortActive = false;
    scanAndMaybeSort(root.document);
    restoreOriginalOrder();
  }

  function restoreOriginalOrder() {
    if (!STATE.listContainer) return;
    var cards = getCardsInContainer(STATE.listContainer);
    if (!cards.length) return;
    cards.sort(function (a, b) {
      var ia = Number(a.dataset.wrIndex);
      var ib = Number(b.dataset.wrIndex);
      return ia - ib;
    });
    cards.forEach(function (card) {
      STATE.listContainer.appendChild(card);
    });
  }

  function cycleViewsState(button) {
    var current = button.dataset.wrViewState || 'desc';
    var next = current === 'desc' ? 'asc' : current === 'asc' ? 'neutral' : 'desc';
    button.dataset.wrViewState = next;
    applyViewsState(button);
  }

  function injectViewsToggle(doc) {
    if (!doc || doc.getElementById('wr-views-toggle')) return;
    ensureStyles(doc);
    var sortBar = findSortBar(doc);
    if (!sortBar) return;
    var sortButton = findSortButton(sortBar);
    if (!sortButton) return;
    sortBar.classList.add('wr-sort-bar');
    var controls = sortBar.querySelector('#wr-sort-controls');
    if (!controls) {
      controls = doc.createElement('span');
      controls.id = 'wr-sort-controls';
      controls.className = 'wr-sort-controls';
      sortBar.insertBefore(controls, sortButton);
      controls.appendChild(sortButton);
    } else if (!controls.contains(sortButton)) {
      controls.appendChild(sortButton);
    }
    var button = doc.createElement('button');
    button.id = 'wr-views-toggle';
    button.className = 'wr-views-toggle';
    button.type = 'button';
    button.title = 'Sort by Views';
    button.dataset.wrViewState = 'desc';
    button.textContent = '▼';
    button.addEventListener('click', function (event) {
      event.preventDefault();
      cycleViewsState(button);
    });
    controls.insertBefore(button, sortButton);
  }

  function ensureViewsToggle(doc) {
    if (!doc) return;
    if (doc.getElementById('wr-views-toggle')) return;
    injectViewsToggle(doc);
  }

  function bootstrapViewsToggle(doc) {
    if (!doc || STATE.toggleBootTimer) return;
    var attempts = 0;
    STATE.toggleBootTimer = setInterval(function () {
      attempts += 1;
      ensureViewsToggle(doc);
      if (doc.getElementById('wr-views-toggle') || attempts >= 40) {
        clearInterval(STATE.toggleBootTimer);
        STATE.toggleBootTimer = null;
      }
    }, 250);
  }

  function attachArrowToggle(sortButton) {
    var arrow = getArrowNode(sortButton);
    if (!arrow || arrow.dataset.wrBound) return;
    arrow.dataset.wrBound = 'true';
    arrow.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (!STATE.sortActive) return;
      STATE.sortDir = STATE.sortDir === 'desc' ? 'asc' : 'desc';
      arrow.textContent = STATE.sortDir === 'desc' ? '▼' : '▲';
      applySort();
    });
  }

  function getDropdownList(sortBar, doc) {
    if (sortBar) {
      var local =
        sortBar.querySelector('#sortby-dropdown') ||
        sortBar.querySelector('ul');
      if (local) return local;
    }
    if (doc) {
      return doc.querySelector('#sortby-dropdown');
    }
    return null;
  }

  function cloneCheckedIcon(dropdownList) {
    if (!dropdownList) return null;
    var existing = dropdownList.querySelector('[data-testid="checked-icon"]');
    if (!existing) return null;
    return existing.cloneNode(true);
  }

  function setCheckedOnViews(dropdownList, enabled) {
    if (!dropdownList) return;
    var allChecks = dropdownList.querySelectorAll(
      '[data-testid="checked-icon"]'
    );
    Array.prototype.forEach.call(allChecks, function (check) {
      var inViews = check.closest('#wr-sort-menu-item');
      if (enabled) {
        if (!inViews) {
          check.style.display = 'none';
          check.dataset.wrHidden = 'true';
        }
      } else {
        if (check.dataset.wrHidden === 'true') {
          check.style.display = '';
          delete check.dataset.wrHidden;
        }
      }
    });
    var viewsCheck = dropdownList.querySelector(
      '#wr-sort-menu-item [data-testid="checked-icon"]'
    );
    if (viewsCheck) {
      viewsCheck.style.display = enabled ? '' : 'none';
    }
  }

  function injectButton(doc) {
    if (!doc || doc.getElementById('wr-sort-menu-item')) return;
    ensureStyles(doc);
    var sortBar = findSortBar(doc);
    if (!sortBar) return;
    var sortButton = findSortButton(sortBar);
    if (sortButton) {
      attachArrowToggle(sortButton);
      if (!sortButton.dataset.wrBound) {
        sortButton.dataset.wrBound = 'true';
        sortButton.addEventListener('click', function () {
          setTimeout(function () {
            injectButton(doc);
          }, 0);
          setTimeout(function () {
            injectButton(doc);
          }, 100);
        });
      }
    }
    var dropdownList = getDropdownList(sortBar, doc);
    if (!dropdownList) return;
    var link = doc.createElement('a');
    link.href = '#';
    link.className = 'WR6Py';
    var item = doc.createElement('li');
    item.className = 'loBjy wr-sort-item';
    item.id = 'wr-sort-menu-item';
    item.setAttribute('role', 'menuitem');
    item.setAttribute('tabindex', '0');
    item.textContent = 'Views';
    var checkIcon = cloneCheckedIcon(dropdownList);
    if (checkIcon) {
      checkIcon.style.display = 'none';
      checkIcon.classList.add('r4Ayt');
      item.appendChild(checkIcon);
    }
    link.appendChild(item);
    dropdownList.appendChild(link);

    if (!dropdownList.dataset.wrBound) {
      dropdownList.dataset.wrBound = 'true';
      dropdownList.addEventListener('click', function (event) {
        var li = event.target.closest('li');
        if (!li) return;
        if (li.id === 'wr-sort-menu-item') {
          event.preventDefault();
          if (!STATE.sortActive) {
            STATE.sortDir = 'desc';
          }
          STATE.sortActive = true;
          if (sortButton) {
            setHeaderSelection(sortButton, 'Views');
            setArrowVisible(sortButton, true);
          }
          setCheckedOnViews(dropdownList, true);
          applySort();
          return;
        }
        STATE.sortActive = false;
        if (sortButton) {
          var label = (li.textContent || '').trim() || 'Hot';
          setHeaderSelection(sortButton, label);
          setArrowVisible(sortButton, false);
        }
        setCheckedOnViews(dropdownList, false);
      });
    }
  }

  function ensureSortMenu(doc) {
    if (!doc || doc.getElementById('wr-sort-menu-item')) return;
    var sortBar = findSortBar(doc);
    if (!sortBar) return;
    var dropdownList = getDropdownList(sortBar, doc);
    if (!dropdownList) return;
    injectButton(doc);
  }

  function observeMenu(doc) {
    if (!doc || STATE.menuObserver) return;
    STATE.menuObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        Array.prototype.forEach.call(mutation.addedNodes, function (node) {
          if (!node || !node.querySelectorAll) return;
          if (node.id === 'sortby-dropdown' || node.querySelector('#sortby-dropdown')) {
            injectButton(doc);
            return;
          }
          if (node.matches && node.matches("[data-testid='sort-by-dropdown']")) {
            injectButton(doc);
            return;
          }
        });
      });
    });
    STATE.menuObserver.observe(doc.body, { childList: true, subtree: true });
  }

  function scanAndMaybeSort(rootNode) {
    var spans = findReadSpans(rootNode);
    if (!spans.length) return;
    indexCardsFromSpans(spans);
    if (STATE.sortActive) applySort();
  }

  function observe(doc) {
    if (!doc || STATE.observer) return;
    var target = doc.body;
    if (!target) return;
    STATE.observer = new MutationObserver(function (mutations) {
      if (STATE.isSorting) return;
      if (STATE.pendingScan) {
        clearTimeout(STATE.pendingScan);
      }
      STATE.pendingScan = setTimeout(function () {
        ensureViewsToggle(doc);
        mutations.forEach(function (mutation) {
          Array.prototype.forEach.call(mutation.addedNodes, function (node) {
            if (!node || !node.querySelectorAll) return;
            scanAndMaybeSort(node);
            if (!STATE.listContainer) {
              var spans = findReadSpans(node);
              if (spans.length) indexCardsFromSpans(spans);
            }
          });
        });
      }, 50);
    });
    STATE.observer.observe(target, { childList: true, subtree: true });
  }

  function attachDropdownTrigger(doc) {
    var sortBar = findSortBar(doc);
    if (!sortBar) return;
    var sortButton = findSortButton(sortBar);
    if (!sortButton || sortButton.dataset.wrDropdownBound) return;
    sortButton.dataset.wrDropdownBound = 'true';
    sortButton.addEventListener('click', function () {
      injectButton(doc);
      watchDropdownOnce(sortBar, doc);
    });
  }

  function watchDropdownOnce(sortBar, doc) {
    if (!sortBar || !doc) return;
    if (STATE.dropdownObserver) {
      STATE.dropdownObserver.disconnect();
      STATE.dropdownObserver = null;
    }
    var dropdownList = getDropdownList(sortBar, doc);
    if (dropdownList) {
      injectButton(doc);
      return;
    }
    STATE.dropdownObserver = new MutationObserver(function () {
      var list = getDropdownList(sortBar, doc);
      if (!list) return;
      injectButton(doc);
      if (STATE.dropdownObserver) {
        STATE.dropdownObserver.disconnect();
        STATE.dropdownObserver = null;
      }
    });
    STATE.dropdownObserver.observe(doc.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden']
    });
  }

  function init(doc) {
    scanAndMaybeSort(doc);
    ensureViewsToggle(doc);
    bootstrapViewsToggle(doc);
    observe(doc);
  }

  var api = {
    parseReadCount: parseReadCount,
    findReadSpans: findReadSpans,
    getCardElement: getCardElement,
    getListContainer: getListContainer,
    sortCards: sortCards
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (root && root.document && !root.__wattpadViewsSorterLoaded) {
    root.__wattpadViewsSorterLoaded = true;
    init(root.document);
  }
})(typeof window !== 'undefined' ? window : null);
