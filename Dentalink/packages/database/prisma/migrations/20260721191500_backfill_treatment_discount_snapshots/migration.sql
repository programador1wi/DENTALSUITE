UPDATE "TreatmentPlanItem" item
SET "maximumDiscountPercentSnapshot" = CASE
  WHEN item."allowsDiscountSnapshot" = false THEN 0
  ELSE COALESCE(
    (
      SELECT version_item."maxDiscountPercent"
      FROM "PriceListVersionItem" version_item
      WHERE version_item."id" = item."priceListVersionItemId"
    ),
    (
      SELECT legacy_item."maxDiscountPercent"
      FROM "PriceListItem" legacy_item
      WHERE legacy_item."id" = item."priceListItemId"
    ),
    100
  )
END;
