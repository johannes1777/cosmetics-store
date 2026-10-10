import { storeConfig } from "../config/store";

const formatter = new Intl.NumberFormat(storeConfig.currency.locale, {
  style: "currency",
  currency: storeConfig.currency.code,
});

export const formatMoney = (pence: number) => formatter.format(pence / 100);

// This is only a PREVIEW for the basket page. The database works out the real
// delivery cost again when the order is placed (see supabase/003_place_order.sql).
export const calcDelivery = (subtotalPence: number, delivery: { standardPence: number; freeOverPence: number }) => {
  if (subtotalPence <= 0) return 0;
  return subtotalPence >= delivery.freeOverPence ? 0 : delivery.standardPence;
};
