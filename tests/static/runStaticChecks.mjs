import { verifyAllGlbs } from './verifyGlb.mjs';
import {
  checkLocLimit,
  checkOpaqueBoxImports,
  checkDependencies,
  checkLintAndBuild,
  checkFinalDocs,
} from './auditCodebase.mjs';

const args = process.argv.slice(2);
const stageArg = args.find((a) => a.startsWith('--stage='))?.split('=')[1] ?? 'final';
const skipBuild = args.includes('--skip-build');
const VALID_STAGES = new Set(['pre-m1', 'm1', 'm2', 'final']);

if (!VALID_STAGES.has(stageArg)) {
  console.error(`Invalid --stage=${stageArg}. Expected pre-m1 | m1 | m2 | final`);
  process.exit(2);
}

const rootDir = process.cwd();
const failures = [];

function record(label, items) {
  if (items.length === 0) {
    console.log(`[PASS] ${label}`);
  } else {
    console.error(`[FAIL] ${label}`);
    for (const item of items) {
      console.error(`  - ${item}`);
      failures.push(`${label}: ${item}`);
    }
  }
}

record('LOC <= 250 limit (src/ & tests/)', checkLocLimit(rootDir));
record('Opaque-box boundary (tests/ -> !src/)', checkOpaqueBoxImports(rootDir));

if (stageArg !== 'pre-m1') {
  record('Required M1 dependencies', checkDependencies(rootDir));
}

const requireM2 = stageArg === 'm2' || stageArg === 'final';
const glbReport = verifyAllGlbs({
  rootDir,
  requireHeroFingers: requireM2,
  requireWeapons: requireM2,
});
record(
  `GLB binary integrity (${requireM2 ? 'strict M2+' : 'base pre-M2'})`,
  glbReport.failures,
);

if (!skipBuild) {
  record('npm run lint & npm run build', checkLintAndBuild(rootDir));
}

if (stageArg === 'final') {
  record('docs/FPS_RANGE_SPEC.md & /egm-review sign-off', checkFinalDocs(rootDir));
}

if (failures.length > 0) {
  console.error(`\nStatic checks failed (${failures.length} issue(s)) at stage=${stageArg}.`);
  process.exit(1);
}
console.log(`\nAll static checks passed for stage=${stageArg}.`);
