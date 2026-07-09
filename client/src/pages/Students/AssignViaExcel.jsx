import React, { useEffect, useState } from 'react'
import axios from 'axios'
import * as XLSX from 'xlsx'

const AssignViaExcel = () => {
    const token = localStorage.getItem('login')

    const [allEligible, setAllEligible] = useState([])
    const [currentList, setCurrentList] = useState(null)  // saved list from DB
    const [isImporting, setIsImporting] = useState(false)
    const [isClearing, setIsClearing] = useState(false)
    const [importStats, setImportStats] = useState(null)
    const [rejectedList, setRejectedList] = useState([])

    const fetchSavedList = async () => {
        try {
            const res = await axios.get(import.meta.env.VITE_APP_API + '/eligibility/get-excel-import', {
                headers: { Authorization: `Bearer ${token}` }
            })
            setCurrentList(res.data.Result)
        } catch (err) {
            console.error('Failed to fetch saved import list:', err)
        }
    }

    useEffect(() => {
        // Load eligible students for cross-check preview
        axios.get(import.meta.env.VITE_APP_API + '/eligibility/eligible-for-assignment', {
            headers: { Authorization: `Bearer ${token}` }
        }).then(res => setAllEligible(res.data.Result || []))
          .catch(err => console.error(err))

        fetchSavedList()
    }, [token])

    const handleImportExcel = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        setIsImporting(true)
        setImportStats(null)
        setRejectedList([])

        const reader = new FileReader()
        reader.onload = async (evt) => {
            try {
                const wb = XLSX.read(evt.target.result, { type: 'binary' })
                const ws = wb.Sheets[wb.SheetNames[0]]
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 })

                // Detect enrolment column
                let enrolIdx = 0
                const headerRow = (data[0] || [])
                for (let i = 0; i < headerRow.length; i++) {
                    const h = String(headerRow[i] || '').toLowerCase().replace(/[^a-z0-9]/g, '')
                    if (h === 'enrolmentno' || h === 'enrollmentno' || h === 'enrolmentnumber' || h === 'enrollmentnumber') {
                        enrolIdx = i
                        break
                    }
                }

                const hasHeader = (() => {
                    const h = String(headerRow[enrolIdx] || '').toLowerCase().replace(/[^a-z0-9]/g, '')
                    return h === 'enrolmentno' || h === 'enrollmentno'
                })()
                const startRow = hasHeader ? 1 : 0

                const rawEnrols = []
                for (let i = startRow; i < data.length; i++) {
                    const v = data[i][enrolIdx]
                    if (v) rawEnrols.push(String(v).trim())
                }

                const unique = [...new Set(rawEnrols.filter(Boolean))]

                // Cross-check against eligible students
                const eligibleMap = new Map(allEligible.map(s => [s.enrolmentNo, s]))

                // Fetch all students for rejection categorization
                const allRes = await axios.get(import.meta.env.VITE_APP_API + '/student/get-all-students-auth', {
                    headers: { Authorization: `Bearer ${token}` }
                })
                const allStdsMap = new Map((allRes.data.Result || []).map(s => [s.enrolmentNo, s]))

                const matched = []
                const rejected = []
                let notFound = 0, notEligible = 0, alreadyAssigned = 0

                unique.forEach(eNo => {
                    if (eligibleMap.has(eNo)) {
                        matched.push(eNo)
                    } else {
                        const std = allStdsMap.get(eNo)
                        if (!std) {
                            rejected.push({ Enrolment_No: eNo, Reason: 'Not found in database' })
                            notFound++
                        } else if (std.isAssign || std.hostelId) {
                            rejected.push({ Enrolment_No: eNo, Reason: 'Already assigned to hostel' })
                            alreadyAssigned++
                        } else {
                            rejected.push({ Enrolment_No: eNo, Reason: 'Not eligible for assignment' })
                            notEligible++
                        }
                    }
                })

                setImportStats({ total: unique.length, eligible: matched.length, notFound, notEligible, alreadyAssigned })
                setRejectedList(rejected)

                // Save to database
                await axios.post(import.meta.env.VITE_APP_API + '/eligibility/save-excel-import', {
                    enrolmentNumbers: matched,
                    label: file.name
                }, { headers: { Authorization: `Bearer ${token}` } })

                // Refresh the saved list display
                await fetchSavedList()

            } catch (err) {
                console.error(err)
                alert('Error reading file or saving to database. Please try again.')
            } finally {
                setIsImporting(false)
                e.target.value = null
            }
        }
        reader.readAsBinaryString(file)
    }

    const handleClear = async () => {
        if (!window.confirm('Clear the current import list? The Assign Students page will show all eligible students again.')) return
        setIsClearing(true)
        try {
            await axios.delete(import.meta.env.VITE_APP_API + '/eligibility/clear-excel-import', {
                headers: { Authorization: `Bearer ${token}` }
            })
            setCurrentList(null)
            setImportStats(null)
            setRejectedList([])
        } catch (err) {
            console.error(err)
            alert('Failed to clear import list.')
        } finally {
            setIsClearing(false)
        }
    }

    const downloadRejected = () => {
        const ws = XLSX.utils.json_to_sheet(rejectedList)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Rejected')
        XLSX.writeFile(wb, 'Rejected_Students.xlsx')
    }

    return (
        <div className="p-6 mt-2 bg-white rounded-xl shadow-sm border border-gray-100 max-w-3xl">
            <h1 className="text-2xl font-bold text-[#6b0f14] mb-1">Assign via Excel — Import</h1>
            <p className="text-sm text-gray-500 mb-6">
                Upload an Excel file containing <strong>Enrolment Numbers</strong>. The system will validate each number against eligible students and save the matched list. The <strong>Assign Students</strong> page will then show only those students.
            </p>

            {/* Current Saved List Status */}
            <div className={`mb-6 p-4 rounded-xl border ${currentList ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <h3 className="font-semibold text-gray-700 mb-2">Current Import Status</h3>
                {currentList ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="text-sm text-gray-700 space-y-1">
                            <p>✅ An import list is <strong className="text-green-700">currently active</strong>.</p>
                            <p>Eligible Students in list: <strong className="text-green-700">{currentList.eligibleCount}</strong></p>
                            <p>Imported on: <strong>{new Date(currentList.importedAt).toLocaleString()}</strong></p>
                            {currentList.label && <p>File: <strong>{currentList.label}</strong></p>}
                        </div>
                        <button
                            onClick={handleClear}
                            disabled={isClearing}
                            className="text-sm bg-red-100 text-red-700 px-4 py-2 rounded-lg font-semibold hover:bg-red-200 transition disabled:opacity-50"
                        >
                            {isClearing ? 'Clearing...' : '🗑 Clear Import List'}
                        </button>
                    </div>
                ) : (
                    <p className="text-sm text-gray-500">⚠ No active import list. The Assign Students page shows <strong>all eligible students</strong>.</p>
                )}
            </div>

            {/* Upload Section */}
            <div className="mb-6 p-5 bg-blue-50 border border-blue-200 rounded-xl">
                <h3 className="font-semibold text-gray-700 mb-1">Upload New Excel File</h3>
                <p className="text-xs text-gray-500 mb-3">
                    Excel file should have a column named <code className="bg-white border px-1 rounded">Enrolment No</code> (or the first column can contain enrolment numbers).
                </p>
                <label className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm shadow cursor-pointer transition ${isImporting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white`}>
                    {isImporting ? (
                        <><svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>Processing & Saving...</>
                    ) : (
                        <><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>Choose Excel File & Save</>
                    )}
                    <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleImportExcel} disabled={isImporting} />
                </label>
                <p className="text-xs text-gray-400 mt-2">Uploading a new file will <strong>replace</strong> the existing import list.</p>
            </div>

            {/* Validation Results */}
            {importStats && (
                <div className="p-5 bg-[#fefaf0] border border-yellow-200 rounded-xl">
                    <h3 className="font-bold text-[#6b0f14] mb-3">Last Import Results</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-2 text-sm mb-4">
                        <div className="flex flex-col">
                            <span className="text-xs text-gray-500">Total in File</span>
                            <strong className="text-lg">{importStats.total}</strong>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-gray-500">Eligible & Saved</span>
                            <strong className="text-lg text-green-600">{importStats.eligible}</strong>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-gray-500">Not Found</span>
                            <strong className="text-lg text-red-600">{importStats.notFound}</strong>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-gray-500">Not Eligible</span>
                            <strong className="text-lg text-orange-600">{importStats.notEligible}</strong>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-gray-500">Already Assigned</span>
                            <strong className="text-lg text-blue-600">{importStats.alreadyAssigned}</strong>
                        </div>
                    </div>
                    {importStats.eligible > 0 && (
                        <div className="mt-2 p-3 bg-green-100 border border-green-300 rounded-lg text-sm text-green-800">
                            ✅ <strong>{importStats.eligible} eligible students</strong> have been saved. Go to the <strong>Assign Students</strong> page to proceed with hostel assignment.
                        </div>
                    )}
                    {rejectedList.length > 0 && (
                        <button onClick={downloadRejected} className="mt-3 text-xs bg-red-100 text-red-700 px-4 py-2 rounded-lg font-semibold hover:bg-red-200 transition">
                            ⬇ Download Rejected List ({rejectedList.length})
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

export default AssignViaExcel
