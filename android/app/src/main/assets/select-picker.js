(() => {
  if (window.__derivNovaSelectPickerInstalled) return;
  window.__derivNovaSelectPickerInstalled = true;
  let activeSelect = null;
  let activeProxy = null;
  let overlay = null;
  const proxies = new WeakMap();

  const labelFor = select => {
    const label = select.labels?.[0];
    if (!label) return 'Choose an option';
    const directText = Array.from(label.childNodes || [])
      .filter(node => node !== select && !node.classList?.contains('derivnova-select-proxy'))
      .map(node => node.textContent || '')
      .join(' ')
      .trim();
    return directText || label.getAttribute?.('aria-label') || label.innerText?.trim() || 'Choose an option';
  };

  const updateProxy = select => {
    const proxy = proxies.get(select);
    if (!proxy) return;
    const selected = Array.from(select.options).find(option => option.value === select.value);
    const selectedText = selected?.textContent?.trim() || 'Choose an option';
    // The document observer calls syncSelects after any child-list update. Writing
    // textContent unconditionally replaces the text node, which queues another
    // observer callback forever in WebView when the picker opens. Only write when
    // the selected option actually changed.
    if (proxy.firstChild.textContent !== selectedText) proxy.firstChild.textContent = selectedText;
    const ariaLabel = `${labelFor(select)}: ${selectedText}`;
    if (proxy.getAttribute('aria-label') !== ariaLabel) proxy.setAttribute('aria-label', ariaLabel);
  };

  const sizeProxy = select => {
    const proxy = proxies.get(select);
    if (!proxy) return;
    proxy.style.width = select.closest('.inline-controls') ? '60px' : '100%';
  };

  const ensureProxy = select => {
    if (proxies.has(select)) {
      updateProxy(select);
      sizeProxy(select);
      return;
    }
    const proxy = document.createElement('button');
    proxy.type = 'button';
    proxy.className = 'derivnova-select-proxy';
    proxy.setAttribute('aria-haspopup', 'listbox');
    proxy.setAttribute('aria-expanded', 'false');
    proxy.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;box-sizing:border-box;padding:8px 10px;border:1px solid #354154;border-radius:6px;background:#10141d;color:#f4f6fb;font:inherit;text-align:left;white-space:nowrap;';
    const text = document.createElement('span');
    text.style.cssText = 'min-width:0;overflow:hidden;text-overflow:ellipsis;';
    const arrow = document.createElement('span');
    arrow.textContent = '▾';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.style.cssText = 'flex:none;color:#9ba7b7;';
    proxy.append(text, arrow);
    proxy.addEventListener('click', event => {
      event.preventDefault();
      openPicker(select, proxy);
    });
    select.addEventListener('change', () => updateProxy(select));
    select.style.cssText += ';display:none !important;';
    select.setAttribute('aria-hidden', 'true');
    select.setAttribute('tabindex', '-1');
    select.after(proxy);
    proxies.set(select, proxy);
    updateProxy(select);
    sizeProxy(select);
  };

  const syncSelects = () => document.querySelectorAll('select').forEach(ensureProxy);

  const closePicker = () => {
    overlay?.remove();
    overlay = null;
    activeProxy?.focus({ preventScroll: true });
    activeProxy?.setAttribute('aria-expanded', 'false');
    activeSelect = null;
    activeProxy = null;
  };

  const openPicker = (select, proxy) => {
    closePicker();
    activeSelect = select;
    activeProxy = proxy || proxies.get(select);
    activeProxy?.setAttribute('aria-expanded', 'true');
    updateProxy(select);
    overlay = document.createElement('div');
    overlay.setAttribute('role', 'presentation');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(4,9,16,.72);display:flex;align-items:flex-end;justify-content:center;padding:12px 10px calc(12px + env(safe-area-inset-bottom));font:14px/1.4 Inter,Arial,sans-serif;color:#f4f6fb;';

    const sheet = document.createElement('section');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', labelFor(select));
    sheet.style.cssText = 'width:min(100%,520px);max-height:82vh;display:flex;flex-direction:column;overflow:hidden;background:#191f2b;border:1px solid #354154;border-radius:16px;box-shadow:0 16px 48px #0009;';

    const heading = document.createElement('div');
    heading.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #2a3343;font-weight:700;';
    const title = document.createElement('span');
    title.textContent = labelFor(select);
    const done = document.createElement('button');
    done.type = 'button'; done.textContent = 'Done';
    done.style.cssText = 'border:0;border-radius:8px;padding:7px 12px;background:#2878e8;color:white;font:inherit;font-weight:700;';
    done.addEventListener('click', closePicker);
    heading.append(title, done);
    sheet.append(heading);

    const options = Array.from(select.options).filter(option => !option.disabled);
    let search = null;
    if (options.length > 10) {
      search = document.createElement('input');
      search.type = 'search'; search.placeholder = 'Search options'; search.setAttribute('aria-label', 'Search options');
      search.style.cssText = 'margin:10px 12px 4px;padding:10px 12px;border:1px solid #354154;border-radius:8px;background:#10141d;color:#f4f6fb;font:inherit;';
      sheet.append(search);
    }

    const list = document.createElement('div');
    list.setAttribute('role', 'listbox');
    list.style.cssText = 'overflow:auto;overscroll-behavior:contain;padding:6px 8px 10px;';
    const batchSize = 50;
    let matchingOptions = options;
    let renderedCount = 0;
    const appendNextBatch = () => {
      const batch = matchingOptions.slice(renderedCount, renderedCount + batchSize);
      if (!batch.length) return;
      const rows = batch.map(option => {
        const row = document.createElement('button');
        row.type = 'button'; row.setAttribute('role', 'option');
        row.setAttribute('aria-selected', String(option.value === select.value));
        row.dataset.searchText = option.textContent.toLocaleLowerCase();
        row.textContent = option.textContent;
        row.style.cssText = 'display:block;width:100%;text-align:left;padding:12px 12px;border:0;border-radius:8px;background:transparent;color:#f4f6fb;font:inherit;';
        if (option.value === select.value) row.style.background = '#2878e833';
        row.addEventListener('click', event => {
          event.preventDefault();
          select.value = option.value;
          select.dispatchEvent(new Event('input', { bubbles: true }));
          select.dispatchEvent(new Event('change', { bubbles: true }));
          closePicker();
        });
        return row;
      });
      list.append(...rows);
      renderedCount += batch.length;
    };
    const filterOptions = () => {
      const query = search.value.trim().toLocaleLowerCase();
      matchingOptions = options.filter(option => option.textContent.toLocaleLowerCase().includes(query));
      renderedCount = 0;
      list.replaceChildren();
      appendNextBatch();
    };
    list.addEventListener('scroll', () => {
      if (list.scrollTop + list.clientHeight >= list.scrollHeight - 80) appendNextBatch();
    }, { passive: true });
    appendNextBatch();
    sheet.append(list);
    overlay.append(sheet);
    overlay.addEventListener('click', event => { if (event.target === overlay) closePicker(); });
    document.documentElement.append(overlay);
    if (search) {
      search.addEventListener('input', filterOptions);
      search.focus();
    }
  };

  syncSelects();
  const observer = new MutationObserver(syncSelects);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('resize', () => document.querySelectorAll('select').forEach(sizeProxy));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && overlay) { event.preventDefault(); closePicker(); }
  }, true);
})();

