import React from 'react';

const ProgressBar = ({ progress }) => {
  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '50%',
      height: '30px',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      borderRadius: '15px',
      overflow: 'hidden',
      zIndex: 1000
    }}>
      <div style={{
        width: `${progress}%`,
        height: '100%',
        backgroundColor: 'rgba(0, 255, 0, 0.7)',
        transition: 'width 0.3s ease-in-out'
      }} />
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        color: 'white',
        fontWeight: 'bold'
      }}>
        {`${Math.round(progress)}%`}
      </div>
    </div>
  );
};

export default ProgressBar;