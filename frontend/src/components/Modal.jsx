import React from 'react';
import './Modal.css';

function Modal({ isOpen, onClose, children }) {
  // ถ้า state 'isOpen' เป็น false ก็ไม่ต้องแสดงผลอะไรเลย
  if (!isOpen) {
    return null;
  }

  return (
    // Overlay คือพื้นหลังสีดำโปร่งแสง
    <div className="modal-overlay" onClick={onClose}>
      {/* modal-content คือกล่องเนื้อหาสีขาว */}
      {/* onClick ที่นี่ป้องกันไม่ให้การคลิกในกล่องทำให้ Modal ปิด */}
      <div className="modal-content" onClick={e => e.stopPropagation()}>      
        {/* 'children' คือสิ่งที่เราจะนำมาใส่ใน Modal ในที่นี้คือ BookingFormPage */}
        {children}
      </div>
    </div>
  );
}

export default Modal;