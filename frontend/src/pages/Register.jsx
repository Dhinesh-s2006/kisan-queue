import { useState } from 'react';
import API from '../api';

export default function Register() {
  const [form, setForm] = useState({
    farmer_id: '', name: '', phone: '', village: '', district: '',
    land_holding_acres: '', primary_crop: '', preferred_language: 'Marathi',
    smartphone_access: 'Yes'
  });
  const [msg, setMsg] = useState('');

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    const farmer_id = form.farmer_id || 'F' + Date.now().toString().slice(-6);
    await API.post('/farmers/register', { ...form, farmer_id });
    setMsg(`Registered! Your Farmer ID is ${farmer_id} — save this for booking & status checks.`);
  };

  return (
    <div>
      <h2>Farmer Registration</h2>
      <form onSubmit={handleSubmit}>
        <input name="name" placeholder="Full Name" onChange={handleChange} required /><br/>
        <input name="phone" placeholder="Phone Number" onChange={handleChange} required /><br/>
        <input name="village" placeholder="Village" onChange={handleChange} required /><br/>
        <input name="district" placeholder="District" onChange={handleChange} required /><br/>
        <input name="land_holding_acres" type="number" placeholder="Land (acres)" onChange={handleChange} /><br/>
        <input name="primary_crop" placeholder="Primary Crop" onChange={handleChange} /><br/>
        <select name="preferred_language" onChange={handleChange}>
          <option>Marathi</option><option>Hindi</option><option>English</option>
        </select><br/>
        <label>Has Smartphone?
          <select name="smartphone_access" onChange={handleChange}>
            <option>Yes</option><option>No</option>
          </select>
        </label><br/>
        <button type="submit">Register</button>
      </form>
      {msg && <p style={{ color: 'green', fontWeight: 'bold' }}>{msg}</p>}
    </div>
  );
}