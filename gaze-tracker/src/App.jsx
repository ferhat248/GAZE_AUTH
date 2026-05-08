import React from 'react';
import { Routes, Route } from 'react-router-dom';
import EyeTracker  from './components/EyeTracker';
import TopLeft     from './pages/TopLeft';
import TopRight    from './pages/TopRight';
import BottomLeft  from './pages/BottomLeft';
import BottomRight from './pages/BottomRight';

export default function App() {
  return (
    <Routes>
      <Route path="/"             element={<EyeTracker />} />
      <Route path="/top-left"     element={<TopLeft />} />
      <Route path="/top-right"    element={<TopRight />} />
      <Route path="/bottom-left"  element={<BottomLeft />} />
      <Route path="/bottom-right" element={<BottomRight />} />
    </Routes>
  );
}
