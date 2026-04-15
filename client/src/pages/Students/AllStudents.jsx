import axios from 'axios'
import React, { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'

import DefaultInput from '../../components/Form/DefaultInput'
import { FaFemale, FaMale } from 'react-icons/fa'
import Dropdown from '../../components/Form/Dropdown'

const DEPARTMENT_MAP = {
    A: 'Arts',
    LLB: 'Law',
    GIS: 'Geographical Science',
    SW: 'Social Work',
}

const AllStudents = () => {
    const [allstds, setAllStds] = useState([])
    const [filteredStudents, setFilteredStudents] = useState([])
    const [searchTerm, setSearchTerm] = useState('')
    
        const [sortOrder, setSortOrder] = useState('asc') // 'asc' or 'desc' for enrolmentNo
    const [assignmentStatus, setAssignmentStatus] = useState('All')
    const [minDistance, setMinDistance] = useState('')
    const [maxDistance, setMaxDistance] = useState('')
    const [genderFilter, setGenderFilter] = useState('')
    const [departmentFilter, setDepartmentFilter] = useState('')
    const [yearFilter, setYearFilter] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const recordsPerPage = 15
    const token = localStorage.getItem('login')

    const getMainDept = enrolNo => {
        if (!enrolNo) return ''
        const parts = enrolNo.split('/').filter(Boolean)
        return parts[0] || '' // MG/24/002 -> MG, AG/23/FT/015 -> AG
    }

    const getSubDept = enrolNo => {
        if (!enrolNo) return ''
        const parts = enrolNo.split('/').filter(Boolean)
        // If full format with sub (4+ parts) return explicit sub (e.g. FT)
        // If short format (3 parts like MG/24/002) return main as sub so short entries appear under sub
        if (parts.length >= 4) return parts[2]
        if (parts.length === 3) return parts[0]
        return ''
    }

    // Backwards-compatible alias: getDept returns main department code

    const getYear = enrolNo => enrolNo?.split('/')?.[1] ?? ''

    useEffect(() => {
        axios
            .get(import.meta.env.VITE_APP_API + '/student/get-all-students-auth', {
                headers: { Authorization: `Bearer ${token}` }
            })
            .then(res => {
                setAllStds(res.data.Result)
                setFilteredStudents(res.data.Result)
            })
            .catch(err => console.log(err))
    }, [token])

    // parent -> Array of sub objects { value, label, type }
    const parentSubMap = React.useMemo(() => {
        const m = new Map()
        allstds.forEach(s => {
            const enrol = s.enrolmentNo || ''
            const main = getMainDept(enrol)
            const parts = enrol.split('/').filter(Boolean)
            const explicitSub = parts.length >= 4 ? parts[2] : ''
            if (!main) return
            if (!m.has(main)) m.set(main, new Map())

            // explicit sub
            if (explicitSub && explicitSub !== main) m.get(main).set(`SUB:${explicitSub}`, { value: `SUB:${explicitSub}`, label: `${explicitSub}`, type: 'sub' })

            // short-format (3 parts) -> represent as SUBSHORT
            if (parts.length === 3) m.get(main).set(`SUBSHORT:${main}`, { value: `SUBSHORT:${main}`, label: `${main}`, type: 'short' })
        })

        // convert inner maps to arrays
        const out = new Map()
        for (const [k, innerMap] of m.entries()) {
            const arr = Array.from(innerMap.values())
            // sort by type priority: short -> sub -> main, then label
            const priority = t => (t === 'short' ? 0 : t === 'sub' ? 1 : 2)
            arr.sort((a, b) => {
                const p = priority(a.type) - priority(b.type)
                return p !== 0 ? p : a.label.localeCompare(b.label)
            })
            out.set(k, arr)
        }
        return out
    }, [allstds])

    const yearOptions = React.useMemo(() => {
        const set = new Set(allstds.map(s => getYear(s.enrolmentNo)))
        return [{ value: '', label: 'All' }, ...Array.from(set).sort().map(y => ({ value: y, label: `20${y}` }))]
    }, [allstds])



    const DepartmentTree = ({ map, value, onChange }) => {
        const [open, setOpen] = useState(false)
        const [expanded, setExpanded] = useState(null)
        const rootRef = useRef(null)

        const displayLabelForValue = (val) => {
            if (!val) return ''
            if (val.startsWith('MAIN:')) return DEPARTMENT_MAP[val.slice(5)] || `${val.slice(5)} (main)`
            if (val.startsWith('SUB:')) return val.slice(4)
            if (val.startsWith('SUBSHORT:')) return val.slice(9)
            return DEPARTMENT_MAP[val] || val
        }

        // close when clicking outside
        useEffect(() => {
            function handleClick(e) {
                if (open && rootRef.current && !rootRef.current.contains(e.target)) {
                    setOpen(false)
                    setExpanded(null)
                }
            }
            document.addEventListener('mousedown', handleClick)
            document.addEventListener('touchstart', handleClick)
            return () => {
                document.removeEventListener('mousedown', handleClick)
                document.removeEventListener('touchstart', handleClick)
            }
        }, [open])

        return (
            <div className="w-32 relative mb-5" ref={rootRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <div className="">
                    <div
                        role="button"
                        tabIndex={0}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-500 transition flex justify-between items-center cursor-pointer"
                        onClick={() => setOpen(o => { const next = !o; if (!next) setExpanded(null); return next; })}
                    >
                        <span className="truncate text-sm">{value ? displayLabelForValue(value) : 'Select an option'}</span>
                        <span className="text-gray-400">▾</span>
                    </div>

                    {open && (
                        <div className="absolute z-50 -mt-1 w-32 max-h-56 overflow-auto bg-white border rounded shadow-lg transition-opacity duration-200 ring-1 ring-black ring-opacity-5">
                            <div className="px-2 py-1 hover:bg-gray-50 cursor-pointer text-xs" onClick={() => { onChange(''); setOpen(false); setExpanded(null); }}>All Departments</div>
                            {Array.from(map.keys()).sort().map(parent => (
                                <div key={parent}>
                                    <div className={`px-2 py-1 flex justify-between items-center ${map.get(parent).some(s => s.value === value) ? 'bg-gray-100 font-semibold' : 'hover:bg-gray-50'}`}>
                                        <button
                                            type="button"
                                            className="text-left flex-1 truncate px-2 py-0.5 text-xs"
                                            onClick={() => { setExpanded(expanded === parent ? null : parent); }}
                                        >
                                            {DEPARTMENT_MAP[parent] || parent}
                                        </button>
                                        {map.get(parent).length > 0 && (
                                            <button
                                                type="button"
                                                className="px-2 text-gray-400 hover:text-gray-600"
                                                onClick={(e) => { e.stopPropagation(); setExpanded(expanded === parent ? null : parent); }}
                                            >
                                                {expanded === parent ? '▾' : '▸'}
                                            </button>
                                        )}
                                    </div>
                                    {expanded === parent && map.get(parent).length > 0 && (
                                        <div className="ml-4 border-l pl-2 bg-white">
                                            {map.get(parent).map(subObj => (
                                                <div key={subObj.value} className={`px-2 py-1 text-xs ${value === subObj.value ? 'bg-gray-100 font-semibold' : 'hover:bg-gray-50'} cursor-pointer`} onClick={() => { onChange(subObj.value); setOpen(false); setExpanded(null); }}>{subObj.label}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    useEffect(() => {
        const term = searchTerm.toLowerCase()

        const filtered = allstds.filter(student => {
            const matchesSearch =
                student.nic?.toLowerCase().includes(term) ||
                student.enrolmentNo?.toLowerCase().includes(term) ||
                student.indexNo?.toLowerCase().includes(term)

            const matchesAssigned =
                assignmentStatus === 'All'
                    ? true
                    : assignmentStatus === 'Assigned'
                        ? student.isAssign === true
                        : student.isAssign !== true

            const matchesDistance =
                (minDistance === '' || (student.distance && student.distance >= Number(minDistance))) &&
                (maxDistance === '' || (student.distance && student.distance <= Number(maxDistance)))

            const matchesGender = genderFilter === '' || student.sex === genderFilter

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
                // backwards-compatible
                matchesDepartment = getMainDept(student.enrolmentNo) === departmentFilter || getSubDept(student.enrolmentNo) === departmentFilter
            }

            const matchesYear = yearFilter === '' || getYear(student.enrolmentNo) === yearFilter

            return matchesSearch && matchesAssigned && matchesDistance && matchesGender && matchesDepartment && matchesYear
        })

        // sort by enrolmentNo (if present)
        filtered.sort((a, b) => {
            const x = (a.enrolmentNo || '').toString();
            const y = (b.enrolmentNo || '').toString();
            return sortOrder === 'asc'
                ? x.localeCompare(y, undefined, { numeric: true, sensitivity: 'base' })
                : y.localeCompare(x, undefined, { numeric: true, sensitivity: 'base' })
        })

        setFilteredStudents(filtered)
        setCurrentPage(1)
    }, [searchTerm, allstds, assignmentStatus, minDistance, maxDistance, genderFilter, departmentFilter, yearFilter, sortOrder])

    const totalPages = Math.ceil(filteredStudents.length / recordsPerPage)
    const paginatedData = filteredStudents.slice(
        (currentPage - 1) * recordsPerPage,
        currentPage * recordsPerPage
    )

    const exportToCSV = () => {
        const headers = [
            'No', 'Enrolment No', 'Index No', 'Name', 'Title', 'Last Name', 'Initials', 'Full Name', 'A/L District',
            'Sex', 'Z-Score', 'Medium', 'NIC', 'Address Line 1', 'Address Line 2', 'Address Line 3', 'Full Address',
            'Email', 'Phone 1', 'Phone 2', 'General English Marks', 'Intake', 'Date of Enrolment', 'Distance (Km)', 'Hostel Assigned'
        ]
        const rows = filteredStudents.map(std => {
            return [
                std.no || '', std.enrolmentNo || '', std.indexNo || '', std.name || '', std.title || '',
                std.lastName || '', std.initials || '', std.fullName || '', std.alDistrict || '', std.sex || '',
                std.zScore ?? '', std.medium || '', (std.nic ? "'" + std.nic : ''), std.address1 || '', std.address2 || '',
                std.address3 || '', std.fullAddress || '', std.email || '', (std.phone1 ? "'" + std.phone1 : ''), (std.phone2 ? "'" + std.phone2 : ''),
                std.genEnglishMarks ?? '', std.intake || '',
                std.dateOfEnrolment ? new Date(std.dateOfEnrolment).toLocaleDateString() : '',
                std.distance ?? '', std.isAssign ? 'Assigned' : 'Not Assigned'
            ]
        })

        const escapeField = (v) => {
            if (v === null || v === undefined) return ''
            const s = String(v)
            return '"' + s.replace(/"/g, '""') + '"'
        }

        const csvContent = 'data:text/csv;charset=utf-8,' +
            [headers.join(','), ...rows.map(row => row.map(field => escapeField(field)).join(','))].join('\n')

        const encodedUri = encodeURI(csvContent)
        const link = document.createElement('a')
        link.setAttribute('href', encodedUri)
        link.setAttribute('download', 'students_export.csv')
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    return (
        <div className="mt-8">
            <div className="mb-4 flex flex-wrap items-center gap-6">
                <DefaultInput
                    label="Search by NIC, Enrolment No, or Index No"
                    name="search"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Enter search term..."
                    className="w-full"
                />


                <div className="w-32">
                    <DepartmentTree map={parentSubMap} value={departmentFilter} onChange={setDepartmentFilter} />
                </div>

                <Dropdown
                    inline
                    label="Intake Year"
                    name="yearFilter"
                    value={yearFilter}
                    onChange={e => setYearFilter(e.target.value)}
                    options={yearOptions}
                    className="w-32"
                />

                <Dropdown
                    inline
                    label="Assignment Status"
                    name="assignmentStatus"
                    value={assignmentStatus}
                    onChange={e => setAssignmentStatus(e.target.value)}
                    options={[
                        { value: 'All', label: 'All' },
                        { value: 'Assigned', label: 'Assigned' },
                        { value: 'Unassigned', label: 'Unassigned' },
                    ]}
                    className="w-32"
                />

                <DefaultInput
                    label="Min Distance (Km)"
                    name="minDistance"
                    type="number"
                    min="0"
                    value={minDistance}
                    onChange={e => setMinDistance(e.target.value)}
                    placeholder="Enter minimum distance"
                    className="w-full"
                />

                <DefaultInput
                    label="Max Distance (Km)"
                    name="maxDistance"
                    type="number"
                    min="0"
                    value={maxDistance}
                    onChange={e => setMaxDistance(e.target.value)}
                    placeholder="Enter maximum distance"
                    className="w-full"
                />

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
                    ]}
                    className="w-28"
                />

                <button
                    onClick={exportToCSV}
                    className="bg-[#6b0f14] text-white px-6 py-2 rounded hover:bg-[#4f0a0f]"
                >
                    Export CSV
                </button>

                <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="bg-[#d4af37] text-[#6b0f14] px-6 py-2 rounded hover:bg-[#c59a3a] font-semibold"
                >
                    Sort Enrolment {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
            </div>

            <div className="overflow-x-auto rounded-2xl shadow-lg">
                <table className="min-w-full text-sm text-left text-gray-600 bg-white">
                    <thead className="text-xs uppercase bg-[#fdf6e3] text-[#6b0f14]">
                        <tr>
                            <th className="px-6 py-4">#</th>
                            <th className="px-6 py-4">Enrolment No</th>
                            <th className="px-6 py-4">Index No</th>
                            <th className="px-6 py-4">NIC</th>
                            <th className="px-6 py-4">Gender</th>
                            <th className="px-6 py-4">Home Town</th>
                            <th className="px-6 py-4">Distance</th>
                            <th className="px-6 py-4">Hostel Assigned</th>
                            <th className="px-6 py-4">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {paginatedData.length > 0 ? (
                            paginatedData.map((data, index) => (
                                <tr key={index} className="hover:bg-[#fefaf0] transition-all duration-150">
                                    <td className="px-6 py-4 font-medium text-gray-800">
                                        {(currentPage - 1) * recordsPerPage + index + 1}
                                    </td>
                                    <td className="px-6 py-4">{data.enrolmentNo}</td>
                                    <td className="px-6 py-4">{data.indexNo}</td>
                                    <td className="px-6 py-4">{data.nic}</td>
                                    <td className="px-6 py-4">
                                        {data.sex === 'Male' ? (
                                            <span className="flex bg-[#fdf6e3] text-[#6b0f14] text-xs font-semibold px-3 py-1 rounded-full gap-1 items-center">
                                                <FaMale className="h-4 w-auto" />
                                                Male
                                            </span>
                                        ) : (
                                            <span className="flex bg-pink-100 text-pink-700 text-xs font-semibold px-3 py-1 rounded-full gap-1 items-center">
                                                <FaFemale className="h-4 w-auto" />
                                                Female
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">{data.address3}</td>
                                    <td className="px-6 py-4">{data.distance} Km</td>
                                    <td className="px-6 py-4">
                                        {data.isAssign ? (
                                            <span className="bg-[#fdf6e3] text-[#6b0f14] text-xs font-semibold px-3 py-1 rounded-full">
                                                Assigned
                                            </span>
                                        ) : (
                                            <span className="bg-red-100 text-red-700 text-xs font-semibold px-3 py-1 rounded-full">
                                                Not Assigned
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <Link
                                            to={`/Dashboard/View-Student/${data._id}`}
                                            className="text-[#6b0f14] font-medium hover:underline"
                                        >
                                            View
                                        </Link>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="9" className="px-6 py-4 text-center text-gray-500">
                                    No students found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="mt-4 flex justify-center gap-4 text-gray-700">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 rounded border border-gray-300 hover:bg-[#fefaf0] disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <span className="px-3 py-1 font-semibold">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 rounded border border-gray-300 hover:bg-[#fefaf0] disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    )
}

export default AllStudents
