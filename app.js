import { ethers } from "ethers";
// Wallet signatures authorize direct Hook calls.
const ABI = [
  "error Error(string)", "error Panic(uint256)",
  "error AccessManagedUnauthorized(address caller)", "error AccessManagedRequiredDelay(address caller,uint32 delay)",
  "error AccessManagedInvalidAuthority(address authority)",
  "error NotDynamicFeePool()", "error PoolNotConfigured()", "error InvalidConfig()", "error InvalidTtl()", "error FeeBelowFloor()", "error FeeAboveCap()", "error InvalidMaxFee()", "error EmptyPoke()", "error PremiumExceedsFeeBand()", "error NativeNotSupported()",
  "error RwaConfigRequired()", "error InvalidDayOverride()", "error InvalidSessionHours()", "error TooManyDayOverrides(uint256 count)", "error DstModeDisagreesWithClock()", "error InvalidFloorConfig()", "error ClaimFeeAboveMax()", "error InvalidClaimFee()", "error InvalidRecipient()", "error ProtocolFeeTooLarge(uint24 fee)", "error InvalidCaller()",
  "function flatFee(bytes32) view returns (uint24)",
  "function pokeFloor(bytes32) view returns (uint24)",
  "function maxFee(bytes32) view returns (uint24)",
  "function currentFee(bytes32,bool) view returns (uint24)",
  "function pokeOf(bytes32) view returns (uint24 fee0For1,uint24 fee1For0,uint40 expiry)",
  "function poolAsymmetry(bytes32) view returns (uint24 premiumPips,bool premiumZeroForOne)",
  "function floorConfig(bytes32) view returns (uint24 openFloor,uint24 overnightFloor,uint24 closedFloor,uint8 spikeMult,uint24 closedSpike,uint32 descentWindow,uint24 closeFloor,uint32 closeBefore,uint32 closeAfter)",
  "function setPoolConfig((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks),(uint24 openFloor,uint24 overnightFloor,uint24 closedFloor,uint8 spikeMult,uint24 closedSpike,uint32 descentWindow,uint24 closeFloor,uint32 closeBefore,uint32 closeAfter),uint24 cap)",
  "function sessionAt(bytes32,uint256) view returns (uint8)",
  "function openSec(bytes32) view returns (uint32)", "function closeSec(bytes32) view returns (uint32)", "function dstMode(bytes32) view returns (uint8)",
  "function dayOverride(bytes32,uint256,uint256,uint256) view returns (uint8)",
  "function earlyClose(bytes32,uint256,uint256,uint256) view returns (uint32)",
  "function poolManager() view returns (address)", "function claimFeeBps(bytes32) view returns (uint16)", "function claimFeeRecipient() view returns (address)",
  "function pokeFee(bytes32,uint24,uint24,uint40)", "function clearPoke(bytes32)",
  "function setDayOverrides(bytes32,uint256,uint64)", "function setEarlyClose(bytes32,uint256,uint256,uint256,uint32)",
  "function setDstMode(bytes32,uint8)",
  "function setClaimFeeBps((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks),uint16)",
];
const POOL_MANAGER_ABI = [
  "function extsload(bytes32) view returns (bytes32)",
  "function protocolFeeController() view returns (address)",
  "function setProtocolFee((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks),uint24)",
];

// 仅收录仓库已记录的 Arc 部署池；新增池须先在此白名单中审核登记。
const POOLS = [
  {
    id: "arc-tbtc-tusdc-test", name: "Arc · tBTC / tUSDC · Crypto 测试池", chainId: 5042,
    rpcUrl: "https://rpc.blockdaemon.mainnet.arc.io", kind: "crypto",
    poolId: "0xdc70685fcc54d7f4c83757ad1473c2b375bf8a9bf9cc541966d4c92230b8b253",
    currency0: "0x442fc5b4d43fb7ec18ff8ac0a8fb9fdd2efec0db", currency1: "0x44e90eb500868af9b0b16406f3ce165c90e1e85e",
    fee: 8388608, tickSpacing: 1, hook: "0x0d93bdb104bc302da6cb7210da56fd44c5bb6080",
    currency0Symbol: "tBTC", currency1Symbol: "tUSDC", source: "docs/test-pools/arc.json"
  },
  {
    id: "arc-tqqq-tusdc-rwa", name: "Arc · tQQQ / tUSDC · RWA 测试池", chainId: 5042,
    rpcUrl: "https://rpc.blockdaemon.mainnet.arc.io", kind: "rwa",
    poolId: "0x27205bba6539bd179b00bcf087ee78438166ccc15a91e0e77a2260ce85bcb3ee",
    currency0: "0x32cf5c0025fb19986e83b49a3cbf3c580039d3f5", currency1: "0x44e90eb500868af9b0b16406f3ce165c90e1e85e",
    fee: 8388608, tickSpacing: 1, hook: "0x7049b3d3e87ad5dab65caf2a7834e9b7bf582080",
    currency0Symbol: "tQQQ", currency1Symbol: "tUSDC", source: "arc-rwa-test-pool-2026-10-02"
  },
  {
    id: "arc-tcrcl-tusdc-rwa", name: "Arc · tCRCL / tUSDC · RWA 测试池", chainId: 5042,
    rpcUrl: "https://rpc.blockdaemon.mainnet.arc.io", kind: "rwa",
    poolId: "0x83a448d087ffff53e430fa3840f7ae57b4a691258df00b2f5e1e8e8c0451d557",
    currency0: "0x44e90eb500868af9b0b16406f3ce165c90e1e85e", currency1: "0xf933e55b1fd15089582f97bcaa2ef1e4539cf0d0",
    fee: 8388608, tickSpacing: 1, hook: "0x7049b3d3e87ad5dab65caf2a7834e9b7bf582080",
    currency0Symbol: "tUSDC", currency1Symbol: "tCRCL", source: "docs/test-pools/arc.json"
  }
];

const $ = (id) => document.getElementById(id);
const value = (id) => $(id).value.trim();
const numberValue = (id) => { if ($(id).hasAttribute("data-bp")) { const raw = value(id); if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw new Error("费率必须为非负数，最多两位小数（bp）"); const [whole, fraction = ""] = raw.split("."); return BigInt(whole) * 100n + BigInt(fraction.padEnd(2,"0")); } const raw = value(id); if (raw === "") throw new Error(`请填写 ${id}`); if (!/^\d+$/.test(raw)) throw new Error(`${id} 必须为非负整数`); return BigInt(raw); };
const integerValue = (id) => { const raw = value(id); if (!/^\d+$/.test(raw)) throw new Error(`${id} 必须为非负整数`); return BigInt(raw); };
let walletAdapter;
export function setWalletAdapter(adapter) { walletAdapter = adapter; }

function isAddress(v) { return /^0x[a-fA-F0-9]{40}$/.test(v); }
function isPoolId(v) { return /^0x[a-fA-F0-9]{64}$/.test(v); }
function poolKind() { return value("poolKind"); }
function target() {
  const hook = value("hook"), poolId = value("poolId");
  if (!isAddress(hook)) throw new Error("请填写有效的 Hook 地址");
  if (!isPoolId(poolId)) throw new Error("请填写有效的 32-byte Pool ID");
  return { hook, poolId };
}
function poolKey() {
  const { hook } = target();
  const currency0 = value("currency0"), currency1 = value("currency1");
  if (!isAddress(currency0) || !isAddress(currency1)) throw new Error("池币种地址无效");
  return { currency0, currency1, fee: Number(value("keyFee")), tickSpacing: Number(value("tickSpacing")), hooks: hook };
}
function contract() {
  const { hook } = target();
  return new ethers.Contract(hook, ABI, new ethers.JsonRpcProvider(value("rpcUrl")));
}
function nowLabel() { return new Date().toLocaleTimeString("zh-CN", { hour12:false }); }
function log(message, type = "info") { const li = document.createElement("li"); li.innerHTML = `<time>${nowLabel()}</time>${escapeHtml(message)}`; if(type === "error") li.style.color = "#ff9a9a"; $("activityLog").prepend(li); }
function escapeHtml(v) { return String(v).replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[ch])); }
function toast(message) { const node = $("toastTemplate").content.firstElementChild.cloneNode(true); node.textContent = message; document.body.append(node); setTimeout(() => node.remove(), 3800); }
function short(a) { return `${a.slice(0,6)}…${a.slice(-4)}`; }
function fmtPips(v) { return `${v.toString()} pips · ${(Number(v) / 100).toLocaleString(undefined,{maximumFractionDigits:2})} bp`; }
function toUnixLabel(seconds) { const n = Number(seconds); return n ? new Date(n * 1000).toLocaleString("zh-CN", {hour12:false,timeZone:"Asia/Shanghai"}) : "无临时调整"; }
function setBusy(button, busy) { button.disabled = busy; button.dataset.label ||= button.textContent; button.textContent = busy ? "等待钱包确认…" : button.dataset.label; }

const ERROR_HINTS = {
  AccessManagedUnauthorized: "当前钱包没有该操作所需的 AccessManager 权限。",
  AccessManagedRequiredDelay: "当前钱包有权限，但该操作仍在 AccessManager 延迟期内。",
  PoolNotConfigured: "该 Pool ID 尚未在 Hook 中配置。",
  InvalidTtl: "TTL 必须大于 0 且不超过 72 小时。",
  FeeBelowFloor: "请求费率低于当前允许的 poke 下限。",
  FeeAboveCap: "请求费率高于该池费率上限。",
  EmptyPoke: "两个方向不能同时写入 0；请使用清除覆盖。",
  InvalidDayOverride: "特殊交易日状态或日期参数无效。",
  InvalidSessionHours: "提前收盘时间必须在有效开盘和常规收盘之间，且交易时段至少 3 小时。",
  TooManyDayOverrides: "单月最多设置 10 个特殊交易日。",
  DstModeDisagreesWithClock: "固定时区模式必须与当前 AUTO 时钟一致。",
  ClaimFeeAboveMax: "claim fee 不能高于 2000 bps（20%）。",
  InvalidClaimFee: "claim fee 收款人尚未初始化，或配置无效。",
  InvalidRecipient: "收款地址不能是零地址、Hook 或 PoolManager。",
  ProtocolFeeTooLarge: "protocol fee 每个方向不能高于 1000 pips（0.1%）。",
  InvalidCaller: "当前钱包不是 PoolManager 的 protocolFeeController。",
};
function errorDataCandidates(error) {
  const values = [], seen = new Set();
  const visit = (item, depth = 0) => {
    if (item == null || depth > 5 || seen.has(item)) return;
    if (typeof item === "string") { if (/^0x[0-9a-fA-F]{8,}$/.test(item)) values.push(item); return; }
    if (typeof item !== "object") return;
    seen.add(item);
    ["data", "error", "info", "cause", "originalError", "response", "body"].forEach((key) => visit(item[key], depth + 1));
  };
  visit(error);
  return [...new Set(values)];
}
function formatErrorArgument(value) {
  if (typeof value === "bigint") return value.toString();
  return String(value);
}
function decodeContractError(error) {
  const iface = new ethers.Interface(ABI);
  for (const data of errorDataCandidates(error)) {
    try {
      const decoded = iface.parseError(data);
      if (!decoded) continue;
      if (decoded.name === "Error") return decoded.args[0];
      if (decoded.name === "Panic") return `Solidity Panic(${decoded.args[0].toString()})`;
      const args = decoded.fragment.inputs.map((input, index) => `${input.name || `arg${index}`}=${formatErrorArgument(decoded.args[index])}`).join(", ");
      return `${decoded.name}${args ? `(${args})` : ""}${ERROR_HINTS[decoded.name] ? `：${ERROR_HINTS[decoded.name]}` : ""}`;
    } catch { /* Continue through wallet/RPC error wrappers until a valid ABI payload is found. */ }
  }
  if (error?.receipt?.status === 0) return "交易已被链上回滚；该钱包/RPC 未返回 revert data。";
  return error?.shortMessage || error?.reason || error?.info?.error?.message || error?.message || String(error);
}
function errorTransactionHash(error) {
  return error?.receipt?.hash || error?.transactionHash || error?.transaction?.hash || error?.info?.transactionHash;
}

function showKind() {
  const rwa = poolKind() === "rwa";
  $("sessionMetric").classList.toggle("hidden", !rwa);
  $("calendarAdminSection").classList.toggle("hidden", !rwa);
  $("rwaConfigCard").classList.toggle("hidden", !rwa);
}
function renderPoolSummary(pool) {
  const fields = [["网络", `Arc · Chain ${pool.chainId}`], ["类型", pool.kind === "rwa" ? "RWA / Calendar" : "Crypto / Flat"], ["记录来源", pool.source], ["Pool ID", pool.poolId], ["Hook", pool.hook], ["PoolKey", `${pool.currency0Symbol} / ${pool.currency1Symbol} · fee ${pool.fee} · tick ${pool.tickSpacing}`]];
  $("poolSummary").innerHTML = fields.map(([k,v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join("");
}
function renderConfigSnapshot(fields, loadingMessage = "") {
  $("configSnapshot").innerHTML = fields.map(([k,v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join("");
  $("stateLoading").textContent = loadingMessage;
}
function setRwaConfigInputs(fc, cap) {
  const fields = ["openFloor", "overnightFloor", "closedFloor", "spikeMult", "closedSpike", "descentWindow", "closeFloor", "closeBefore", "closeAfter"];
  fields.forEach((field) => { $(field).value = fc[field].toString(); });
  $("rwaMaxFee").value = cap.toString();
}
function selectPool() {
  const pool = POOLS.find((entry) => entry.id === value("poolPreset"));
  if (!pool) return;
  const values = {rpcUrl:pool.rpcUrl,chainId:pool.chainId,hook:pool.hook,poolId:pool.poolId,currency0:pool.currency0,currency1:pool.currency1,keyFee:pool.fee,tickSpacing:pool.tickSpacing,poolKind:pool.kind};
  Object.entries(values).forEach(([id, entry]) => { $(id).value = entry; });
  calendarReadVersion++;
  clearSelectedCalendarState();
  $("dstModeCurrent").textContent = "读取后显示";
  $("dstModeInput").value = "";
  renderPoolSummary(pool); showKind(); updateDirections();

  log(`已选择 ${pool.name}。`);
  $("stateUpdated").textContent = "正在自动读取…";
  renderConfigSnapshot([], "正在通过 Arc RPC 获取当前参数…");
  void loadState();
}
function initialisePools() {
  $("poolPreset").replaceChildren(...POOLS.map((pool) => {
    const option = document.createElement("option"); option.value = pool.id; option.textContent = pool.name; return option;
  }));
  selectPool();
}
async function switchNetwork() {
  try {
    if (!walletAdapter?.connected) { walletAdapter?.openConnect(); return; }
    await walletAdapter.switchChain();
  } catch (error) { reportError("切换网络失败", error); }
}
function updateDirections() {
  const pool = POOLS.find((entry) => entry.id === value("poolPreset"));
  const c0 = pool?.currency0Symbol || "currency0", c1 = pool?.currency1Symbol || "currency1";
  $("direction0Label").textContent = `${c0} → ${c1}`;
  $("direction1Label").textContent = `${c1} → ${c0}`;
}

const DAY_OVERRIDE_LABELS = ["默认日历（NONE）", "全天关闭（FORCE_CLOSED）", "全天开放（FORCE_OPEN）"];
const DST_MODE_LABELS = ["自动夏令时（AUTO）", "固定冬令时（FIXED_EST · UTC−5）", "固定夏令时（FIXED_EDT · UTC−4）"];
function renderDstMode(mode) {
  $("dstModeCurrent").textContent = DST_MODE_LABELS[Number(mode)] || `未知 (${mode})`;
  $("dstModeInput").value = [0, 1, 2].includes(Number(mode)) ? mode.toString() : "";
}
function calendarLocalDate(timestamp, mode) {
  const millis = Number(timestamp) * 1000;
  const utc = new Date(millis);
  const year = utc.getUTCFullYear();
  const firstSunday = (month) => 1 + (7 - new Date(Date.UTC(year, month, 1)).getUTCDay()) % 7;
  const autoEdt = millis >= Date.UTC(year, 2, firstSunday(2) + 7) && millis < Date.UTC(year, 10, firstSunday(10));
  const offsetHours = Number(mode) === 1 ? 5 : Number(mode) === 2 ? 4 : autoEdt ? 4 : 5;
  const local = new Date(millis - offsetHours * 3600_000);
  return { year: local.getUTCFullYear(), month: local.getUTCMonth() + 1, day: local.getUTCDate(), offsetHours };
}
function calendarDateLabel(date) {
  return `${calendarDateValue(date)}（美东${date.offsetHours == null ? "" : ` UTC−${date.offsetHours}`}）`;
}
function daysInMonth(year, month) {
  const date = new Date(0);
  date.setUTCFullYear(year, month, 0);
  return date.getUTCDate();
}
function calendarDateValue(date) {
  return `${String(date.year).padStart(4,"0")}-${String(date.month).padStart(2,"0")}-${String(date.day).padStart(2,"0")}`;
}
function selectedCalendarDate() {
  const raw = value("calendarDateInput");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error("请选择有效的美东操作日期");
  const [year, month, day] = raw.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) throw new Error("请选择有效的美东操作日期");
  return { year, month, day };
}
let calendarReadVersion = 0;
function clearSelectedCalendarState(message = "读取后显示") {
  $("calendarDate").textContent = value("calendarDateInput") ? `${value("calendarDateInput")}（美东）` : message;
  $("calendarOverride").textContent = message;
  $("calendarEarlyClose").textContent = message;
}
async function loadSelectedCalendarState(initialiseDate = true) {
  const version = ++calendarReadVersion;
  const selectedPool = value("poolPreset");
  clearSelectedCalendarState("读取中…");
  try {
    const { poolId } = target();
    const c = contract();
    if (initialiseDate && !value("calendarDateInput")) {
      const [block, mode] = await Promise.all([c.runner.provider.getBlock("latest"), c.dstMode(poolId)]);
      if (version !== calendarReadVersion || selectedPool !== value("poolPreset")) return;
      $("calendarDateInput").value = calendarDateValue(calendarLocalDate(block.timestamp, mode));
    }
    const date = selectedCalendarDate();
    const [override, early] = await Promise.all([
      c.dayOverride(poolId, date.year, date.month, date.day),
      c.earlyClose(poolId, date.year, date.month, date.day),
    ]);
    if (version !== calendarReadVersion || selectedPool !== value("poolPreset")) return;
    $("calendarDate").textContent = calendarDateLabel(date);
    $("calendarOverride").textContent = DAY_OVERRIDE_LABELS[Number(override)] || `未知 (${override})`;
    $("calendarEarlyClose").textContent = Number(early) ? `美东 ${secondsToClock(early)}` : "无（使用常规收盘）";
  } catch (error) {
    if (version !== calendarReadVersion || selectedPool !== value("poolPreset")) return;
    clearSelectedCalendarState("读取失败，请选择有效日期或刷新重试");
    reportError("所选日期读取失败", error);
  }
}
function secondsToClock(seconds) {
  const n = Number(seconds);
  return `${String(Math.floor(n / 3600)).padStart(2,"0")}:${String(Math.floor(n % 3600 / 60)).padStart(2,"0")}`;
}
function easternClockToSeconds(clock) {
  if (!/^\d{2}:\d{2}$/.test(clock)) throw new Error("请选择有效的美东提前收盘时间");
  const [hour, minute] = clock.split(":").map(Number);
  return BigInt(hour * 3600 + minute * 60);
}
async function readCurrentCalendarState(c, poolId, timestamp, mode) {
  const date = calendarLocalDate(timestamp, mode);
  const [override, early, session] = await Promise.all([
    c.dayOverride(poolId, date.year, date.month, date.day),
    c.earlyClose(poolId, date.year, date.month, date.day),
    c.sessionAt(poolId, timestamp),
  ]);
  return { date, override: Number(override), early: Number(early), session: Number(session) };
}
function renderCurrentCalendarState(state) {
  $("calendarSession").textContent = ["OPEN", "OVERNIGHT", "CLOSED"][state.session] || `UNKNOWN (${state.session})`;
}
function protocolFeeDirections(packed) {
  const packedValue = BigInt(packed);
  return { zeroForOne: packedValue & 0xfffn, oneForZero: packedValue >> 12n };
}
function poolStateSlot(poolId) {
  return ethers.keccak256(ethers.concat([poolId, ethers.zeroPadValue(ethers.toBeHex(6), 32)]));
}
async function protocolFeeAt(manager, poolId) {
  const slot0 = BigInt(await manager.extsload(poolStateSlot(poolId)));
  return (slot0 >> 184n) & 0xffffffn;
}
function renderProtocolAndClaimState({ manager, controller, protocolFee, claimFeeBps, claimRecipient }) {
  const directions = protocolFeeDirections(protocolFee);
  $("protocolManager").textContent = short(manager);
  $("protocolController").textContent = short(controller);
  $("protocol0For1").textContent = fmtPips(directions.zeroForOne);
  $("protocol1For0").textContent = fmtPips(directions.oneForZero);
  $("claimFeeCurrent").textContent = `${claimFeeBps.toString()} bps · ${(Number(claimFeeBps) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
  $("claimFeeRecipient").textContent = claimRecipient === ethers.ZeroAddress ? "未初始化" : short(claimRecipient);

  $("claimFeeBps").value = claimFeeBps.toString();
}

async function loadState() {
  if (poolKind() === "rwa") void loadSelectedCalendarState();
  const selectedPool = value("poolPreset");
  try {
    const { poolId } = target(); const c = contract(true); const timestamp = BigInt(Math.floor(Date.now()/1000));
    const [floor, cap, f0, f1, poke, asym, managerAddress, claimFeeBps, claimRecipient] = await Promise.all([c.pokeFloor(poolId), c.maxFee(poolId), c.currentFee(poolId,true), c.currentFee(poolId,false), c.pokeOf(poolId), c.poolAsymmetry(poolId), c.poolManager(), c.claimFeeBps(poolId), c.claimFeeRecipient()]);
    if (selectedPool !== value("poolPreset")) return;
    const manager = new ethers.Contract(managerAddress, POOL_MANAGER_ABI, new ethers.JsonRpcProvider(value("rpcUrl")));
    const [protocolFee, protocolController] = await Promise.all([protocolFeeAt(manager, poolId), manager.protocolFeeController()]);
    if (selectedPool !== value("poolPreset")) return;
    renderProtocolAndClaimState({ manager: managerAddress, controller: protocolController, protocolFee, claimFeeBps, claimRecipient });
    $("current0For1").textContent = fmtPips(f0); $("current1For0").textContent = fmtPips(f1); $("feeBand").textContent = `${floor} / ${cap}`;
    $("pokeExpiry").textContent = toUnixLabel(poke.expiry); $("pokeValues").textContent = `0→1 ${poke.fee0For1} · 1→0 ${poke.fee1For0}`;
    const shared = [["允许设置的最低费率", fmtPips(floor)], ["最高费率", fmtPips(cap)], ["单方向额外加价", `${fmtPips(asym.premiumPips)} · ${asym.premiumZeroForOne ? $("direction0Label").textContent : $("direction1Label").textContent}`], [$("direction0Label").textContent, fmtPips(f0)], [$("direction1Label").textContent, fmtPips(f1)], ["临时费率（保存值）", `${fmtPips(poke.fee0For1)} / ${fmtPips(poke.fee1For0)}`], ["临时费率到期（北京时间）", toUnixLabel(poke.expiry)]];
    if (poolKind() === "crypto") {
      const flat = await c.flatFee(poolId); if (selectedPool !== value("poolPreset")) return;
      renderConfigSnapshot([...shared, ["平时使用的基础费率（flat）", fmtPips(flat)]], "读取完成；数值来自当前链上状态。");
    }
    if (poolKind() === "rwa") {
      const [fc, session, open, close, dst] = await Promise.all([c.floorConfig(poolId), c.sessionAt(poolId,timestamp), c.openSec(poolId), c.closeSec(poolId), c.dstMode(poolId)]);
      if (selectedPool !== value("poolPreset")) return;
      setRwaConfigInputs(fc, cap);
      renderDstMode(dst);
      const calendarState = await readCurrentCalendarState(c, poolId, timestamp, dst);
      if (selectedPool !== value("poolPreset")) return;
      $("session").textContent = ["OPEN","OVERNIGHT","CLOSED"][Number(session)] || `UNKNOWN (${session})`; $("sessionDetail").textContent = calendarReference(open,close,dst);
      renderCurrentCalendarState(calendarState);
      renderConfigSnapshot([...shared, ["当前 RWA 时段", ["OPEN","OVERNIGHT","CLOSED"][Number(session)] || String(session)], ["日历", calendarReference(open,close,dst)], ["当天特殊交易日", DAY_OVERRIDE_LABELS[calendarState.override] || String(calendarState.override)], ["当天提前收盘", calendarState.early ? `美东 ${secondsToClock(calendarState.early)}` : "无"], ["open / overnight / closed", `${fc.openFloor} / ${fc.overnightFloor} / ${fc.closedFloor} pips`], ["开盘曲线", `spike ${fc.spikeMult} · closedSpike ${fc.closedSpike} · descent ${fc.descentWindow}s`], ["收盘曲线", `floor ${fc.closeFloor} · before ${fc.closeBefore}s · after ${fc.closeAfter}s`]], "读取完成；数值来自当前链上状态。");
    }
    $("stateUpdated").textContent = `链上已读取 · ${nowLabel()}`;
    log("已读取当前池配置、费率与覆盖状态。");
  } catch (error) { if (selectedPool === value("poolPreset")) { $("stateUpdated").textContent = "读取失败"; renderConfigSnapshot([], "无法读取 RPC 或合约状态；请点击刷新重试。"); reportError("读取失败", error); } }
}

async function send(action, button) {
  try {
    const calendarAction = ["forceClosed", "forceOpen", "restoreDefault", "setEarlyClose", "clearEarlyClose"].includes(action);
    if (calendarAction && poolKind() !== "rwa") throw new Error("仅 RWA 池支持日历调整");
    const date = calendarAction ? selectedCalendarDate() : null;
    let dstMode;
    if (action === "setDstMode") {
      if (poolKind() !== "rwa") throw new Error("仅 RWA 池支持夏令时模式调整");
      const raw = value("dstModeInput");
      if (!["0", "1", "2"].includes(raw)) throw new Error("请选择有效的夏令时模式");
      dstMode = Number(raw);
    }
    if (!walletAdapter?.connected) { walletAdapter?.openConnect(); toast("请先在弹窗选择钱包，连接后再提交。"); return; }
    setBusy(button, true);
    const signer = await walletAdapter.getSigner();
    const network = await signer.provider.getNetwork();
    if (network.chainId !== 5042n) throw new Error("请先将钱包切换到 Arc 网络，再提交。");
    const { hook, poolId } = target();
    const c = new ethers.Contract(hook, ABI, signer); let tx;
    if (action === "setDstMode") {
      if (!confirm(`确认将当前池夏令时模式设置为${DST_MODE_LABELS[dstMode]}？该设置影响整个池的日历时间换算；固定模式必须与当前 AUTO 时钟一致。`)) return;
      tx = await c.setDstMode(poolId, dstMode);
    }
    if (action === "poke") { const a=numberValue("fee0For1"), b=numberValue("fee1For0"), ttl=numberValue("ttl"); if(a===0n&&b===0n) throw new Error("两个方向不能同时为 0；清除请使用 clearPoke。"); if(ttl===0n||ttl>259200n) throw new Error("TTL 必须在 1–259200 秒内。"); tx = await c.pokeFee(poolId,a,b,ttl); }
    if (action === "clearPoke") { if (!confirm("确认清除链上双向覆盖并恢复当前自主费率？")) return; tx = await c.clearPoke(poolId); }
    if (action === "setClaimFee") {
      const bps = numberValue("claimFeeBps");
      if (bps > 2000n) throw new Error("claim fee 不能高于 2000 bps（20%）。");
      if (!confirm(`确认将该池 claim fee 分账设置为 ${bps} bps？这会影响之后同步的 LP 手续费分账。`)) return;
      tx = await c.setClaimFeeBps(poolKey(), bps);
    }
    if (action === "setRwaConfig") {
      if (poolKind() !== "rwa") throw new Error("仅 RWA 池支持日历费率配置");
      const cfg = {
        openFloor: integerValue("openFloor"), overnightFloor: integerValue("overnightFloor"), closedFloor: integerValue("closedFloor"),
        spikeMult: integerValue("spikeMult"), closedSpike: integerValue("closedSpike"), descentWindow: integerValue("descentWindow"),
        closeFloor: integerValue("closeFloor"), closeBefore: integerValue("closeBefore"), closeAfter: integerValue("closeAfter"),
      };
      const cap = integerValue("rwaMaxFee");
      if (cfg.openFloor < 100n || cfg.overnightFloor < 100n || cfg.closedFloor < 100n || cap < 100n) throw new Error("open / overnight / closed 与 cap 至少为 100 pips");
      if (cfg.openFloor > cap || cfg.overnightFloor > cap || cfg.closedFloor > cap || cfg.closeFloor > cap) throw new Error("基础费率与 closeFloor 不能超过 maxFee");
      if (cfg.spikeMult > 20n || cfg.descentWindow > 21600n || cfg.closeBefore > 21600n || cfg.closeAfter > 21600n) throw new Error("spikeMult 最大 20；各窗口最大 21,600 秒（6 小时）");
      if (cfg.descentWindow === 0n ? (cfg.spikeMult !== 0n || cfg.closedSpike !== 0n) : (cfg.overnightFloor * cfg.spikeMult <= cfg.openFloor || cfg.closedSpike <= cfg.openFloor)) throw new Error("开盘曲线要求：有 descentWindow 时，两个峰值均须高于 openFloor；无窗口时 spike 与 closedSpike 必须为 0");
      if (cfg.closeFloor === 0n ? (cfg.closeBefore !== 0n || cfg.closeAfter !== 0n) : (cfg.closeFloor < cfg.openFloor || (cfg.closeBefore === 0n && cfg.closeAfter === 0n))) throw new Error("收盘曲线要求：关闭时两个窗口都为 0；启用时 closeFloor ≥ openFloor 且至少一个窗口非 0");
      const signature = "setPoolConfig((address,address,uint24,int24,address),(uint24,uint24,uint24,uint8,uint24,uint32,uint24,uint32,uint32),uint24)";
      tx = await c[signature](poolKey(), cfg, cap);
    }
    if (["forceClosed", "forceOpen", "restoreDefault"].includes(action)) {
      const readOnly = contract();
      if (!confirm(`确认将 ${calendarDateLabel(date)} 设置为${action === "forceClosed" ? "全天关闭" : action === "forceOpen" ? "全天开放" : "默认日历"}？前端会保留同月其他特殊日期。`)) return;
      let packed = 0n;
      const days = daysInMonth(date.year, date.month);
      const overrides = await Promise.all(Array.from({ length: days }, (_, index) => readOnly.dayOverride(poolId, date.year, date.month, index + 1)));
      overrides.forEach((entry, index) => { packed |= BigInt(entry) << BigInt(index * 2); });
      const shift = BigInt((date.day - 1) * 2);
      packed &= ~(3n << shift);
      const state = action === "forceClosed" ? 1n : action === "forceOpen" ? 2n : 0n;
      packed |= state << shift;
      tx = await c.setDayOverrides(poolId, date.year * 100 + date.month, packed);
    }
    if (action === "setEarlyClose" || action === "clearEarlyClose") {
      const closeSec = action === "clearEarlyClose" ? 0n : easternClockToSeconds(value("earlyCloseTime"));
      if (!confirm(`确认${action === "clearEarlyClose" ? "清除" : `将`} ${calendarDateLabel(date)}${action === "clearEarlyClose" ? "的提前收盘设置" : `设置为美东 ${value("earlyCloseTime")} 提前收盘`}？`)) return;
      tx = await c.setEarlyClose(poolId, date.year, date.month, date.day, closeSec);
    }
    setBusy(button,true); log(`${action} 已提交：${tx.hash}`); toast("交易已提交，等待链上确认。"); const receipt = await tx.wait(); log(`${action} 成功确认：${receipt.hash}`); toast("链上交易已确认。"); await loadState();
  } catch (error) { reportError(`${action} 失败`, error); } finally { setBusy(button,false); }
}

function reportError(prefix, error) {
  const message = decodeContractError(error);
  const hash = errorTransactionHash(error);
  const suffix = hash ? ` · tx ${hash}` : "";
  log(`${prefix}：${message}${suffix}`, "error");
  toast(`${prefix}：${message.slice(0,120)}`);
}

// Read-only reference matches the contract's UTC-date AUTO transition rules.
function clockFromSeconds(seconds) {
 const n=Number(seconds);return String(Math.floor(n/3600)).padStart(2,"0")+":"+String(Math.floor(n%3600/60)).padStart(2,"0");
}
function calendarReference(open,close,mode) {
 const now=new Date(),year=now.getUTCFullYear();
 const sunday=(month)=>1+(7-new Date(Date.UTC(year,month,1)).getUTCDay())%7;
 const summer=now.getTime()>=Date.UTC(year,2,sunday(2)+7)&&now.getTime()<Date.UTC(year,10,sunday(10));
 const offset=Number(mode)===1?5:Number(mode)===2?4:summer?4:5;
 const bj=(sec)=>{const n=Number(sec)+(8+offset)*3600;return clockFromSeconds(n%86400)+(n>=86400?"（次日）":"（同日）");};
 return "美东 "+clockFromSeconds(open)+"–"+clockFromSeconds(close)+"；北京 "+bj(open)+"–"+bj(close)+"；"+(Number(mode)===0?"自动夏令时":"固定时差")+"。常规时段仅供参照，休市和提前收盘以链上日历为准。";
}
$("calendarDateInput").addEventListener("change", () => { void loadSelectedCalendarState(false); });
$("loadButton").addEventListener("click",loadState); $("poolPreset").addEventListener("change",selectPool); $("switchNetwork").addEventListener("click",switchNetwork); ["currency0","currency1"].forEach(id=>$(id).addEventListener("input",updateDirections)); $("clearLog").addEventListener("click",()=>$("activityLog").replaceChildren());
document.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", () => { const action = button.dataset.action; return send(action, button); }));
function updatePipsHint(id) {
  try {
    const pips = numberValue(id);
    $(id + "Pips").textContent = `${value(id)} bp = ${pips} pips${pips === 0n ? "（该方向沿用自主费率）" : ""}`;
  } catch {
    $(id + "Pips").textContent = "请输入非负 bp 数值，最多两位小数；1 bp = 100 pips。";
  }
}
["fee0For1", "fee1For0"].forEach(id => {
  $(id).addEventListener("input", () => updatePipsHint(id));
  updatePipsHint(id);
});
initialisePools();
