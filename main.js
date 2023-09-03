const Action = require("./app/action");
const log = require("./app/log");
const core = require("@actions/core");

(async function() {
  try {
    // 获取输入
    const orgName = core.getInput("orgName", { required: true });
    await Action(orgName);
    log.info("CordCloud-JS Action 成功结束运行！", orgName);


    // log.warning("CordCloud Action 运行失败！");
  } catch (error) {
    log.setFailed("错误：", error);
  }
})();
