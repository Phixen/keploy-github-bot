import { Context } from "probot";
import { IssueCommentCreatedEvent, WorkflowRunCompletedEvent } from "@octokit/webhooks-types";
import * as yaml from 'yaml';

export async function handleKeployTest(context: Context) {
    const { comment, repository, sender, issue } = context.payload as IssueCommentCreatedEvent;

    const workflow_id = 'keploy-test.yml';
    if (sender.login === "github-actions[bot]") {
        return;
    }
    if (comment.body.includes("/keploy-test")) {
        const welcomeComment = await context.octokit.issues.createComment(context.issue({
            body: "🚀 Initiating Keploy Test...",
        }));

        try {
            // Attempt to dispatch the workflow
            const workflowExists = await context.octokit.actions.getWorkflow({
                owner: repository.owner.login,
                repo: repository.name,
                workflow_id: workflow_id,
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


            await context.octokit.actions.createWorkflowDispatch({
                owner: repository.owner.login,
                repo: repository.name,
                workflow_id: workflow_id,
                ref: pr.data.head.ref, // Ensure this is the correct reference
            });
            await context.octokit.issues.updateComment({
                ...context.repo(),
                comment_id: welcomeComment.data.id,
                body: "🚀 Keploy Test Workflow has been dispatched successfully!",
            });
        } catch (error) {
            console.error('Error:', error);
            await context.octokit.issues.updateComment({
                ...context.repo(),
                comment_id: welcomeComment.data.id,
                body: "❌ Failed to dispatch Keploy Test Workflow. Please check the configuration.",
            });
        }
    }
}

export async function handleWorkflowRunCompleted(context: Context) {
    const { workflow_run, repository } = context.payload as WorkflowRunCompletedEvent;

    if (workflow_run.name !== "Keploy Test" || workflow_run.conclusion !== "success") {
        return;
    }

    const headSha = workflow_run.head_sha;
    // Search for a pull request associated with the head_sha
    const pullRequests = await context.octokit.pulls.list({
        owner: repository.owner.login,
        repo: repository.name,
        state: 'open',
    });

    // Find PR by matching the head SHA
    const pr = pullRequests.data.find((pr) => pr.head.sha === headSha);

    if (!pr) {
        console.log("No associated pull request found for this workflow run.");
        return;
    }

    const artifacts = await context.octokit.actions.listWorkflowRunArtifacts({
        owner: repository.owner.login,
        repo: repository.name,
        run_id: workflow_run.id,
    });

    const reportArtifact = artifacts.data.artifacts.find(
        (artifact) => artifact.name === "keploy-reports"
    );

    if (!reportArtifact) {
        console.log("No reports artifact found");
        return;
    }

    const download = await context.octokit.actions.downloadArtifact({
        owner: repository.owner.login,
        repo: repository.name,
        artifact_id: reportArtifact.id,
        archive_format: "zip",
    });

    const zip = require("adm-zip");
    const admZip = new zip(Buffer.from(download.data as ArrayBuffer));


    if (admZip.getEntries().length === 0) {
        console.log("The downloaded artifact is empty");
        return;
    }

    console.log("AdmZip:", admZip);

    const reportFiles = admZip.getEntries().filter((entry: any) => {
        console.log("Entry:", entry.entryName, "IsDirectory:", entry.isDirectory);
        return !entry.isDirectory && entry.entryName.endsWith('-report.yaml');
    });

    if (reportFiles.length === 0) {
        console.log("No report files found. All entries:", admZip.getEntries().map((e: any) => e.entryName));
        return;
    }
    console.log("Report Files:", reportFiles);
    let reportData: any[] = [];

    reportFiles.forEach((file: any) => {
        const content = yaml.parse(admZip.readAsText(file)) as any;
        console.log(content);
        reportData.push({
            testSet: content.name,
            status: content.status,
            passed: content.success,
            failed: content.failure,
            total: content.total
        });
    });

    console.log("Report Data:", reportData);

    const markdownTable = generateMarkdownTable(reportData);
    console.log(markdownTable);
    await context.octokit.issues.createComment({
        ...context.repo(),
        issue_number: pr.number,
        body: markdownTable,
    });
}

function generateMarkdownTable(data: Array<{ testSet: string; status: string; passed: number; failed: number; total: number; }>): string {
    let table = `| Test Set | Status | Passed | Failed | Total |\n`;
    table += `|:---------|:------:|:------:|:------:|:-----:|\n`;
    data.forEach(row => {
        const statusEmoji = row.status === 'PASSED' ? '✅' : '❌';
        const passedColor = row.passed > 0 ? '**' : '';
        const failedColor = row.failed > 0 ? '**' : '';
        table += `| \`${row.testSet}\` | ${statusEmoji} ${row.status} | ${passedColor}${row.passed}${passedColor} | ${failedColor}${row.failed}${failedColor} | ${row.total} |\n`;
    });
    return `## Test Results\n\n${table}\n\n*Generated by Keploy Test Runner*`;
}
