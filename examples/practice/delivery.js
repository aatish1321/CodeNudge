// Delivery is free for orders of 30 or more. Print 0 for this order.
const orderTotal = 30;
let deliveryFee = 5;
if (orderTotal > 30) {
  deliveryFee = 0;
}
console.log(deliveryFee);
