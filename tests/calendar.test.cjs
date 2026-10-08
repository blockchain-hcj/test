const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Exercise the application's read and transaction paths without signing on chain.
const source = fs.readFileSync(new URL('../app.js', `file://${__filename}`), 'utf8')
  .replace('import { ethers } from "ethers";', '')
  .replace('export function setWalletAdapter', 'function setWalletAdapter')
  .split('$("calendarDateInput").addEventListener')[0];
function setup(date = '2028-02-29') {
  const elements = {};
  const element = id => elements[id] ||= { value: '', textContent: '', dataset: {} };
  const calls = [], confirmations = [], errors = [];
  const poolId = '0x' + '2'.repeat(64);
  Object.entries({ calendarDateInput: date, poolKind: 'rwa', poolPreset: 'rwa-test',
    hook: '0x' + '1'.repeat(40), poolId, earlyCloseTime: '13:00' })
    .forEach(([id, value]) => { element(id).value = value; });
  const tx = { hash: '0xtest', wait: async () => ({ hash: '0xtest' }) };
  const reader = {
    dayOverride: async (...args) => { calls.push(['readOverride', ...args]); return args[3] === 1 ? 2n : 0n; },
    earlyClose: async () => 0n,
    dstMode: async () => 0n,
    runner: { provider: { getBlock: async () => ({ timestamp: Date.parse('2026-10-08T02:00:00Z') / 1000 }) } },
  };
  const writer = {
    setDayOverrides: async (...args) => { calls.push(['writeOverride', ...args]); return tx; },
    setEarlyClose: async (...args) => { calls.push(['writeEarly', ...args]); return tx; },
  };
  const context = vm.createContext({ document: { getElementById: element },
    ethers: { Contract: function () { return writer; } }, reader, errors,
    confirm: message => { confirmations.push(message); return true; } });
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
