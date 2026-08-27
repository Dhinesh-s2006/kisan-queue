require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// List centres
app.get('/api/centres', async (req, res) => {
  const r = await pool.query('SELECT * FROM centres');
  res.json(r.rows);
});

// Slots for a centre on a date
app.get('/api/centres/:id/slots', async (req, res) => {
  const { date } = req.query;
  const r = await pool.query(
    'SELECT * FROM slots WHERE centre_id=$1 AND date=$2 ORDER BY start_time',
    [req.params.id, date]
  );
  res.json(r.rows);
});

// Register farmer
app.post('/api/farmers/register', async (req, res) => {
  const { farmer_id, name, phone, village, district, land_holding_acres,
          primary_crop, preferred_language, smartphone_access } = req.body;
  await pool.query(
    `INSERT INTO farmers VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (farmer_id) DO UPDATE SET name=$2`,
    [farmer_id, name, phone, village, district, land_holding_acres,
     primary_crop, preferred_language, smartphone_access]
  );
  res.json({ success: true, farmer_id });
});

// Create booking (auto queue position)
app.post('/api/bookings', async (req, res) => {
  const { booking_id, farmer_id, slot_id, centre_id, booking_date, crop,
          quantity_quintals, msp_rate_inr } = req.body;

    // Check if requested slot is full
  const slotCheck = await pool.query(
  'SELECT * FROM slots WHERE slot_id=$1',
  [slot_id]
);

if (slotCheck.rows.length === 0) {
  return res.status(404).json({
    error: 'slot_not_found',
    message: 'Selected slot does not exist.'
  });
}

const slot = slotCheck.rows[0];

if (slot.booked_count >= slot.max_farmers) {
    // find next available slot at same centre, same day, later time
    const alt = await pool.query(
      `SELECT * FROM slots WHERE centre_id=$1 AND date=$2 AND booked_count < max_farmers
       AND start_time > $3 ORDER BY start_time LIMIT 1`,
      [centre_id, booking_date, slot.start_time]
    );
    if (alt.rows.length > 0) {
      return res.status(409).json({
        error: 'slot_full',
        message: 'This slot is full. Nearest available slot suggested.',
        suggested_slot: alt.rows[0]
      });
    }
    // no slots left today at this centre — suggest a nearby centre same day
    const altCentre = await pool.query(
      `SELECT s.* FROM slots s WHERE s.date=$1 AND s.centre_id != $2
       AND s.booked_count < s.max_farmers ORDER BY s.start_time LIMIT 1`,
      [booking_date, centre_id]
    );
    return res.status(409).json({
      error: 'centre_full',
      message: 'No slots left today at this centre. Nearby centre suggested.',
      suggested_slot: altCentre.rows[0] || null
    });
  }
  const countRes = await pool.query(
    "SELECT COUNT(*) FROM bookings WHERE slot_id=$1 AND status != 'Payment Completed'",
    [slot_id]
  );
  const queuePos = parseInt(countRes.rows[0].count) + 1;

  // NEW: pull real moving-average processing time instead of hardcoded 12
  const avgRes = await pool.query(`
    SELECT booking_id,
      MAX(CASE WHEN status='Checked-In' THEN changed_at END) AS checkin_time,
      MAX(CASE WHEN status='Procured' THEN changed_at END) AS procured_time
    FROM status_history WHERE centre_id=$1
    GROUP BY booking_id
    HAVING MAX(CASE WHEN status='Procured' THEN changed_at END) IS NOT NULL
    ORDER BY procured_time DESC LIMIT 10
  `, [centre_id]);

  let avgMinutes;
  if (avgRes.rows.length > 0) {
    const durations = avgRes.rows.map(row => (new Date(row.procured_time) - new Date(row.checkin_time)) / 60000);
    avgMinutes = durations.reduce((a, b) => a + b, 0) / durations.length;
  } else {
    const c = await pool.query('SELECT daily_capacity_slots FROM centres WHERE centre_id=$1', [centre_id]);
    avgMinutes = 480 / c.rows[0].daily_capacity_slots; // cold-start fallback
  }

  const estWait = Math.round(queuePos * avgMinutes);

  await pool.query(
    `INSERT INTO bookings (booking_id, farmer_id, slot_id, centre_id, booking_date,
     crop, quantity_quintals, status, msp_rate_inr, payment_status,
     queue_position_at_booking, estimated_wait_minutes, sms_notifications_sent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'Confirmed',$8,'Not Applicable',$9,$10,1)`,
    [booking_id, farmer_id, slot_id, centre_id, booking_date, crop,
     quantity_quintals, msp_rate_inr, queuePos, estWait]
  );
  await pool.query('UPDATE slots SET booked_count = booked_count + 1 WHERE slot_id=$1', [slot_id]);

  res.json({ success: true, booking_id, queue_position: queuePos, estimated_wait_minutes: estWait });
});


// Farmer's bookings/status
app.get('/api/bookings/:farmerId', async (req, res) => {
  const r = await pool.query('SELECT * FROM bookings WHERE farmer_id=$1 ORDER BY booking_date DESC', [req.params.farmerId]);
  res.json(r.rows);
});

// Admin: live queue for a centre
app.get('/api/centres/:id/queue', async (req, res) => {
  const r = await pool.query(
    `SELECT b.*, f.name, f.phone FROM bookings b
     JOIN farmers f ON b.farmer_id = f.farmer_id
     WHERE b.centre_id=$1 AND b.status NOT IN ('Payment Completed', 'No-Show')
     ORDER BY b.booking_date, b.queue_position_at_booking`,
    [req.params.id]
  );
  res.json(r.rows);
});

// Advance booking status (also fakes a notification)
// Advance booking status
const STATUS_FLOW = [
  'Booked',
  'Confirmed',
  'Checked-In',
  'Grading',
  'Procured',
  'Payment Pending',
  'Payment Completed'
];

app.patch('/api/bookings/:id/status', async (req, res) => {
  const { status } = req.body;

  const booking = await pool.query(
    'SELECT centre_id FROM bookings WHERE booking_id=$1',
    [req.params.id]
  );

  if (booking.rows.length === 0) {
    return res.status(404).json({
      error: 'booking_not_found',
      message: 'Booking not found.'
    });
  }

  const centreId = booking.rows[0].centre_id;

  await pool.query(
    `UPDATE bookings
     SET status=$1,
         sms_notifications_sent = sms_notifications_sent + 1
     WHERE booking_id=$2`,
    [status, req.params.id]
  );

  await pool.query(
    `INSERT INTO status_history
     (booking_id, centre_id, status)
     VALUES ($1,$2,$3)`,
    [req.params.id, centreId, status]
  );

  res.json({
    success: true,
    booking_id: req.params.id,
    new_status: status
  });
});


// Mark a booking as No-Show
app.post('/api/bookings/:id/no-show', async (req, res) => {
  try {
    const b = await pool.query(
      'SELECT * FROM bookings WHERE booking_id=$1',
      [req.params.id]
    );

    if (b.rows.length === 0) {
      return res.status(404).json({
        error: 'booking_not_found',
        message: 'Booking not found.'
      });
    }

    const booking = b.rows[0];

    // Prevent marking completed booking as No-Show
    if (booking.status === 'Payment Completed') {
      return res.status(400).json({
        error: 'invalid_status',
        message: 'Completed booking cannot be marked as No-Show.'
      });
    }

    // Mark booking as No-Show
    await pool.query(
      `UPDATE bookings
       SET status='No-Show'
       WHERE booking_id=$1`,
      [req.params.id]
    );

    // Free the slot
    await pool.query(
      `UPDATE slots
       SET booked_count = GREATEST(booked_count - 1, 0)
       WHERE slot_id=$1`,
      [booking.slot_id]
    );

    // Record status change
    await pool.query(
      `INSERT INTO status_history
       (booking_id, centre_id, status)
       VALUES ($1,$2,'No-Show')`,
      [booking.booking_id, booking.centre_id]
    );

    res.json({
      success: true,
      booking_id: booking.booking_id,
      new_status: 'No-Show',
      message: `Slot freed up for ${booking.slot_id}.`
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'server_error',
      message: 'Unable to mark booking as No-Show.'
    });
  }
});

// Moving average processing time per centre (minutes between Checked-In -> Procured)
app.get('/api/centres/:id/avg-processing-time', async (req, res) => {
  const r = await pool.query(`
    SELECT booking_id,
      MAX(CASE WHEN status='Checked-In' THEN changed_at END) AS checkin_time,
      MAX(CASE WHEN status='Procured' THEN changed_at END) AS procured_time
    FROM status_history
    WHERE centre_id=$1
    GROUP BY booking_id
    HAVING MAX(CASE WHEN status='Procured' THEN changed_at END) IS NOT NULL
    ORDER BY procured_time DESC
    LIMIT 10
  `, [req.params.id]);

  if (r.rows.length === 0) {
    // cold start fallback: capacity-based estimate (480 working min / daily capacity)
    const c = await pool.query('SELECT daily_capacity_slots FROM centres WHERE centre_id=$1', [req.params.id]);
    const fallback = Math.round(480 / c.rows[0].daily_capacity_slots);
    return res.json({ avg_minutes_per_farmer: fallback, source: 'capacity_fallback', sample_size: 0 });
  }

  const durations = r.rows.map(row => (new Date(row.procured_time) - new Date(row.checkin_time)) / 60000);
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;

  res.json({ avg_minutes_per_farmer: Math.round(avg), source: 'moving_average', sample_size: durations.length });
});


// =====================================================
// GRIEVANCE / COMPLAINT SYSTEM WITH SLA ESCALATION
// =====================================================

// SLA time limits in hours
const SLA_HOURS = {
  'Payment Delay': 48,
  'Grading Dispute': 24,
  'Staff Conduct': 72,
  'Other': 72
};


// 1. Farmer raises a grievance
app.post('/api/grievances', async (req, res) => {
  try {
    const {
      farmer_id,
      booking_id,
      centre_id,
      issue_type,
      description
    } = req.body;

    // Basic validation
    if (!farmer_id || !centre_id || !issue_type || !description) {
      return res.status(400).json({
        error: 'missing_fields',
        message: 'Farmer ID, centre ID, issue type and description are required.'
      });
    }

    // Check farmer exists
    const farmer = await pool.query(
      'SELECT farmer_id FROM farmers WHERE farmer_id=$1',
      [farmer_id]
    );

    if (farmer.rows.length === 0) {
      return res.status(404).json({
        error: 'farmer_not_found',
        message: 'Farmer not found.'
      });
    }

    // Check centre exists
    const centre = await pool.query(
      'SELECT centre_id FROM centres WHERE centre_id=$1',
      [centre_id]
    );

    if (centre.rows.length === 0) {
      return res.status(404).json({
        error: 'centre_not_found',
        message: 'Centre not found.'
      });
    }

    // Generate grievance ID
    const grievance_id =
      'G' + Date.now().toString().slice(-8);

    // Get SLA duration
    const slaHours = SLA_HOURS[issue_type] || 72;

    // Insert grievance
    await pool.query(
      `INSERT INTO grievances
       (
         grievance_id,
         booking_id,
         farmer_id,
         centre_id,
         issue_type,
         description,
         status,
         sla_deadline
       )
       VALUES
       (
         $1,$2,$3,$4,$5,$6,'Open',
         NOW() + ($7 * INTERVAL '1 hour')
       )`,
      [
        grievance_id,
        booking_id || null,
        farmer_id,
        centre_id,
        issue_type,
        description,
        slaHours
      ]
    );

    res.json({
      success: true,
      grievance_id,
      status: 'Open',
      sla_hours: slaHours,
      message: `Grievance raised successfully. It must be resolved within ${slaHours} hours.`
    });

  } catch (err) {
    console.error('Create grievance error:', err);

    res.status(500).json({
      error: 'server_error',
      message: 'Unable to create grievance.'
    });
  }
});


// 2. Farmer views their grievances
app.get('/api/grievances/:farmerId', async (req, res) => {
  try {

    const r = await pool.query(
      `SELECT
         *,
         CASE
           WHEN status = 'Resolved'
             THEN 'Resolved'

           WHEN NOW() > sla_deadline
             THEN 'Escalated'

           WHEN sla_deadline - NOW() < INTERVAL '6 hours'
             THEN 'Due Soon'

           ELSE 'On Track'
         END AS sla_status

       FROM grievances

       WHERE farmer_id=$1

       ORDER BY created_at DESC`,
      [req.params.farmerId]
    );

    res.json(r.rows);

  } catch (err) {

    console.error('Get farmer grievances error:', err);

    res.status(500).json({
      error: 'server_error',
      message: 'Unable to load grievances.'
    });
  }
});


// 3. Admin views grievances for a centre
app.get('/api/centres/:id/grievances', async (req, res) => {
  try {

    const r = await pool.query(
      `SELECT
         g.*,
         f.name AS farmer_name,
         f.phone,

         CASE
           WHEN g.status = 'Resolved'
             THEN 'Resolved'

           WHEN NOW() > g.sla_deadline
             THEN 'Escalated'

           WHEN g.sla_deadline - NOW() < INTERVAL '6 hours'
             THEN 'Due Soon'

           ELSE 'On Track'
         END AS sla_status,

         EXTRACT(
           EPOCH FROM
           (g.sla_deadline - NOW())
         ) / 3600 AS hours_remaining

       FROM grievances g

       JOIN farmers f
         ON g.farmer_id = f.farmer_id

       WHERE g.centre_id=$1

       ORDER BY
         CASE
           WHEN g.status != 'Resolved'
            AND NOW() > g.sla_deadline
           THEN 0
           ELSE 1
         END,

         g.sla_deadline ASC`,
      [req.params.id]
    );

    res.json(r.rows);

  } catch (err) {

    console.error('Get centre grievances error:', err);

    res.status(500).json({
      error: 'server_error',
      message: 'Unable to load grievances.'
    });
  }
});


// 4. Admin marks grievance as In Progress / Escalated
app.patch('/api/grievances/:id/status', async (req, res) => {
  try {

    const { status } = req.body;

    const allowedStatuses = [
      'Open',
      'In Progress',
      'Escalated'
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: 'invalid_status',
        message: 'Invalid grievance status.'
      });
    }

    const result = await pool.query(
      `UPDATE grievances
       SET status=$1
       WHERE grievance_id=$2
       RETURNING *`,
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'grievance_not_found',
        message: 'Grievance not found.'
      });
    }

    res.json({
      success: true,
      grievance: result.rows[0]
    });

  } catch (err) {

    console.error('Update grievance status error:', err);

    res.status(500).json({
      error: 'server_error',
      message: 'Unable to update grievance status.'
    });
  }
});


// 5. Admin resolves grievance
app.patch('/api/grievances/:id/resolve', async (req, res) => {
  try {

    const { resolution_notes } = req.body;

    const result = await pool.query(
      `UPDATE grievances

       SET
         status='Resolved',
         resolved_at=NOW(),
         resolution_notes=$1

       WHERE grievance_id=$2

       RETURNING *`,
      [
        resolution_notes || 'Resolved by centre staff',
        req.params.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'grievance_not_found',
        message: 'Grievance not found.'
      });
    }

    res.json({
      success: true,
      grievance: result.rows[0]
    });

  } catch (err) {

    console.error('Resolve grievance error:', err);

    res.status(500).json({
      error: 'server_error',
      message: 'Unable to resolve grievance.'
    });
  }
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is using the correct index.js' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));