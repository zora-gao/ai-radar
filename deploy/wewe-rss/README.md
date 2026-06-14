# 自建 WeWe RSS（覆盖清单里的微信公众号）

微信公众号没有官方 RSS。WeWe RSS 基于「微信读书」接口，把公众号文章转成 RSS/Atom，
用来补齐我们清单里无法从公开服务拿到的 7 个号：

> 硅星人、特工宇宙、字节跳动、阿里云、月之暗面、百度、腾讯

项目地址：https://github.com/cooderl/wewe-rss

---

## 1. 启动服务

```bash
cd ai-news-aggregator/deploy/wewe-rss

# 设置后台登录密码（强随机串），以及对外访问地址
export AUTH_CODE="换成你自己的强随机密码"
export SERVER_ORIGIN_URL="http://localhost:4000"   # 部署到服务器改成你的域名

docker compose up -d
```

启动后访问后台：`http://localhost:4000`，用上面的 `AUTH_CODE` 登录。

## 2. 绑定微信读书账号

后台 →「账号管理」→ 添加账号 → 用**微信扫码**登录一个微信读书账号。
（建议用小号；该账号仅用于拉取公众号文章。）

## 3. 添加这 7 个公众号

后台 →「订阅源」→ 添加。两种方式：
- 直接搜公众号名称添加；或
- 复制该公众号任意一篇文章链接（`https://mp.weixin.qq.com/s/...`）粘贴进去，
  系统会自动识别并订阅整个号。

添加完每个号都会得到一个 **feed id**（在订阅源列表里能看到）。

## 4. 拿到每个号的 RSS 地址

WeWe RSS 的 feed 地址格式：

```
{SERVER_ORIGIN_URL}/feeds/{feedId}.atom    # Atom
{SERVER_ORIGIN_URL}/feeds/{feedId}.rss     # RSS
{SERVER_ORIGIN_URL}/feeds/all.atom         # 全部订阅源聚合
```

例如：`http://localhost:4000/feeds/MP_WXS_xxxxx.atom`

## 5. 接回聚合器

把 7 个号的 feed 地址填到 `src/fetchers/curated.ts` 里对应条目的 `feedUrl`，
并把 `verified` 改成 `true`。对应关系：

| 源 id | 名称 | 替换 feedUrl 为 |
|---|---|---|
| `guixingren`  | 硅星人   | `<你的服务地址>/feeds/<硅星人 feedId>.atom` |
| `tegongyuzhou`| 特工宇宙 | `<你的服务地址>/feeds/<特工宇宙 feedId>.atom` |
| `bytedance`   | 字节跳动 | `<你的服务地址>/feeds/<字节跳动 feedId>.atom` |
| `aliyun`      | 阿里云   | `<你的服务地址>/feeds/<阿里云 feedId>.atom` |
| `moonshot`    | 月之暗面 | `<你的服务地址>/feeds/<月之暗面 feedId>.atom` |
| `baidu`       | 百度     | `<你的服务地址>/feeds/<百度 feedId>.atom` |
| `tencent`     | 腾讯     | `<你的服务地址>/feeds/<腾讯 feedId>.atom` |

> 也可以直接把这张表里的 7 个 feedId 发我，我来替换。

## 安全提示

- `AUTH_CODE` 用强随机串，**只通过环境变量注入**，不要写进代码或提交到 git。
- 部署到公网时建议放在反代后加 HTTPS；feed 地址含订阅信息，避免公开泄露。
- `data/` 目录是 sqlite 数据，做好备份，不要提交到仓库。
