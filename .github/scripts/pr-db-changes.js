// noinspection JSUnresolvedReference
// noinspection JSUnusedGlobalSymbols
export async function run ({github, context}) {
  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const pr = context.payload.pull_request;
  const pull_number = pr.number;

  // Fetch changed files in the PR (paginate to be safe)
  const files = await github.paginate(
    github.rest.pulls.listFiles,
    { owner, repo, pull_number, per_page: 100 }
  );

  // Consider only newly added files under the migrations path
  const targetPrefix = 'database/rentec/schema/migrations/';
  const addedMigrations = files.filter(f => f.status === 'added' && f.filename.startsWith(targetPrefix));

  // Prepare Database changes section with stable markers so we can replace it on every run
  const START = "<!-- DATABASE_CHANGES_START -->"
  const END = "<!-- DATABASE_CHANGES_END -->"
  
  // Ensure the label state reflects presence/absence of added migrations
  const labelName = "Database changes"
  const heading = "### " + labelName
  const headSha = pr.head.sha
  const lines = addedMigrations
    .map((f) => {
      const name = f.filename.split("/").pop()
      const url = `https://github.com/${owner}/${repo}/blob/${headSha}/${f.filename}`
      return `- [${name}](${url})`
    })
    .join("\n")

  const section =
    lines.length > 0
      ? `${START}\n${heading}\n\nThis PR adds the following migration files:\n\n${lines}\n\n${END}`
      : ""

  // Get current body and strip any existing section
  const oldBody = pr.body || ""
  const regex = new RegExp(`${START}[\\s\\S]*?${END}`, "g")
  const bodySansDbChanges = oldBody.replace(regex, "").trimEnd()
  const newBody = [bodySansDbChanges, section].filter(Boolean).join("\n\n")

  // Update PR body only if changed
  if (oldBody !== newBody) {
    await github.rest.pulls.update({ owner, repo, pull_number, body: newBody });
  }

  // region labels
  // Read current labels on the PR
  const prLabels = (pr.labels || []).map(l => typeof l === 'string' ? l : l.name);
  const hasLabel = prLabels.includes(labelName);

  if (addedMigrations.length > 0) {
    // Add label (and create if missing) when needed
    if (!hasLabel) {
      await ensureLabelExists();
      await github.rest.issues.addLabels({
        owner,
        repo,
        issue_number: pull_number,
        labels: [labelName]
      });
    }
  } else if (hasLabel) {
    // Remove label if no DB changes remain
    try {
      await github.rest.issues.removeLabel({ owner, repo, issue_number: pull_number, name: labelName });
    } catch (e) {
      // Ignore 404 if label was already removed
      if (e.status !== 404) throw e;
    }
  }

  async function ensureLabelExists() {
    try {
      await github.rest.issues.getLabel({ owner, repo, name: labelName });
    } catch (e) {
      if (e.status === 404) {
        await github.rest.issues.createLabel({
          owner,
          repo,
          name: labelName,
          color: '1778d3',
          description: 'PR introduces database migration files'
        });
      } else {
        throw e;
      }
    }
  }
  // endregion
}
