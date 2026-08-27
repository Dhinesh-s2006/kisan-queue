import { useState } from 'react';
import API from '../api';

export default function RaiseGrievance() {
  const [farmerId, setFarmerId] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [centreId, setCentreId] = useState('');
  const [issueType, setIssueType] = useState('Payment Delay');
  const [description, setDescription] = useState('');

  const [message, setMessage] = useState('');
  const [grievances, setGrievances] = useState([]);
  const [loading, setLoading] = useState(false);

  const submitGrievance = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setMessage('');

      const res = await API.post('/grievances', {
        farmer_id: farmerId,
        booking_id: bookingId || null,
        centre_id: centreId,
        issue_type: issueType,
        description
      });

      setMessage(
        `Grievance submitted successfully! Ticket ID: ${res.data.grievance_id}. Your SLA is ${res.data.sla_hours} hours.`
      );

      setDescription('');
      setBookingId('');

      fetchGrievances();

    } catch (err) {
      console.error(err);

      setMessage(
        err.response?.data?.message ||
        'Unable to submit grievance.'
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchGrievances = async () => {
    if (!farmerId) {
      setMessage('Please enter your Farmer ID first.');
      return;
    }

    try {
      const res = await API.get(`/grievances/${farmerId}`);
      setGrievances(res.data);
    } catch (err) {
      console.error(err);
      setMessage('Unable to load grievances.');
    }
  };

  const getStatusStyle = (status) => {
    if (status === 'Escalated') {
      return {
        background: '#ffebee',
        color: '#c62828'
      };
    }

    if (status === 'Due Soon') {
      return {
        background: '#fff3e0',
        color: '#ef6c00'
      };
    }

    if (status === 'Resolved') {
      return {
        background: '#e8f5e9',
        color: '#2e7d32'
      };
    }

    return {
      background: '#e3f2fd',
      color: '#1565c0'
    };
  };

  return (
    <div>

      <h2>Raise an Issue</h2>

      <p style={{ color: '#666' }}>
        Report a problem related to your procurement.
      </p>

      <form onSubmit={submitGrievance}>

        <div style={{ marginBottom: 12 }}>
          <label>Farmer ID</label><br />

          <input
            placeholder="Example: F671242"
            value={farmerId}
            onChange={e => setFarmerId(e.target.value)}
            required
          />
        </div>


        <div style={{ marginBottom: 12 }}>
          <label>Centre ID</label><br />

          <input
            placeholder="Example: PC001"
            value={centreId}
            onChange={e => setCentreId(e.target.value)}
            required
          />
        </div>


        <div style={{ marginBottom: 12 }}>
          <label>Booking ID (optional)</label><br />

          <input
            placeholder="Example: B00001"
            value={bookingId}
            onChange={e => setBookingId(e.target.value)}
          />
        </div>


        <div style={{ marginBottom: 12 }}>
          <label>Issue Type</label><br />

          <select
            value={issueType}
            onChange={e => setIssueType(e.target.value)}
          >
            <option>Payment Delay</option>
            <option>Grading Dispute</option>
            <option>Staff Conduct</option>
            <option>Other</option>
          </select>
        </div>


        <div style={{ marginBottom: 12 }}>
          <label>Describe your issue</label><br />

          <textarea
            placeholder="Explain the problem..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows="5"
            required
          />
        </div>


        <button type="submit" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit Issue'}
        </button>

      </form>


      {message && (
        <div
          style={{
            marginTop: 15,
            padding: 12,
            background: '#fff8e1',
            border: '1px solid #ffe082',
            borderRadius: 6
          }}
        >
          {message}
        </div>
      )}


      <hr style={{ margin: '30px 0' }} />


      <h2>My Grievances</h2>

      <button onClick={fetchGrievances}>
        Refresh My Tickets
      </button>


      {grievances.length === 0 && (
        <p style={{ color: '#777', marginTop: 15 }}>
          No grievances found.
        </p>
      )}


      {grievances.map(g => (

        <div
          key={g.grievance_id}
          style={{
            border: '1px solid #ccc',
            borderRadius: 6,
            padding: 15,
            marginTop: 12
          }}
        >

          <b>Ticket ID: {g.grievance_id}</b>

          <p>
            <b>Issue:</b> {g.issue_type}
          </p>

          <p>
            <b>Description:</b> {g.description}
          </p>

          <p>
            <b>Status:</b> {g.status}
          </p>

          <span
            style={{
              ...getStatusStyle(g.sla_status),
              padding: '5px 10px',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 'bold'
            }}
          >
            {g.sla_status}
          </span>

          {g.sla_status !== 'Resolved' && (
            <p style={{ marginTop: 12 }}>
              <b>SLA Deadline:</b>{' '}
              {new Date(g.sla_deadline).toLocaleString()}
            </p>
          )}

          {g.resolution_notes && (
            <p>
              <b>Resolution:</b> {g.resolution_notes}
            </p>
          )}

        </div>

      ))}

    </div>
  );
}