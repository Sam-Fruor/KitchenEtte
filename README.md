```markdown
# 🍽️ La Kitchen Ette - Serverless Restaurant POS & Ordering System

A full-stack, real-time restaurant management system built with **React** and **Supabase**. This application operates on a 100% serverless architecture, meaning it requires no Node.js backend. It handles live customer ordering, kitchen ticket management, and real-time inventory updates using Supabase WebSockets.

## ✨ Key Features

### 📱 Customer App (Front-End)
* **Live Menu Sync:** Menu items, prices, and "Sold Out" statuses update instantly in real-time.
* **Smart Cart System:** Add/remove items, adjust quantities (+/-), and calculate packing & delivery fees automatically.
* **Customizable Thalis:** Interactive modal to build custom thali combos from the daily whiteboard.
* **Anti-Spam Checkout:** 10-digit strict mobile validation and a 60-second cooldown timer between orders.
* **WhatsApp Integration:** Instantly sends formatted order details directly to the restaurant's WhatsApp business number.
* **Live Order Tracking:** Customers can track their order status with a live countdown timer synced perfectly across timezones.

### 👨‍🍳 Partner Portal (Admin Dashboard)
* **Secure Authentication:** Protected by Supabase enterprise-grade Auth.
* **Real-Time Kitchen Display System (KDS):** New orders pop up instantly via WebSockets—no refreshing required.
* **Audio Alerts:** Kitchen bell "Ding!" plays automatically when a new order arrives.
* **KPI Dashboard:** Tracks live daily revenue, pending orders, and processed tickets.
* **Full Menu Control:** Add, edit, delete, or temporarily toggle off menu items.
* **Store Management:** Master switches to pause Delivery, Takeaway, Dine-in, or completely close the store.
* **Direct Customer Contact:** 1-click WhatsApp button to message customers regarding their specific order.
* **Fully Responsive:** Beautiful mobile-first sidebar design for managers on the go.

## 🛠️ Tech Stack
* **Frontend:** React.js, Vite, Tailwind CSS
* **Icons:** Lucide React
* **Backend / Database:** Supabase (PostgreSQL)
* **Real-Time:** Supabase WebSockets (`supabase.channel`)
* **Routing:** React Router v6

---

## 🚀 Installation & Setup

### 1. Clone the repository
```bash
git clone [https://github.com/yourusername/kitchen-ette.git](https://github.com/yourusername/kitchen-ette.git)
cd kitchen-ette

```

### 2. Install dependencies

```bash
npm install

```

### 3. Supabase Database Setup

1. Create a new project on [Supabase](https://supabase.com/).
2. Go to the **SQL Editor** and run the following tables setup:

```sql
CREATE TABLE store_settings (id INT PRIMARY KEY, is_open BOOLEAN DEFAULT TRUE, delivery_active BOOLEAN DEFAULT TRUE, takeaway_active BOOLEAN DEFAULT TRUE, dine_in_active BOOLEAN DEFAULT TRUE);
INSERT INTO store_settings (id) VALUES (1);

CREATE TABLE users (id SERIAL PRIMARY KEY, phone_number VARCHAR(15) UNIQUE, name VARCHAR(100), pg_address TEXT, role VARCHAR(20) DEFAULT 'customer');

CREATE TABLE orders (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id), order_details JSONB, total_amount INT, payment_reference VARCHAR(100), status VARCHAR(50) DEFAULT 'Preparing', payment_status VARCHAR(50) DEFAULT 'Pending', order_type VARCHAR(20) DEFAULT 'Delivery', estimated_completion_time TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE static_menu (id SERIAL PRIMARY KEY, category VARCHAR(50), item_name VARCHAR(100), price_half INT, price_full INT, is_available BOOLEAN DEFAULT TRUE);

CREATE TABLE daily_board (id SERIAL PRIMARY KEY, category VARCHAR(50) DEFAULT 'Daily Whiteboard', item_name VARCHAR(100), description TEXT, price INT, is_available BOOLEAN DEFAULT TRUE);

```

3. **Enable Real-Time:** Run this SQL command to enable live syncing:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE orders, store_settings, static_menu, daily_board;

```

4. **Enable Nightly Reset (Optional):** Run this to automatically restock the menu at 2:00 AM IST every night:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('reset-daily-menu', '30 20 * * *', $$
  UPDATE static_menu SET is_available = true;
  UPDATE daily_board SET is_available = true;
$$);

```

### 4. Configure Environment Variables

In your `src` folder, update the `supabaseClient.js` file (or use a `.env` file) with your Supabase credentials:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

```

### 5. Run the App Locally

```bash
npm run dev

```

## 🔐 Admin Access

To access the Partner Portal:

1. Navigate to `/admin` or scroll to the bottom footer of the main page and click "Partner Portal Login".
2. Create an admin user inside your Supabase Dashboard -> Authentication tab to log in.

---

*Built with ❤️ for local food businesses.*

```

### How to upload this to GitHub:
1. Save the file.
2. Open your terminal.
3. Run the exact same 3 commands you just learned:
   * `git add .`
   * `git commit -m "Added README file"`
   * `git push origin main`

```