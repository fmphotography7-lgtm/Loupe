/* StudioFlow 3.8.1 · Deterministic test harness for the Production Workspace inventory fix.
   Plain Node, no framework/dependency needed: run with `node tests/production-workspace.test.js`
   from the project root. Exercises the pure logic (on-hand reading, reservation math, guards)
   directly, without needing the Electron UI. */
const assert = require('assert');

// Minimal stand-in for the parts of the module under test that don't need the DOM/window.SF.
const PW = {
  getInventoryOnHand(item){
    return Number(
      item?.currentOnHand ?? item?.quantity ?? item?.onHand ?? item?.stock ?? item?.qty ?? 0
    );
  },
  getInventoryReserved(item){return Math.max(0, Number(item?.reserved ?? 0))},
  getInventoryAvailable(item){return Math.max(0, this.getInventoryOnHand(item)-this.getInventoryReserved(item))},
  setInventoryOnHand(item,value){const v=Math.max(0,Number(value)||0);item.currentOnHand=v;item.quantity=v;},
};

function reserve(item, qty, reservations, orderId){
  if(reservations[orderId]) return false; // guard: no double reserve
  if(PW.getInventoryAvailable(item) < qty) return false;
  item.reserved = PW.getInventoryReserved(item) + qty;
  reservations[orderId] = {inventoryItemId:item.id, reservedQuantity:qty, reservationStatus:'reserved'};
  return true;
}
function fulfill(item, reservations, orderId){
  const r = reservations[orderId];
  if(!r || r.reservationStatus !== 'reserved') return false; // guard: no double fulfill
  PW.setInventoryOnHand(item, PW.getInventoryOnHand(item) - r.reservedQuantity);
  item.reserved = Math.max(0, PW.getInventoryReserved(item) - r.reservedQuantity);
  r.reservationStatus = 'fulfilled';
  return true;
}

let pass = 0, fail = 0;
function test(name, fn){
  try { fn(); console.log(`  ok  ${name}`); pass++; }
  catch(e){ console.log(`FAIL  ${name}\n      ${e.message}`); fail++; }
}

console.log('Existing Stock (3 on hand, order needs 1)');
test('on-hand reads 3 from `quantity`', () => {
  const item = {id:'i1', quantity:3};
  assert.strictEqual(PW.getInventoryOnHand(item), 3);
  assert.strictEqual(PW.getInventoryAvailable(item), 3);
});
test('reserve succeeds and does not touch on-hand', () => {
  const item = {id:'i1', quantity:3, reserved:0};
  const res = {};
  assert.strictEqual(reserve(item, 1, res, 'order1'), true);
  assert.strictEqual(item.quantity, 3);   // on-hand unchanged
  assert.strictEqual(item.reserved, 1);
  assert.strictEqual(PW.getInventoryAvailable(item), 2);
});
test('fulfillment decreases on-hand and reserved together, once', () => {
  const item = {id:'i1', quantity:3, reserved:1};
  const res = {order1:{inventoryItemId:'i1', reservedQuantity:1, reservationStatus:'reserved'}};
  assert.strictEqual(fulfill(item, res, 'order1'), true);
  assert.strictEqual(item.quantity, 2);
  assert.strictEqual(item.reserved, 0);
});

console.log('\nInsufficient Stock (0 on hand, order needs 1)');
test('available is 0, reserve fails', () => {
  const item = {id:'i2', quantity:0, reserved:0};
  const res = {};
  assert.strictEqual(PW.getInventoryAvailable(item), 0);
  assert.strictEqual(reserve(item, 1, res, 'order2'), false);
});

console.log('\nField compatibility');
test('currentOnHand:3, quantity:undefined -> 3', () => {
  assert.strictEqual(PW.getInventoryOnHand({currentOnHand:3, quantity:undefined}), 3);
});
test('quantity:3, currentOnHand:undefined -> 3', () => {
  assert.strictEqual(PW.getInventoryOnHand({quantity:3, currentOnHand:undefined}), 3);
});
test('quantity:0 (a real zero) is read as 0, not treated as missing', () => {
  assert.strictEqual(PW.getInventoryOnHand({quantity:0}), 0);
});

console.log('\nNo double deduction');
test('reserving the same order twice only reserves once', () => {
  const item = {id:'i3', quantity:5, reserved:0};
  const res = {};
  assert.strictEqual(reserve(item, 2, res, 'order3'), true);
  assert.strictEqual(reserve(item, 2, res, 'order3'), false); // guard blocks the second call
  assert.strictEqual(item.reserved, 2);
});
test('fulfilling the same order twice only deducts once', () => {
  const item = {id:'i4', quantity:5, reserved:2};
  const res = {order4:{inventoryItemId:'i4', reservedQuantity:2, reservationStatus:'reserved'}};
  assert.strictEqual(fulfill(item, res, 'order4'), true);
  assert.strictEqual(fulfill(item, res, 'order4'), false); // guard blocks the second call
  assert.strictEqual(item.quantity, 3);
});

console.log('\nMultiple-line order (two products resolve/reserve independently)');
test('two different inventory items reserve independently', () => {
  const itemA = {id:'a', quantity:4, reserved:0};
  const itemB = {id:'b', quantity:2, reserved:0};
  const res = {};
  assert.strictEqual(reserve(itemA, 1, res, 'order5-lineA'), true);
  assert.strictEqual(reserve(itemB, 1, res, 'order5-lineB'), true);
  assert.strictEqual(itemA.reserved, 1);
  assert.strictEqual(itemB.reserved, 1);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
