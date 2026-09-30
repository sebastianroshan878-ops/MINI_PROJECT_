# RestaurantPro — Restaurant Management System

A full stack Mini Project built with **React (Vite)**, **Node.js / Express**, and **MongoDB (Mongoose)**.

This project follows every requirement from the guide's SRS document (see `docs/guide-requirements.md`)
and adds a reasonable amount of beginner-friendly extra polish on top: a live dashboard, menu search &
filters, a live table board, order tracking, automatic bill generation, a loyalty/rewards program, and
more — listed under "Extra features" below.

---

## 1. What's inside

```
RestaurantPro/
├── backend/            Node + Express + MongoDB API (Independent port 5000)
│   ├── config/         DB and constants
│   ├── middleware/     Authentication and error handling
│   ├── models/         MongoDB schemas (User, Table, Menu, Order, etc.)
│   ├── routes/         Express REST API routes
│   ├── services/       Business logic (reservations, loyalty, payments, etc.)
│   ├── tests/          API smoke tests
│   ├── package.json    Backend-only dependencies & scripts
│   └── server.js       Express entry point
├── frontend/           React (Vite) website + staff panel (Independent port 5173)
│   ├── src/            React components, pages, context, and styles
│   ├── package.json    Frontend-only dependencies & scripts
│   ├── vite.config.js  Vite config with /api proxy to localhost:5000
│   └── index.html      HTML entry point
├── docs/               SRS requirements mapping & notes
├── run-all.js          Concurrent runner with graceful shutdown
├── package.json        Root orchestrator (delegates to backend/frontend)
├── install-all.bat     One-click Windows dependency installer
├── start-all.bat       One-click Windows launcher (starts both services)
├── start-backend.bat   One-click launcher for Backend ONLY
├── start-frontend.bat  One-click launcher for Frontend ONLY
└── seed-database.bat   One-click database seeder
```

## 2. Requirements

- **Node.js 18+** (check with `node -v`)
- **MongoDB** running locally on `mongodb://127.0.0.1:27017` OR a MongoDB Atlas connection string configured in `backend/.env`.

---

## 3. How to Run It

### Method 1: Run Frontend & Backend Independently (Recommended for separate development)

Frontend and Backend have **completely independent dependencies, commands, and port bindings**. They do not interfere with each other or any other project on your system.

#### Terminal 1 — Backend (Port 5000)
```powershell
cd backend
npm install           # First time only (installs backend dependencies)
npm run seed          # First time only — populates demo menu, tables & accounts
npm run dev           # Starts API server with hot-reload on http://localhost:5000
```
Available backend scripts (run inside `backend/`):
- `npm run dev` — Run server with nodemon auto-restart
- `npm start` — Run server in production mode
- `npm run seed` — Seed initial database records
- `npm run test:api` — Run backend API smoke tests

#### Terminal 2 — Frontend (Port 5173)
```powershell
cd frontend
npm install           # First time only (installs frontend dependencies)
npm run dev           # Starts Vite dev server on http://localhost:5173
```
Available frontend scripts (run inside `frontend/`):
- `npm run dev` — Start Vite React dev server
- `npm run build` — Build production bundle to `frontend/dist`
- `npm run preview` — Preview the production build locally

Open **http://localhost:5173** in your browser.
The React app communicates with the backend at `http://localhost:5000` through the Vite proxy configured in `frontend/vite.config.js`.

---

### Method 2: Single-Command Combined Runner (Root folder)

From the root `RestaurantPro/` folder:
```powershell
npm install           # Installs both backend & frontend dependencies automatically
npm run all           # Starts both backend (port 5000) and frontend (port 5173) together
```

Other convenient root scripts:
```powershell
npm run seed          # Seeds the database with demo dishes, tables, staff accounts
npm run dev:frontend  # Runs only the frontend via npm --prefix
npm run dev:backend   # Runs only the backend via npm --prefix
npm run build         # Builds frontend bundle for production
npm test              # Runs API smoke tests
```

---

### Method 3: One-Click Windows Launchers (.bat)

If you prefer double-clicking from Windows Explorer:
- **`install-all.bat`** — Installs dependencies for both backend and frontend.
- **`start-all.bat`** — Launches both backend and frontend concurrently in one window.
- **`start-backend.bat`** — Launches ONLY the backend server (port 5000).
- **`start-frontend.bat`** — Launches ONLY the frontend React client (port 5173).
- **`seed-database.bat`** — Populates the database with demo data.

## 4. Demo logins (after running the seed script)

| Role      | Email                          | Password    |
|-----------|---------------------------------|-------------|
| Admin     | admin@restaurantpro.com         | admin123    |
| Manager   | manager@restaurantpro.com       | staff123    |
| Waiter    | waiter@restaurantpro.com        | staff123    |
| Chef      | chef@restaurantpro.com          | staff123    |
| Delivery  | delivery@restaurantpro.com      | staff123    |
| Customer  | customer@demo.com               | customer123 |

Or just click a role on the login page — it fills the form for you.

The Login page also links to **Sign up** so you can register a brand-new customer account to show
that flow too.

## 5. A five-minute walkthrough for your viva

1. **Home page** → browse the menu, chef's specials, and reviews.
2. **Reserve a table** → pick a date/time/guest count, see live availability, get a confirmation code.
   Try booking a busy slot to see the **waiting list** offer.
3. **Menu → add a few dishes → Cart → Checkout** → place a delivery or parcel order, then pay with
   the test card `4111 1111 1111 1111` (any future expiry/CVV).
4. **Track order** page → paste the order number + phone to watch it move through its stages live.
5. Log out, log back in as **Admin** → the **Dashboard** shows revenue, popular dishes, table
   turnover, satisfaction and delivery performance for the last 7/14/30 days.
6. Open **Tables** → tap a table to cycle it between available/occupied/cleaning; reservations
   starting soon are shown automatically.
7. Open **Orders** → move an order forward (Confirmed → Preparing → Ready → ...), print its bill.
8. Open **Menu** (staff side) → toggle a dish sold out, edit stock, add a brand-new dish.
9. Log in as **Chef** or **Delivery** to see how the same Orders page only shows the actions their
   role is allowed to do (role-based access control).
10. As **Manager**, open **Team** → assign a task, then log in as that staff member and open
    **My work** to complete it and check in/out for attendance.

## 6. Guide requirements → where they are implemented

See `docs/guide-requirements.md` for a full checklist mapped to files and API routes.

## 7. Extra features added on top of the guide's requirements

- Live **admin dashboard** (revenue by day/type, popular & slow-moving dishes, table turnover,
  reservation trends by hour, customer satisfaction, delivery on-time rate)
- **Loyalty points & tiers** (Bronze/Silver/Gold) with a bonus multiplier and point redemption at
  checkout
- **Waiting list** that is automatically offered a table the moment one becomes free
- **Search & filters** on the menu (category, diet, search box) and on customers/orders in the staff
  panel
- **Live table board** staff can tap through available → occupied → cleaning
- **Order tracking page** with a step-by-step timeline, usable without logging in
- **Automatic, printable bill** with GST breakdown
- A **simulated payment gateway** (test mode: card / UPI / wallet / cash) so the checkout flow is
  complete without needing a real merchant account
- **In-app notifications** (bell icon) for reservations, orders, payments and loyalty updates
- **Staff task board & attendance check-in/out**, feeding a simple **performance summary**
- **Role-based access control** across 6 roles (admin, manager, waiter, chef, delivery, customer) —
  each role's staff panel only shows the pages and buttons it's allowed to use
- Customer **profile & preferences** (seating, diet, spice level, default order type) that are reused
  automatically on future bookings/orders
- **Reviews with restaurant replies**, shown on the home page when 4★ or higher

## 8. Notes for the viva

- Card numbers/CVV are validated and then thrown away — never stored (see
  `backend/services/paymentGateway.js`). Only the payment method, brand and last 4 digits are saved.
- Table allocation always assigns the **smallest table that fits the group** (and the guest's
  preferred seating area first), so big tables stay free for big groups — see
  `getFreeTables()` in `backend/services/reservationService.js`.
- All prices are read from the database on the server, never trusted from the browser — see
  `buildOrderItems()` in `backend/services/orderService.js`.
- The whole project uses **plain JavaScript with clear comments** so it's easy to explain line by
  line; no TypeScript, no state-management library, no CSS framework — just React state and a single
  CSS file.
