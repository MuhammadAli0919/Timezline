# Timezline

Timezline is a responsive, made-to-order furniture and consultation storefront for Karachi. The catalog is quote-first: designs are never sold from ready-made stock, and every enquiry can include dimensions, materials, finishes, notes and private reference files.

## Run locally

- Requires Node.js 22.5 or later.
- Install dependencies with `npm install`.
- Start the application with `npm start` and open `http://localhost:3000`.
- Run checks with `npm run check` and tests with `npm test`.

## Catalog and quote flow

- SQLite seeds the Home & Living, Office, Kitchen, Doors, Wardrobes and Flooring taxonomies on startup.
- `GET /api/taxonomy`, `GET /api/filters` and `GET /api/products` serve categories, attribute filters and paginated designs.
- `GET /api/products/:id` provides stable product links that reopen the matching design details.
- The product detail dialog includes finish swatches and a responsive dimensions visualizer. Its quote action pre-fills the custom quote form.
- `POST /api/quotes` validates and stores enquiries in `data/timezline.sqlite`; up to four JPG, PNG, WEBP or PDF reference files are stored privately in `uploads/`.
- Optional SMTP notification sends new leads to `QUOTE_NOTIFICATION_EMAIL`. Copy `.env.example` to `.env` and set the SMTP host, port, sender and credentials to enable delivery. No credentials are committed; the API reports `not_configured` or `failed` when email cannot be sent.
- After an enquiry is saved, the site opens a prefilled WhatsApp message to Timezline with the selected product link, item code, specifications and customer contact details. If pop-ups are blocked, it presents a direct WhatsApp link instead. The customer confirms sending in WhatsApp.

The SQLite database is the lead store; an external CMS and automatic WhatsApp Business API delivery are not configured. WhatsApp uses the customer-confirmed click-to-chat flow required for direct enquiries.
