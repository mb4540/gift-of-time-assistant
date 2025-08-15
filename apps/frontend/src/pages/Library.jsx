import { useState } from 'react'
import { uploadFile, importTeks } from '../lib/api'

export default function Library() {
  const [tenantId, setTenantId] = useState('00000000-0000-0000-0000-000000000001') // replace after auth
  const [file, setFile] = useState(null)
  const [teksFile, setTeksFile] = useState(null)
  const [log, setLog] = useState('')

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-xl">Book & Reference Management</h2>

      <div className="border p-4 rounded">
        <h3 className="font-medium">Upload Book/Reference (PDF/EPUB/DOCX/CSV)</h3>
        <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
        <button className="px-3 py-1 border rounded ml-2" onClick={async () => {
          if (!file) return
          const res = await uploadFile({ tenantId, file })
          setLog(prev => prev + `\nUploaded ${file.name} → ${res.blobKey} (ingest scheduled)`)
        }}>Upload & Ingest</button>
      </div>

      <div className="border p-4 rounded">
        <h3 className="font-medium">Import TEKS CSV</h3>
        <input type="file" accept=".csv" onChange={e => setTeksFile(e.target.files?.[0] || null)} />
        <button className="px-3 py-1 border rounded ml-2" onClick={async () => {
          if (!teksFile) return
          const res = await importTeks({ tenantId, file: teksFile })
          setLog(prev => prev + `\nTEKS rows inserted: ${res.inserted}`)
        }}>Import</button>
      </div>

      <pre className="bg-gray-50 p-3 text-xs whitespace-pre-wrap">{log}</pre>
    </div>
  )
}
