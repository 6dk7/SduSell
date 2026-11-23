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
- Post, edit, and delete listings; set their status to active, reserved, or sold
- Up to 8 photos per listing, resized in the browser before upload; choose the cover photo
- Browse with search (works for Russian and English), category, city, price range, condition and sort
- Switch the interface between Russian, Kazakh and English
- Listing page with gallery, "Show phone number", WhatsApp link, seller info and view count
- Publish listings to sell, exchange, give away or request an item; add subject and course details to books
- Mark listings as active, reserved or sold
- Browse curated student-life collections and quick categories on the home page
- Favorites and a "My listings" page
- Profile settings at `/#/profile`: edit your name, phone and city; add or remove a profile photo
- Student email verification preview for official SDU student addresses
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
  app.js      the whole frontend (hash routing: #/, #/listing/3, #/sell, #/me, #/favorites, #/profile)
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
| PUT | `/api/auth/me` | 🔒 `name, phone, city, avatar?` (avatar is an image data URL or empty string to remove it) |
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

## Profile and student verification

Open `http://localhost:3000/#/profile` while signed in, or choose **Profile & verification** from the account menu. The profile form saves a user's name, phone number, city and optional photo through `PUT /api/auth/me`. Photos are resized in the browser, stored with the existing upload files, and referenced by the user's `avatar_url`. Existing SQLite databases gain the optional avatar field automatically at startup.

The student verification panel is a **UI preview only**. It accepts an address ending in `@stu.sdu.edu.kz` and displays an honest status message, but it does not send an email, store a verification request, or mark an account as verified. SDU's student services page describes student email addresses in this domain format: [SDU student services](https://sdu.edu.kz/en/student-services/). Before implementing delivery, confirm the accepted student domains with the university and add server-side request storage, rate limits, expiring one-time tokens, confirmation handling, and a persisted verification status. Do not trust a client-side email suffix check as proof of identity.

## Ideas for next steps

- Turkish interface translation, with a complete review of all user-facing text
- In-app chat between buyers and sellers, alongside phone and WhatsApp contact
- Extend the profile editor with account email changes, privacy settings and account recovery
- Connect the student verification preview to a mail provider and verified-account status
- Saved searches with notifications when matching listings are posted
- Seller profiles with ratings and listing history
- Listing expiry and renewal, plus optional promoted listings

## SDU Finds

Open `http://localhost:3000/#/discover`. Save a listing to influence recommendations; use “Not for me” to hide it. Guests can browse without logging in. A collection ends after the available listings or 100 cards.

The rule-based algorithm prioritizes favorite categories and mixes in other categories. It excludes sold, owned, saved and hidden listings. Preferences persist in SQLite; ordinary skips only last for the current collection.

Listing types are `sell`, `exchange`, `free` and `wanted`; status values are `active`, `reserved` and `sold`. Older databases receive the new optional listing columns in place when the server starts.
