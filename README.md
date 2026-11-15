# SduSell

A classifieds marketplace in the style of OLX.kz and Facebook Marketplace. Students and neighbours post things for sale, browse by category and city, save favorites, and contact sellers by phone or WhatsApp.

No npm packages and no build step. Everything runs on Node.js 22.13 or newer.

## Run it

```bash
cd sdusell
npm run seed     # optional: 3 demo users and 23 listings
npm start        # http://localhost:3000
```

Demo login after seeding: `demo@sdusell.kz` / `password123`.

Other commands:

```bash
npm test                              # 10 discovery API tests, use a throwaway database
node server/seed.js --reset           # wipe everything and reseed
PORT=8080 npm start                   # change the port
```

## What it does

- Sign up and log in (passwords hashed with scrypt, sessions expire after 14 days)
- Post, edit, delete a listing; mark it as sold or available again
- Up to 8 photos per listing, resized in the browser before upload; choose the cover photo
- Browse with search (works for Russian and English), category, city, price range, condition and sort
- Switch the interface between Russian, Kazakh and English
- Listing page with gallery, "Show phone number", WhatsApp link, seller info and view count
- Publish listings to sell, exchange, give away or request an item; add subject and course details to books
- Mark listings as active, reserved or sold
- Browse curated student-life collections and quick categories on the home page
- Favorites and a "My listings" page
- SDU Finds (`/#/discover`): swipeable discovery cards, saved interests, persistent hidden listings and explained recommendations
- Works on phones; keyboard focus is visible; reduced motion is respected

## Project layout

```
server/
  index.js    HTTP server, routes, validation, static files, image uploads
  db.js       SQLite schema (node:sqlite), categories and cities
  auth.js     password hashing and sessions
  seed.js     demo data
public/
  index.html  page shell
  app.js      the whole frontend (hash routing: #/, #/listing/3, #/sell, #/me, #/favorites)
  styles.css  design
tests/
  api.test.js
data/         created on first run: sdusell.db and uploads/ (not committed)
```

## API

Send `Authorization: Bearer <token>` for the routes marked with a lock. All bodies are JSON.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/meta` | categories and cities |
| GET | `/api/discovery` | optional auth; `limit` (1–50), `exclude` (up to 100 IDs); returns `items` with `reason`, `has_more`, `personalized` |
| POST | `/api/discovery/:id/reaction` | 🔒 `{ "reaction": "like" \| "pass" }`; like adds to Favorites, pass hides the listing |
| POST | `/api/auth/register` | `name, email, password (8+), phone?, city?` returns `token, user` |
| POST | `/api/auth/login` | `email, password` returns `token, user` |
| POST | `/api/auth/logout` | 🔒 |
| GET | `/api/auth/me` | 🔒 |
| PUT | `/api/auth/me` | 🔒 `name, phone, city` |
| GET | `/api/listings` | query: `q, category` or comma-separated `categories`, `type`, `subject`, `course`, `city, min, max, condition, sort, page, limit, seller` |
| GET | `/api/listings?mine=1` | 🔒 your listings, including sold |
| GET | `/api/listings?favorites=1` | 🔒 |
| GET | `/api/listings/:id` | includes `images` and `seller` |
| POST | `/api/listings` | 🔒 `title, description, price, category, city, condition, listing_type, subject?, course?, negotiable, images[]` |
| PUT | `/api/listings/:id` | 🔒 owner only; accepts the same listing fields |
| PATCH | `/api/listings/:id/status` | 🔒 owner only, `{ "status": "active" \| "reserved" \| "sold" }` |
| DELETE | `/api/listings/:id` | 🔒 owner only |
| POST / DELETE | `/api/listings/:id/favorite` | 🔒 |

`sort` is one of `price_asc`, `price_desc`, `popular`; the default is newest first. `images` holds PNG, JPEG or WebP data URLs (new photos) or `/uploads/...` paths (photos to keep).

Quick try from a terminal:

```bash
curl localhost:3000/api/listings?q=iphone
curl -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' \
     -d '{"email":"demo@sdusell.kz","password":"password123"}'
```

## Before you put it on the internet

This is a solid course project, not a production service. Things to add first:

- Serve it over HTTPS (for example behind Caddy or nginx); tokens are sent in a header
- Move the rate limiter and sessions out of memory if you run more than one server
- Email verification and password reset
- Report and moderation tools for listings
- Backups for `data/`

## Ideas for next steps

- Kazakh and Russian interface language switch
- Chat between buyer and seller instead of phone and WhatsApp only
- Profile page where users edit their name, phone and city (the API already has `PUT /api/auth/me`)
- Promoted listings, saved searches, listing expiry after 30 days

## SDU Finds

Open `http://localhost:3000/#/discover`. Save a listing to influence recommendations; use “Not for me” to hide it. Guests can browse without logging in. A collection ends after the available listings or 100 cards.

The rule-based algorithm prioritizes favorite categories and mixes in other categories. It excludes sold, owned, saved and hidden listings. Preferences persist in SQLite; ordinary skips only last for the current collection.

Listing types are `sell`, `exchange`, `free` and `wanted`; status values are `active`, `reserved` and `sold`. Older databases receive the new optional listing columns in place when the server starts.
