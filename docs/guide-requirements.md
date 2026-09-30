# Guide requirements checklist

Copied from the uploaded SRS document, with where each part is implemented.

## Project overview
- Full stack Restaurant Management System ("RestaurantPro") — **Done.** React frontend
  (`frontend/`) + Node/Express/MongoDB backend (`backend/`).

## Reservation Management
| Requirement | Implemented in |
|---|---|
| Real-time table availability tracking | `GET /api/tables/availability`, `frontend/src/pages/Reserve.jsx` |
| Dining reservation system with confirmation notifications | `POST /api/reservations`, `backend/services/notify.js` (in-app notification + console "email/SMS") |
| Table allocation and optimization system | `getFreeTables()` in `backend/services/reservationService.js` — picks the smallest suitable table, preferring the guest's chosen seating area |
| Waiting list management | `backend/models/Waitlist.js`, `backend/routes/waitlist.js`, auto-promoted when a table frees up |
| Guest count and special request handling | `Reservation.guests`, `Reservation.specialRequests` |

## Online Ordering
| Requirement | Implemented in |
|---|---|
| Parcel booking for takeaways | order `type: 'parcel'` throughout `backend/routes/orders.js` |
| Home delivery order placement | order `type: 'delivery'`, delivery address + charge |
| Order tracking for customers | `GET /api/orders/track/:orderNumber`, `frontend/src/pages/TrackOrder.jsx` |
| Customizable menu options with dietary filters | add-ons + spice level on `MenuItem`, `GET /api/menu?diet=&glutenFree=` |
| Delivery scheduling | `scheduledFor` field, checked in `backend/routes/orders.js` |

## Customer Management
| Requirement | Implemented in |
|---|---|
| Customer profiles and order history | `backend/models/Customer.js`, `GET /api/customers/me`, `frontend/src/pages/Profile.jsx` |
| Loyalty program management | `backend/services/loyalty.js` (points, tiers, redemption) |
| Feedback and review system | `backend/models/Feedback.js`, `backend/routes/feedback.js` |
| Preferred dining and ordering preferences | `Customer.preferences` (seating, diet, spice, order type) |

## Payment System
| Requirement | Implemented in |
|---|---|
| Secure online payment gateway integration | `backend/services/paymentGateway.js` (simulated test-mode gateway) + `paymentService.js` |
| Support for multiple payment methods (Cards/UPI/Wallets) | `frontend/src/components/PaymentModal.jsx`, `method` field on `Payment` |
| Automated bill generation | `GET /api/orders/:id/bill`, `frontend/src/components/BillView.jsx` |
| Refund and cancellation processing | `refundPayment()` in `paymentService.js`, `cancelOrder()` in `orderService.js` |

## Analytics Dashboard
| Requirement | Implemented in |
|---|---|
| Revenue tracking by service type | `GET /api/analytics` → `revenueByType` |
| Table turnover rates and reservation trends | `tableTurnover`, `reservations.byHour/byDay` |
| Popular dishes and menu analysis | `menu.popularDishes`, `menu.leastOrdered`, `menu.categorySales` |
| Customer satisfaction metrics | `satisfaction` (average rating, distribution, % satisfied) |
| Delivery performance tracking | `delivery` (avg time, on-time %, active/delivered counts) |

## Staff Management
| Requirement | Implemented in |
|---|---|
| Role-based access control for staff | `backend/middleware/auth.js` (`authorize(...)`), used on every route; 6 roles |
| Task assignment and tracking | `backend/models/Task.js`, `backend/routes/tasks.js`, `frontend/src/pages/admin/MyWork.jsx` |
| Attendance and performance records | `backend/models/Attendance.js`, `backend/routes/attendance.js`, `GET /api/staff/performance` |

## Future scope (mentioned in the SRS, not built — listed for the viva)
Mobile app, AI-based optimization, voice ordering, third-party delivery integration, real-time
kitchen prep tracking. These were listed by the guide as *future* scope, so they are intentionally
left for a later version and can be mentioned as such if asked.
