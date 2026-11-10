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
    this.textContent = '';
    this.options = [];
    this.labels = [];
    this.events = [];
  }
  get firstChild() { return this.children[0] || null; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
  append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
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
  class FakeMutationObserver { observe() {} }
  const context = {
    window: { addEventListener() {} },
    document,
    Event: class { constructor(type) { this.type = type; } },
    MutationObserver: FakeMutationObserver
  };
  const source = readFileSync(new URL('../android/app/src/main/assets/select-picker.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, context);
  return { document, body };
}

test('floating picker replaces native select and dispatches analyzer change events', () => {
  const select = new FakeElement('select');
  select.labels = [{ innerText: 'History' }];
  select.value = '100';
  select.options = ['50', '100', '250'].map(value => ({ value, textContent: value, disabled: false }));
  const { document } = loadPicker(select);

  assert.match(select.style.cssText, /display:none/);
  assert.equal(select.attributes['aria-hidden'], 'true');
  const proxy = select.parentElement.children[select.parentElement.children.indexOf(select) + 1];
  assert.equal(proxy.className, 'derivnova-select-proxy');
  assert.equal(proxy.firstChild.textContent, '100');

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
