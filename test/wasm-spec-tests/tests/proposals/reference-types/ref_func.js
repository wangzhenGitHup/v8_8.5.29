
'use strict';

let hostrefs = {};
let hostsym = Symbol("hostref");
function hostref(s) {
  if (! (s in hostrefs)) hostrefs[s] = {[hostsym]: s};
  return hostrefs[s];
}
function is_hostref(x) {
  return (x !== null && hostsym in x) ? 1 : 0;
}
function is_funcref(x) {
  return typeof x === "function" ? 1 : 0;
}
function eq_ref(x, y) {
  return x === y ? 1 : 0;
}

let spectest = {
  hostref: hostref,
  is_hostref: is_hostref,
  is_funcref: is_funcref,
  eq_ref: eq_ref,
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

function exports(instance) {
  return {module: instance.exports, spectest: spectest};
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
      // Note that JS can't reliably distinguish different NaN values,
      // so there's no good way to test that it's a canonical NaN.
      if (!Number.isNaN(actual)) {
        throw new Error("Wasm NaN return value expected, got " + actual);
      };
      return;
    case "ref.func":
      if (typeof actual !== "function") {
        throw new Error("Wasm function return value expected, got " + actual);
      };
      return;
    case "ref.any":
      if (actual === null) {
        throw new Error("Wasm reference return value expected, got " + actual);
      };
      return;
    default:
      if (!Object.is(actual, expected)) {
        throw new Error("Wasm return value " + expected + " expected, got " + actual);
      };
  }
}

// ref_func.wast:1
let $1 = instance("\x00\x61\x73\x6d\x01\x00\x00\x00\x01\x86\x80\x80\x80\x00\x01\x60\x01\x7f\x01\x7f\x03\x82\x80\x80\x80\x00\x01\x00\x07\x85\x80\x80\x80\x00\x01\x01\x66\x00\x00\x0a\x8a\x80\x80\x80\x00\x01\x84\x80\x80\x80\x00\x00\x20\x00\x0b");

// ref_func.wast:4
register("M", $1)

// ref_func.wast:6
let $2 = instance("\x00\x61\x73\x6d\x01\x00\x00\x00\x01\x8d\x80\x80\x80\x00\x03\x60\x01\x7f\x01\x7f\x60\x00\x00\x60\x00\x01\x7f\x02\x87\x80\x80\x80\x00\x01\x01\x4d\x01\x66\x00\x00\x03\x8f\x80\x80\x80\x00\x0e\x00\x01\x01\x01\x01\x01\x02\x02\x02\x01\x01\x00\x00\x00\x04\x84\x80\x80\x80\x00\x01\x70\x00\x01\x06\xa4\x80\x80\x80\x00\x07\x6f\x00\xd2\x00\x0b\x6f\x00\xd2\x01\x0b\x70\x00\xd2\x00\x0b\x70\x00\xd2\x01\x0b\x70\x01\xd2\x00\x0b\x70\x00\xd2\x03\x0b\x70\x00\xd2\x04\x0b\x07\xd0\x80\x80\x80\x00\x08\x09\x69\x73\x5f\x6e\x75\x6c\x6c\x2d\x66\x00\x07\x09\x69\x73\x5f\x6e\x75\x6c\x6c\x2d\x67\x00\x08\x09\x69\x73\x5f\x6e\x75\x6c\x6c\x2d\x76\x00\x09\x05\x73\x65\x74\x2d\x66\x00\x0a\x05\x73\x65\x74\x2d\x67\x00\x0b\x06\x63\x61\x6c\x6c\x2d\x66\x00\x0c\x06\x63\x61\x6c\x6c\x2d\x67\x00\x0d\x06\x63\x61\x6c\x6c\x2d\x76\x00\x0e\x09\x90\x80\x80\x80\x00\x03\x03\x00\x02\x03\x05\x03\x00\x02\x04\x06\x03\x00\x02\x00\x01\x0a\xa6\x81\x80\x80\x00\x0e\x87\x80\x80\x80\x00\x00\x20\x00\x41\x01\x6a\x0b\x88\x80\x80\x80\x00\x00\xd2\x05\x1a\xd2\x06\x1a\x0b\x82\x80\x80\x80\x00\x00\x0b\x82\x80\x80\x80\x00\x00\x0b\x82\x80\x80\x80\x00\x00\x0b\x82\x80\x80\x80\x00\x00\x0b\x85\x80\x80\x80\x00\x00\xd2\x00\xd1\x0b\x85\x80\x80\x80\x00\x00\xd2\x01\xd1\x0b\x85\x80\x80\x80\x00\x00\x23\x04\xd1\x0b\x86\x80\x80\x80\x00\x00\xd2\x00\x24\x04\x0b\x86\x80\x80\x80\x00\x00\xd2\x01\x24\x04\x0b\x8f\x80\x80\x80\x00\x00\x41\x00\xd2\x00\x26\x00\x20\x00\x41\x00\x11\x00\x00\x0b\x8f\x80\x80\x80\x00\x00\x41\x00\xd2\x01\x26\x00\x20\x00\x41\x00\x11\x00\x00\x0b\x8f\x80\x80\x80\x00\x00\x41\x00\x23\x04\x26\x00\x20\x00\x41\x00\x11\x00\x00\x0b");

// ref_func.wast:58
assert_return(() => call($2, "is_null-f", []), 0);

// ref_func.wast:59
assert_return(() => call($2, "is_null-g", []), 0);

// ref_func.wast:60
assert_return(() => call($2, "is_null-v", []), 0);

// ref_func.wast:62
assert_return(() => call($2, "call-f", [4]), 4);

// ref_func.wast:63
assert_return(() => call($2, "call-g", [4]), 5);

// ref_func.wast:64
assert_return(() => call($2, "call-v", [4]), 4);

// ref_func.wast:65
run(() => call($2, "set-g", []));

// ref_func.wast:66
assert_return(() => call($2, "call-v", [4]), 5);

// ref_func.wast:67
run(() => call($2, "set-f", []));

// ref_func.wast:68
assert_return(() => call($2, "call-v", [4]), 4);

// ref_func.wast:70
assert_invalid("\x00\x61\x73\x6d\x01\x00\x00\x00\x01\x86\x80\x80\x80\x00\x01\x60\x01\x7f\x01\x7f\x02\x8d\x80\x80\x80\x00\x02\x01\x4d\x01\x66\x00\x00\x01\x4d\x01\x67\x00\x00\x06\x86\x80\x80\x80\x00\x01\x70\x00\xd2\x07\x0b");

// ref_func.wast:79
assert_invalid("\x00\x61\x73\x6d\x01\x00\x00\x00\x01\x84\x80\x80\x80\x00\x01\x60\x00\x00\x03\x82\x80\x80\x80\x00\x01\x00\x06\x86\x80\x80\x80\x00\x01\x70\x00\xd2\x00\x0b\x0a\x88\x80\x80\x80\x00\x01\x82\x80\x80\x80\x00\x00\x0b");

// ref_func.wast:83
assert_invalid("\x00\x61\x73\x6d\x01\x00\x00\x00\x01\x84\x80\x80\x80\x00\x01\x60\x00\x00\x03\x82\x80\x80\x80\x00\x01\x00\x0a\x8b\x80\x80\x80\x00\x01\x85\x80\x80\x80\x00\x00\xd2\x00\x1a\x0b");
