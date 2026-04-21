import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const VERSION_FILE = path.join(REPO_ROOT, 'VERSION');
const PACKAGE_JSON = path.join(REPO_ROOT, 'package.json');
const COVERAGE_SUMMARY = path.join(REPO_ROOT, 'coverage', 'coverage-summary.json');
const SKILLS_DIR = path.join(REPO_ROOT, '.agents', 'skills');

const README_PATH = path.join(REPO_ROOT, 'README.md');
const AGENTS_MD_PATH = path.join(REPO_ROOT, 'AGENTS.md');
const SKILLS_README_PATH = path.join(REPO_ROOT, '.agents', 'skills', 'README.md');

function readFileSync(filepath) {
  try {
    return fs.readFileSync(filepath, 'utf8').trim();
  } catch (err) {
    console.warn(`Warning: Could not read ${filepath}`);
    return null;
  }
}

function updateFencedSection(content, sectionName, newContent) {
  const startMarker = `<!-- AUTO-START:${sectionName} -->`;
  const endMarker = `<!-- AUTO-END:${sectionName} -->`;
  const regex = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`, 'g');
  return content.replace(regex, `${startMarker}\n${newContent}\n${endMarker}`);
}

function getMajorVersion(version) {
  if (!version) return 'unknown';
  const match = version.match(/\d+/);
  return match ? match[0] : version;
}

function getCoverageColor(pct) {
  if (pct < 50) return 'red';
  if (pct < 80) return 'yellow';
  return 'brightgreen';
}

function extractSkillMetadata(skillDir) {
  const skillFile = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillFile)) return null;

  const content = fs.readFileSync(skillFile, 'utf8');
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const metadata = {
    name: path.basename(skillDir),
    description: 'No description available',
  };

  if (fmMatch) {
    const fmLines = fmMatch[1].split('\n');
    for (const line of fmLines) {
      if (line.startsWith('name:')) {
        metadata.name = line.replace('name:', '').trim().replace(/['"]/g, '');
      } else if (line.startsWith('description:')) {
        let desc = line.replace('description:', '').trim();
        if (desc === '>' || desc === '|' || desc === '>-') {
          // Multiline description - this is a simplified parser
          const descLines = [];
          const fmIndex = fmLines.indexOf(line);
          for (let i = fmIndex + 1; i < fmLines.length; i++) {
            if (fmLines[i].startsWith('  ')) {
              descLines.push(fmLines[i].trim());
            } else {
              break;
            }
          }
          metadata.description = descLines.join(' ');
        } else {
          metadata.description = desc.replace(/['"]/g, '');
        }
      }
    }
  }
  return metadata;
}

async function main() {
  const version = readFileSync(VERSION_FILE);
  const pkgStr = readFileSync(PACKAGE_JSON);
  const pkg = pkgStr ? JSON.parse(pkgStr) : { dependencies: {}, devDependencies: {} };
  const coverageStr = readFileSync(COVERAGE_SUMMARY);
  const coverageData = coverageStr ? JSON.parse(coverageStr) : null;

  const reactVersion = getMajorVersion(pkg.dependencies?.react);
  const tsVersion = getMajorVersion(pkg.devDependencies?.typescript);
  const viteVersion = getMajorVersion(pkg.devDependencies?.vite);
  const vitestVersion = getMajorVersion(pkg.devDependencies?.vitest);

  const coveragePct = coverageData?.total?.statements?.pct || 0;
  const coverageColor = getCoverageColor(coveragePct);

  // 1. Update README.md Badges
  let readme = readFileSync(README_PATH);
  if (readme) {
    const badges = [
      `[![Version](https://img.shields.io/badge/version-${version}-blue)](VERSION)`,
      `[![Built with React](https://img.shields.io/badge/React-${reactVersion}-61DAFB?logo=react)](https://react.dev)`,
      `[![TypeScript](https://img.shields.io/badge/TypeScript-${tsVersion}-3178C6?logo=typescript)](https://www.typescriptlang.org)`,
      `[![Vite](https://img.shields.io/badge/Vite-${viteVersion}-646CFF?logo=vite)](https://vitejs.dev)`,
      `[![Coverage](https://img.shields.io/badge/coverage-${coveragePct}%25-${coverageColor})](coverage/index.html)`,
    ].join('\n');
    readme = updateFencedSection(readme, 'badges', badges);

    // 2. Update README.md Tech Stack
    const techStack = [
      `| UI Framework | React ${reactVersion} + TypeScript ${tsVersion} |`,
      `| Build Tool | Vite ${viteVersion} |`,
      `| Database | SQLite WASM (FTS5) |`,
      `| Search | Orama 3 |`,
      `| Rich Text | TipTap 2 |`,
      `| Graph | Graphology + Sigma.js |`,
      `| Mind Map | Mind Elixir 5 |`,
      `| Validation | Zod |`,
      `| Icons | Lucide React |`,
      `| Unit Tests | Vitest ${vitestVersion} |`,
      `| E2E Tests | Playwright |`,
    ].join('\n');
    readme = updateFencedSection(readme, 'tech-stack', techStack);
    fs.writeFileSync(README_PATH, readme + '\n');
  }

  // 3. Scan Skills
  if (fs.existsSync(SKILLS_DIR)) {
    const skillDirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('_'))
      .map(dirent => path.join(SKILLS_DIR, dirent.name));

    const skills = skillDirs.map(extractSkillMetadata).filter(Boolean);
    skills.sort((a, b) => a.name.localeCompare(b.name));

    // 4. Update AGENTS.md Skills
    let agentsMd = readFileSync(AGENTS_MD_PATH);
    if (agentsMd) {
      const skillList = skills.map(s => `- \`${s.name}\`: ${s.description.substring(0, 100)}${s.description.length > 100 ? '...' : ''}`).join('\n');
      agentsMd = updateFencedSection(agentsMd, 'skills', skillList);
      fs.writeFileSync(AGENTS_MD_PATH, agentsMd + '\n');
    }

    // 5. Update .agents/skills/README.md Skills Table
    let skillsReadme = readFileSync(SKILLS_README_PATH);
    if (skillsReadme) {
      const skillsTable = skills.map(s => `| [\`${s.name}/\`](${s.name}/) | ${s.description} |`).join('\n');
      skillsReadme = updateFencedSection(skillsReadme, 'skills-table', skillsTable);
      fs.writeFileSync(SKILLS_README_PATH, skillsReadme + '\n');
    }
  }

  console.log('Documentation updated successfully!');
}

main().catch(err => {
  console.error('Error updating documentation:', err);
  process.exit(1);
});
