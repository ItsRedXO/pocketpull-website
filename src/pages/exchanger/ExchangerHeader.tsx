import React from 'react';

export const ExchangerHeader: React.FC = () => {
  return (
    <div className="mb-8">
      <h1 className="font-display text-5xl md:text-6xl uppercase tracking-tighter"
        style={{ textShadow: '0 0 40px rgba(0,200,255,0.4)' }}>
        CARD <span className="text-[#00c8ff]">EXCHANGER</span>
      </h1>
      <p className="text-gray-500 mt-1 text-sm">
        Trade your cards 1:1 by value. Leftover difference is refunded to your balance.
      </p>
    </div>
  );
};
