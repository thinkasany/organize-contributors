const axios = require("axios");
const fs = require("fs");
const { Octokit } = require("@octokit/core");
const puppeteer = require("puppeteer");

/** 生成数组 **/
const outputArray = async payload => {
  const { orgName, limitNumber, excludesList } = payload;
  const apiUrl = `https://api.github.com/orgs/${orgName}/repos`;
  const repos = []
  const reposResponse = await axios.get(apiUrl);
  if (reposResponse.status === 200) {
    const repositories = reposResponse.data;
    repositories.forEach(repo => {
      if (!repo.fork) {
        repos.push(repo.full_name)
      }
    });
  } else {
    console.error(`获取repos数据失败。状态码: ${reposResponse.status}`);
  }
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

        if (excludesList.includes(username)) continue; // 给用户提供排除某些用户的功能

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
  return contributorsArray.slice(0, limitNumber);
};

/** 生成图片 */
const outputPng = async contributors => {
  const avatars = contributors.map(i => i.avatar);
  // https://github.com/puppeteer/puppeteer/issues/10729
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: `/usr/bin/google-chrome`,
    args: [
      `--no-sandbox`,
      `--headless`,
      `--disable-gpu`,
      `--disable-dev-shm-usage`
    ]
  });
  const page = await browser.newPage();
  const customStyle = `
    .custom {
        width: 60px;
        height: 60px;
        margin: 1px 1px;
        border-radius: 50%;
    }
    #container {
      padding-bottom: 5px;
    }
`;
  // 创建一个HTML字符串，其中包含多个图片
  const htmlContent = `
    <style>${customStyle}</style>
    <div id="container"> ${avatars
      .map(avatarUrl => `<img src="${avatarUrl}" class="custom" />`)
      .join("")}</div>
`;

  // 设置页面内容
  await page.setContent(htmlContent);

  // 等待加载所有图片
  await page.waitForSelector("img");

  // 修改容器的尺寸和样式
  await page.evaluate(() => {
    const container = document.body; // 或者选择包含所有图片的父元素
    container.style.width = "890px";
  });

  // 获取包含所有图片的容器的尺寸
  const containerSize = await page.evaluate(() => {
    const container = document.getElementById("container");
    const rect = container.getBoundingClientRect();
    return { width: rect.width, height: rect.height + 10 };
  });

  // 设置页面尺寸以适应容器
  await page.setViewport(containerSize);

  // 截取整个页面，包括所有图片
  await page.screenshot({ path: "contributors.png", omitBackground: true });

  await browser.close();
  console.log("PNG文件已保存");
};

/**
 * 返回比对的数据是否有差异，有差异则继续，无差异则中断
 * @returns {boolean}
 */
const diff = (upstream, contributors) => {
  if (upstream.length !== contributors.length) {
    return true;
  }
  for (let i = 0; i < upstream.length; i++) {
    if (upstream[i].username !== contributors[i].username) {
      return true;
    }
  }
  return false;
};

const Action = async payload => {
  const {
    orgName,
    repo,
    owner,
    branch,
    token,
    jsonPath,
    pngPath,
    commitMessage,
    committerName,
    committerEmail,
    limitNumber,
    excludesList
  } = payload;
  console.log("payload in action", payload);
  const octokit = new Octokit({
    auth: token
  });
  console.log("octokit", octokit);
  const contributors = await outputArray({
    orgName,
    limitNumber,
    excludesList
  });
  /** 线上分支的数据 */
  let upstream;
  try {
    const upstreamApi = `https://api.github.com/repos/${owner}/${repo}/contents/${jsonPath}?ref=${branch}`;
    const response = await axios.get(upstreamApi);
    // GitHub返回的内容被Base64编码，需要解码, 解析JSON内容
    upstream = JSON.parse(
      Buffer.from(response.data.content, "base64").toString("utf-8")
    );
    console.log("upstreamApi", upstreamApi);
    console.log("upstream", upstream.length);
  } catch (error) {
    console.error("获取JSON文件失败, 也可能是没有这个文件:", error);
  }

  // 通过比对远端数据是否变化来决定是否继续向下执行
  if (upstream?.length && !diff(upstream, contributors)) {
    console.log("数据没有差异，执行中断");
    return;
  }

  let imageContent;
  try {
    await outputPng(contributors);
    imageContent = fs.readFileSync("contributors.png");
  } catch (error) {
    console.log("图片生成遇到了问题", error);
  }

  // 创建一个 axios 实例，包含共享的请求配置
  const Axios = axios.create({
    baseURL: `https://api.github.com/repos/${owner}/${repo}`,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });

  try {
    // 1. 获取特定分支的最后一次提交 SHA
    const branchResponse = await Axios.get(`/branches/${branch}`);
    const lastCommitSHA = branchResponse.data.commit.sha;
    console.log("lastCommitSHA", lastCommitSHA);

    // 2. 创建 Blobs（base64 编码）
    const createBlob = async (content, encoding) => {
      const blobResponse = await Axios.post("/git/blobs", {
        content: content,
        encoding: encoding
      });
      return blobResponse.data.sha;
    };

    const jsonSHA = await createBlob(
      Buffer.from(JSON.stringify(contributors)).toString("base64"),
      "base64"
    );
    const pngSHA = await createBlob(imageContent.toString("base64"), "base64");

    // 3. 创建一个定义了文件夹结构的树
    const createTree = async (baseTreeSHA, blobs) => {
      const tree = blobs.map(blob => {
        return {
          path: blob.path,
          mode: "100644",
          type: "blob",
          sha: blob.sha
        };
      });

      const treeResponse = await Axios.post("/git/trees", {
        base_tree: baseTreeSHA,
        tree: tree
      });
      return treeResponse.data.sha;
    };

    const treeSHA = await createTree(lastCommitSHA, [
      { path: pngPath, sha: pngSHA },
      { path: jsonPath, sha: jsonSHA }
    ]);
    console.log("treeSHA", treeSHA);

    // 4. 创建提交
    const createCommit = async treeSHA => {
      const commitResponse = await Axios.post("/git/commits", {
        message: commitMessage,
        author: {
          name: committerName,
          email: committerEmail
        },
        parents: [lastCommitSHA],
        tree: treeSHA
      });
      return commitResponse.data.sha;
    };

    const newCommitSHA = await createCommit(treeSHA);

    // 5. 更新分支引用
    await Axios.patch(`/git/refs/heads/${branch}`, {
      sha: newCommitSHA
    });
  } catch (error) {
    console.log("遇到错误", error);
  }

  console.log("files has been committed to the repository.");
};

module.exports = Action;
