# 云打印（芯烨云 / Xprinter Cloud）

订单提交后，后端自动把后厨小票发到商家绑定的云打印机。整条链路在
后端完成，密钥不进浏览器。

## 架构

```
顾客扫码下单 (app/menu/[tenant]/page.tsx)
   └─ createOrder() 写入 Supabase orders 表
   └─ fire-and-forget POST /api/print { orderId }     ← 不阻塞下单
            │
            ▼
   /api/print (lib/xpyun.ts + service-role 读取)
   ├─ 用 service role 读订单 + 该店 printer_sn / 开关 / 联数
   ├─ buildReceipt() 拼小票（<C>居中 <BOLD>加粗 <BR>换行 …）
   └─ sha1(user+UserKEY+ts) 签名 → POST open.xpyun.net/.../print
```

- 开发者凭证 `XPYUN_USER` / `XPYUN_KEY` 是**我们全局一个账号**，放后端 env。
- 每家店把自己的打印机 **SN** 存在 `tenants.printer_sn`（私有，RLS 保护）。
- 打印失败/未配置**绝不影响下单** —— `/api/print` 永远快速返回。

## 一次性配置

1. **跑 SQL**：Supabase → SQL Editor → 运行 `supabase/printers.sql`
   （给 tenants 加 `printer_sn` / `print_enabled` / `print_copies`）。
2. **填 env**（`.env.local`，本地；线上同样配到部署平台）：
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase → Settings → API → `service_role`
   - `XPYUN_USER` / `XPYUN_KEY` — admin.xpyun.net → 开发者中心
3. 重启 `npm run dev`。

## 打印机到货后（按 SN 操作，约 2 分钟）

机器标签上找到 **SN**。下面 `<SLUG>` 换成商家 slug，`<SN>` 换成序列号。

```bash
# 1) 注册并绑定打印机到这家店（成功后自动写入 tenants.printer_sn）
curl -X POST localhost:3100/api/print \
  -H 'Content-Type: application/json' \
  -d '{"register":true,"slug":"<SLUG>","sn":"<SN>","name":"<SLUG> 后厨"}'

# 2) 查状态（确认在线、有纸）
curl -X POST localhost:3100/api/print \
  -H 'Content-Type: application/json' -d '{"status":true,"slug":"<SLUG>"}'

# 3) 打一张测试小票
curl -X POST localhost:3100/api/print \
  -H 'Content-Type: application/json' -d '{"test":true,"slug":"<SLUG>"}'
```

看到测试小票吐出来 = 全链路通。之后真实下单会自动出单。

## 返回码

`/api/print` 返回 `{ ok, printed?, code, msg, reason? }`：

- `code === 0` → 芯烨云已受理（成功）。
- `printed:false, reason:"no_printer"` → 这家店还没绑 SN。
- `printed:false, reason:"disabled"` → 商家关了自动出单（`print_enabled=false`）。
- `printed:false, reason:"xpyun_not_configured"` → env 没填凭证。

## TODO（后续可加）

- 后台「设置」页加打印机绑定/测试按钮（现在用 curl）。
- 打印失败重试 + 失败告警。
- 出单回调 `backurlFlag`（确认实际打印成功，非仅受理）。
