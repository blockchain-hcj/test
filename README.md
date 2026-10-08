# 测试池费率管理

独立前端仓库，从 `cetus/univ4/fee-admin` 迁出。不依赖合约仓库、Redis 或后端。

支持 Arc（Chain ID 5042）的 tBTC/tUSDC、tQQQ/tUSDC、tCRCL/tUSDC 三个池。自动读取链上参数；测试人员可调整双向临时费率、TTL，以及 RWA 指定日期日历状态。1 bp = 100 pips，输入旁实时显示换算。

## 部署给同事：GitHub Pages

首次部署需仓库管理员完成一次设置：

1. 打开 <https://github.com/blockchain-hcj/test/settings/pages>。
2. 在 **Build and deployment → Source** 选择 **GitHub Actions**。
3. 打开 **Actions → Deploy fee console**。若第一次因尚未启用 Pages 而失败，点 **Re-run all jobs**，或 **Run workflow**。
4. 成功后把 <https://blockchain-hcj.github.io/test/> 发给同事，以部署任务实际输出地址为准。

未启用 Pages 或工作流失败时，不表示已经上线。公开仓库可使用 GitHub Free 的 Pages；私有仓库需确认账户方案支持。后续推送到 `main` 自动更新。

工作流只发布构建后的 `dist`，不发布源码、依赖目录或原合约仓库。网页通常公开可访问；链上权限限制写入，不限制查看。需要限制网站访问时使用内网或有登录保护的托管配置。

## 可选：Vercel

导入 `blockchain-hcj/test` 仓库，根目录为仓库根目录，Framework 选 **Vite**。`vercel.json` 已配置：安装 `npm ci`，构建 `npm run build`，输出 `dist`。不需要环境变量。

部署成功后分享 Vercel 的 HTTPS 地址。两种托管只选一种即可；只用 Vercel 时可停用 Pages 工作流。不要再使用旧的 `site` 复制命令，当前 `dist` 已包含完整首页和资源。

## 本地开发

建议 Node.js 22：

```bash
npm ci
npm run dev
```

发布版本验证：

```bash
npm run build
npm run preview
```

地址以终端输出为准。`npm start` 构建并通过 Python 3 在 8080 端口提供 `dist`；线上仅发布 `dist`，不运行 `npm start`。请使用 HTTP/HTTPS，不要用 `file://` 打开源码 HTML。

## 钱包与权限

- RainbowKit + wagmi 提供统一弹窗，支持 OKX、MetaMask 与浏览器发现的钱包；当前不提供手机扫码。
- Chrome 安装 OKX 后，点击连接并在插件完成授权。账户菜单可断开再重新选择；插件账户和网络变更会自动同步。刷新后主动连接，不自动恢复所有已授权插件。
- 网页不持有私钥；签名与交易确认在钱包插件内完成。不上传任何 keystore、密码、私钥或秘密 API key。
- 读取不需要连接钱包；写入须拥有合约 `AccessManager` 权限。页面上线不等于链上授权完成。
- Victor、Kiro 的授权需确认链上 Keeper 角色已经生效，不把模拟或授权脚本视为已授权。
- 日历配置钱包可选择美东日期（默认当前合约口径的当天日期），设置全天关闭、全天开放、恢复默认日历、设置或清除提前收盘。页面会自动读取所选日期的特殊交易日、提前收盘配置，并展示当前实时 RWA 时段。

## 测试范围与维护

单边 0 表示该方向使用自主费率；双边 0 拒绝写入，主动恢复使用 `clearPoke`。建议 TTL 7200 秒，合约上限 259200 秒（72 小时）。

修改指定日期的特殊交易日时，前端会重新构造并提交完整月份状态，以保留同月其他已配置日期。

输入校验仅辅助操作，权限、边界和 50% 保护以合约为准；接口读值作参考，验收以 Swap 事件的 fee 为准。本轮不启用自动调费策略。

RPC 与池白名单在 `app.js`，钱包链配置在 `wallet.jsx`，更换 RPC 时两处保持一致。浏览器可见配置不要包含秘密密钥。

依赖由 `package-lock.json` 锁定；当前第三方间接依赖仍有 moderate 审计告警，未视为生产安全审计通过。
