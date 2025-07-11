// frontend/src/components/DateTimePicker.jsx (Simplified Version)
import React from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import "../datepicker-override.css";

// Component นี้จะรับหน้าที่แค่แสดงปฏิทินเท่านั้น
function DateTimePicker({ selectedDate, onDateChange }) {
  return (
    <div className="form-group">
      <label>Wenn Sie Freizeit haben</label>
      <DatePicker
        selected={selectedDate}
        onChange={onDateChange}
        inline
        minDate={new Date()}
      />
    </div>
  );
}

export default DateTimePicker;