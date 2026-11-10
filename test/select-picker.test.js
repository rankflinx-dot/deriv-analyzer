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
    this.style = {};
    this.hidden = false;
    this.value = '';
    this.textContent = '';
    this.options = [];
    this.labels = [];
    this.events = [];
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
  append(...children) { for (const child of children) this.children.push(child); }
  remove() { this.removed = true; }
  focus() { this.focused = true; }
  closest(selector) { return selector === 'select' && this.tagName === 'select' ? this : null; }
  dispatchEvent(event) { this.events.push(event.type); return true; }
  querySelectorAll(selector) {
    const found = [];
    const visit = node => { for (const child of node.children) { if (child.tagName === selector) found.push(child); visit(child); } };
    visit(this);
    return found;
  }
  click() { for (const listener of this.listeners.click || []) listener({ target: this }); }
}

function loadPicker() {
  const documentListeners = {};
  const document = {
    documentElement: new FakeElement('html'),
    createElement: tag => new FakeElement(tag),
    addEventListener: (type, listener) => { (documentListeners[type] ||= []).push(listener); }
  };
  const context = { window: {}, document, Element: FakeElement, Event: class { constructor(type) { this.type = type; } } };
  const source = readFileSync(new URL('../android/app/src/main/assets/select-picker.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, context);
  return { document, documentListeners };
}

test('floating picker changes a selection and dispatches analyzer change events', () => {
  const { document, documentListeners } = loadPicker();
  const select = new FakeElement('select');
  select.labels = [{ innerText: 'History' }];
  select.value = '100';
  select.options = ['50', '100', '250'].map(value => ({ value, textContent: value, disabled: false }));

  const tap = { target: select, prevented: false, stopped: false,
    preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
  documentListeners.click[0](tap);
  assert.equal(tap.prevented, true, 'native WebView picker is suppressed');
  assert.equal(tap.stopped, true);

  const overlay = document.documentElement.children[0];
  const optionButton = overlay.querySelectorAll('button').find(button => button.textContent === '250');
  assert.ok(optionButton, 'the requested tick count is available');
  optionButton.click();

  assert.equal(select.value, '250');
  assert.deepEqual(select.events, ['input', 'change']);
  assert.equal(overlay.removed, true);
});
