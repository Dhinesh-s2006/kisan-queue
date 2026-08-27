import { useState } from 'react';
import API from '../api';

export default function MyStatus() {
  const [farmerId, setFarmerId] = useState('');
  const [bookings, setBookings] = useState([]);

  const fetchStatus = async () => {
    const res = await API.get(`/bookings/${farmerId}`);
    setBookings(res.data);
  };

  return (
    <div>
      <h2>My Procurement Status</h2>
      <input placeholder="Farmer ID" value={farmerId} onChange={e => setFarmerId(e.target.value)} />
      <button onClick={fetchStatus}>Check Status</button>

      {bookings.map(b => (
        <div key={b.booking_id} style={{ border: '1px solid #ccc', padding: 12, marginTop: 10 }}>
          <b>{b.crop}</b> — {b.quantity_quintals} quintals<br/>
          Status: <b>{b.status}</b><br/>
          Queue Position: {b.queue_position_at_booking} | Est. Wait: {b.estimated_wait_minutes} min<br/>
          {b.payment_status !== 'Not Applicable' && <>Payment: {b.payment_status} {b.payment_amount_inr ? `— ₹${b.payment_amount_inr}` : ''}<br/></>}
          Notifications sent: {b.sms_notifications_sent}
        </div>
      ))}
    </div>
  );
}