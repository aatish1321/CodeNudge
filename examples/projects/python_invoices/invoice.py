# Calculate one invoice's total from its items and percentage discount.
def invoice_total(order):
    subtotal = sum(item["price"] * item["quantity"] for item in order["items"])
    discount = order.get("discount_percent", 0) / 100
    return round(subtotal - discount, 2)
