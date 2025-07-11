// frontend/src/components/ServiceSelector.jsx

import React from 'react';

function ServiceSelector({ groupedServices, selectedService, onServiceChange, availableDurations, selectedDuration, onDurationChange }) {
  return (
    <>
      <div className="form-group">
        <label htmlFor="service-select">Massagearten</label>
        <select id="service-select" value={selectedService} onChange={onServiceChange}>
          <option value="">-- Bitte Service auswählen --</option>
          {Object.keys(groupedServices).map(name => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="duration-select">Wählen Sie Dauer</label>
        <select id="duration-select" value={selectedDuration} onChange={onDurationChange} disabled={!selectedService}>
          <option value="">-- Bitte Dauer auswählen --</option>
          {availableDurations.map(option => (
            <option key={option.id} value={option.id}>
              {option.duration_minutes} Min - {option.price} €
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

export default ServiceSelector;