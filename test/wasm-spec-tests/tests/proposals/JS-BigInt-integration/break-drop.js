
'use strict';

let spectest = {
  print: console.log.bind(console),
  print_i32: console.log.bind(console),
  print_i32_f32: console.log.bind(console),
  print_f64_f64: console.log.bind(console),
  print_f32: console.log.bind(console),
  print_f64: console.log.bind(console),
  global_i32: 666,
  global_f32: 666,
  global_f64: 666,
  table: new WebAssembly.Table({initial: 10, maximum: 20, element: 'anyfunc'}),
  memory: new WebAssembly.Memory({initial: 1, maximum: 2})
};
let handler = {
  get(target, prop) {
    return (prop in target) ?  target[prop] : {};
  }
};
let registry = new Proxy({spectest}, handler);

function register(name, instance) {
  registry[name] = instance.exports;
}

function module(bytes, valid = true) {
  let buffer = new ArrayBuffer(bytes.length);
  let view = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; ++i) {
    view[i] = bytes.charCodeAt(i);
  }
  let validated;
  try {
    validated = WebAssembly.validate(buffer);
  } catch (e) {
    throw new Error("Wasm validate throws");
  }
  if (validated !== valid) {
    throw new Error("Wasm validate failure" + (valid ? "" : " expected"));
  }
  return new WebAssembly.Module(buffer);
}

function instance(bytes, imports = registry) {
  return new WebAssembly.Instance(module(bytes), imports);
}

function call(instance, name, args) {
  return instance.exports[name](...args);
}

function get(instance, name) {
  let v = instance.exports[name];
  return (v instanceof WebAssembly.Global) ? v.value : v;
}

function exports(name, instance) {
  return {[name]: instance.exports};
}

function run(action) {
  action();
}

function assert_malformed(bytes) {
  try { module(bytes, false) } catch (e) {
    if (e instanceof WebAssembly.CompileError) return;
  }
  throw new Error("Wasm decoding failure expected");
}

function assert_invalid(bytes) {
  try { module(bytes, false) } catch (e) {
    if (e instanceof WebAssembly.CompileError) return;
  }
  throw new Error("Wasm validation failure expected");
}

function assert_unlinkable(bytes) {
  let mod = module(bytes);
  try { new WebAssembly.Instance(mod, registry) } catch (e) {
    if (e instanceof WebAssembly.LinkError) return;
  }
  throw new Error("Wasm linking failure expected");
}

function assert_uninstantiable(bytes) {
  let mod = module(bytes);
  try { new WebAssembly.Instance(mod, registry) } catch (e) {
    if (e instanceof WebAssembly.RuntimeError) return;
  }
  throw new Error("Wasm trap expected");
}

function assert_trap(action) {
  try { action() } catch (e) {
    if (e instanceof WebAssembly.RuntimeError) return;
  }
  throw new Error("Wasm trap expected");
}

let StackOverflow;
try { (function f() { 1 + f() })() } catch (e) { StackOverflow = e.constructor }

function assert_exhaustion(action) {
  try { action() } catch (e) {
    if (e instanceof StackOverflow) return;
  }
  throw new Error("Wasm resource exhaustion expected");
}

function assert_return(action, expected) {
  let actual = action();
  switch (expected) {
    case "nan:canonical":
    case "nan:arithmetic":
    case "nan:any":
      // Note that JS can't reliably distinguish different NaN values,
      // so there's no good way to test that it's a canonical NaN.
      if (!Number.isNaN(actual)) {
        throw new Error("Wasm return value NaN expected, got " + actual);
      };
      return;
    default:
      if (!Object.is(actual, expected)) {
        throw new Error("Wasm return value " + expected + " expected, got " + actual);
      };
  }
}

// break-drop.wast:1
let $1 = instance("\x00\x61\x73\x6d\x01\x00\x00\x00\x01\x84\x80\x80\x80\x00\x01\x60\x00\x00\x03\x84\x80\x80\x80\x00\x03\x00\x00\x00\x07\x99\x80\x80\x80\x00\x03\x02\x62\x72\x00\x00\x05\x62\x72\x5f\x69\x66\x00\x01\x08\x62\x72\x5f\x74\x61\x62\x6c\x65\x00\x02\x0a\xaa\x80\x80\x80\x00\x03\x87\x80\x80\x80\x00\x00\x02\x40\x0c\x00\x0b\x0b\x89\x80\x80\x80\x00\x00\x02\x40\x41\x01\x0d\x00\x0b\x0b\x8a\x80\x80\x80\x00\x00\x02\x40\x41\x00\x0e\x00\x00\x0b\x0b");

// break-drop.wast:7
assert_return(() => call($1, "br", []));

// break-drop.wast:8
assert_return(() => call($1, "br_if", []));

// break-drop.wast:9
assert_return(() => call($1, "br_table", []));
