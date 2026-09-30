import { money, dateTime, TYPE_LABEL, METHOD_LABEL } from '../utils.js';

// The printable bill. `bill` comes from GET /api/orders/:id/bill
export default function BillView({ bill }) {
  return (
    <article className="bill">
      <header className="bill-head">
        <h2>{bill.restaurant.name}</h2>
        <p>{bill.restaurant.address}</p>
        <p>Phone {bill.restaurant.phone} | GSTIN {bill.restaurant.gstin}</p>
      </header>

      <dl className="bill-meta">
        <div><dt>Bill no.</dt><dd>{bill.billNumber}</dd></div>
        <div><dt>Order</dt><dd>{bill.orderNumber}</dd></div>
        <div><dt>Date</dt><dd>{dateTime(bill.date)}</dd></div>
        <div><dt>Service</dt><dd>{TYPE_LABEL[bill.type]}{bill.tableNumber ? `, Table ${bill.tableNumber}` : ''}</dd></div>
        <div><dt>Customer</dt><dd>{bill.customerName}{bill.customerPhone ? ` (${bill.customerPhone})` : ''}</dd></div>
        {bill.deliveryAddress && <div><dt>Deliver to</dt><dd>{bill.deliveryAddress}</dd></div>}
      </dl>

      <table className="bill-table">
        <thead>
          <tr><th>Item</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Amount</th></tr>
        </thead>
        <tbody>
          {bill.items.map((item, i) => (
            <tr key={i}>
              <td>
                {item.name}
                {item.addOns && item.addOns.length > 0 && <small> + {item.addOns.map((a) => a.name).join(', ')}</small>}
                {item.spiceLevel && <small> ({item.spiceLevel})</small>}
              </td>
              <td className="num">{item.quantity}</td>
              <td className="num">{money(item.price)}</td>
              <td className="num">{money(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="bill-totals">
        <div><span>Subtotal</span><span>{money(bill.subtotal)}</span></div>
        {bill.discount > 0 && <div><span>Loyalty discount</span><span>- {money(bill.discount)}</span></div>}
        <div><span>CGST ({bill.gstRate / 2}%)</span><span>{money(bill.cgst)}</span></div>
        <div><span>SGST ({bill.gstRate / 2}%)</span><span>{money(bill.sgst)}</span></div>
        {bill.deliveryCharge > 0 && <div><span>Delivery charge</span><span>{money(bill.deliveryCharge)}</span></div>}
        <div className="grand"><span>Total</span><span>{money(bill.total)}</span></div>
      </div>

      <footer className="bill-foot">
        {bill.payment ? (
          <p>
            Paid by {METHOD_LABEL[bill.payment.method]} ({bill.payment.transactionId}).
            {bill.paymentStatus === 'refunded' && ' This payment has been refunded.'}
          </p>
        ) : (
          <p>Payment status: {bill.paymentStatus === 'unpaid' ? 'Not paid yet' : bill.paymentStatus}</p>
        )}
        <p>Thank you for dining with us!</p>
      </footer>
    </article>
  );
}
