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
      {centreId && <GrievancePanel centreId={centreId} />}
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

function GrievancePanel({ centreId }) {
  const [grievances, setGrievances] = useState([]);
  const [notes, setNotes] = useState({});

  const load = async () => {
    if (!centreId) return;

    const res = await API.get(`/centres/${centreId}/grievances`);
    setGrievances(res.data);
  };

  useEffect(() => {
    load();
  }, [centreId]);

  const resolve = async (id) => {
    await API.patch(
      `/grievances/${id}/resolve`,
      {
        resolution_notes: notes[id] || 'Resolved by staff'
      }
    );

    load();
  };

  const badgeColor = {
    'On Track': '#4caf50',
    'Due Soon': '#ff9800',
    'Escalated': '#f44336',
    'Resolved': '#9e9e9e'
  };

  return (
    <div style={{ marginTop: 30 }}>
      <h2>Grievances</h2>

      <table
        width="100%"
        border="1"
        cellPadding="8"
        style={{ borderCollapse: 'collapse' }}
      >
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th>Farmer</th>
            <th>Type</th>
            <th>Description</th>
            <th>SLA Status</th>
            <th>Hrs Left</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {grievances.map(g => (
            <tr key={g.grievance_id}>
              <td>
                {g.farmer_name} ({g.phone})
              </td>

              <td>
                {g.issue_type}
              </td>

              <td>
                {g.description}
              </td>

              <td>
                <span
                  style={{
                    background: badgeColor[g.sla_status],
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: 4
                  }}
                >
                  {g.sla_status}
                </span>
              </td>

              <td>
                {g.status === 'Resolved'
                  ? '—'
                  : Math.max(
                      0,
                      Math.round(g.hours_remaining)
                    )}
              </td>

              <td>
                {g.status !== 'Resolved' && (
                  <>
                    <input
                      placeholder="Resolution note"
                      style={{ width: 100 }}
                      onChange={e =>
                        setNotes({
                          ...notes,
                          [g.grievance_id]: e.target.value
                        })
                      }
                    />

                    <button
                      onClick={() =>
                        resolve(g.grievance_id)
                      }
                    >
                      Resolve
                    </button>
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