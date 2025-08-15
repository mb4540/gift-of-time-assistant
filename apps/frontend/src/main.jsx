import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './pages/App.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Library from './pages/Library.jsx'
import Lessons from './pages/Lessons.jsx'
import Assessments from './pages/Assessments.jsx'
import Analytics from './pages/Analytics.jsx'
import Help from './pages/Help.jsx'

const qc = new QueryClient()

const router = createBrowserRouter([
  { path: '/', element: <App/>,
    children: [
      { index: true, element: <Dashboard/> },
      { path: 'library', element: <Library/> },
      { path: 'lessons', element: <Lessons/> },
      { path: 'assessments', element: <Assessments/> },
      { path: 'analytics', element: <Analytics/> },
      { path: 'help', element: <Help/> }
    ]
  }
])

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
)
