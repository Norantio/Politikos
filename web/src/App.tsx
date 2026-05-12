import { NavLink, Route, Routes, Navigate } from "react-router-dom";
import Live from "./views/Live";
import Feed from "./views/Feed";
import Calendar from "./views/Calendar";
import RaceDetail from "./views/RaceDetail";

export default function App() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-name">Politikos</div>
          <div className="brand-sub">Election Dashboard</div>
        </div>
        <ul className="nav">
          <li className="nav-item"><NavLink to="/live">Live Races</NavLink></li>
          <li className="nav-item"><NavLink to="/feed">Event Feed</NavLink></li>
          <li className="nav-item"><NavLink to="/calendar">Calendar</NavLink></li>
        </ul>
      </aside>

      <main className="main">
        <Routes>
          <Route path="/" element={<Navigate to="/live" replace />} />
          <Route path="/live" element={<Live />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/race/:id" element={<RaceDetail />} />
          <Route path="*" element={<Navigate to="/live" replace />} />
        </Routes>

        <div className="footer">
          Election data provided by{" "}
          <a href="https://civicapi.org" target="_blank" rel="noopener noreferrer">civicAPI</a>.
        </div>
      </main>
    </div>
  );
}

