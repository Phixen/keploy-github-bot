import { Probot } from "probot";
import { handleIssueOpened } from "./handlers/issueHandlers";
import { handlePullRequestOpened } from "./handlers/pullRequestHandlers";
import { handleKeployTest } from "./handlers/keployTestHandler";
import { handleWorkflowRunCompleted } from "./handlers/keployTestHandler";

export default (app: Probot) => {
  app.log.info("Yay, the app was loaded!!!!");

  // handle issue opened
  app.on("issues.opened", async (context) => handleIssueOpened(context));

  // handle pull request opened
  app.on("pull_request.opened", async (context) => handlePullRequestOpened(context));

  // handle issue comment
  app.on("issue_comment.created", async (context) => {
    const issue = context.payload.issue;
    if (issue.pull_request) {
      handleKeployTest(context);
    }
  });


  app.on("workflow_run.completed", async (context) => {
    console.log("Workflow run completed");
    console.log(context.payload);
    await handleWorkflowRunCompleted(context);
  });
};
