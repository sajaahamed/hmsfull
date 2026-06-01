import React, { useEffect, useState } from 'react'
import DefaultInput from '../../components/Form/DefaultInput'
import Dropdown from '../../components/Form/Dropdown'
import { FaFemale, FaMale } from 'react-icons/fa'
import { Link } from 'react-router-dom'
import axios from 'axios'


const HostelAssign = () => {
    const [getallstudents, setgetallstudents] = useState([])
    const [filteredStudents, setFilteredStudents] = useState([])
    const [filters, setFilters] = useState({
        search: '',
        distance: '',
        gender: '',
        intakeYear: '',
    })
    const token = localStorage.getItem('login')

    const getIntakeYearCode = (enrolmentNo) => {
        const parts = String(enrolmentNo ?? '').split('/').filter(Boolean)
        return parts[1] || ''
    }

    const intakeYearOptions = React.useMemo(() => {
        const years = new Set()
        ;(getallstudents || []).forEach(s => {
            const y = getIntakeYearCode(s?.enrolmentNo)
            if (y) years.add(y)
        })

        return Array.from(years)
            .sort()
            .map(y => ({
                value: y,
                label: String(y).length === 2 ? `20${y}` : String(y)
            }))
    }, [getallstudents])

    const [allhostels, setAllHostels] = useState([])
    const [selectedHostel, setSelectedHostel] = useState('')
    const [selectedStudents, setSelectedStudents] = useState(new Set())
    const [selectAllVisible, setSelectAllVisible] = useState(false)
    const [selectCount, setSelectCount] = useState('Custom') // only 'Custom' option allowed
    const [customSelect, setCustomSelect] = useState('')

    useEffect(() => {
        axios.get(import.meta.env.VITE_APP_API + '/student/get-all-students-auth', {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => {
                setgetallstudents(res.data.Result)
                setFilteredStudents(res.data.Result)
            })
            .catch(err => console.log(err))
    }, [token])

    useEffect(() => {
        axios.get(import.meta.env.VITE_APP_API + '/hostel/get-all-hostels', {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => setAllHostels(res.data.Result))
            .catch(err => console.error("Failed to fetch hostels:", err))
    }, [token])

    useEffect(() => {
        let filtered = Array.isArray(getallstudents) ? [...getallstudents] : []

        if (filters.search.trim() !== '') {
            const searchTerm = filters.search.toLowerCase()
            filtered = filtered.filter(student =>
                (student.enrolmentNo?.toLowerCase().includes(searchTerm) ||
                    student.nic?.toLowerCase().includes(searchTerm))
            )
        }

        if (filters.distance.trim() !== '') {
            const distNum = Number(filters.distance)
            if (!isNaN(distNum)) {
                filtered = filtered.filter(student => Number(student.distance) >= distNum)
                // Sort by distance descending (big to small)
                filtered = filtered.sort((a, b) => Number(b.distance || 0) - Number(a.distance || 0))
            }
        }

        if (filters.gender !== '') {
            filtered = filtered.filter(student => student.sex === filters.gender)
        }

        if (filters.intakeYear !== '') {
            filtered = filtered.filter(student => getIntakeYearCode(student.enrolmentNo) === filters.intakeYear)
        }

        setFilteredStudents(filtered)
    }, [filters, getallstudents])

    // compute visible students (not assigned)
    const visibleStudents = filteredStudents.filter(student => student.isAssign === false)

    // determine how many to select (number)

    useEffect(() => {
        // update selectAllVisible when visibleStudents or selection changes
        const allSelected = visibleStudents.length > 0 && visibleStudents.every(s => selectedStudents.has(s._id))
        setSelectAllVisible(allSelected)
    }, [visibleStudents, selectedStudents])

    const handleFilterChange = (e) => {
        setFilters(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }))
    }

    const handleCheckboxChange = (studentId) => {
        setSelectedStudents(prev => {
            const newSelected = new Set(prev)
            if (newSelected.has(studentId)) {
                newSelected.delete(studentId)
            } else {
                newSelected.add(studentId)
            }
            return newSelected
        })
    }

    const handleSelectAllChange = (e) => {
        const checked = e.target.checked
        setSelectedStudents(prev => {
            const newSelected = new Set(prev)
            visibleStudents.forEach(s => {
                if (checked) newSelected.add(s._id)
                else newSelected.delete(s._id)
            })
            return newSelected
        })
        setSelectAllVisible(checked)
    }

    const handleSelectCountChange = (e) => {
        const val = e.target.value
        setSelectCount(val)
        if (val !== 'Custom') setCustomSelect('')
        const n = val === 'All' ? visibleStudents.length : Number(val) || 0
        const ids = visibleStudents.slice(0, n).map(s => s._id)
        setSelectedStudents(new Set(ids))
        setSelectAllVisible(n >= visibleStudents.length && visibleStudents.length > 0)
    }

    const handleCustomSelectChange = (e) => {
        const v = e.target.value.replace(/[^0-9]/g, '')
        setCustomSelect(v)
        if (v) {
            setSelectCount(v)
            const n = Number(v)
            const ids = visibleStudents.slice(0, n).map(s => s._id)
            setSelectedStudents(new Set(ids))
            setSelectAllVisible(n >= visibleStudents.length && visibleStudents.length > 0)
        } else {
            setSelectCount('All')
            setSelectedStudents(new Set())
            setSelectAllVisible(false)
        }
    }

    const handleHostelChange = (e) => {
        setSelectedHostel(e.target.value)
    }

    const handleAssignSubmit = () => {
        if (!selectedHostel) {
            alert('Please select a hostel first.')
            return
        }

        if (selectedStudents.size === 0) {
            alert('Please select at least one student.')
            return
        }

        const payload = {
            hostelId: selectedHostel,
            studentIds: Array.from(selectedStudents),
        }

        axios.post(import.meta.env.VITE_APP_API + '/hostel/assign-students', payload, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(() => {
                alert('Students assigned successfully!')
                setSelectedStudents(new Set())
                axios.get(import.meta.env.VITE_APP_API + '/student/get-all-students-auth', {
                    headers: { Authorization: `Bearer ${token}` }
                })
                    .then(res => {
                        setgetallstudents(res.data.Result)
                        setFilteredStudents(res.data.Result)
                    })
            })
            .catch(err => {
                console.error(err)
                alert('Failed to assign students. Please try again.')
            })
    }

    return (
        <div>
            <h1 className="font-bold text-[#6b0f14] text-xl">Assign Students to Hostels</h1>

            <div className="flex flex-nowrap gap-4 mt-4 max-w-4xl overflow-x-auto no-scrollbar">
                <div className="flex-grow min-w-[250px]">
                    <DefaultInput
                        label="Search Enrolment No / NIC"
                        name="search"
                        value={filters.search}
                        onChange={handleFilterChange}
                        placeholder="Enter enrolment or NIC"
                    />
                </div>

                <div className="min-w-[150px] shrink-0">
                    <Dropdown
                        label="Gender"
                        name="gender"
                        value={filters.gender}
                        onChange={handleFilterChange}
                        options={[
                            { label: 'Male', value: 'Male' },
                            { label: 'Female', value: 'Female' },
                        ]}
                    />
                </div>

                <div className="min-w-[150px] shrink-0">
                    <Dropdown
                        label="Intake Year"
                        name="intakeYear"
                        value={filters.intakeYear}
                        onChange={handleFilterChange}
                        options={intakeYearOptions}
                    />
                </div>

                <div className="min-w-[150px] shrink-0">
                    <DefaultInput
                        label="Distance ≥"
                        type="number"
                        name="distance"
                        value={filters.distance}
                        onChange={handleFilterChange}
                        placeholder="Enter minimum distance"
                        min="0"
                    />
                </div>
            </div>

            <div className="max-w-3xl">
                <Dropdown
                    label="Select Hostel"
                    name="hostel"
                    value={selectedHostel}
                    onChange={handleHostelChange}
                    options={allhostels.map(h => ({ label: h.name, value: h._id }))}
                />
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-3 max-w-3xl">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full">
                    <label className="flex items-center gap-2">
                        <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-[#6b0f14] focus:ring-2 focus:ring-[#6b0f14]/30 transition" checked={selectAllVisible} onChange={handleSelectAllChange} />
                        <span className="text-sm">Select All (visible)</span>
                    </label>

                    <div className="flex items-center gap-2">
                        <label className="text-sm">Select rows:</label>
                        <select value={selectCount} onChange={handleSelectCountChange} className="border px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-[#6b0f14]/30 transition w-32 sm:w-auto">
                            <option value="Custom">Custom</option>
                        </select>
                        <input type="number" min="1" value={customSelect} onChange={handleCustomSelectChange} placeholder="Enter rows to select" className="border px-3 py-2 rounded-md w-full sm:w-40 focus:outline-none focus:ring-2 focus:ring-[#6b0f14]/30 transition" />
                    </div>
                </div>

                <div className="w-full sm:w-auto mt-3 sm:mt-0 flex justify-end">
                    <button
                        onClick={handleAssignSubmit}
                        className="w-full sm:w-auto bg-gradient-to-r from-[#6b0f14] to-[#4f0a0f] text-white px-5 py-2 rounded-lg font-semibold shadow-lg hover:scale-[1.02] transform transition will-change-transform disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-4 focus:ring-[#6b0f14]/25"
                        disabled={!selectedHostel || selectedStudents.size === 0}
                    >
                        Assign Selected Students
                    </button>
                </div>
            </div>

            <div className="mt-2 max-w-3xl text-sm text-gray-600">
                <span className="text-sm mr-4">Filtered: <span className="font-semibold">{filteredStudents.length}</span></span>
                <span className="text-sm mr-4">Total: <span className="font-semibold">{getallstudents.length}</span></span>
                <span className="text-sm">Selected: <span className="font-semibold">{selectedStudents.size}</span></span>
            </div>

            <div className="overflow-x-auto rounded-2xl shadow-lg mt-4 max-w-7xl">
                <table className="min-w-full text-sm text-left text-gray-600 bg-white">
                    <thead className="text-xs uppercase bg-[#fdf6e3] text-[#6b0f14]">
                        <tr>
                            <th className="px-3 sm:px-6 py-3 font-semibold">Select</th>
                            <th className="px-3 sm:px-6 py-3 font-semibold">#</th>
                            <th className="px-3 sm:px-6 py-3 font-semibold">Enrolment No</th>
                            
                            <th className="hidden md:table-cell px-6 py-3 font-semibold">NIC</th>
                            <th className="px-3 sm:px-6 py-3 font-semibold">Gender</th>
                            <th className="hidden md:table-cell px-6 py-3 font-semibold">Home Town</th>
                            <th className="px-3 sm:px-6 py-3 font-semibold">Distance</th>
                            <th className="hidden md:table-cell px-6 py-3 font-semibold">Hostel Assigned</th>
                            <th className="px-3 sm:px-6 py-3 font-semibold">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {
                            visibleStudents.length > 0 ? (
                                visibleStudents.map((data, index) => (
                                        <tr
                                            key={data._id}
                                            onClick={() => handleCheckboxChange(data._id)}
                                            className={`transition-all duration-150 cursor-pointer ${
                                                selectedStudents.has(data._id)
                                                    ? 'bg-[#fdf6e3] text-[#3a0709]'
                                                    : 'hover:bg-[#fefaf0]'
                                            }`}
                                        >
                                            <td className="px-3 sm:px-6 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedStudents.has(data._id)}
                                                    onChange={(e) => {
                                                        e.stopPropagation()
                                                        handleCheckboxChange(data._id)
                                                    }}
                                                    disabled={data.isAssign}
                                                    className="h-4 w-4"
                                                />
                                            </td>
                                            <td className="px-3 sm:px-6 py-3 font-medium text-gray-800">{index + 1}</td>
                                            <td className="px-3 sm:px-6 py-3 truncate">{data.enrolmentNo}</td>
                                            
                                            <td className="hidden md:table-cell px-6 py-3 truncate">{data.nic}</td>
                                            <td className="px-3 sm:px-6 py-3">
                                                {data.sex === 'Male' ? (
                                                    <span className="flex uppercase bg-[#fdf6e3] text-[#6b0f14] text-xs font-semibold px-2 py-1 rounded-full items-center">
                                                        <FaMale className='h-4 w-auto mr-1' /> Male
                                                    </span>
                                                ) : (
                                                    <span className="flex uppercase bg-pink-100 text-pink-700 text-xs font-semibold px-2 py-1 rounded-full items-center">
                                                        <FaFemale className='h-4 w-auto mr-1' /> Female
                                                    </span>
                                                )}
                                            </td>
                                            <td className="hidden md:table-cell px-6 py-3 truncate">{data.address3}</td>
                                            <td className="px-3 sm:px-6 py-3">{data.distance} Km</td>
                                            <td className="hidden md:table-cell px-6 py-3">
                                                <span className="uppercase bg-red-100 text-red-700 text-xs font-semibold px-3 py-1 rounded-full">
                                                    Not-Assigned
                                                </span>
                                            </td>
                                            <td className="px-3 sm:px-6 py-3">
                                                <Link to={`/Dashboard/View-Student/${data._id}`} className="text-[#6b0f14] font-medium hover:underline">View</Link>
                                            </td>
                                        </tr>
                                    ))
                            ) : (
                                <tr>
                                    <td colSpan="9" className="px-6 py-4 text-center text-gray-500">No matching records found.</td>
                                </tr>
                            )
                        }
                    </tbody>
                </table>
            </div>

            
        </div>
    )
}

export default HostelAssign
