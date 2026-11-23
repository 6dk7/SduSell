# SduSell

A classifieds marketplace in the style of OLX.kz and Facebook Marketplace. Students and neighbours post things for sale, browse by category and city, save favorites, and contact sellers by phone or WhatsApp.

The frontend is a React 19 app built with Vite. The backend is still plain Node.js (22.13 or newer) with SQLite and no npm packages, so React and Vite are the only things `npm install` fetches.

## Run it

```bash
cd SduSell
npm install
npm run seed     # optional: 3 demo users and 23 listings
npm run build    # builds the React app into dist/
npm start        # http://localhost:3000 (API + built frontend)
```

Developing the frontend with hot reload, in two terminals:

```bash
npm run dev:server   # API on http://localhost:3000
npm run dev          # React app on http://localhost:5173, proxies /api and /uploads to :3000
```

On Windows PowerShell, to use the React app at `http://localhost:5174` with an API server at `http://localhost:3001`, run these in two terminals:

```powershell
$env:PORT = "3001"
npm run dev:server
```

```powershell
$env:PORT = "3001"
npm run dev -- --port 5174
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
- Listing page with gallery, "Show phone number", WhatsApp link, seller info and view count
- Favorites and a "My listings" page
- Profile settings: edit your name, phone and city, and add or remove a profile photo
- Student email verification preview for official SDU student addresses
- SDU Finds (`/#/discover`): swipeable discovery cards, saved interests, persistent hidden listings and explained recommendations
- Works on phones; keyboard focus is visible; reduced motion is respected

## Project layout

```
server/            HTTP server, routes, SQLite, auth, profile photo upload, seed data
index.html         Vite entry (mounts #root)
vite.config.js     React plugin + dev proxy to the API
public/assets/     logo, copied as is into dist/
src/
  main.jsx         entry: providers + <App />
  App.jsx          layout and hash routes
  styles.css       design (unchanged)
  context/         Session (user, token, categories/cities) and UI (toast, dialog)
  lib/             api.js, router.js (hash routing hook), hooks.js (useFetch), format.js, categories.js
  components/      Header/Footer, AuthDialog, FavToggle, ListingCard, Field, Artwork, States
  pages/           Home, Discovery, Listing, Sell (new + edit), Mine, Favorites, Profile
tests/             server tests (node --test)
data/              created on first run: sdusell.db and uploads/ (not committed)
dist/              build output served by the Node server (not committed)
```

Routes are hash URLs: `#/`, `#/listing/3`, `#/sell`, `#/edit/3`, `#/me`, `#/favorites`, `#/discover`, and `#/profile`.

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
| GET | `/api/listings` | query: `q, category, city, min, max, condition, sort, page, limit, seller` |
| GET | `/api/listings?mine=1` | 🔒 your listings, including sold |
| GET | `/api/listings?favorites=1` | 🔒 |
| GET | `/api/listings/:id` | includes `images` and `seller` |
| POST | `/api/listings` | 🔒 `title, description, price, category, city, condition, negotiable, images[]` |
| PUT | `/api/listings/:id` | 🔒 owner only |
| PATCH | `/api/listings/:id/status` | 🔒 owner only, `{ "status": "sold" \| "active" }` |
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

Sign in and open **Profile & verification** from the account menu, or go directly to `http://localhost:3000/#/profile`. The profile form saves a user's name, phone number, city and optional photo through `PUT /api/auth/me`. The browser resizes photos before upload. The server stores the image in `data/uploads/` and records its path in the `users.avatar_url` field in SQLite. Existing databases gain this optional field automatically when the server starts.

The university email panel is a preview only. It accepts an address ending in `@stu.sdu.edu.kz` and shows a clear status message, but it does not send an email, save a verification request, or mark an account verified. Before implementing real verification, confirm accepted student email domains with SDU, then add server-side request storage, rate limits, expiring one-time tokens, confirmation handling and a persisted verification status. A client-side suffix check is not proof of identity.

## Ideas for next steps

- Kazakh and Russian interface language switch
- Chat between buyer and seller instead of phone and WhatsApp only
- Account email changes, privacy settings and recovery
- Connect student verification to a mail provider and persisted verified status
- Promoted listings, saved searches, listing expiry after 30 days

## SDU Finds

Open `http://localhost:3000/#/discover`. Save a listing to influence recommendations; use “Not for me” to hide it. Guests can browse without logging in. A collection ends after the available listings or 100 cards.

The rule-based algorithm prioritizes favorite categories and mixes in other categories. It excludes sold, owned, saved and hidden listings. Preferences persist in SQLite; ordinary skips only last for the current collection.
