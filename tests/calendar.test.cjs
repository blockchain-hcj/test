const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Exercise the application's read and transaction paths without signing on chain.
const source = fs.readFileSync(new URL('../app.js', `file://${__filename}`), 'utf8')
  .replace('import { ethers } from "ethers";', '')
  .replace('import { NETWORKS } from "./networks.js";', '')
  .replace('export function setWalletAdapter', 'function setWalletAdapter')
  .split('$("calendarDateInput").addEventListener')[0];
function setup(date = '2028-02-29') {
  const elements = {};
  const element = id => elements[id] ||= { value: '', textContent: '', dataset: {} };
  const calls = [], confirmations = [], errors = [];
  const poolId = '0x' + '2'.repeat(64);
  Object.entries({ calendarDateInput: date, poolKind: 'rwa', poolPreset: 'rwa-test',
    chainId: '5042', hook: '0x' + '1'.repeat(40), poolId, earlyCloseTime: '13:00' })
    .forEach(([id, value]) => { element(id).value = value; });
  const tx = { hash: '0xtest', wait: async () => ({ hash: '0xtest' }) };
  const reader = {
    dayOverride: async (...args) => { calls.push(['readOverride', ...args]); return args[3] === 1 ? 2n : 0n; },
    earlyClose: async () => 0n,
    dstMode: async () => 0n,
    runner: { provider: { getBlock: async () => ({ timestamp: Date.parse('2026-10-08T02:00:00Z') / 1000 }) } },
  };
  const writer = {
    setDstMode: async (...args) => { calls.push(['writeDstMode', ...args]); return tx; },
    setDayOverrides: async (...args) => { calls.push(['writeOverride', ...args]); return tx; },
    setEarlyClose: async (...args) => { calls.push(['writeEarly', ...args]); return tx; },
  };
  const context = vm.createContext({ document: { getElementById: element },
    ethers: { Contract: function () { return writer; } }, reader, errors,
    confirm: message => { confirmations.push(message); return true; } });
  vm.runInContext(fs.readFileSync(new URL('../networks.js', `file://${__filename}`), 'utf8').replace('export const', 'const'), context);
  vm.runInContext(source, context);
  vm.runInContext(`contract = () => reader; loadState = async () => {};
    toast = () => {}; log = () => {}; reportError = (prefix, error) => errors.push(error.message);
    setWalletAdapter({ connected: true, getSigner: async () => ({ provider: { getNetwork: async () => ({ chainId: 5042n }) } }) });`, context);
  return { context, calls, confirmations, errors, element, reader, poolId,
    run: code => vm.runInContext(code, context),
    send: action => vm.runInContext(`send("${action}", { dataset: {}, textContent: "submit" })`, context) };
}

test('selected month/day is submitted and other days are preserved for all override actions', async () => {
  for (const [action, state] of [['forceClosed', 1n], ['forceOpen', 2n], ['restoreDefault', 0n]]) {
    const app = setup('2028-02-29');
    await app.send(action);
    assert.deepEqual(app.calls.find(call => call[0] === 'writeOverride'),
      ['writeOverride', app.poolId, 202802, 2n | (state << 56n)]);
    assert.equal(app.calls.filter(call => call[0] === 'readOverride').length, 29);
    assert.match(app.confirmations[0], /2028-02-29/);
    assert.deepEqual(app.errors, []);
  }
});

test('31st of another year/month is packed at its correct bit position', async () => {
  const app = setup('2027-12-31');
  await app.send('forceOpen');
  assert.deepEqual(app.calls.find(call => call[0] === 'writeOverride'),
    ['writeOverride', app.poolId, 202712, 2n | (2n << 60n)]);
});

test('set and clear early close use the selected date', async () => {
  const app = setup('2027-01-15');
  await app.send('setEarlyClose');
  await app.send('clearEarlyClose');
  assert.deepEqual(app.calls, [
    ['writeEarly', app.poolId, 2027, 1, 15, 46800n],
    ['writeEarly', app.poolId, 2027, 1, 15, 0n],
  ]);
});

test('invalid and empty dates cannot submit transactions', async () => {
  for (const date of ['', '2027-02-29', '2028-02-30', '2026-04-31', '2026-13-01', '0000-01-01']) {
    const app = setup(date);
    await app.send('forceClosed');
    assert.equal(app.calls.length, 0);
    assert.match(app.errors[0], /有效的美东操作日期/);
  }
});

test('initial date follows contract Eastern day rather than browser UTC day', async () => {
  const app = setup('');
  await app.run('loadSelectedCalendarState()');
  assert.equal(app.element('calendarDateInput').value, '2026-10-07');
});

test('selected-date reads display the selected configuration', async () => {
  const app = setup('2027-01-01');
  app.reader.earlyClose = async () => 46800n;
  await app.run('loadSelectedCalendarState()');
  assert.equal(app.element('calendarDateInput').value, '2027-01-01');
  assert.equal(app.element('calendarDate').textContent, '2027-01-01（美东）');
  assert.match(app.element('calendarOverride').textContent, /FORCE_OPEN/);
  assert.equal(app.element('calendarEarlyClose').textContent, '美东 13:00');
});

test('an older date request cannot overwrite the newly selected date', async () => {
  const app = setup('2027-01-01');
  let resolveOld;
  app.reader.dayOverride = async (_pool, _year, _month, day) => day === 1
    ? await new Promise(resolve => { resolveOld = resolve; }) : 1n;
  const oldRequest = app.run('loadSelectedCalendarState()');
  app.element('calendarDateInput').value = '2027-01-02';
  await app.run('loadSelectedCalendarState()');
  resolveOld(2n);
  await oldRequest;
  assert.equal(app.element('calendarDate').textContent, '2027-01-02（美东）');
  assert.match(app.element('calendarOverride').textContent, /FORCE_CLOSED/);
});

test('date captured at submission survives changes during wallet connection', async () => {
  const app = setup('2027-01-15');
  let resolveSigner;
  app.context.signerReady = new Promise(resolve => { resolveSigner = resolve; });
  app.run('setWalletAdapter({ connected: true, getSigner: () => signerReady })');
  const pending = app.send('forceClosed');
  app.element('calendarDateInput').value = '2028-02-29';
  resolveSigner({ provider: { getNetwork: async () => ({ chainId: 5042n }) } });
  await pending;
  assert.deepEqual(app.calls.find(call => call[0] === 'writeOverride'),
    ['writeOverride', app.poolId, 202701, 2n | (1n << 28n)]);
});

test('all DST modes submit for the pool without requiring an operation date', async () => {
  for (const mode of [0, 1, 2]) {
    const app = setup('');
    app.element('dstModeInput').value = String(mode);
    await app.send('setDstMode');
    assert.deepEqual(app.calls, [['writeDstMode', app.poolId, mode]]);
    assert.deepEqual(app.errors, []);
  }
});

test('invalid DST modes and crypto pools cannot submit', async () => {
  for (const mode of ['', '3', '-1', '1.0']) {
    const app = setup();
    app.element('dstModeInput').value = mode;
    await app.send('setDstMode');
    assert.equal(app.calls.length, 0);
    assert.match(app.errors[0], /有效的夏令时模式/);
  }
  const app = setup();
  app.element('poolKind').value = 'crypto';
  app.element('dstModeInput').value = '0';
  await app.send('setDstMode');
  assert.equal(app.calls.length, 0);
  assert.match(app.errors[0], /仅 RWA/);
});

test('DST selection is captured before wallet waits and refresh follows confirmation', async () => {
  const app = setup();
  let resolveSigner;
  app.context.signerReady = new Promise(resolve => { resolveSigner = resolve; });
  app.run('setWalletAdapter({ connected: true, getSigner: () => signerReady }); loadState = async () => reader.refreshed = true');
  app.element('dstModeInput').value = '2';
  const pending = app.send('setDstMode');
  app.element('dstModeInput').value = '1';
  resolveSigner({ provider: { getNetwork: async () => ({ chainId: 5042n }) } });
  await pending;
  assert.deepEqual(app.calls, [['writeDstMode', app.poolId, 2]]);
  assert.equal(app.reader.refreshed, true);
});

test('cancelling DST confirmation does not submit', async () => {
  const app = setup();
  app.element('dstModeInput').value = '0';
  app.context.confirm = () => false;
  await app.send('setDstMode');
  assert.equal(app.calls.length, 0);
});

test('chain DST mode fills the selector and current value', () => {
  const app = setup();
  for (const [mode, label] of [[0, 'AUTO'], [1, 'FIXED_EST'], [2, 'FIXED_EDT']]) {
    app.run(`renderDstMode(${mode}n)`);
    assert.equal(app.element('dstModeInput').value, String(mode));
    assert.ok(app.element('dstModeCurrent').textContent.includes(label));
  }
});

test('BSC PoolKeys match supplied PoolIds and use the correct hooks', async () => {
  const { ethers } = await import('ethers');
  const app = setup();
  const pools = app.run('POOLS.filter(pool => pool.chainId === 56)');
  assert.equal(pools.length, 7);
  for (const pool of pools) {
    assert.equal(pool.fee, 0x800000);
    assert.equal(pool.tickSpacing, ['bsc-tbspy-tusdt', 'bsc-tbcrcl-tusdt'].includes(pool.id) ? 10 : 1);
    assert.ok(BigInt(pool.currency0) < BigInt(pool.currency1));
    const computed = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'address', 'uint24', 'int24', 'address'],
      [pool.currency0, pool.currency1, pool.fee, pool.tickSpacing, pool.hook]));
    assert.equal(computed, pool.poolId, pool.id);
  }
  assert.equal(pools.find(pool => pool.id === 'bsc-bnb-usdt').currency0, ethers.ZeroAddress);
  assert.equal(pools.find(pool => pool.id === 'bsc-wbnb-usdt').currency0Symbol, 'USDT');
});

function selectBsc(app, id = 'bsc-tqqq-tusdt') {
  app.context.pool = app.run(`POOLS.find(pool => pool.id === '${id}')`);
  app.run(`Object.entries({ poolPreset: pool.id, chainId: pool.chainId, poolKind: pool.kind,
    hook: pool.hook, poolId: pool.poolId, currency0: pool.currency0, currency1: pool.currency1,
    keyFee: pool.fee, tickSpacing: pool.tickSpacing }).forEach(([id, v]) => document.getElementById(id).value = String(v));`);
}

test('BSC calendar transactions use the selected Hook and PoolId on chain 56', async () => {
  const app = setup();
  selectBsc(app);
  app.run('setWalletAdapter({ connected: true, chainId: 56, getSigner: async () => ({ provider: { getNetwork: async () => ({ chainId: 56n }) } }) })');
  app.element('dstModeInput').value = '0';
  await app.send('setDstMode');
  assert.deepEqual(app.calls, [['writeDstMode', app.context.pool.poolId, 0]]);
  assert.deepEqual(app.errors, []);
  assert.equal(app.element('networkBadge').textContent, 'BSC 已连接');
});

test('wrong-chain wallets cannot submit for either Arc or BSC', async () => {
  for (const targetChain of [5042, 56]) {
    const app = setup();
    if (targetChain === 56) selectBsc(app);
    app.context.wrongChain = targetChain === 56 ? 5042n : 56n;
    app.run('setWalletAdapter({ connected: true, getSigner: async () => ({ provider: { getNetwork: async () => ({ chainId: wrongChain }) } }) })');
    app.element('dstModeInput').value = '0';
    await app.send('setDstMode');
    assert.equal(app.calls.length, 0);
    assert.match(app.errors[0], targetChain === 56 ? /切换到 BSC/ : /切换到 Arc/);
  }
});

test('network switching follows the selected pool', async () => {
  const app = setup();
  app.context.switches = [];
  app.run('setWalletAdapter({ connected: true, switchChain: async id => switches.push(id) })');
  await app.run('switchNetwork()');
  selectBsc(app);
  await app.run('switchNetwork()');
  assert.deepEqual(Array.from(app.context.switches), [5042, 56]);
});

test('switching pools while the wallet is pending aborts submission', async () => {
  const app = setup();
  selectBsc(app);
  let resolveSigner;
  app.context.signerReady = new Promise(resolve => { resolveSigner = resolve; });
  app.run('setWalletAdapter({ connected: true, getSigner: () => signerReady })');
  app.element('dstModeInput').value = '0';
  const pending = app.send('setDstMode');
  selectBsc(app, 'bsc-qqqb-usdt');
  resolveSigner({ provider: { getNetwork: async () => ({ chainId: 56n }) } });
  await pending;
  assert.equal(app.calls.length, 0);
  assert.match(app.errors[0], /目标池已切换/);
});

test('tbSPY uses tickSpacing 10 and supports calendar transactions', async () => {
  const app = setup();
  selectBsc(app, 'bsc-tbspy-tusdt');
  app.run('setWalletAdapter({ connected: true, getSigner: async () => ({ provider: { getNetwork: async () => ({ chainId: 56n }) } }) })');
  app.element('dstModeInput').value = '0';
  await app.send('setDstMode');
  assert.deepEqual(app.calls, [['writeDstMode', app.context.pool.poolId, 0]]);
  assert.deepEqual(app.errors, []);
  assert.equal(app.run('poolKey().tickSpacing'), 10);
});

test('selecting BSC resets stale state and updates network, directions and PoolKey', () => {
  const app = setup();
  for (const id of ['sessionMetric', 'calendarAdminSection', 'rwaConfigCard']) {
    app.element(id).classList = { toggle() {} };
  }
  app.run('loadState = async () => {}');
  app.element('poolPreset').value = 'bsc-wbnb-usdt';
  app.element('current0For1').textContent = 'old fee';
  app.element('rwaMaxFee').value = 'old cap';
  app.run('selectPool()');
  assert.equal(app.element('chainId').value, '56');
  assert.match(app.element('poolSummary').innerHTML, /BSC · Chain 56/);
  assert.equal(app.element('direction0Label').textContent, 'USDT → WBNB');
  assert.equal(app.element('current0For1').textContent, '—');
  assert.equal(app.element('rwaMaxFee').value, '');
  app.element('poolPreset').value = 'bsc-tbspy-tusdt';
  app.run('selectPool()');
  assert.equal(app.element('tickSpacing').value, '10');
  assert.equal(app.element('stateUpdated').textContent, '正在自动读取…');
  assert.equal(app.element('direction0Label').textContent, 'tbSPY → tUSDT');
});
