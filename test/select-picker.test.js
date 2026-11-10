import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toLowerCase();
    this.children = [];
    this.listeners = {};
    this.attributes = {};
    this.dataset = {};
    this.style = { cssText: '' };
    this.hidden = false;
    this.value = '';
    this._textContent = '';
    this.textContentWrites = 0;
    this.options = [];
    this.labels = [];
    this.events = [];
    this.scrollTop = 0;
    this.clientHeight = 100;
    this.scrollHeight = 100;
  }
  get textContent() { return this._textContent; }
  set textContent(value) { this.textContentWrites++; this._textContent = String(value); }
  get firstChild() { return this.children[0] || null; }
  setAttribute(name, value) { this.attributes[name] = value; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
  append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  after(sibling) {
    const index = this.parentElement.children.indexOf(this);
    sibling.parentElement = this.parentElement;
    this.parentElement.children.splice(index + 1, 0, sibling);
  }
  remove() { this.removed = true; }
  focus() { this.focused = true; }
  closest(selector) { return selector === 'select' && this.tagName === 'select' ? this : null; }
  dispatchEvent(event) { this.events.push(event.type); for (const listener of this.listeners[event.type] || []) listener(event); return true; }
  querySelectorAll(selector) {
    const found = [];
    const visit = node => { for (const child of node.children) { if (child.tagName === selector) found.push(child); visit(child); } };
    visit(this);
    return found;
  }
  click() {
    const event = { target: this, preventDefault() { this.defaultPrevented = true; } };
    for (const listener of this.listeners.click || []) listener(event);
    return event;
  }
}

function loadPicker(select) {
  const root = new FakeElement('html');
  const body = new FakeElement('body');
  root.append(body);
  const document = {
    documentElement: root,
    createElement: tag => new FakeElement(tag),
    querySelectorAll: selector => root.querySelectorAll(selector),
    addEventListener() {}
  };
  if (select) body.append(select);
  class FakeMutationObserver {
    constructor(callback) { this.callback = callback; FakeMutationObserver.instance = this; }
    observe() {}
  }
  const context = {
    window: { addEventListener() {} },
    document,
    Event: class { constructor(type) { this.type = type; } },
    MutationObserver: FakeMutationObserver
  };
  const source = readFileSync(new URL('../android/app/src/main/assets/select-picker.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, context);
  return { document, body, observer: FakeMutationObserver.instance };
}

test('floating picker replaces native select and dispatches analyzer change events', () => {
  const select = new FakeElement('select');
  select.labels = [{ innerText: 'History' }];
  select.value = '100';
  select.options = ['50', '100', '250'].map(value => ({ value, textContent: value, disabled: false }));
  const { document, observer } = loadPicker(select);

  assert.match(select.style.cssText, /display:none/);
  assert.equal(select.attributes['aria-hidden'], 'true');
  const proxy = select.parentElement.children[select.parentElement.children.indexOf(select) + 1];
  assert.equal(proxy.className, 'derivnova-select-proxy');
  assert.equal(proxy.firstChild.textContent, '100');

  // A MutationObserver pass must not rewrite the same proxy label. In WebView,
  // that child-list write would schedule another observer pass indefinitely.
  const writesBeforeSync = proxy.firstChild.textContentWrites;
  observer.callback([]);
  assert.equal(proxy.firstChild.textContentWrites, writesBeforeSync);

  proxy.click();
  const overlay = document.documentElement.children.at(-1);
  const optionButton = overlay.querySelectorAll('button').find(button => button.textContent === '250');
  assert.ok(optionButton, 'the requested tick count is available');
  optionButton.click();

  assert.equal(select.value, '250');
  assert.deepEqual(select.events, ['input', 'change']);
  assert.equal(proxy.firstChild.textContent, '250');
  assert.equal(overlay.removed, true);
});

test('large market lists render in batches and search filters without freezing the picker', () => {
  const select = new FakeElement('select');
  select.labels = [{ innerText: 'Market' }];
  select.value = 'V0';
  select.options = Array.from({ length: 1200 }, (_, i) => ({
    value: `V${i}`,
    textContent: `Volatility ${i} Index`,
    disabled: false
  }));
  const { document } = loadPicker(select);
  const proxy = select.parentElement.children[select.parentElement.children.indexOf(select) + 1];
  proxy.click();
  const overlay = document.documentElement.children.at(-1);
  const list = overlay.querySelectorAll('div').find(node => node.attributes.role === 'listbox');
  assert.ok(list);
  assert.equal(list.querySelectorAll('button').length, 50, 'only the first batch is added initially');

  list.scrollHeight = 200;
  list.scrollTop = 150;
  list.dispatchEvent({ type: 'scroll', target: list });
  assert.equal(list.querySelectorAll('button').length, 100, 'scrolling appends just one more batch');

  const search = overlay.querySelectorAll('input')[0];
  search.value = 'Volatility 1199 Index';
  search.dispatchEvent({ type: 'input', target: search });
  const matches = list.querySelectorAll('button');
  assert.equal(matches.length, 1, 'search renders only matching option rows');
  assert.equal(matches[0].textContent, 'Volatility 1199 Index');
});

