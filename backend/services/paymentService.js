const Payment = require('../models/Payment');
const gateway = require('./paymentGateway');
const { awardPoints, reverseRewards } = require('./loyalty');
const { notify } = require('./notify');
const { HttpError, makeCode } = require('../utils/helpers');

const METHODS = ['card', 'upi', 'wallet', 'cash'];

// Take payment for an order. Online methods go through the gateway; cash is recorded by staff.
async function payOrder({ order, method, details = {}, byStaff }) {
  if (order.status === 'cancelled') throw new HttpError(400, 'This order was cancelled');
  if (order.paymentStatus === 'paid') throw new HttpError(400, 'This order is already paid');
  if (!METHODS.includes(method)) throw new HttpError(400, 'Choose a payment method');
  if (method === 'cash' && !byStaff) {
    throw new HttpError(403, 'Cash is collected by our staff at the counter or on delivery');
  }

  const result =
    method === 'cash'
      ? { success: true, transactionId: makeCode('CASH'), maskedDetails: {}, message: 'Cash received' }
      : await gateway.charge({ method, amount: order.total, details });

  const payment = await Payment.create({
    order: order._id,
    orderNumber: order.orderNumber,
    customer: order.customer,
    customerName: order.customerName,
    amount: order.total,
    method,
    status: result.success ? 'success' : 'failed',
    transactionId: result.transactionId,
    details: result.maskedDetails,
    failureReason: result.success ? undefined : result.message,
    paidAt: result.success ? new Date() : undefined,
  });

  if (!result.success) throw new HttpError(402, result.message);

  order.paymentStatus = 'paid';
  order.payment = payment._id;
  const points = await awardPoints(order);
  await order.save();

  if (order.customer) {
    await notify({
      customer: order.customer,
      type: 'payment',
      title: 'Payment received',
      message: `Rs.${order.total} paid for ${order.orderNumber}.${points ? ` You earned ${points} loyalty points.` : ''}`,
    });
  }
  await notify({ forStaff: true, type: 'payment', title: 'Payment received', message: `${order.orderNumber}: Rs.${order.total} by ${method}` });
  return payment;
}

// Refund the successful payment of an order (used for cancellations and manager refunds).
async function refundPayment(order, reason) {
  const payment = await Payment.findById(order.payment);
  if (!payment || payment.status !== 'success') throw new HttpError(400, 'There is no successful payment to refund for this order');

  payment.status = 'refunded';
  payment.refund = { refundId: makeCode('RFD'), amount: payment.amount, reason, at: new Date() };
  await payment.save();

  await reverseRewards(order, { wasPaid: true });
  order.paymentStatus = 'refunded';
  await order.save();

  if (order.customer) {
    await notify({
      customer: order.customer,
      type: 'payment',
      title: 'Refund processed',
      message: `Rs.${payment.amount} refunded for ${order.orderNumber} (${payment.refund.refundId}).`,
    });
  }
  return payment;
}

module.exports = { payOrder, refundPayment };
