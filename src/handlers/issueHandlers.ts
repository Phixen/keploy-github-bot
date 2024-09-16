import { Context } from "probot";

export async function handleIssueOpened(context: Context) {
  const issueComment = context.issue({
    body: "Thanks for opening this issue!",
  });
  
  await context.octokit.issues.addLabels(context.issue({
    labels: ["keploy-bot"]
  }));
  
  await context.octokit.issues.createComment(issueComment);
}