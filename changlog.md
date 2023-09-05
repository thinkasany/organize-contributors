# 2023.9.4

1. 许用户指定最多生成 limit_number 个 contributors，比如参数 `limit_number: "200"`
2. 允许排除某些用户，比如参数 `excludes_list: "ImgBotApp, github-actions[bot]"`
3. 默认邮箱用 actions@github.com
4. fix: 没有修改变化的空提交
5. fix: excludes_list trim


[根据issue建议优化](https://github.com/thinkasany/organize-contributors/issues/3)

# 2023.9.5

修复功能: 
1. [fix: upstream is undefined](https://github.com/thinkasany/organize-contributors/pull/7)
2. 过滤 fork 的仓库统计，避免影响到原仓库的开发者 [fix: remove fork's repo statistics ](https://github.com/thinkasany/organize-contributors/pull/8)
