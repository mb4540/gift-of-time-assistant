import { useState } from 'react'
import { askRag } from '../lib/api'

export default function Dashboard() {
  const [tenantId] = useState('00000000-0000-0000-0000-000000000001') // replace with auth org id
  const [q, setQ] = useState('What is the late work policy?')
  const [out, setOut] = useState('')

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-xl">Teacher Dashboard</h2>
      <div className="flex gap-2">
        <input className="border px-2 py-1 flex-1" value={q} onChange={e => setQ(e.target.value)} />
        <button className="px-3 py-1 border rounded" onClick={async () => {
          const res = await askRag({ tenantId, query: q })
          setOut(JSON.stringify(res, null, 2))
        }}>Ask</button>
      </div>
      <pre className="bg-gray-50 p-3 text-xs whitespace-pre-wrap">{out}</pre>
    </div>
  )
}
