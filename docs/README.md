# Kisan Queue — Simulated Dataset (PS 26032)

Simulated data for demo/prototype purposes since live DoCA procurement data isn't accessible. Matches the "Data feasibility" section of the solution doc.

## Files

| File | Rows | Description |
|---|---|---|
| `centres.csv` / `.json` | 5 | Procurement centres (Pune & Ahmednagar district, Maharashtra) |
| `farmers.csv` / `.json` | 60 | Farmer profiles with village, crop, language, smartphone access |
| `slots.csv` / `.json` | 400 | 8 slots/day × 10 days × 5 centres, with capacity per slot |
| `bookings.csv` / `.json` | 150 | Core transactional data — the one to build your demo around |

## Schema notes

**bookings.csv** is the important one — it drives your queue engine, dashboard, and notification demo:
- `status`: one of `Booked → Confirmed → Checked-In → Grading → Procured → Payment Pending → Payment Completed` (use this to show the end-to-end flow live)
- `queue_position_at_booking` + `estimated_wait_minutes`: feed directly into your "live queue position" feature
- `grading_result`: `FAQ`, `Grade A`, `Grade B`, or `Below FAQ - Rejected` (rejected bookings have `procured_quantity_quintals = 0`)
- `payment_status`: `Not Applicable` / `Pending` / `Completed` — good for the payment-tracking demo screen
- `sms_notifications_sent`: count of notification triggers fired (0-4), useful to fake the notification log

**farmers.csv**: `smartphone_access` is ~75% "Yes" / 25% "No" — use the "No" farmers to demo your SMS-fallback story convincingly.

**crops & MSP rates** are illustrative (based on typical Maharashtra mandi crops — wheat, cotton, soybean, onion, etc.) — not live Agmarknet prices, so don't cite them as real MSP figures if asked; just say "indicative rates for demo purposes."

## Regenerating / extending

Run `python3 generate_dataset.py` then `python3 to_json.py` to regenerate. Change `NUM_FARMERS`, `NUM_BOOKINGS`, `NUM_DAYS`, or the `centres` list at the top of `generate_dataset.py` to scale the dataset up or down.

## Suggested use

- Seed your Postgres/Mongo DB directly from the JSON files.
- Use `bookings.json` to pre-populate the admin dashboard so it looks "alive" during the demo instead of empty.
- Filter a handful of bookings to `status = Booked` right before your live demo, so you can walk through the flow live for real end-to-end (book → queue update → notify → grade → pay) on top of the pre-seeded background data.
