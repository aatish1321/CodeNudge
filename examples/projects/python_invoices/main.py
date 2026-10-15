# Report paid orders, unique paying customers, and discounted revenue.
# Expected report: 3 paid orders, 2 customers, and $61.00 revenue.
from invoice import invoice_total


ORDERS = [
    {
        "customer": "Ada",
        "status": "paid",
        "discount_percent": 10,
        "items": [{"price": 12.50, "qty": 2}, {"price": 5.00, "qty": 1}],
    },
    {
        "customer": "Ben",
        "status": "paid",
        "discount_percent": 0,
        "items": [{"price": 8.00, "qty": 3}],
    },
    {
        "customer": "Ada",
        "status": "paid",
        "discount_percent": 0,
        "items": [{"price": 10.00, "qty": 1}],
    },
    {
        "customer": "Cara",
        "status": "cancelled",
        "discount_percent": 0,
        "items": [{"price": 99.00, "qty": 1}],
    },
]


def main():
    paid = [order for order in ORDERS if order["status"] == "paid"]
    customers = {order["customer"] for order in paid}
    revenue = sum(invoice_total(order) for order in paid)
    print(f"Paid orders: {len(paid)}")
    print(f"Customers: {len(customers)}")
    print(f"Revenue: ${revenue:.2f}")


if __name__ == "__main__":
    main()
