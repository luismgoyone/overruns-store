# The Overruns Project: Store POC Spec

Source of truth: https://claude.ai/artifact/4HaqLZ9TcqKohmDwKNNE8g (copied here on 2026-10-15 so the plan travels with it).

## Overview

The proof of concept is a working storefront for The Overruns Project. A shopper can browse products, add them to a cart, and pay with GCash, Maya or a card in PayMongo test mode. The owner can add products and see orders. Everything runs on free tiers, so it costs ₱0 a month except an optional domain.

The goal is to show the client a real, clickable store they can try on their phone before they commit to the paid setup (about ₱4,150 a month).

- **In scope:** product catalog with sizes and stock, cart, checkout with test payments, order confirmation email, and a simple admin page for products and orders.
- **Out of scope for the POC:** real payments, shipping-rate APIs (a flat fee is used instead), customer accounts, discount codes, reviews, and analytics.
- **Assumption:** the brand sells overrun apparel (factory-surplus branded clothing) in limited, size-based stock.

## Tech stack (free tiers)

| Part | Service | Free-tier limits that matter |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript + Tailwind CSS | Free, open source |
| Hosting | Vercel Hobby | 100 GB transfer, 1M function calls, 5,000 image transformations a month. **Non-commercial use only**, so it must move to Pro before real sales. |
| Database + login + images | Supabase Free | 500 MB database, 1 GB file storage, 5 GB egress, 2 projects. **Pauses after 1 week with no activity**, so open it before each client demo. |
| Email | Resend Free | 3,000 emails a month, 100 a day |
| Payments | PayMongo test mode | Free. No real money moves; uses test GCash, Maya and card numbers. |
| Domain | None for the POC | Use the free `*.vercel.app` address |

Images live in Supabase Storage (already in the stack; 1 GB holds hundreds of compressed product photos).

## Pages and features

Seven shopper pages and two admin pages, all mobile-first (most shoppers arrive from Instagram on their phones).

| Page | Route | What it does |
|---|---|---|
| Home | `/` | Hero banner, latest drop, featured products, link to Instagram |
| Shop | `/shop` | Product grid with filters for category and size, sort by newest or price |
| Product | `/product/[slug]` | Photo gallery, price, size picker with stock per size, add to cart, "Sold out" state |
| Cart | `/cart` | Line items, quantity, remove, subtotal, flat shipping fee, total |
| Checkout | `/checkout` | Name, phone, email, delivery address, then hands off to PayMongo |
| Order confirmed | `/order/[id]` | Order summary and status after payment |
| About | `/about` | Brand story and what "overruns" means for the shopper |
| Admin: products | `/admin/products` | Add or edit a product, upload photos, set stock per size |
| Admin: orders | `/admin/orders` | List of orders with status (pending, paid, shipped) |

The cart lives in the browser (localStorage); shoppers don't need an account. Only the owner logs in (Supabase Auth email login) to reach `/admin`.

## Data model

Prices are stored in centavos (whole numbers).

| Table | Key columns | Notes |
|---|---|---|
| `products` | `id`, `slug`, `name`, `description`, `category`, `price_centavos`, `images` (list of storage paths), `is_active`, `created_at` | One row per item |
| `product_variants` | `id`, `product_id`, `size` (XS to XXL), `stock` | Stock tracked per size |
| `orders` | `id`, `customer_name`, `email`, `phone`, `address`, `subtotal_centavos`, `shipping_centavos`, `total_centavos`, `status`, `paymongo_checkout_id`, `created_at` | Status is `pending`, `paid`, `shipped` or `cancelled` |
| `order_items` | `id`, `order_id`, `variant_id`, `product_name`, `size`, `qty`, `price_centavos` | Copies name and price at purchase time |

Row Level Security on every table: anyone can read active products, only server code can create orders, only the admin can edit products or see orders.

## Checkout and payments

PayMongo Hosted Checkout with test API keys. Shipping is a flat fee (e.g. ₱150) set in one config value.

1. Shopper submits the checkout form. A server action re-checks stock and prices from the database, never trusting the browser's cart.
2. Server creates an `orders` row (`pending`) and its `order_items`.
3. Server creates a PayMongo Checkout Session with line items, allowed payment methods (card, GCash, Maya, QR Ph), and `success_url` → `/order/[id]`. Saves the `cs_...` id on the order.
4. Shopper is redirected to PayMongo and pays with test details.
5. PayMongo calls `/api/webhooks/paymongo` with `checkout_session.payment.paid`. The route verifies the signature, marks the order `paid`, and lowers stock per size.
6. Resend sends the order confirmation email.
7. Shopper lands on `/order/[id]`, which shows the order and status.

The webhook, not the redirect, marks an order paid. PayMongo secret key and webhook secret stay in Vercel env vars. Going live = swap in live keys, no code changes.

## Visual direction ("warehouse editorial")

| Element | Choice |
|---|---|
| Background | Off-white `#F5F3EE`, white `#FFFFFF` product cards |
| Text | Near-black `#111111`, muted gray `#6B6B6B` for secondary |
| Accent | Tag orange `#E85D2A` for buttons, "Overrun price" badge, sale prices |
| Display font | Archivo Black (or Anton), uppercase, headings + wordmark |
| Body font | Inter, 16px base |
| Prices | Original retail price struck through in gray, overrun price bold black |
| Motifs | Hang-tag badges, thin 1px black borders, "LIMITED STOCK" labels, square product photos on plain backgrounds |
| Corners/shadows | Square corners (0–4px), no drop shadows |

The struck-through retail price next to the overrun price appears on every product card and product page.

## Build plan

1. Mockups (Stitch) → client thumbs-up. 2. Setup. 3. Catalog. 4. Cart. 5. Checkout. 6. Email. 7. Admin. 8. Demo.

**Done when:**
- [ ] A shopper can find a product, pick a size, and add it to the cart on a phone
- [ ] A test GCash, Maya or card payment marks the order paid and lowers stock
- [ ] A sold-out size can't be added to the cart
- [ ] The shopper gets a confirmation email
- [ ] The owner can add a product with photos and see new orders without touching code

## Before launch (after the POC)

Vercel Pro, Supabase Pro, custom domain, PayMongo live keys after business verification.
