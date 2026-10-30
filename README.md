# Daily Care

A personal tracker I built for my own daily routine: supplements, skincare, alternating gels, an azelaic acid schedule and a shaving blade counter.

It's made for me, so there's **no customization**. The products, routine order and schedules are hardcoded.

If you like the design sense and UI/UX, feel free to clone it and make one for yourself.

## What it does

- **Checklist:** morning, afternoon, evening and night supplements and eye drops.
- **Skincare:** morning and night routines in strict order.
- **Gels:** Nioclean and Sebozit alternate daily.
- **Azelaic acid:** shows up every 3rd day (two days off in between).
- **Blade:** counts shaves out of 20.
- **History:** tap a past day to edit it.

Everything is saved in your browser's `localStorage`. There's no backend and no account.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Stack

Next.js, React and plain CSS. Icons are Twemoji, plus a few brand icons for the products I use.

## Making it yours

- Items and routines: `app/page.tsx`
- Data and schedule logic: `lib/store.ts`
- Styles: `app/globals.css`

Please swap out the brand icons in `public/emoji` for your own products.
