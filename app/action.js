const axios = require("axios");
const fs = require("fs");

const asyncFunc = async orgName => {
  const apiUrl = `https://api.github.com/orgs/${orgName}/repos`;
  const allRepos = await axios.get(apiUrl);
  const repos = allRepos.data.map(i => i.full_name);
  console.log(repos);
  const mergedContributors = {}; // 合并后的贡献者数据
  for (const repo of repos) {
    try {
      // 发送请求获取贡献者数据
      const response = await axios.get(
        `https://api.github.com/repos/${repo}/contributors`,
        {
          params: {
            per_page: 100 // 每页返回 100 条数据
          }
        }
      );
      const contributors = response.data;
      //   console.log(contributors);

      // 遍历贡献者数据
      for (const contributor of contributors) {
        const username = contributor.login; // 贡献者的用户名
        const contributions = contributor.contributions; // 贡献次数
        const avatar = contributor.avatar_url;
        // console.log(contributor);
        // 如果该贡献者已存在于合并后的贡献者数据中，则累加贡献次数
        if (mergedContributors[username]) {
          mergedContributors[username] = {
            ...mergedContributors[username],
            contributions:
              contributions + mergedContributors[username].contributions
          };
        } else {
          // 否则，将该贡献者添加到合并后的贡献者数据中
          mergedContributors[username] = {
            username,
            contributions,
            avatar
          };
        }
      }
    } catch (error) {
      console.error(`Error retrieving contributors for ${repo}:`, error);
    }
  }
  // 将对象转换为数组
  const contributorsArray = Object.values(mergedContributors);
  // 根据 contributions 属性从大到小排序
  contributorsArray.sort((a, b) => b.contributions - a.contributions);
  return contributorsArray;
};

export const Action = async orgName => {
  const contributors = await asyncFunc(orgName);
  console.log(contributors, contributors.length);
  const jsonStr = JSON.stringify(contributors, null, 2);

  // 写入 JSON 文件
  fs.writeFile("data.json", jsonStr, "utf8", err => {
    if (err) {
      console.error("Error writing JSON file:", err);
    } else {
      console.log("JSON file has been saved.");
    }
  });
};
