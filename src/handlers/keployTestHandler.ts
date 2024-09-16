import { Context } from "probot";
import { IssueCommentCreatedEvent, WorkflowRunCompletedEvent } from "@octokit/webhooks-types";

export async function handleKeployTest(context: Context) {
    const { comment, repository, sender, issue } = context.payload as IssueCommentCreatedEvent;
    if (sender.login === "github-actions[bot]") {
        return;
    }
    if (comment.body.includes("/keploy-test")) {
        // Post welcome message with loader
        const welcomeComment = await context.octokit.issues.createComment(context.issue({
            body: "🚀 Welcome to Keploy!\n\n Preparing to generate test cases... This may take a while.",
        }));
        try {
            // check if the workflow file exists in the repository
            const workflowExists = await context.octokit.actions.getWorkflow({
                owner: repository.owner.login,
                repo: repository.name,
                workflow_id: 'main.yml',
            });

            if (!workflowExists) {
                console.log("Workflow file does not exist");
                await context.octokit.issues.updateComment({
                    ...context.repo(),
                    comment_id: welcomeComment.data.id,
                    body: "🚀 Welcome to Keploy Test!\n\n❌ The workflow file 'keploy-test.yml' does not exist in the repository. Please ensure the workflow file exists before running the tests.",
                });
                return;
            }
            const pr = await context.octokit.pulls.get({
                owner: repository.owner.login,
                repo: repository.name,
                pull_number: issue.number,
            });

            const workflow_id = 'main.yml';
            await context.octokit.actions.createWorkflowDispatch({
                owner: repository.owner.login,
                repo: repository.name,
                workflow_id: workflow_id, // Make sure this file exists in .github/workflows/
                ref: pr.data.head.ref,
            });

            await context.octokit.issues.updateComment({
                ...context.repo(),
                comment_id: welcomeComment.data.id,
                body: `🐇 Running Keploy Test Workflow... 🐰 The workflow will add a comment with test results. (Date and time)`,
            });
        } catch (error) {
            console.error('Error:', error);
            return;
        }
    }
}

export async function handleWorkflowRunCompleted(context: Context) {
    const { workflow_run, repository } = context.payload as WorkflowRunCompletedEvent;

    if (workflow_run.name !== "Display Current Date and Time" || workflow_run.conclusion !== "success") {
        return;
    }


    const headSha = workflow_run.head_sha;
    let prNumber: number | null = null;


    // Search for a pull request associated with the head_sha
    const pullRequests = await context.octokit.pulls.list({
        owner: repository.owner.login,
        repo: repository.name,
        state: 'open',
    });

    // Find PR by matching the head SHA
    const pr = pullRequests.data.find((pr) => pr.head.sha === headSha);

    const artifacts = await context.octokit.actions.listWorkflowRunArtifacts({
        owner: repository.owner.login,
        repo: repository.name,
        run_id: workflow_run.id,
    });

    const dateArtifact = artifacts.data.artifacts.find(
        (artifact) => artifact.name === "output"
    );

    if (!dateArtifact) {
        console.log("No output artifact found");
        return;
    }

    const download = await context.octokit.actions.downloadArtifact({
        owner: repository.owner.login,
        repo: repository.name,
        artifact_id: dateArtifact.id,
        archive_format: "zip",
    });

    const zip = require("adm-zip");
    const admZip = new zip(Buffer.from(download.data as ArrayBuffer));
    const dateContent = admZip.readAsText("date.txt");

    if (pr) {
        prNumber = pr.number;
    } else {
        console.log("No associated pull request found for this workflow run.");
        // If no PR is associated, comment on the commit instead
        await context.octokit.repos.createCommitComment({
            owner: repository.owner.login,
            repo: repository.name,
            commit_sha: headSha,
            body: `Workflow output: The workflow completed successfully, but no associated pull request was found.`,
        });
        return;
    }

    // If PR number is present, comment on the PR as before
    await context.octokit.issues.createComment({
        ...context.repo(),
        issue_number: prNumber,
        body: ` 🐰 Keploy Test Workflow output: ${dateContent}`,
    });
}