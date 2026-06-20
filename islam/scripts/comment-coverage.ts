#!/usr/bin/env bun
/**
 * Comments on a PR with coverage of changed code.
 *
 * Reads LCOV report from coverage/lcov.info, filters to files changed
 * in the PR (git diff BASE..HEAD), and posts a markdown comment.
 * Updates the existing comment on re-runs using an HTML marker.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

const GITHUB_API = "https://api.github.com";
const COMMENT_MARKER = "<!-- coverage-comment -->";

// === LCOV parsing ===

interface FileCoverage {
  path: string;
  linesFound: number;
  linesHit: number;
  uncoveredLines: number[]; // 1-indexed line numbers
}

function parseLcov(content: string): Map<string, FileCoverage> {
  const files = new Map<string, FileCoverage>();
  let current: FileCoverage | null = null;

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("SF:")) {
      const path = line.slice(3).trim();
      current = {
        path,
        linesFound: 0,
        linesHit: 0,
        uncoveredLines: [],
      };
      files.set(path, current);
    } else if (line === "end_of_record") {
      current = null;
    } else if (current) {
      if (line.startsWith("LF:")) {
        current.linesFound = parseInt(line.slice(3), 10);
      } else if (line.startsWith("LH:")) {
        current.linesHit = parseInt(line.slice(3), 10);
      } else if (line.startsWith("DA:")) {
        const parts = line.slice(3).split(",");
        const lineNum = parseInt(parts[0], 10);
        const hitCount = parseInt(parts[1], 10);
        if (hitCount === 0) {
          current.uncoveredLines.push(lineNum);
        }
      }
    }
  }

  return files;
}

// === Git diff (changed files) ===

async function getChangedFiles(
  baseSha: string,
  headSha: string,
): Promise<string[]> {
  const proc = Bun.spawn(
    ["git", "diff", "--name-only", `${baseSha}..${headSha}`],
    { stdout: "pipe" },
  );
  const output = await new Response(proc.stdout).text();
  await proc.exited;
  return output
    .trim()
    .split("\n")
    .filter(Boolean)
    // Strip "islam/" prefix so paths match LCOV
    .map((p) => p.replace(/^islam\//, ""));
}

// === GitHub API ===

async function findExistingComment(prNumber: string): Promise<number | null> {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) throw new Error("GITHUB_REPOSITORY not set");

  const url = `${GITHUB_API}/repos/${repo}/issues/${prNumber}/comments`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) {
    console.warn(`Failed to fetch comments: ${res.status}`);
    return null;
  }
  const comments = (await res.json()) as Array<{ id: number; body: string }>;
  const existing = comments.find((c) => c.body.includes(COMMENT_MARKER));
  return existing?.id ?? null;
}

async function postComment(prNumber: string, body: string): Promise<void> {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) throw new Error("GITHUB_REPOSITORY not set");

  const url = `${GITHUB_API}/repos/${repo}/issues/${prNumber}/comments`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to post comment: ${res.status} ${text}`);
  }
}

async function updateComment(
  _prNumber: string,
  commentId: number,
  body: string,
): Promise<void> {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) throw new Error("GITHUB_REPOSITORY not set");

  const url = `${GITHUB_API}/repos/${repo}/issues/comments/${commentId}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update comment: ${res.status} ${text}`);
  }
}

// === Comment formatting ===

function formatCoverageComment(
  files: Array<{ path: string; coverage: FileCoverage }>,
  totalLines: number,
  coveredLines: number,
): string {
  const overallPct =
    totalLines === 0 ? 100 : (coveredLines / totalLines) * 100;

  if (files.length === 0) {
    return `${COMMENT_MARKER}
## 📊 Test Coverage

No coverage data for changed files (changed files don't include any tracked source files).

**Overall: ${overallPct.toFixed(1)}%**`;
  }

  const rows = files
    .map(({ path, coverage }) => {
      const pct =
        coverage.linesFound === 0
          ? 100
          : (coverage.linesHit / coverage.linesFound) * 100;
      const uncovered =
        coverage.uncoveredLines.length === 0
          ? "—"
          : coverage.uncoveredLines.map((n) => n.toString()).join(", ");
      return `| \`${path}\` | ${pct.toFixed(1)}% | ${coverage.linesHit}/${coverage.linesFound} | ${uncovered} |`;
    })
    .join("\n");

  return `${COMMENT_MARKER}
## 📊 Test Coverage

| File | Coverage | Lines | Uncovered |
|------|----------|-------|-----------|
${rows}

**Overall: ${overallPct.toFixed(1)}%** of changed code (${coveredLines}/${totalLines} lines covered).`;
}

// === Main ===

async function main() {
  const lcovPath = join(process.cwd(), "coverage", "lcov.info");
  console.log(`Reading coverage from ${lcovPath}`);
  const lcovContent = await readFile(lcovPath, "utf-8");
  const allFiles = parseLcov(lcovContent);
  console.log(`Parsed ${allFiles.size} files from LCOV report`);

  const baseSha = process.env.BASE_SHA;
  const headSha = process.env.HEAD_SHA;
  const prNumber = process.env.PR_NUMBER;

  if (!baseSha || !headSha || !prNumber) {
    throw new Error("BASE_SHA, HEAD_SHA, and PR_NUMBER must be set");
  }

  const changedFiles = await getChangedFiles(baseSha, headSha);
  console.log(`Found ${changedFiles.length} changed files in PR`);

  // Filter to changed files that have coverage data
  const relevant = changedFiles
    .map((path) => {
      const coverage = allFiles.get(path);
      return coverage ? { path, coverage } : null;
    })
    .filter(
      (x): x is { path: string; coverage: FileCoverage } => x !== null,
    );

  // Compute totals
  let totalLines = 0;
  let coveredLines = 0;
  for (const { coverage } of relevant) {
    totalLines += coverage.linesFound;
    coveredLines += coverage.linesHit;
  }

  const body = formatCoverageComment(relevant, totalLines, coveredLines);
  console.log(`Coverage comment prepared for ${relevant.length} files`);

  // Post or update
  const existingId = await findExistingComment(prNumber);
  if (existingId) {
    await updateComment(prNumber, existingId, body);
    console.log(`Updated existing coverage comment (id=${existingId})`);
  } else {
    await postComment(prNumber, body);
    console.log("Posted new coverage comment");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
