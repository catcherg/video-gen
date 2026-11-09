// Static checks for a video's source, whoever wrote it. They catch code that can't render the same way twice
// or that reaches outside the framework. They are not a security boundary: generated code still needs a sandbox.
import { parse } from "@babel/parser";
import path from "node:path";

export type Finding = { file: string; line: number; rule: string; message: string };

const ALLOWED_PACKAGES = [/^remotion$/, /^react$/, /^three$/, /^three\//, /^@remotion\/three$/];
/** Hooks that keep state between frames or run once per painted frame. */
const STATEFUL_HOOKS = new Set(["useState", "useEffect", "useLayoutEffect", "useReducer", "useRef", "useFrame", "useThree"]);
const FORBIDDEN_CALLS = new Set(["setTimeout", "setInterval", "setImmediate", "requestAnimationFrame", "fetch", "eval", "require", "importScripts"]);
const FORBIDDEN_CONSTRUCTORS = new Set(["Function", "XMLHttpRequest", "WebSocket", "EventSource", "Worker", "SharedWorker"]);
const FORBIDDEN_GLOBALS = new Set(["window", "document", "globalThis", "self", "process", "navigator", "localStorage", "sessionStorage", "indexedDB", "Date", "performance", "Function", "Reflect", "Proxy", "WebAssembly", "Buffer", "module", "exports", "__dirname", "__filename"]);
/** Ways to climb from an ordinary value to the runtime. */
const FORBIDDEN_MEMBERS = new Set(["constructor", "__proto__", "prototype", "getPrototypeOf", "getOwnPropertyDescriptor", "defineProperty", "getBuiltinModule", "mainModule"]);
/** TypeScript-only wrappers that still contain real code. Every other TS node is a type and can be skipped. */
const TS_EXPRESSIONS = new Set(["TSAsExpression", "TSSatisfiesExpression", "TSNonNullExpression"]);

type Node = { type: string; loc?: { start: { line: number } }; [key: string]: unknown };

const isNode = (v: unknown): v is Node => typeof v === "object" && v !== null && typeof (v as Node).type === "string";

/** True for a computed key put together from words, as opposed to arithmetic or a key made only of variables. */
const buildsTextKey = (key: Node): boolean => {
  if (key.type === "TemplateLiteral") return (key.quasis as { value: { raw: string } }[]).some((q) => /[a-z_$]/i.test(q.value.raw));
  if (key.type !== "BinaryExpression" || key.operator !== "+") return false;
  const isText = (n: Node): boolean => n.type === "StringLiteral" || n.type === "TemplateLiteral" || buildsTextKey(n);
  return isText(key.left as Node) || isText(key.right as Node);
};

/** The property name of a member expression, including computed ones written as strings. */
const memberName = (node: Node): string | undefined => {
  const property = node.property as Node;
  if (!node.computed && property.type === "Identifier") return property.name as string;
  if (property.type === "StringLiteral") return property.value as string;
  return undefined;
};

/** True when this Identifier is a real use of a variable, rather than a property name or an object key. */
const isVariableUse = (node: Node, parent: Node | undefined) => {
  if (!parent) return true;
  if ((parent.type === "MemberExpression" || parent.type === "OptionalMemberExpression") && parent.property === node && !parent.computed) return false;
  if (parent.type === "ObjectProperty" && parent.key === node && !parent.computed && !parent.shorthand) return false;
  if (parent.type === "ObjectMethod" && parent.key === node && !parent.computed) return false;
  return true;
};

export type CheckOptions = {
  /** Repository-relative folder of the video, such as videos/demo. */
  videoDir: string;
  /** The kit the video is built on. Leave out to allow any kit. */
  kit?: string;
};

/** Every rule this source file breaks. `file` is repository-relative. */
export const checkSource = (file: string, source: string, { videoDir, kit }: CheckOptions): Finding[] => {
  const findings: Finding[] = [];
  const report = (node: Node, rule: string, message: string) => findings.push({ file, line: node.loc?.start.line ?? 0, rule, message });

  const checkImport = (node: Node, target: string) => {
    if (target.startsWith(".")) {
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), target));
      const allowed = resolved === videoDir || resolved.startsWith(`${videoDir}/`) || resolved.startsWith("src/core/") || resolved.startsWith(kit ? `src/kits/${kit}/` : "src/kits/");
      if (!allowed) report(node, "import", `"${target}" is outside this video, src/core and its kit`);
    } else if (!ALLOWED_PACKAGES.some((p) => p.test(target))) {
      report(node, "import", `package "${target}" is not allowed in a video`);
    }
  };

  const visit = (node: Node, parent: Node | undefined) => {
    if (node.type.startsWith("TS") && !TS_EXPRESSIONS.has(node.type)) return;
    switch (node.type) {
      case "ImportDeclaration":
      case "ExportNamedDeclaration":
      case "ExportAllDeclaration":
        if (isNode(node.source)) checkImport(node, node.source.value as string);
        if (node.type === "ImportDeclaration") return;
        break;
      case "MetaProperty":
        report(node, "runtime-access", "import.meta can reach outside the video");
        break;
      case "Import":
        report(node, "dynamic-import", "dynamic import is not allowed in a video");
        break;
      case "MemberExpression":
      case "OptionalMemberExpression": {
        const object = node.object as Node;
        if (object.type === "Identifier" && object.name === "Math" && memberName(node) === "random") report(node, "random", "use hash() in visuals or createRng() in audio");
        const member = memberName(node);
        if (member && FORBIDDEN_MEMBERS.has(member)) report(node, "runtime-access", `.${member} can reach outside the video`);
        const key = node.property as Node;
        if (node.computed && buildsTextKey(key)) report(node, "runtime-access", "property names built from text can reach outside the video");
        break;
      }
      case "CallExpression":
      case "OptionalCallExpression": {
        const callee = node.callee as Node;
        const name = callee.type === "Identifier" ? (callee.name as string) : callee.type === "MemberExpression" ? memberName(callee) : undefined;
        if (name && STATEFUL_HOOKS.has(name)) report(node, "stateful-hook", `${name} keeps state between frames; compute from the frame number instead`);
        if (callee.type === "Identifier" && FORBIDDEN_CALLS.has(name as string)) report(node, "forbidden-call", `${name}() is not allowed in a video`);
        break;
      }
      case "NewExpression": {
        const callee = node.callee as Node;
        if (callee.type === "Identifier" && FORBIDDEN_CONSTRUCTORS.has(callee.name as string)) report(node, "forbidden-call", `new ${callee.name}() is not allowed in a video`);
        break;
      }
      case "Identifier":
        if (FORBIDDEN_GLOBALS.has(node.name as string) && isVariableUse(node, parent)) report(node, "forbidden-global", `${node.name} depends on the clock or the outside world`);
        break;
      case "JSXAttribute": {
        const name = node.name as Node;
        if (name.name === "dangerouslySetInnerHTML") report(node, "raw-html", "raw HTML is not allowed in a video");
        break;
      }
      case "JSXOpeningElement": {
        const name = node.name as Node;
        if (name.type === "JSXIdentifier" && ["script", "iframe", "object", "embed"].includes(name.name as string)) report(node, "raw-html", `<${name.name}> is not allowed in a video`);
        break;
      }
      case "StringLiteral":
        if (/^(https?:|wss?:|data:|file:)/i.test(node.value as string)) report(node, "url", "videos can't load anything from a URL");
        break;
      case "TemplateElement":
        if (/^(https?:|wss?:|data:|file:)/i.test((node.value as { raw: string }).raw)) report(node, "url", "videos can't load anything from a URL");
        break;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === "loc" || key === "extra" || key.endsWith("Comments")) continue;
      if (Array.isArray(value)) value.filter(isNode).forEach((child) => visit(child, node));
      else if (isNode(value)) visit(value, node);
    }
  };

  let ast: Node;
  try {
    ast = parse(source, { sourceType: "module", plugins: ["typescript", "jsx"] }) as unknown as Node;
  } catch (err) {
    return [{ file, line: 0, rule: "parse", message: (err as Error).message }];
  }
  visit(ast.program as Node, undefined);
  return findings;
};
