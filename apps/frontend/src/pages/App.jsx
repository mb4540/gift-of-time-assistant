import { Outlet, NavLink } from 'react-router-dom'

export default function App() {
  return (
    <div className="min-h-screen grid grid-rows-[auto,1fr]">
      <header className="border-b px-6 py-3 flex items-center gap-6">
        <h1 className="font-bold text-lg">{import.meta.env.VITE_APP_NAME || 'Gift of Time Assistant'}</h1>
        <nav className="flex gap-4 text-sm">
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/library">Library</NavLink>
          <NavLink to="/lessons">Lessons</NavLink>
          <NavLink to="/assessments">Assessments</NavLink>
          <NavLink to="/analytics">Analytics</NavLink>
          <NavLink to="/help">Help</NavLink>
        </nav>
      </header>
      <main className="p-6"><Outlet/></main>
    </div>
  )
}
