const Action = require("./app/action");
const log = require("./app/log");
const core = require("@actions/core");
const github = require("@actions/github");

(async function() {
  try {
    // 获取输入
    const context = github.context;
    const owner = context.repo.owner;
    const repoName = context.repo.repo;
    const orgName = core.getInput("orgName", { required: true });
    const token = core.getInput("github_token", { required: true });
    log.info(`orgName: ${orgName}; repoName: ${repoName}; owner:${owner};`);
    const commitMessage =
      core.getInput("commit_message") || "chore: update contributors [skip ci]"; // git commit message
    const pngPath = core.getInput("png_Path") || "contributors.png";
    const jsonPath = core.getInput("json_path") || "json/data.json";
    const branch = core.getInput("branch") || "master";
    const committerName = core.getInput("committer_name") || "contributors bot";
    const committerEmail =
      core.getInput("committer_email") || "action@gmail.com";

    const payload = {
      orgName,
      repo: repoName,
      owner,
      branch,
      token,
      jsonPath,
      pngPath,
      commitMessage,
      committerEmail,
      committerName
    };
    await Action(payload);
    log.info("organize-contributors Action 成功结束运行！", orgName);
  } catch (error) {
    log.setFailed("错误：", error);
  }
})();
