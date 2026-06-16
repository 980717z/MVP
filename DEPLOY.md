# 部署 bentoOS.io 到 Vercel

技术栈：Next.js 14 + Supabase。域名 bentoOS.io 在 Cloudflare，只用它做 DNS。

---

## 1. 代码推到 GitHub

本地已经是 git 仓库并完成首次提交。去 https://github.com/new 建一个**私有**仓库（名字随意，如 `bentoos`），**不要**勾选 "Add README"。建好后它会给你两条命令，在 MVP 目录里跑：

```bash
cd /Users/zeyangwen/Desktop/Alpine/MVP
git remote add origin https://github.com/<你的用户名>/bentoos.git
git branch -M main
git push -u origin main
```

> `.env.local` 已被 .gitignore，Supabase key 不会上传。✓

---

## 2. Vercel 导入项目

1. 用 GitHub 账号登录 https://vercel.com
2. **Add New → Project** → 选刚才那个仓库 → **Import**
3. Framework 会自动识别为 **Next.js**，构建命令默认 `next build`，不用改
4. 展开 **Environment Variables**，加这两条（值在本地 `.env.local` 里）：

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://pxeycsanbttnywimsvlh.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_GQbh3jfVGy4i2B6viBs6tg_B3T0uPia` |

5. **Deploy** → 等 1-2 分钟，会给你一个 `xxx.vercel.app` 临时网址，先用它测一遍能不能登录/建店。

---

## 3. 绑定 bentoOS.io

### Vercel 端
项目 → **Settings → Domains** → 输入 `bentoos.io` → Add。
（同时也加 `www.bentoos.io`，Vercel 会自动把 www 跳转到主域名。）
Vercel 会显示需要的 DNS 记录，类似：
- `A` 记录：`@` → `76.76.21.21`
- `CNAME`：`www` → `cname.vercel-dns.com`

> 以 Vercel 实际显示的为准，可能不同。

### Cloudflare 端（DNS）
进 Cloudflare → 选 bentoos.io → **DNS → Records**，按 Vercel 给的值加记录：

1. **A** `@` → Vercel 给的 IP
2. **CNAME** `www` → `cname.vercel-dns.com`

⚠️ **关键**：每条记录的 **Proxy status 必须设成「DNS only」（灰色云朵）**，不要橙色。
否则 Cloudflare 代理会和 Vercel 的 SSL 打架，出现证书/重定向错误。

DNS 生效后（几分钟到几十分钟），Vercel 会自动签发 HTTPS 证书，bentoOS.io 就上线了。

---

## 4. Supabase 配置生产域名

进 Supabase → **Authentication → URL Configuration**：
- **Site URL** 改成 `https://bentoos.io`
- **Redirect URLs** 加上 `https://bentoos.io/**`（和 `https://*.vercel.app/**` 方便测试）

这样注册/登录的邮件链接、回跳地址才会指向正式域名。

---

## 5. 以后怎么更新

改完代码后只要：
```bash
git add -A && git commit -m "你的改动说明" && git push
```
Vercel 检测到 push 会**自动重新部署**。老板那边什么都不用操作。

---

## 备忘
- 数据库结构在 `supabase/schema.sql`，改表结构时在 Supabase SQL Editor 跑。
- 免费额度：Vercel 个人版免费够用；Supabase 免费版闲置 7 天会暂停，正式运营前建议升级或定期访问。
