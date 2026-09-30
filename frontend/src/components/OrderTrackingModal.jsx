import { useState, useEffect } from 'react';
import Modal from './Modal.jsx';

const STATUS_STAGES = [
  { key: 'confirmed', title: 'Order Confirmed', icon: '✅', desc: 'Kitchen received and accepted your order.' },
  { key: 'preparing', title: 'Preparing', icon: '👨‍🍳', desc: 'Master chefs are cooking your meal with fresh ingredients.' },
  { key: 'ready', title: 'Ready', icon: '🍽️', desc: 'Your dishes are plated and packed hot from the kitchen.' },
  { key: 'served', title: 'Served', icon: '🎉', desc: 'Delivered to your table or door. Enjoy your meal!' },
];

export default function OrderTrackingModal({ initialOrder, onClose }) {
  const [orderNumber, setOrderNumber] = useState(initialOrder ? initialOrder.orderNumber : 'RP-7824');
  const [currentStepIndex, setCurrentStepIndex] = useState(initialOrder ? (initialOrder.stepIndex || 1) : 1);
  const [eta, setEta] = useState(14);

  // Simulated live countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setEta((prev) => Math.max(1, prev - 1));
    }, 45000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Modal title="📦 Live Order Status Tracker" onClose={onClose}>
      <div className="order-tracker-container">
        {/* Order Header Summary */}
        <div className="tracker-header-box">
          <div>
            <span className="muted small">Active Order Tracking</span>
            <h3 style={{ margin: '2px 0' }}>Order #{orderNumber}</h3>
            <span className="tracker-badge">Dine-in • Table 4</span>
          </div>
          <div className="eta-counter">
            <span className="eta-val">{eta}</span>
            <span className="eta-label">Mins ETA</span>
          </div>
        </div>

        {/* 4-Step Progress Flow: Confirmed -> Preparing -> Ready -> Served */}
        <div className="tracking-timeline-flow">
          {STATUS_STAGES.map((stage, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            const isPending = idx > currentStepIndex;

            return (
              <div
                key={stage.key}
                className={`timeline-step-item ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''} ${isPending ? 'pending' : ''}`}
                onClick={() => setCurrentStepIndex(idx)}
                style={{ cursor: 'pointer' }}
                title="Click to simulate stage transition"
              >
                <div className="step-node">
                  <span className="step-icon">{stage.icon}</span>
                  {isCurrent && <div className="pulse-ring" />}
                </div>
                <div className="step-info">
                  <div className="spread">
                    <strong>{stage.title}</strong>
                    {isCurrent && <span className="active-pill">In Progress</span>}
                    {isCompleted && <span className="done-pill">Done</span>}
                  </div>
                  <p className="muted small">{stage.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action button to simulate next stage */}
        <div className="spread" style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #eee' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setCurrentStepIndex((c) => (c < STATUS_STAGES.length - 1 ? c + 1 : 0))}
          >
            🔄 Simulate Next Status ({STATUS_STAGES[currentStepIndex].title})
          </button>
          <button className="btn btn-accent btn-sm" onClick={onClose}>
            Close Tracker
          </button>
        </div>
      </div>
    </Modal>
  );
}
