import { describe, expect, it } from 'vitest';
import {
  bizAOV,
  bizAUR,
  bizBadgeLabel,
  bizBasket,
  bizChannelValue,
  bizCostPerRevenue,
  bizTotalMetric,
  emptyBizChannel,
  formatBizInputValue,
  parseBizInputValue,
  safeDiv,
  type BizState,
} from '../business';

function makeState(overrides: Partial<BizState> = {}): BizState {
  return {
    channelData: { shopee: emptyBizChannel(), tiktok: emptyBizChannel(), tokopedia: emptyBizChannel(), website: emptyBizChannel(), chat: emptyBizChannel() },
    offlineStores: [],
    otherChannels: [],
    shopeeOmzet: { old: null, cur: null },
    ...overrides,
  };
}

describe('safeDiv', () => {
  it('divides normally', () => {
    expect(safeDiv(100, 4)).toBe(25);
  });
  it('returns null for missing operands or division by zero', () => {
    expect(safeDiv(null, 4)).toBeNull();
    expect(safeDiv(100, 0)).toBeNull();
    expect(safeDiv(100, null)).toBeNull();
  });
});

describe('bizChannelValue', () => {
  it("falls back to Shopee's omzet input when the channel's own revenue is empty", () => {
    const state = makeState({ shopeeOmzet: { old: 5_000_000, cur: 6_000_000 } });
    expect(bizChannelValue(state, 'shopee', 'revenue', 'old')).toBe(5_000_000);
  });

  it('prefers a manually-entered Shopee revenue over the omzet fallback', () => {
    const state = makeState({ shopeeOmzet: { old: 5_000_000, cur: 6_000_000 } });
    state.channelData.shopee.revenue.old = 9_000_000;
    expect(bizChannelValue(state, 'shopee', 'revenue', 'old')).toBe(9_000_000);
  });

  it('sums offline stores into a single "offline_sales" value', () => {
    const state = makeState({
      offlineStores: [
        { id: 1, name: 'Store 1', ...emptyBizChannel(), revenue: { old: 1000, cur: 1200 } },
        { id: 2, name: 'Store 2', ...emptyBizChannel(), revenue: { old: 2000, cur: null } },
      ],
    });
    expect(bizChannelValue(state, 'offline_sales', 'revenue', 'old')).toBe(3000);
    expect(bizChannelValue(state, 'offline_sales', 'revenue', 'cur')).toBe(1200);
  });
});

describe('bizTotalMetric / calculated metrics', () => {
  it('AOV/AUR/Basket combine total revenue, transactions and qty across all channels', () => {
    const state = makeState();
    state.channelData.shopee = { revenue: { old: 1_000_000, cur: 1_500_000 }, transactions: { old: 10, cur: 15 }, qty: { old: 20, cur: 30 } };
    state.channelData.tiktok = { revenue: { old: 500_000, cur: 500_000 }, transactions: { old: 5, cur: 5 }, qty: { old: 10, cur: 10 } };

    expect(bizTotalMetric(state, 'revenue', 'old')).toBe(1_500_000);
    expect(bizAOV(state, 'old', '__total__')).toBeCloseTo(1_500_000 / 15);
    expect(bizAUR(state, 'old', '__total__')).toBeCloseTo(1_500_000 / 30);
    expect(bizBasket(state, 'old', '__total__')).toBeCloseTo(30 / 15);
  });

  it('per-channel AOV works the same way scoped to one channel', () => {
    const state = makeState();
    state.channelData.shopee = { revenue: { old: 1_000_000, cur: null }, transactions: { old: 10, cur: null }, qty: { old: 20, cur: null } };
    expect(bizAOV(state, 'old', 'shopee')).toBe(100_000);
  });
});

describe('bizCostPerRevenue', () => {
  it('divides total ad spend by total revenue across all channels', () => {
    const state = makeState();
    state.channelData.shopee.revenue = { old: 10_000_000, cur: 12_000_000 };
    const spend = [{ old: 1_000_000, cur: 1_200_000 }];
    expect(bizCostPerRevenue(state, spend, 'old')).toBeCloseTo(0.1);
    expect(bizCostPerRevenue(state, spend, 'cur')).toBeCloseTo(0.1);
  });

  it('returns null (not 0) when no platform spend is known yet — unknown, not zero spend', () => {
    const state = makeState();
    state.channelData.shopee.revenue = { old: 10_000_000, cur: null };
    expect(bizCostPerRevenue(state, [], 'old')).toBeNull();
  });
});

describe('bizBadgeLabel', () => {
  it('counts how many of the 7 channels have any value filled', () => {
    const state = makeState();
    expect(bizBadgeLabel(state)).toBe('—');
    state.channelData.shopee.revenue.old = 1000;
    expect(bizBadgeLabel(state)).toBe('1/7');
  });
});

describe('parseBizInputValue / formatBizInputValue', () => {
  it('round-trips a formatted number', () => {
    expect(parseBizInputValue('1.234.567')).toBe(1234567);
    expect(formatBizInputValue(1234567)).toBe('1.234.567');
  });
  it('treats an empty string as null, not 0', () => {
    expect(parseBizInputValue('')).toBeNull();
    expect(formatBizInputValue(null)).toBe('');
  });
});
