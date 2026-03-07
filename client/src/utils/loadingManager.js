let _stack = []; // array of {id, message}
const _listeners = new Set();
let _nextId = 1;

const notify = () => {
  const isLoading = _stack.length > 0;
  const message = _stack.length > 0 ? _stack[_stack.length - 1].message : null;
  _listeners.forEach((fn) => {
    try { fn({ isLoading, message }); } catch (e) { /* ignore listener errors */ }
  });
};

export const startLoading = (message = null) => {
  const id = _nextId++;
  _stack.push({ id, message });
  notify();
  return id;
};

export const stopLoading = (id = null) => {
  if (_stack.length === 0) return;
  if (id == null) {
    _stack.pop();
  } else {
    const idx = _stack.findIndex((e) => e.id === id);
    if (idx >= 0) _stack.splice(idx, 1);
  }
  notify();
};

export const subscribe = (fn) => {
  _listeners.add(fn);
  // emit current state immediately
  try { fn({ isLoading: _stack.length > 0, message: _stack.length > 0 ? _stack[_stack.length - 1].message : null }); } catch (e) {}
  return () => _listeners.delete(fn);
};

export const getCount = () => _stack.length;

export default {
  startLoading,
  stopLoading,
  subscribe,
  getCount
};
