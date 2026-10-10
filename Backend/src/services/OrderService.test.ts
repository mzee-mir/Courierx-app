import { describe, it } from 'node:test';
import assert from 'node:assert';
import { OrderService } from './OrderService';
import { VehicleType } from '../enums/OrderEnums';

describe('OrderService server-side pricing (I8: client-controlled pricing)', () => {
  it('computes zero distance for identical coordinates', () => {
    const d = OrderService.haversineKm([45.3182, 2.0469], [45.3182, 2.0469]);
    assert.ok(d < 0.001);
  });

  it('computes ~5km for Mogadishu port to a known dropoff', () => {
    // Port of Mogadishu (45.3330, 2.0369) to Lido Beach (45.3160, 2.0870) is ~6km
    const d = OrderService.haversineKm([45.3330, 2.0369], [45.3160, 2.0870]);
    assert.ok(d > 4 && d < 8, `expected ~5-6km, got ${d}`);
  });

  it('pricing ignores any client-supplied distance and uses coordinates', () => {
    const r1 = OrderService.calculatePricingForOrder(
      VehicleType.CAR,
      [45.3330, 2.0369],
      [45.3160, 2.0870]
    );
    // Fake distance the client might send is not accepted; server computes from coords.
    const r2 = OrderService.calculatePricing(VehicleType.CAR, 1000);
    assert.notEqual(r1.price, r2.price);
    assert.ok(r1.distanceKm > 4 && r1.distanceKm < 8);
  });

  it('deterministic: same coordinates produce the same price', () => {
    const a = OrderService.calculatePricingForOrder(VehicleType.TRUCK, [45.33, 2.03], [45.31, 2.08]);
    const b = OrderService.calculatePricingForOrder(VehicleType.TRUCK, [45.33, 2.03], [45.31, 2.08]);
    assert.equal(a.price, b.price);
  });

  it('commission is 15% of price', () => {
    const r = OrderService.calculatePricingForOrder(VehicleType.BAJAJ, [45.33, 2.03], [45.32, 2.04]);
    assert.ok(Math.abs(r.commission - r.price * 0.15) < 0.02);
  });
});
