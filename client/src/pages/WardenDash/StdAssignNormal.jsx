import React, { useEffect, useState, useMemo, useCallback } from 'react'
import axios from 'axios'
import DefaultBtn from '../../components/Buttons/DefaultBtn'
import { Link } from 'react-router-dom'
import { getUserInfoFromToken } from '../../utils/auth' // adjust path as needed

const StdAssignNormal = () => {
    const [students, setStudents] = useState([]) // expects [{ student, allocations }]
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [selectedStudents, setSelectedStudents] = useState(new Set())
    const [rooms, setRooms] = useState([])
    const [_roomsLoading, setRoomsLoading] = useState(false)
    const [selectedRoom, setSelectedRoom] = useState('')

    const token = localStorage.getItem('login')
    const currentUser = useMemo(() => getUserInfoFromToken(), [])

    const fetchStudents = useCallback(async () => {
        if (!token || !currentUser?.email) {
            setError('Unauthorized: Missing token or user info.')
            setLoading(false)
            return
        }

        try {
            setLoading(true)
            setError(null)

            const url = `${import.meta.env.VITE_APP_API}/hostel/warden-students?wardenEmail=${encodeURIComponent(currentUser.email)}`
            const res = await axios.get(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            })

            setStudents(res.data.Result || [])
        } catch (err) {
            console.error('Error fetching students:', err)
            setError('Failed to fetch student data.')
        } finally {
            setLoading(false)
        }
    }, [token, currentUser.email])

    useEffect(() => {
        fetchStudents()
        fetchRooms()
    }, [fetchStudents, fetchRooms])

    const fetchRooms = async () => {
        if (!token) return
        setRoomsLoading(true)
        try {
            // try the warden rooms endpoints in order and normalize various response shapes
            const endpoints = [
                '/warden/all-rooms',
                '/room/warden-Rooms',
                '/room/get-all-rooms',
            ]

                    for (const ep of endpoints) {
                try {
                    const res = await axios.get(import.meta.env.VITE_APP_API + ep, {
                        headers: { Authorization: `Bearer ${token}` },
                    })

                    const data = res?.data || {};
                    // possible shapes: array, { Result: [...] }, { rooms: [...] }, { result: [...] }, or nested
                    const roomsCandidate = data.Result || data.rooms || data.result || data;

                    if (Array.isArray(roomsCandidate) && roomsCandidate.length > 0) {
                        setRooms(roomsCandidate);
                        return;
                    }

                    // fallback: maybe data.rooms exists but empty check already handled; try any arrays on common keys
                    if (Array.isArray(data.rooms) && data.rooms.length > 0) {
                        setRooms(data.rooms);
                        return;
                    }

                    if (Array.isArray(data.Result) && data.Result.length > 0) {
                        setRooms(data.Result);
                        return;
                    }

                    if (Array.isArray(data.Rooms) && data.Rooms.length > 0) {
                        setRooms(data.Rooms);
                        return;
                    }
                } catch {
                    // try next endpoint
                }
            }

            // nothing returned
            setRooms([])
        } catch (err) {
            console.error('Failed to fetch rooms:', err)
            setRooms([])
        } finally {
            setRoomsLoading(false)
        }
    }

    const toggleStudentSelection = (id) => {
        setSelectedStudents((prev) => {
            const updated = new Set(prev)
            if (updated.has(id)) {
                updated.delete(id)
            } else {
                updated.add(id)
            }
            return updated
        })
    }

    const toggleSelectAll = () => {
        if (selectedStudents.size === students.length) {
            setSelectedStudents(new Set())
        } else {
            setSelectedStudents(new Set(students.map(({ student }) => student._id)))
        }
    }

    const handleAssignToRooms = async () => {
        if (selectedStudents.size === 0) {
            alert('Please select at least one student to assign rooms.')
            return
        }

        const selectedIds = Array.from(selectedStudents)
        console.log('Selected student IDs:', selectedIds)

        try {
            if (!selectedRoom) {
                alert('Please select a room to assign the students to.')
                return
            }

            const payload = { studentIds: selectedIds, roomId: selectedRoom }
            const res = await axios.post(import.meta.env.VITE_APP_API + '/warden/assign-students-to-room', payload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            })

            if (res.data.Status === 'Success') {
                alert('Rooms assigned successfully!')
                window.location.reload()
            } else {
                alert(res.data.Error || 'Failed to assign rooms')
            }
            setSelectedStudents(new Set())
        } catch (error) {
            console.error('Failed to assign rooms:', error)
            alert('Failed to assign rooms. Please try again.')
        }
    }

    return (
        <div>
            <div className="-mt-4 mb-2">
                <Link to={'/Dashboard/WardenStudents'}>
                    <DefaultBtn type="button" label="Back" />
                </Link>
            </div>

            {/* Room select moved below the students table to appear near the assign button */}

            {loading && <p className="mb-4 text-center text-blue-600">Loading students...</p>}
            {error && <p className="mb-4 text-center text-red-600">{error}</p>}

            <div className="overflow-x-auto rounded-2xl shadow-lg">
                <table className="min-w-full text-sm text-left text-gray-600 bg-white">
                    <thead className="text-xs uppercase bg-[#fdf6e3] text-[#6b0f14]">
                        <tr>
                            <th className="px-6 py-4 font-semibold">
                                <input
                                    type="checkbox"
                                    onChange={toggleSelectAll}
                                    checked={selectedStudents.size === students.length && students.length > 0}
                                    aria-label="Select all students"
                                />
                            </th>
                            <th className="px-6 py-4 font-semibold">#</th>
                            <th className="px-6 py-4 font-semibold">Enrolment No</th>
                            <th className="px-6 py-4 font-semibold">Index No</th>
                            <th className="px-6 py-4 font-semibold">NIC</th>
                            <th className="px-6 py-4 font-semibold">Gender</th>
                            <th className="px-6 py-4 font-semibold">Home Town</th>
                            <th className="px-6 py-4 font-semibold">Distance</th>
                            <th className="px-6 py-4 font-semibold">Room IDs</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {students.length === 0 && !loading && (
                            <tr>
                                <td colSpan={9} className="text-center py-6 text-gray-400">
                                    No students found.
                                </td>
                            </tr>
                        )}
                        {students
                            .filter(({ allocations }) =>
                                allocations?.some(a => !a.roomId) // Only include students with at least one unassigned room
                            )
                            .map(({ student }, index) => {
                                const id = student._id || index

                                return (
                                    <tr key={id}>
                                        <td className="px-6 py-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedStudents.has(id)}
                                                onChange={() => toggleStudentSelection(id)}
                                                aria-label={`Select student ${student.enrolmentNo || index + 1}`}
                                            />
                                        </td>
                                        <td className="px-6 py-4">{index + 1}</td>
                                        <td className="px-6 py-4">{student.enrolmentNo || '-'}</td>
                                        <td className="px-6 py-4">{student.indexNo || '-'}</td>
                                        <td className="px-6 py-4">{student.nic || '-'}</td>
                                        <td className="px-6 py-4">{student.sex || '-'}</td>
                                        <td className="px-6 py-4">{student.address3 || '-'}</td>
                                        <td className="px-6 py-4">{student.distance || '-'}</td>
                                    </tr>
                                )
                            })}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <label className="font-medium">Select Room to assign:</label>
                    <select
                        value={selectedRoom}
                        onChange={(e) => setSelectedRoom(e.target.value)}
                        className="border px-3 py-2 rounded"
                    >
                        <option value="">-- Select Room --</option>
                        {rooms.map((r) => {
                            const full = (r.currentOccupants || 0) >= (r.capasity || 0) || r.status === 'Full'
                            return (
                                <option key={r._id} value={r._id} disabled={full}>
                                    {r.roomID || r.roomNo || r.name || r._id} {full ? '(Full)' : ''}
                                </option>
                            )
                        })}
                    </select>
                </div>

                <div className="flex justify-end">
                    <DefaultBtn
                        type="button"
                        label="Assign to Rooms"
                        onClick={handleAssignToRooms}
                        disabled={selectedStudents.size === 0}
                    />
                </div>
            </div>
        </div>
    )
}

export default StdAssignNormal
