// frontend/src/components/TherapistSelector.jsx

import React from 'react';

function TherapistSelector({ therapists, selectedTherapist, onChange }) {
  return (
    <div className="form-group">
      <label htmlFor="therapist-select">Masseur</label>
      <select id="therapist-select" value={selectedTherapist} onChange={onChange}>
        <option value="">-- Alle verfügbaren --</option>
        {therapists.map(therapist => (
          <option key={therapist.id} value={therapist.id}>
            {therapist.full_name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default TherapistSelector;