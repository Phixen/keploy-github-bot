import { Context } from "probot";

export async function handlePullRequestOpened(context: Context) {
  const issueComment = context.issue({
    body: "Thanks for opening this pull request!",
  });
  
  await context.octokit.issues.createComment(issueComment);
}