import { useState, useEffect } from 'react';
import axios from 'axios';

const API = axios.create({ baseURL: 'http://localhost:4000/api' });
const STATUS_FLOW = ['Booked','Confirmed','Checked-In','Grading','Procured','Payment Pending','Payment Completed'];

export default function App() {
  const [centres, setCentres] = useState([]);
  const [centreId, setCentreId] = useState('');
  const [queue, setQueue] = useState([]);

  useEffect(() => { API.get('/centres').then(res => setCentres(res.data)); }, []);

  const loadQueue = async (id) => {
    setCentreId(id);
    const res = await API.get(`/centres/${id}/queue`);
    setQueue(res.data);
  };

  const advanceStatus = async (booking) => {
    const idx = STATUS_FLOW.indexOf(booking.status);
    const next = STATUS_FLOW[Math.min(idx + 1, STATUS_FLOW.length - 1)];
    await API.patch(`/bookings/${booking.booking_id}/status`, { status: next });
    loadQueue(centreId); // refresh
  };

  const markNoShow = async (booking) => {
  try {
    await API.post(`/bookings/${booking.booking_id}/no-show`);
    loadQueue(centreId);
  } catch (err) {
    console.error(err);
    alert(
      err.response?.data?.message ||
      'Unable to mark booking as No-Show.'
    );
  }
};

  const totalBooked = queue.length;
  const centre = centres.find(c => c.centre_id === centreId);
  const utilization = centre ? Math.round((totalBooked / centre.daily_capacity_slots) * 100) : 0;

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto' }}>
      <h1>Kisan Queue — Admin Dashboard</h1>

      <div style={{ marginBottom: 20 }}>
        <b>Select Centre: </b>
        {centres.map(c => (
          <button key={c.centre_id} onClick={() => loadQueue(c.centre_id)} style={{ marginRight: 8 }}>
            {c.centre_name}
          </button>
        ))}
      </div>

      {centreId && (
        <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
          <Stat label="Farmers in Queue" value={totalBooked} />
          <Stat label="Capacity Utilization" value={`${utilization}%`} />
          <Stat label="Centre Capacity" value={centre?.daily_capacity_slots} />
        </div>
      )}

      <table width="100%" border="1" cellPadding="8" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th>Farmer</th><th>Phone</th><th>Crop</th><th>Qty</th>
            <th>Status</th><th>Payment</th><th>Action</th>
          </tr>
        </thead>
        <tbody>
          {queue.map(b => (
            <tr key={b.booking_id}>
              <td>{b.name}</td>
              <td>{b.phone}</td>
              <td>{b.crop}</td>
              <td>{b.quantity_quintals}</td>
              <td><b>{b.status}</b></td>
              <td>{b.payment_status}</td>
              <td>
                {b.status !== 'Payment Completed' &&
                b.status !== 'No-Show' && (
                  <>
                    <button onClick={() => advanceStatus(b)}>
                      Advance →
                    </button>

                    {b.status === 'Confirmed' && (
                      <button
                        onClick={() => markNoShow(b)}
                        style={{
                          marginLeft: 8,
                          background: '#f8d7da',
                          border: '1px solid #dc3545',
                          padding: '4px 8px',
                          cursor: 'pointer'
                        }}
                      >
                        Mark No-Show
                      </button>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ background: '#e8f5e9', padding: 16, borderRadius: 8, flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 'bold' }}>{value}</div>
      <div>{label}</div>
    </div>
  );
}