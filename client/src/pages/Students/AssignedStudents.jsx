import axios from 'axios'
import React, { useEffect, useState, useRef } from 'react'
import DefaultInput from '../../components/Form/DefaultInput'
import { FaFemale, FaMale, FaUserTie } from 'react-icons/fa'
import Dropdown from '../../components/Form/Dropdown'

const DEPARTMENT_MAP = {
    A: 'Arts',
    LLB: 'Law',
    GIS: 'Geographical Science',
    SW: 'Social Work',
}

const AssignedStudents = () => {
    const [students, setStudents] = useState([])
    const [filteredList, setFilteredList] = useState([])

    // Filters
    const [searchTerm, setSearchTerm] = useState('')
    const [genderFilter, setGenderFilter] = useState('')
    const [departmentFilter, setDepartmentFilter] = useState('')
    const [yearFilter, setYearFilter] = useState('')

    const [currentPage, setCurrentPage] = useState(1)
    const recordsPerPage = 15
    const token = localStorage.getItem('login')

    const fetchStudents = () => {
        axios.get(import.meta.env.VITE_APP_API + '/eligibility/assigned-students', {
            headers: { Authorization: `Bearer ${token}` }
        }).then(res => {
            setStudents(res.data.Result || [])
        }).catch(err => console.error(err))
    }

    useEffect(() => {
        fetchStudents()
    }, [token])

    const getMainDept = enrolNo => {
        if (!enrolNo) return ''
        const parts = enrolNo.split('/').filter(Boolean)
        return parts[0] || ''
    }

    const getSubDept = enrolNo => {
        if (!enrolNo) return ''
        const parts = enrolNo.split('/').filter(Boolean)
        if (parts.length >= 4) return parts[2]
        if (parts.length === 3) return parts[0]
        return ''
    }

    const getYear = enrolNo => enrolNo?.split('/')?.[1] ?? ''

    const yearOptions = React.useMemo(() => {
        const set = new Set(students.map(s => getYear(s.enrolmentNo)))
        return [{ value: '', label: 'All' }, ...Array.from(set).filter(Boolean).sort().map(y => ({ value: y, label: `20${y}` }))]
    }, [students])

    // Department tree dropdown
    const DepartmentTree = ({ value, onChange }) => {
        const [open, setOpen] = useState(false)
        const rootRef = useRef(null)

        const map = React.useMemo(() => {
            const m = new Map()
            students.forEach(s => {
                const enrol = s.enrolmentNo || ''
                const main = getMainDept(enrol)
                const parts = enrol.split('/').filter(Boolean)
                const explicitSub = parts.length >= 4 ? parts[2] : ''
                if (!main) return
                if (!m.has(main)) m.set(main, new Map())
                if (explicitSub && explicitSub !== main) m.get(main).set(`SUB:${explicitSub}`, { value: `SUB:${explicitSub}`, label: `${explicitSub}`, type: 'sub' })
                if (parts.length === 3) m.get(main).set(`SUBSHORT:${main}`, { value: `SUBSHORT:${main}`, label: `${main}`, type: 'short' })
            })

            const out = new Map()
            for (const [k, innerMap] of m.entries()) {
                const arr = Array.from(innerMap.values())
                const priority = t => (t === 'short' ? 0 : t === 'sub' ? 1 : 2)
                arr.sort((a, b) => {
                    const p = priority(a.type) - priority(b.type)
                    return p !== 0 ? p : a.label.localeCompare(b.label)
                })
                out.set(k, arr)
            }
            return out
        }, [students])

        const displayLabelForValue = (val) => {
            if (!val) return ''
            if (val.startsWith('MAIN:')) return DEPARTMENT_MAP[val.slice(5)] || `${val.slice(5)} (main)`
            if (val.startsWith('SUB:')) return val.slice(4)
            if (val.startsWith('SUBSHORT:')) return val.slice(9)
            return DEPARTMENT_MAP[val] || val
        }

        useEffect(() => {
            function handleClick(e) {
                if (open && rootRef.current && !rootRef.current.contains(e.target)) {
                    setOpen(false)
                }
            }
            document.addEventListener('mousedown', handleClick)
            return () => document.removeEventListener('mousedown', handleClick)
        }, [open])

        return (
            <div className="w-40 relative mb-5" ref={rootRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <div>
                    <div
                        role="button"
                        tabIndex={0}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-400 transition flex justify-between items-center cursor-pointer"
                        onClick={() => setOpen(!open)}
                    >
                        <span className="truncate text-sm">{value ? displayLabelForValue(value) : 'Select'}</span>
                        <span className="text-gray-400">▾</span>
                    </div>

                    {open && (
                        <div className="absolute z-50 mt-1 w-48 max-h-56 overflow-auto bg-white border rounded shadow-lg">
                            <div className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm" onClick={() => { onChange(''); setOpen(false); }}>All Departments</div>
                            {Array.from(map.keys()).sort().map(parent => (
                                <div key={parent}>
                                    <div
                                        className="px-3 py-2 text-sm font-semibold hover:bg-gray-50 cursor-pointer"
                                        onClick={() => { onChange(`MAIN:${parent}`); setOpen(false); }}
                                    >
                                        {DEPARTMENT_MAP[parent] || parent}
                                    </div>
                                    {map.get(parent).map(subObj => (
                                        <div
                                            key={subObj.value}
                                            className="px-6 py-1 text-xs hover:bg-gray-50 cursor-pointer text-gray-600"
                                            onClick={() => { onChange(subObj.value); setOpen(false); }}
                                        >
                                            ↳ {subObj.label}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // Filtering
    useEffect(() => {
        const term = searchTerm.toLowerCase()

        const filtered = students.filter(student => {
            if (!student) return false

            const matchesSearch =
                student.nic?.toLowerCase().includes(term) ||
                student.enrolmentNo?.toLowerCase().includes(term) ||
                student.name?.toLowerCase().includes(term)

            const matchesGender = genderFilter === '' || (student.sex && student.sex.trim().toLowerCase() === genderFilter.trim().toLowerCase())

            let matchesDepartment = false
            if (departmentFilter === '') {
                matchesDepartment = true
            } else if (departmentFilter.startsWith('MAIN:')) {
                const mainCode = departmentFilter.slice(5)
                matchesDepartment = getMainDept(student.enrolmentNo) === mainCode
            } else if (departmentFilter.startsWith('SUB:')) {
                const subCode = departmentFilter.slice(4)
                matchesDepartment = getSubDept(student.enrolmentNo) === subCode
            } else if (departmentFilter.startsWith('SUBSHORT:')) {
                const mainCode = departmentFilter.slice(9)
                const parts = (student.enrolmentNo || '').split('/').filter(Boolean)
                matchesDepartment = getMainDept(student.enrolmentNo) === mainCode && parts.length === 3
            } else {
                matchesDepartment = getMainDept(student.enrolmentNo) === departmentFilter || getSubDept(student.enrolmentNo) === departmentFilter
            }

            const matchesYear = yearFilter === '' || getYear(student.enrolmentNo) === yearFilter

            return matchesSearch && matchesGender && matchesDepartment && matchesYear
        })

        setFilteredList(filtered)
        setCurrentPage(1)
    }, [searchTerm, students, genderFilter, departmentFilter, yearFilter])


    const totalPages = Math.ceil(filteredList.length / recordsPerPage)
    const paginatedData = filteredList.slice(
        (currentPage - 1) * recordsPerPage,
        currentPage * recordsPerPage
    )

    return (
        <div className="p-6 mt-2 bg-white rounded-xl shadow-sm border border-gray-100">
            <h1 className="text-2xl font-bold text-[#6b0f14] mb-6 border-b pb-3">Assigned Students</h1>

            <p className="text-sm text-gray-500 mb-6">
                Students listed below have been <span className="font-semibold text-green-600">successfully allocated to a hostel</span>.
            </p>

            <div className="mb-4 flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[200px] mb-5">
                    <DefaultInput
                        label="Search by Name, NIC, Enrolment"
                        name="search"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Search..."
                    />
                </div>
                <div className="mb-[20px]">
                    <DepartmentTree value={departmentFilter} onChange={setDepartmentFilter} />
                </div>
                <div className="mb-[20px]">
                    <Dropdown
                        inline
                        label="Study Year"
                        name="yearFilter"
                        value={yearFilter}
                        onChange={e => setYearFilter(e.target.value)}
                        options={yearOptions}
                        className="w-32 mb-5"
                    />
                </div>
                <div className="mb-[20px]">
                    <Dropdown
                        inline
                        label="Gender"
                        name="genderFilter"
                        value={genderFilter}
                        onChange={e => setGenderFilter(e.target.value)}
                        options={[
                            { value: '', label: 'All' },
                            { value: 'Male', label: 'Male' },
                            { value: 'Female', label: 'Female' },
                            { value: 'REV', label: 'REV' },
                        ]}
                        className="w-32 mb-5"
                    />
                </div>
            </div>

            <div className="overflow-x-auto rounded-xl shadow border border-gray-200">
                <table className="min-w-full text-sm text-left text-gray-600 bg-white">
                    <thead className="text-xs uppercase bg-[#fdf6e3] text-[#6b0f14] border-b">
                        <tr>
                            <th className="px-6 py-4 font-semibold">#</th>
                            <th className="px-6 py-4 font-semibold">Registration No</th>
                            <th className="px-6 py-4 font-semibold">Student Name</th>
                            <th className="px-6 py-4 font-semibold">Study Year</th>
                            <th className="px-6 py-4 font-semibold">Gender</th>
                            <th className="px-6 py-4 font-semibold">Hostel</th>
                            <th className="px-6 py-4 font-semibold">Room</th>
                            <th className="px-6 py-4 font-semibold">Assigned Date</th>
                            <th className="px-6 py-4 font-semibold">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {paginatedData.length > 0 ? (
                            paginatedData.map((std, index) => {
                                const studyYear = std.dateOfEnrolment ? `Year ${(new Date().getFullYear() - new Date(std.dateOfEnrolment).getFullYear()) + 1}` : ''

                                return (
                                    <tr key={std._id} className="transition-all duration-150 hover:bg-[#fefaf0] border-b">
                                        <td className="px-6 py-4 text-gray-800">
                                            {(currentPage - 1) * recordsPerPage + index + 1}
                                        </td>
                                        <td className="px-6 py-4 font-medium">{std.enrolmentNo}</td>
                                        <td className="px-6 py-4">{std.name}</td>
                                        <td className="px-6 py-4">{studyYear}</td>
                                        <td className="px-6 py-4">
                                            {std.sex === 'Male' ? (
                                                <span className="flex bg-[#fdf6e3] text-[#6b0f14] w-fit text-xs font-semibold px-2 py-1 rounded-md gap-1 items-center">
                                                    <FaMale className="h-3 w-auto" />
                                                    Male
                                                </span>
                                            ) : std.sex === 'Female' ? (
                                                <span className="flex bg-pink-50 text-pink-700 w-fit text-xs font-semibold px-2 py-1 rounded-md gap-1 items-center">
                                                    <FaFemale className="h-3 w-auto" />
                                                    Female
                                                </span>
                                            ) : (
                                                <span className="flex bg-orange-50 text-orange-700 w-fit text-xs font-semibold px-2 py-1 rounded-md gap-1 items-center">
                                                    <FaUserTie className="h-3 w-auto" />
                                                    {std.sex || 'REV'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 font-medium">{std.hostelName || 'Unknown'}</td>
                                        <td className="px-6 py-4 font-medium">{std.roomNumber || 'Unknown'}</td>
                                        <td className="px-6 py-4 font-medium">
                                            {std.assignmentDate ? new Date(std.assignmentDate).toLocaleDateString() : 'Unknown'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-bold px-2.5 py-1 rounded-md border bg-green-100 text-green-700 border-green-200">
                                                Assigned
                                            </span>
                                        </td>
                                    </tr>
                                )
                            })
                        ) : (
                            <tr>
                                <td colSpan="9" className="px-6 py-8 text-center text-gray-500 bg-gray-50">
                                    No assigned students found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="mt-6 flex justify-between items-center text-sm text-gray-600">
                    <div>
                        Showing <span className="font-medium">{(currentPage - 1) * recordsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * recordsPerPage, filteredList.length)}</span> of <span className="font-medium">{filteredList.length}</span> results
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed bg-white shadow-sm transition-colors"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed bg-white shadow-sm transition-colors"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AssignedStudents
