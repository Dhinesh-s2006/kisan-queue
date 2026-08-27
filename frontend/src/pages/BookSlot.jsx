import { useState, useEffect } from 'react';
import API from '../api';

export default function BookSlot() {
  const [farmerId, setFarmerId] = useState('');
  const [centres, setCentres] = useState([]);
  const [centreId, setCentreId] = useState('');
  const [date, setDate] = useState('2026-03-01');
  const [slots, setSlots] = useState([]);
  const [crop, setCrop] = useState('');
  const [qty, setQty] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    API.get('/centres').then(res => setCentres(res.data));
  }, []);

  const loadSlots = async () => {
    if (!centreId || !date) return;
    const res = await API.get(`/centres/${centreId}/slots`, { params: { date } });
    setSlots(res.data);
  };

const bookSlot = async (slot) => {
  try {
    const booking_id = 'B' + Date.now().toString().slice(-6);

    const res = await API.post('/bookings', {
      booking_id,
      farmer_id: farmerId,
      slot_id: slot.slot_id,
      centre_id: centreId,
      booking_date: date,
      crop,
      quantity_quintals: parseFloat(qty),
      msp_rate_inr: 2275
    });

    setResult(res.data);

  } catch (err) {

    if (err.response?.status === 409) {
      const data = err.response.data;

      setResult({
        overflow: true,
        message: data.message,
        suggested_slot: data.suggested_slot
      });

    } else {
      console.error(err);
      alert('Booking failed. Please try again.');
    }
  }
};
  return (
    <div>
      <h2>Book a Procurement Slot</h2>
      <input placeholder="Your Farmer ID" value={farmerId} onChange={e => setFarmerId(e.target.value)} /><br/>
      <select onChange={e => setCentreId(e.target.value)}>
        <option value="">Select Centre</option>
        {centres.map(c => <option key={c.centre_id} value={c.centre_id}>{c.centre_name}</option>)}
      </select><br/>
      <input type="date" value={date} onChange={e => setDate(e.target.value)} /><br/>
      <input placeholder="Crop" value={crop} onChange={e => setCrop(e.target.value)} /><br/>
      <input placeholder="Quantity (quintals)" type="number" value={qty} onChange={e => setQty(e.target.value)} /><br/>
      <button onClick={loadSlots}>Show Available Slots</button>

      <ul>
        {slots.map(s => (
          <li key={s.slot_id}>
            {s.start_time} - {s.end_time} (booked {s.booked_count}/{s.max_farmers})
            <button style={{ marginLeft: 10 }} onClick={() => bookSlot(s)}>Book</button>
          </li>
        ))}
      </ul>

   {result && result.success && (
  <div style={{
    background: '#e8f5e9',
    padding: 12,
    marginTop: 12
  }}>
    <b>Booking Confirmed!</b><br />
    Booking ID: {result.booking_id}<br />
    Queue Position: {result.queue_position}<br />
    Estimated Wait: {result.estimated_wait_minutes} min
  </div>
)}

{result?.overflow && (
  <div style={{
    background: '#fff3cd',
    padding: 12,
    marginTop: 12
  }}>
    <b>⚠️ Slot Full</b><br />
    {result.message}<br /><br />

    {result.suggested_slot && (
      <>
        <b>Suggested Slot:</b><br />

        {result.suggested_slot.start_time}
        {' - '}
        {result.suggested_slot.end_time}

        <br />

        Booked: {result.suggested_slot.booked_count}/
        {result.suggested_slot.max_farmers}

        <br /><br />

        <button
          onClick={() => bookSlot(result.suggested_slot)}
        >
          Book Suggested Slot
        </button>
      </>
    )}
  </div>
)}
    </div>
  );
}