import { execSync } from 'node:child_process';
import fs from 'node:fs';

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch (err) {
    return '';
  }
}

// 1. Identify latest tag
let latestTag = run('git describe --tags --abbrev=0 --match "v*"');
if (!latestTag) {
  latestTag = 'v2.4.0';
}

console.log(`[Release Automation] Latest existing tag: ${latestTag}`);

// 2. Retrieve commit log since latest tag
let commitLog = run(`git log ${latestTag}..HEAD --pretty=format:"%H|%s|%b<COMMIT_END>"`);
const overrideType = process.env.INPUT_RELEASE_TYPE || 'auto';

if (!commitLog) {
  if (overrideType && overrideType !== 'auto') {
    console.log('[Release Automation] Manual override dispatch detected; evaluating HEAD commit.');
    commitLog = run('git log -1 --pretty=format:"%H|%s|%b<COMMIT_END>"');
  } else {
    console.log('[Release Automation] No new commits detected since latest tag. Skipping release.');
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, 'should_release=false\n');
    }
    process.exit(0);
  }
}

const rawCommits = commitLog
  .split('<COMMIT_END>')
  .map((c) => c.trim())
  .filter(Boolean);

console.log(`[Release Automation] Commits evaluated: ${rawCommits.length}`);

// 3. Classify commits & determine bump type
let isMajor = false;
let isMinor = false;
let isPatch = true;

const features = [];
const improvements = [];
const majorChanges = [];
const bugFixes = [];

for (const raw of rawCommits) {
  const [hash, subject, ...bodyParts] = raw.split('|');
  const body = bodyParts.join('|') || '';
  const cleanSubject = (subject || '').trim();
  const shortSha = (hash || '').slice(0, 7);

  if (!cleanSubject) continue;

  // Check for breaking changes
  const isBreaking =
    cleanSubject.includes('BREAKING CHANGE') ||
    cleanSubject.startsWith('feat!') ||
    cleanSubject.startsWith('fix!') ||
    body.includes('BREAKING CHANGE');

  if (isBreaking) {
    isMajor = true;
    majorChanges.push(`- **${cleanSubject}** (${shortSha})`);
  } else if (cleanSubject.startsWith('feat')) {
    isMinor = true;
    const desc = cleanSubject.replace(/^feat(\([^)]+\))?:\s*/i, '');
    features.push(`- ${desc.charAt(0).toUpperCase() + desc.slice(1)} (${shortSha})`);
  } else if (cleanSubject.startsWith('fix')) {
    const desc = cleanSubject.replace(/^fix(\([^)]+\))?:\s*/i, '');
    bugFixes.push(`- ${desc.charAt(0).toUpperCase() + desc.slice(1)} (${shortSha})`);
  } else {
    // Normal style, refactor, perf, chore
    const desc = cleanSubject.replace(/^(perf|refactor|style|chore)(\([^)]+\))?:\s*/i, '');
    improvements.push(`- ${desc.charAt(0).toUpperCase() + desc.slice(1)} (${shortSha})`);
  }
}

// 4. Calculate next semver tag
let [majorStr, minorStr, patchStr] = latestTag.replace(/^v/, '').split('.');
let major = parseInt(majorStr, 10) || 2;
let minor = parseInt(minorStr, 10) || 4;
let patch = parseInt(patchStr, 10) || 0;

if (overrideType === 'major' || (overrideType === 'auto' && isMajor)) {
  major += 1;
  minor = 0;
  patch = 0;
} else if (overrideType === 'minor' || (overrideType === 'auto' && isMinor)) {
  minor += 1;
  patch = 0;
} else {
  // Default to patch for normal code fixes & improvements
  patch += 1;
}

let nextTag = `v${major}.${minor}.${patch}`;
// Avoid tag collision if tag already exists locally or remotely
while (run(`git tag -l ${nextTag}`)) {
  patch += 1;
  nextTag = `v${major}.${minor}.${patch}`;
}

console.log(`[Release Automation] Target release tag: ${nextTag}`);

// 5. Generate release notes adhering to Section 5
let releaseTitle = `Stark Entertainment ${nextTag}`;
if (process.env.INPUT_CUSTOM_TITLE) {
  releaseTitle = `Stark Entertainment ${nextTag} — ${process.env.INPUT_CUSTOM_TITLE}`;
} else if (isMajor) {
  releaseTitle += ' — Major Platform Evolution';
} else if (isMinor) {
  const firstFeat = features[0] ? features[0].replace(/^-\s*/, '').replace(/\s*\([a-f0-9]+\)$/, '') : 'New Features';
  releaseTitle += ` — ${firstFeat.slice(0, 50)}`;
} else {
  releaseTitle += ' — Minor Bug Fixes & Improvements';
}

let notes = `# ${releaseTitle}\n\n`;

if (majorChanges.length > 0) {
  notes += `### Major Changes\n${majorChanges.join('\n')}\n\n`;
}

if (features.length > 0) {
  notes += `### New Features\n${features.join('\n')}\n\n`;
}

if (bugFixes.length > 0) {
  notes += `### Bug Fixes\n${bugFixes.join('\n')}\n\n`;
}

if (improvements.length > 0) {
  notes += `### Minor Bug Fixes & Improvements\n${improvements.join('\n')}\n\n`;
}

if (features.length === 0 && bugFixes.length === 0 && improvements.length === 0 && majorChanges.length === 0) {
  notes += `### Minor Bug Fixes & Improvements\n- Routine maintenance, dependency updates, and operational polish.\n\n`;
}

notes += `\n---\n*Automated release generated from branch \`stark-features\` commit \`${run('git rev-parse --short HEAD')}\`.*`;

fs.writeFileSync('release-notes.md', notes, 'utf8');
console.log('[Release Automation] Generated release notes:');
console.log(notes);

// 6. Export outputs for GitHub Actions
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `should_release=true\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `tag_name=${nextTag}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `release_title=${releaseTitle}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `body_path=release-notes.md\n`);
}
