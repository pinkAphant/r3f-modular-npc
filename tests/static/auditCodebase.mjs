import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

const CODE_EXTS = new Set(['.ts', '.tsx', '.mts', '.cts', '.mjs', '.js']);
const MAX_LOC = 250;

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else if (CODE_EXTS.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

function countLines(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  if (raw.length === 0) return 0;
  return raw.replace(/\r?\n$/, '').split(/\r?\n/).length;
}

function scriptKindFor(filePath) {
  const ext = path.extname(filePath);
  if (ext === '.tsx') return ts.ScriptKind.TSX;
  if (ext === '.mjs' || ext === '.js') return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function normalizeSpec(spec) {
  let norm = spec.replace(/\\/g, '/');
  if (norm.startsWith('file://')) {
    try {
      norm = fileURLToPath(norm).replace(/\\/g, '/');
    } catch {
      norm = norm.slice('file://'.length);
    }
  }
  return norm.split(/[?#]/, 1)[0];
}

function checkSpec(rootDir, file, spec, violations) {
  const rel = path.relative(rootDir, file);
  const srcRoot = path.resolve(rootDir, 'src');
  const norm = normalizeSpec(spec);
  if (norm === 'src' || norm.startsWith('src/') || norm === '@' || norm.startsWith('@/')) {
    violations.push(`${rel} imports '${spec}'`);
    return;
  }
  let resolved = null;
  if (norm.startsWith('.')) {
    resolved = path.resolve(path.dirname(file), norm);
  } else if (path.posix.isAbsolute(norm) || path.isAbsolute(norm)) {
    resolved = path.resolve(norm);
  }
  if (resolved && (resolved === srcRoot || resolved.startsWith(srcRoot + path.sep))) {
    violations.push(`${rel} resolves into src via '${spec}'`);
  }
}

export function checkLocLimit(rootDir) {
  const violations = [];
  for (const sub of ['src', 'tests']) {
    for (const file of walkFiles(path.join(rootDir, sub))) {
      const loc = countLines(file);
      if (loc > MAX_LOC) {
        violations.push(`${path.relative(rootDir, file)}: ${loc} lines (> ${MAX_LOC})`);
      }
    }
  }
  return violations;
}

function unwrapGrouping(node) {
  let cur = node;
  while (cur) {
    if (ts.isParenthesizedExpression(cur)) cur = cur.expression;
    else if (ts.isBinaryExpression(cur) && cur.operatorToken.kind === ts.SyntaxKind.CommaToken) cur = cur.right;
    else break;
  }
  return cur;
}

function getMemberName(node) {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (ts.isElementAccessExpression(node) && node.argumentExpression && ts.isStringLiteralLike(node.argumentExpression)) {
    return node.argumentExpression.text;
  }
  return null;
}

function isCreateRequireCallee(expr, createRequireFns) {
  const cur = unwrapGrouping(expr);
  if (!cur) return false;
  if (ts.isIdentifier(cur) && createRequireFns.has(cur.text)) return true;
  return getMemberName(cur) === 'createRequire';
}

function isRootedAt(node, names) {
  let cur = unwrapGrouping(node);
  while (cur && getMemberName(cur) !== null) cur = unwrapGrouping(cur.expression);
  return Boolean(cur && ts.isIdentifier(cur) && names.has(cur.text));
}

function isRequireRoot(node, requireAliases, createRequireFns) {
  const cur = unwrapGrouping(node);
  if (!cur) return false;
  if (ts.isIdentifier(cur)) return cur.text === 'require' || requireAliases.has(cur.text);
  if (ts.isCallExpression(cur) && isCreateRequireCallee(cur.expression, createRequireFns)) return true;
  return getMemberName(cur) === 'require' && isRootedAt(cur.expression, new Set(['globalThis', 'module']));
}

function getRequireCallee(expr, sf, requireAliases, createRequireFns) {
  let cur = unwrapGrouping(expr);
  while (cur) {
    if (isRequireRoot(cur, requireAliases, createRequireFns)) return expr.getText(sf);
    if (getMemberName(cur) !== null) cur = unwrapGrouping(cur.expression);
    else break;
  }
  return null;
}

function trackAliases(node, createRequireFns, requireAliases) {
  if (ts.isBindingElement(node) && node.propertyName && ts.isIdentifier(node.propertyName)) {
    if (node.propertyName.text === 'createRequire' && ts.isIdentifier(node.name)) {
      createRequireFns.add(node.name.text);
    }
    return;
  }
  let lhs = null;
  let rhs = null;
  if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.name)) {
    lhs = node.name.text;
    rhs = unwrapGrouping(node.initializer);
  } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(node.left)) {
    lhs = node.left.text;
    rhs = unwrapGrouping(node.right);
  }
  if (!lhs || !rhs) return;
  if (isCreateRequireCallee(rhs, createRequireFns)) createRequireFns.add(lhs);
  else if (ts.isCallExpression(rhs) && isCreateRequireCallee(rhs.expression, createRequireFns)) requireAliases.add(lhs);
}

export function checkOpaqueBoxImports(rootDir) {
  const violations = [];
  for (const file of walkFiles(path.join(rootDir, 'tests'))) {
    const rel = path.relative(rootDir, file);
    const code = fs.readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, scriptKindFor(file));
    const createRequireFns = new Set(['createRequire']);
    const requireAliases = new Set();
    const visit = (node) => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
        if (ts.isStringLiteralLike(node.moduleSpecifier)) {
          const mod = node.moduleSpecifier.text;
          checkSpec(rootDir, file, mod, violations);
          if (ts.isImportDeclaration(node) && (mod === 'module' || mod === 'node:module')) {
            const nb = node.importClause?.namedBindings;
            if (nb && ts.isNamedImports(nb)) {
              for (const el of nb.elements) {
                if ((el.propertyName ?? el.name).text === 'createRequire') {
                  createRequireFns.add(el.name.text);
                  violations.push(`${rel} imports 'createRequire' from '${mod}'`);
                }
              }
            }
          }
        }
      } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
        const expr = node.moduleReference.expression;
        if (ts.isStringLiteralLike(expr)) checkSpec(rootDir, file, expr.text, violations);
      } else {
        trackAliases(node, createRequireFns, requireAliases);
        if (ts.isCallExpression(node)) {
          if (isCreateRequireCallee(node.expression, createRequireFns)) {
            violations.push(`${rel} calls ${node.expression.getText(sf)}`);
          }
          const isDynImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
          const requireCallee = isDynImport ? null : getRequireCallee(node.expression, sf, requireAliases, createRequireFns);
          if ((isDynImport || requireCallee) && node.arguments.length > 0) {
            const arg = node.arguments[0];
            if (ts.isStringLiteralLike(arg)) {
              checkSpec(rootDir, file, arg.text, violations);
            } else {
              const label = isDynImport ? 'import' : requireCallee;
              violations.push(`${rel} uses non-literal dynamic ${label}(${arg.getText(sf)})`);
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return violations;
}

export function checkDependencies(rootDir) {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const lowerDeps = new Set(Object.keys(allDeps).map((k) => k.toLowerCase()));
  const missing = [];
  if (!lowerDeps.has('@pinkaphant/ecctrl') && !lowerDeps.has('ecctrl')) {
    missing.push('@pinkaphant/ecctrl (or ecctrl)');
  }
  for (const dep of ['@react-three/rapier', '@react-three/uikit', 'wiggle']) {
    if (!lowerDeps.has(dep)) missing.push(dep);
  }
  return missing;
}

export function checkLintAndBuild(rootDir) {
  const failures = [];
  for (const script of ['lint', 'build']) {
    const res = spawnSync('npm', ['run', script], {
      cwd: rootDir,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    if (res.status !== 0) {
      failures.push(`npm run ${script} failed (exit ${res.status}):\n${res.stdout}\n${res.stderr}`);
    }
  }
  return failures;
}

export function checkFinalDocs(rootDir) {
  const failures = [];
  const specPath = path.join(rootDir, 'docs', 'FPS_RANGE_SPEC.md');
  if (!fs.existsSync(specPath) || fs.statSync(specPath).size < 200) {
    failures.push('Missing or incomplete docs/FPS_RANGE_SPEC.md (> 200 bytes required)');
    return failures;
  }
  const specText = fs.readFileSync(specPath, 'utf8');
  const reviewPath = path.join(rootDir, 'docs', 'EGM_REVIEW.md');
  const reviewText = fs.existsSync(reviewPath) ? fs.readFileSync(reviewPath, 'utf8') : '';
  const combined = `${specText}\n${reviewText}`;
  if (!/egm[- ]review/i.test(combined)) {
    failures.push('Missing /egm-review verification section in docs/FPS_RANGE_SPEC.md or docs/EGM_REVIEW.md');
  }
  return failures;
}
