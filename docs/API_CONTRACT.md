# Kisan Queue API Contract

Base URL:

http://localhost:5000/api

---

## 1. Register Farmer

### POST /farmers/register

Purpose:
Register a new farmer in the system.

Request:

{
  "name": "Ravi Kumar",
  "phone": "9876543210",
  "village": "Kovilpatti",
  "district": "Thoothukudi",
  "land_holding_acres": 3.5,
  "primary_crop": "Rice",
  "preferred_language": "Tamil",
  "smartphone_access": "Yes"
}

Response:

{
  "farmer_id": "F001",
  "message": "Farmer registered successfully"
}

---

## 2. Book a Slot

### POST /bookings

Purpose:
Create a booking for a farmer and assign a queue position.

Request:

{
  "farmer_id": "F001",
  "slot_id": "S001",
  "centre_id": "C001",
  "crop": "Rice",
  "quantity_quintals": 10
}

Response:

{
  "booking_id": "B001",
  "queue_position": 5,
  "estimated_wait_minutes": 40,
  "status": "Booked"
}

---

## 3. Get Farmer Booking Status

### GET /bookings/:farmerId

Purpose:
Show the farmer's current booking, queue position,
estimated waiting time and procurement/payment status.

Example:

GET /api/bookings/F001

Response:

{
  "farmer_id": "F001",
  "booking_id": "B001",
  "status": "Confirmed",
  "queue_position": 5,
  "estimated_wait_minutes": 40,
  "grading_result": "Good",
  "procured_quantity_quintals": 10,
  "payment_status": "Pending"
}

---

## 4. Get All Centres

### GET /centres

Purpose:
Return all procurement centres.

Response:

[
  {
    "centre_id": "C001",
    "centre_name": "Kovilpatti Procurement Centre",
    "village_town": "Kovilpatti",
    "district": "Thoothukudi",
    "state": "Tamil Nadu",
    "daily_capacity_slots": 100
  }
]

---

## 5. Get Available Slots

### GET /centres/:id/slots?date=

Purpose:
Show available time slots for a particular centre and date.

Example:

GET /api/centres/C001/slots?date=2026-08-27

Response:

[
  {
    "slot_id": "S001",
    "date": "2026-08-27",
    "start_time": "09:00",
    "end_time": "10:00",
    "max_farmers": 20,
    "booked_count": 12,
    "available": 8
  }
]

---

## 6. Get Live Queue

### GET /centres/:id/queue

Purpose:
Show the current queue for the admin dashboard.

Example:

GET /api/centres/C001/queue

Response:

[
  {
    "booking_id": "B001",
    "farmer_id": "F001",
    "farmer_name": "Ravi Kumar",
    "queue_position": 1,
    "status": "Checked-In"
  },
  {
    "booking_id": "B002",
    "farmer_id": "F002",
    "farmer_name": "Suresh",
    "queue_position": 2,
    "status": "Confirmed"
  }
]

---

## 7. Update Booking Status

### PATCH /bookings/:id/status

Purpose:
Allow admin staff to move a booking through the procurement process.

Possible statuses:

Booked
Confirmed
Checked-In
Grading
Procured
Payment

Example:

PATCH /api/bookings/B001/status

Request:

{
  "status": "Grading"
}

Response:

{
  "booking_id": "B001",
  "status": "Grading",
  "message": "Booking status updated successfully"
}

---

## 8. Get Notifications

### GET /notifications/:farmerId

Purpose:
Show simulated SMS/in-app notifications sent to the farmer.

Example:

GET /api/notifications/F001

Response:

[
  {
    "message": "Your slot is confirmed.",
    "type": "SMS",
    "sent_at": "2026-08-27 08:30"
  },
  {
    "message": "You are next in the queue.",
    "type": "SMS",
    "sent_at": "2026-08-27 09:45"
  }
]