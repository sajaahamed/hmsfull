import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { FileSpreadsheet, Activity, Building, IndianRupee, Users, CreditCard } from 'lucide-react';

const DEPARTMENT_MAP = {
    A: 'Arts',
    LLB: 'Law',
    GIS: 'Geographical Science',
    SW: 'Social Work',
};

const getMainDept = enrolNo => {
    if (!enrolNo) return 'N/A';
    const parts = enrolNo.split('/').filter(Boolean);
    return parts[0] || 'N/A';
};

const getSubDept = enrolNo => {
    if (!enrolNo) return '';
    const parts = enrolNo.split('/').filter(Boolean);
    if (parts.length >= 4) return parts[2] || '';
    if (parts.length === 3) return parts[0] || '';
    return '';
};

const getBatchFromEnrolNo = enrolNo => {
    if (!enrolNo) return '';
    const parts = enrolNo.split('/').filter(Boolean);
    return parts[1] || '';
};

const getBatchPrefixFromEnrolNo = enrolNo => {
    if (!enrolNo) return '';
    const parts = enrolNo.split('/').filter(Boolean);
    if (parts.length < 2) return '';
    return `${parts[0]}/${parts[1]}`.toUpperCase();
};

const getBatchYearFromEnrolNo = enrolNo => {
    const raw = getBatchFromEnrolNo(enrolNo);
    if (!raw) return '';
    if (/^\d{2}$/.test(raw)) return `20${raw}`;
    if (/^\d{4}$/.test(raw)) return raw;
    return raw;
};

const formatDateYmd = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
};

const defaultPaymentFilters = {
    departmentFilter: '',
    hostelId: '',
    batchYear: '',
    batch: '',
    residentDateFrom: '',
    residentDateTo: ''
};

const DepartmentTreeSelect = ({ options, value, onChange }) => {
    const [open, setOpen] = useState(false);
    const [expanded, setExpanded] = useState(null);
    const rootRef = useRef(null);

    const getLabelForValue = (val) => {
        if (!val) return 'All Departments';
        if (val.startsWith('MAIN:')) {
            const code = val.slice(5);
            return DEPARTMENT_MAP[code] || code;
        }
        if (val.startsWith('SUB:')) return val.slice(4);
        return val;
    };

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (open && rootRef.current && !rootRef.current.contains(e.target)) {
                setOpen(false);
                setExpanded(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [open]);

    return (
        <div className="relative" ref={rootRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <button
                type="button"
                onClick={() => setOpen(prev => !prev)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-left text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-500 flex items-center justify-between"
            >
                <span className="truncate">{getLabelForValue(value)}</span>
                <span className="text-gray-400">▾</span>
            </button>

            {open && (
                <div className="absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded-lg border border-gray-300 bg-white shadow-lg">
                    <button
                        type="button"
                        onClick={() => {
                            onChange('');
                            setOpen(false);
                            setExpanded(null);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                        All Departments
                    </button>

                    {options.map((entry) => (
                        <div key={entry.main} className="border-t border-gray-100">
                            <div className="flex items-center justify-between px-3 py-2">
                                <button
                                    type="button"
                                    className={`text-left text-sm ${value === `MAIN:${entry.main}` ? 'font-semibold text-gray-900' : 'text-gray-800'}`}
                                    onClick={() => {
                                        onChange(`MAIN:${entry.main}`);
                                    }}
                                >
                                    {DEPARTMENT_MAP[entry.main] || entry.main}
                                </button>
                                {entry.subs.length > 0 && (
                                    <button
                                        type="button"
                                        className="text-gray-400 hover:text-gray-600"
                                        onClick={() => setExpanded(prev => (prev === entry.main ? null : entry.main))}
                                    >
                                        {expanded === entry.main ? '▾' : '▸'}
                                    </button>
                                )}
                            </div>

                            {expanded === entry.main && entry.subs.length > 0 && (
                                <div className="bg-gray-50 border-t border-gray-100">
                                    {entry.subs.map((subCode) => (
                                        <button
                                            key={`${entry.main}-${subCode}`}
                                            type="button"
                                            onClick={() => {
                                                onChange(`SUB:${subCode}`);
                                                setOpen(false);
                                                setExpanded(null);
                                            }}
                                            className={`w-full px-6 py-2 text-left text-sm ${value === `SUB:${subCode}` ? 'font-semibold text-gray-900' : 'text-gray-700'} hover:bg-gray-100`}
                                        >
                                            {subCode}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ── Shared styling helpers ────────────────────────────────────────────
const applyStylesToWorksheet = (worksheet) => {
    worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };

            if (rowNumber === 1) {
                cell.font = { name: 'Calibri', size: 14, bold: true };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                return;
            }

            if (rowNumber === 3 || rowNumber === 4) {
                cell.font = { name: 'Calibri', size: 11, bold: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                return;
            }

            if (rowNumber === worksheet.rowCount) {
                cell.font = { name: 'Calibri', size: 11, bold: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
            } else {
                cell.font = { name: 'Calibri', size: 11 };
            }

            if (rowNumber > 4) {
                if (typeof cell.value === 'number') {
                    cell.alignment = { vertical: 'middle', horizontal: 'right' };
                } else {
                    cell.alignment = { vertical: 'middle', horizontal: 'left' };
                }
            }
        });
    });
};

const Reports = () => {
    const [loadingReport, setLoadingReport] = useState(null);
    const [showPaymentFilterModal, setShowPaymentFilterModal] = useState(false);
    const [paymentFilterLoading, setPaymentFilterLoading] = useState(false);
    const [paymentFilters, setPaymentFilters] = useState(defaultPaymentFilters);
    const [paymentFilterOptions, setPaymentFilterOptions] = useState({
        departments: [],
        batchYears: [],
        batches: [],
        hostels: []
    });
    const token = localStorage.getItem('login');

    const fetchStudents = async () => {
        const res = await axios.get(import.meta.env.VITE_APP_API + '/student/get-all-students-auth', {
            headers: { Authorization: `Bearer ${token}` }
        });
        return res.data.Result || [];
    };

    const fetchHostels = async () => {
        const res = await axios.get(import.meta.env.VITE_APP_API + '/hostel/get-all-hostels', {
            headers: { Authorization: `Bearer ${token}` }
        });
        return res.data.Result || [];
    };

    const collectPaymentFilterOptions = async () => {
        const [students, hostels] = await Promise.all([fetchStudents(), fetchHostels()]);

        const deptMap = new Map();
        const batchYearSet = new Set();
        const batchSet = new Set();

        students.forEach((std) => {
            const enrol = std.enrolmentNo || '';
            const main = getMainDept(enrol);
            const sub = getSubDept(enrol);
            const batch = getBatchPrefixFromEnrolNo(enrol);
            const batchYear = String(std.batchYear || getBatchYearFromEnrolNo(enrol) || '').trim();

            if (main && main !== 'N/A') {
                if (!deptMap.has(main)) deptMap.set(main, new Set());

                if (sub && sub !== main) {
                    deptMap.get(main).add(sub);
                }

                const parts = enrol.split('/').filter(Boolean);
                if (parts.length === 3) {
                    deptMap.get(main).add(main);
                }
            }

            if (batchYear) batchYearSet.add(batchYear);
            if (batch) batchSet.add(batch);
        });

        const departments = Array.from(deptMap.entries())
            .map(([mainCode, subSet]) => ({
                main: mainCode,
                subs: Array.from(subSet).sort()
            }))
            .sort((a, b) => (DEPARTMENT_MAP[a.main] || a.main).localeCompare(DEPARTMENT_MAP[b.main] || b.main));

        return {
            departments,
            batchYears: Array.from(batchYearSet).sort(),
            batches: Array.from(batchSet).sort(),
            hostels: [...hostels].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
        };
    };

    const openPaymentFilterModal = async () => {
        try {
            setPaymentFilterLoading(true);
            const options = await collectPaymentFilterOptions();
            setPaymentFilterOptions(options);
            setPaymentFilters(defaultPaymentFilters);
            setShowPaymentFilterModal(true);
        } catch (error) {
            console.error('Failed to load payment filters', error);
            alert('Failed to load payment filters.');
        } finally {
            setPaymentFilterLoading(false);
        }
    };

    const handlePaymentFilterChange = (field, value) => {
        setPaymentFilters(prev => ({ ...prev, [field]: value }));
    };

    const handlePaymentExportWithFilters = async () => {
        const selectedHostel = paymentFilterOptions.hostels.find(h => h._id === paymentFilters.hostelId);

        const filters = {
            departmentFilter: paymentFilters.departmentFilter,
            hostelId: paymentFilters.hostelId,
            batchYear: paymentFilters.batchYear,
            batch: paymentFilters.batch,
            residentDateFrom: paymentFilters.residentDateFrom,
            residentDateTo: paymentFilters.residentDateTo,
            selectedHostelName: selectedHostel?.name || '',
        };

        setShowPaymentFilterModal(false);
        await handleDownload('payments', () => generatePaymentReport(filters));
    };

    // ── 1. Distribution Report ────────────────────────────────────────
    const generateDistributionReport = async () => {
        const students = await fetchStudents();
        const hostels = await fetchHostels();
        const assignedStudents = students.filter(s => s.hostelId || s.hostelName || s.isAssign);

        const maleHostels = hostels.filter(h => h.gender === 'Male').sort((a, b) => a.name.localeCompare(b.name));
        const femaleHostels = hostels.filter(h => h.gender === 'Female').sort((a, b) => a.name.localeCompare(b.name));
        const allHostelCols = [...maleHostels, ...femaleHostels];

        const groups = {};
        assignedStudents.forEach(std => {
            const deptCode = getMainDept(std.enrolmentNo);
            const department = DEPARTMENT_MAP[deptCode] || deptCode;
            let batch = 'N/A';
            if (std.enrolmentNo) {
                const parts = std.enrolmentNo.split('/');
                if (parts.length >= 2) batch = `${parts[0]}/${parts[1]}`;
            }
            const key = `${department}_${batch}`;
            if (!groups[key]) {
                groups[key] = { department, batch, hostelCounts: {} };
                allHostelCols.forEach(h => groups[key].hostelCounts[h.name] = 0);
            }
            let assignedHostelName = std.hostelName;
            if (!assignedHostelName && std.hostelId) {
                const h = hostels.find(x => x._id === std.hostelId);
                if (h) assignedHostelName = h.name;
            }
            if (assignedHostelName && groups[key].hostelCounts[assignedHostelName] !== undefined) {
                groups[key].hostelCounts[assignedHostelName]++;
            }
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Hall Wise Summery');

        const row1 = ['Faculty', 'Batch'];
        if (maleHostels.length > 0) { row1.push('Male Hostels'); for (let i = 1; i < maleHostels.length; i++) row1.push(''); }
        if (femaleHostels.length > 0) { row1.push('Female Hostels'); for (let i = 1; i < femaleHostels.length; i++) row1.push(''); }
        row1.push('Total');

        const row2 = ['', ''];
        maleHostels.forEach(h => row2.push(h.name));
        femaleHostels.forEach(h => row2.push(h.name));
        row2.push('');

        worksheet.addRow([`Hall Wise Summery Report - Generated ${new Date().toLocaleDateString()}`]);
        worksheet.addRow([]);
        worksheet.addRow(row1);
        worksheet.addRow(row2);

        worksheet.mergeCells(1, 1, 1, row1.length);
        worksheet.mergeCells(3, 1, 4, 1);
        worksheet.mergeCells(3, 2, 4, 2);

        let colIdx = 3;
        if (maleHostels.length > 0) { worksheet.mergeCells(3, colIdx, 3, colIdx + maleHostels.length - 1); colIdx += maleHostels.length; }
        if (femaleHostels.length > 0) { worksheet.mergeCells(3, colIdx, 3, colIdx + femaleHostels.length - 1); colIdx += femaleHostels.length; }
        worksheet.mergeCells(3, colIdx, 4, colIdx);

        Object.values(groups).sort((a, b) => a.department.localeCompare(b.department)).forEach(g => {
            const row = [g.department, g.batch];
            let total = 0;
            allHostelCols.forEach(h => { const c = g.hostelCounts[h.name]; row.push(c); total += c; });
            row.push(total);
            worksheet.addRow(row);
        });

        worksheet.getColumn(1).width = 25;
        worksheet.getColumn(2).width = 12;
        for (let i = 0; i < allHostelCols.length; i++) { worksheet.getColumn(i + 3).width = 15; }
        worksheet.getColumn(allHostelCols.length + 3).width = 12;

        applyStylesToWorksheet(worksheet);

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), 'Hall_Wise_Summery_Report.xlsx');
    };

    // ── 2. Capacity Report ────────────────────────────────────────────
    const generateCapacityReport = async () => {
        const hostels = await fetchHostels();
        const rows = [];
        let grandRooms = 0, grandMale = 0, grandFemale = 0;

        hostels.forEach(h => {
            const rooms = h.roomCount || 0;
            const maleCap = h.gender === 'Male' ? rooms * 2 : 0;
            const femaleCap = h.gender === 'Female' ? rooms * 2 : 0;
            rows.push([h.name || 'Unnamed', rooms, maleCap, femaleCap, maleCap + femaleCap]);
            grandRooms += rooms; grandMale += maleCap; grandFemale += femaleCap;
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Hostel Details & Capacity');

        worksheet.addRow([`Hostel Details & Capacity Report - Generated ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`]);
        worksheet.addRow([]);
        worksheet.addRow(['Hostel Name', 'No of Rooms', 'Capacity', '', '']);
        worksheet.addRow(['', '', 'Male', 'Female', 'Total']);
        rows.forEach(r => worksheet.addRow(r));
        worksheet.addRow(['Grand Total', grandRooms, grandMale, grandFemale, grandMale + grandFemale]);

        worksheet.mergeCells(1, 1, 1, 5);
        worksheet.mergeCells(3, 1, 4, 1);
        worksheet.mergeCells(3, 2, 4, 2);
        worksheet.mergeCells(3, 3, 3, 5);
        worksheet.mergeCells(worksheet.rowCount, 1, worksheet.rowCount, 1);

        worksheet.columns = [
            { width: 25 }, { width: 15 }, { width: 12 }, { width: 12 }, { width: 12 }
        ];

        applyStylesToWorksheet(worksheet);

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), 'Hostel_Details_&_Capacity__Report.xlsx');
    };

    // ── 3. Financial Report ───────────────────────────────────────────
    const generateFinancialReport = async () => {
        const students = await fetchStudents();
        const hostels = await fetchHostels();
        const assignedStudents = students.filter(s => s.hostelId || s.hostelName || s.isAssign);

        const deptsSet = new Set();
        assignedStudents.forEach(std => {
            const deptCode = getMainDept(std.enrolmentNo);
            const department = DEPARTMENT_MAP[deptCode] || deptCode;
            deptsSet.add(department);
        });
        const departments = Array.from(deptsSet).sort();

        const groups = {};
        hostels.forEach(h => {
            groups[h.name] = { hostelName: h.name, deptCounts: {} };
            departments.forEach(d => { groups[h.name].deptCounts[d] = { M: 0, F: 0 }; });
        });

        assignedStudents.forEach(std => {
            let assignedHostelName = std.hostelName;
            if (!assignedHostelName && std.hostelId) {
                const h = hostels.find(x => x._id === std.hostelId);
                if (h) assignedHostelName = h.name;
            }
            if (!assignedHostelName || !groups[assignedHostelName]) return;
            const deptCode = getMainDept(std.enrolmentNo);
            const department = DEPARTMENT_MAP[deptCode] || deptCode;
            const gender = std.sex === 'Male' ? 'M' : 'F';
            if (groups[assignedHostelName].deptCounts[department]) {
                groups[assignedHostelName].deptCounts[department][gender]++;
            }
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Faculty Wise Hostel Summery');

        const row1 = ['Hostel Name'];
        departments.forEach(d => { row1.push(d); row1.push(''); });
        row1.push('Total Students', 'Fee/Student');

        const row2 = [''];
        departments.forEach(() => row2.push('M', 'F'));
        row2.push('', '');

        worksheet.addRow([`Faculty Wise Hostel Summery - Generated ${new Date().toLocaleDateString()}`]);
        worksheet.addRow([]);
        worksheet.addRow(row1);
        worksheet.addRow(row2);

        worksheet.mergeCells(1, 1, 1, row1.length);
        worksheet.mergeCells(3, 1, 4, 1);
        let colIdx = 2;
        departments.forEach(() => {
            worksheet.mergeCells(3, colIdx, 3, colIdx + 1);
            colIdx += 2;
        });
        worksheet.mergeCells(3, colIdx, 4, colIdx);
        worksheet.mergeCells(3, colIdx + 1, 4, colIdx + 1);

        Object.values(groups).sort((a, b) => a.hostelName.localeCompare(b.hostelName)).forEach(g => {
            const row = [g.hostelName];
            let total = 0;
            departments.forEach(d => {
                const mCount = g.deptCounts[d].M;
                const fCount = g.deptCounts[d].F;
                row.push(mCount, fCount);
                total += mCount + fCount;
            });
            row.push(total, '');
            worksheet.addRow(row);
        });

        worksheet.getColumn(1).width = 25;
        let cIdx = 2;
        departments.forEach(() => {
            worksheet.getColumn(cIdx++).width = 8;
            worksheet.getColumn(cIdx++).width = 8;
        });
        worksheet.getColumn(cIdx++).width = 15;
        worksheet.getColumn(cIdx++).width = 15;

        applyStylesToWorksheet(worksheet);

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), 'Faculty_Wise_Hostel_Summery_Report.xlsx');
    };

    // ── 4. Eligibility & Allocation Report ────────────────────────────
    const generateEligibilityReport = async () => {
        const students = await fetchStudents();
        const groups = {};
        let grandRegistered = 0, grandEligible = 0, grandMale = 0, grandFemale = 0, grandRev = 0, grandTotal = 0;

        students.forEach(std => {
            const deptCode = getMainDept(std.enrolmentNo);
            const department = DEPARTMENT_MAP[deptCode] || deptCode || 'Unknown';

            let batchYear = 'Unknown';
            if (std.enrolmentNo) {
                const parts = std.enrolmentNo.split('/');
                if (parts.length >= 2 && parts[1]) {
                    batchYear = parts[1].length === 2 ? `20${parts[1]}` : parts[1];
                }
            }

            let studyYear = '';
            if (std.dateOfEnrolment) {
                studyYear = String((new Date().getFullYear() - new Date(std.dateOfEnrolment).getFullYear()) + 1);
            }

            const studyYearLabel = studyYear ? `Year ${studyYear}` : 'Unknown';

            const key = `${department}_${batchYear}_${studyYear}`;
            if (!groups[key]) {
                groups[key] = { department, batchYear, studyYearLabel, registered: 0, eligible: 0, maleAssigned: 0, femaleAssigned: 0 };
            }

            groups[key].registered++;

            const isAssigned = !!(std.isAssign || std.hostelId || std.hostelName);
            const isEligible = isAssigned || std.eligibilityStatus === 'Eligible' || std.eligibilityStatus === true;

            if (isEligible) groups[key].eligible++;

            if (isAssigned) {
                const gender = (std.sex || '').toLowerCase();
                if (gender === 'male') groups[key].maleAssigned++;
                else if (gender === 'female') groups[key].femaleAssigned++;
            }
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('HOSTEL Facillity Allocation and Student Satisfaction');

        worksheet.addRow(['HOSTEL Facillity Allocation and Student Satisfaction']);
        worksheet.addRow([]);
        worksheet.addRow(['Faculty', 'Batch Year', 'Year of Intake', 'Student Registered', 'No. of Students Eligible for Hostel', 'No. of Students Who Received Hostel', '', '', '']);
        worksheet.addRow(['', '', '', '', '', 'Male', 'Female', 'Rev', 'Total']);

        Object.values(groups).sort((a, b) => a.department.localeCompare(b.department)).forEach(g => {
            const rev = 0;
            const total = g.maleAssigned + g.femaleAssigned + rev;
            worksheet.addRow([g.department, g.batchYear, g.studyYearLabel, g.registered, g.eligible, g.maleAssigned, g.femaleAssigned, rev, total]);

            grandRegistered += g.registered;
            grandEligible += g.eligible;
            grandMale += g.maleAssigned;
            grandFemale += g.femaleAssigned;
            grandRev += rev;
            grandTotal += total;
        });

        worksheet.addRow(['Grand Total', '', '', grandRegistered, grandEligible, grandMale, grandFemale, grandRev, grandTotal]);

        worksheet.mergeCells(1, 1, 1, 9);
        worksheet.mergeCells(3, 1, 4, 1);
        worksheet.mergeCells(3, 2, 4, 2);
        worksheet.mergeCells(3, 3, 4, 3);
        worksheet.mergeCells(3, 4, 4, 4);
        worksheet.mergeCells(3, 5, 4, 5);
        worksheet.mergeCells(3, 6, 3, 9);
        worksheet.mergeCells(worksheet.rowCount, 1, worksheet.rowCount, 3);

        worksheet.columns = [
            { width: 25 }, { width: 15 }, { width: 18 }, { width: 20 }, { width: 35 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }
        ];

        applyStylesToWorksheet(worksheet);

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), 'HOSTEL_Facillity_Allocation_and_Student_Satisfaction_Report.xlsx');
    };

    // ── 5. Payment Report ────────────────────────────
    const generatePaymentReport = async (filters = {}) => {

        const url = import.meta.env.VITE_APP_API + '/admin/payments';
        const params = {};
        if (filters.departmentFilter) params.departmentFilter = filters.departmentFilter;
        if (filters.hostelId) params.hostelId = filters.hostelId;
        if (filters.batchYear) params.batchYear = filters.batchYear;
        if (filters.batch) params.batch = filters.batch;
        if (filters.residentDateFrom) params.residentDateFrom = filters.residentDateFrom;
        if (filters.residentDateTo) params.residentDateTo = filters.residentDateTo;

        const res = await axios.get(url, {
            headers: { Authorization: `Bearer ${token}` },
            params,
        });
        const payments = res.data.Result || res.data.result || [];

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Hall List');

        worksheet.addRow([`Hall List - Generated ${new Date().toLocaleDateString()}`]);
        worksheet.addRow([]);

        const headers = ['No', 'Reg No', 'Enrollment No', 'Hostel', 'Room No', 'Hall Fee', 'Paid Date'];
        worksheet.addRow(headers);
        worksheet.addRow(['', '', '', '', '', '', '']); // Empty row 4 for shared styling compatibility

        let totalAmount = 0;

        payments.forEach((p, idx) => {
            const dateStr = formatDateYmd(p.paidDate) || '-';
            const amount = Number(p.amount) || 0;
            totalAmount += amount;

            worksheet.addRow([
                idx + 1,
                p.studentId?.no || '-',
                p.studentId?.enrolmentNo || '-',
                p.hostelName || '-',
                p.roomNo || '-',
                amount,
                dateStr
            ]);
        });

        worksheet.addRow(['Grand Total', '', '', '', '', totalAmount, '']);

        worksheet.mergeCells(1, 1, 1, 7); // Title

        // Merge the two header rows to look like one centered header block
        for (let i = 1; i <= 7; i++) {
            worksheet.mergeCells(3, i, 4, i);
        }

        worksheet.mergeCells(worksheet.rowCount, 1, worksheet.rowCount, 5); // Total label

        worksheet.columns = [
            { width: 8 },
            { width: 15 },
            { width: 20 },
            { width: 22 },
            { width: 12 },
            { width: 15 },
            { width: 15 }
        ];

        applyStylesToWorksheet(worksheet);

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), 'Hall_List.xlsx');
    };

    const handleDownload = async (type, generatorFn) => {
        try {
            setLoadingReport(type);
            await generatorFn();
        } catch (error) {
            console.error('Failed to generate report', error);
            alert('Failed to generate report.');
        } finally {
            setLoadingReport(null);
        }
    };

    const reportOptions = [
        {
            id: 'distribution',
            title: 'Hall Wise Summery',
            description: 'Shows the distribution of students across hostels grouped by their academic department and batch year.',
            icon: Activity,
            color: 'bg-blue-50 text-blue-600',
            action: generateDistributionReport
        },
        {
            id: 'capacity',
            title: 'Hostel Details & Capacity',
            description: 'A comprehensive summary of room availability and overall accommodation capacity separated by gender.',
            icon: Building,
            color: 'bg-emerald-50 text-emerald-600',
            action: generateCapacityReport
        },
        {
            id: 'financial',
            title: 'Faculty Wise Hostel Summery',
            description: 'Breakdown of allocated students by department inside each hostel, intended for fee and academic analysis.',
            icon: IndianRupee,
            color: 'bg-purple-50 text-purple-600',
            action: generateFinancialReport
        },
        {
            id: 'eligibility',
            title: 'Hostel Facillity Allocation and Student Satisfaction',
            description: 'Detailed view of student registrations versus actual hostel eligibility and final room assignments.',
            icon: Users,
            color: 'bg-amber-50 text-amber-600',
            action: generateEligibilityReport
        },
        {
            id: 'payments',
            title: 'Hall List',
            description: 'Complete export of all recorded hostel hall fee payments made by assigned students.',
            icon: CreditCard,
            color: 'bg-indigo-50 text-indigo-600',
            action: generatePaymentReport
        }
    ];

    return (
        <div className="p-8 max-w-7xl mx-auto min-h-screen">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">System Reports</h1>
                <p className="text-gray-500">Generate and download comprehensive data exports for hostel management.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {reportOptions.map((report) => {
                    const Icon = report.icon;
                    const isLoading = loadingReport === report.id;

                    return (
                        <div key={report.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className={`p-3 rounded-xl ${report.color}`}>
                                        <Icon className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-gray-800">{report.title}</h3>
                                </div>
                                <p className="text-gray-600 text-sm leading-relaxed mb-8">
                                    {report.description}
                                </p>
                            </div>

                            <button
                                onClick={() => {
                                    if (report.id === 'payments') {
                                        openPaymentFilterModal();
                                        return;
                                    }
                                    handleDownload(report.id, report.action);
                                }}
                                disabled={!!loadingReport || paymentFilterLoading}
                                className={`w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-medium transition-all
                                    ${isLoading
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : loadingReport || paymentFilterLoading
                                            ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                                            : 'bg-[#6b0f14] text-white hover:bg-[#4f0a0f] active:scale-[0.98]'
                                    }
                                `}
                            >
                                {isLoading || (paymentFilterLoading && report.id === 'payments') ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                        {paymentFilterLoading && report.id === 'payments' ? 'Loading filters...' : 'Generating...'}
                                    </>
                                ) : (
                                    <>
                                        <FileSpreadsheet className="w-5 h-5" />
                                        Export to Excel
                                    </>
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>

            {showPaymentFilterModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
                    <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
                        <h2 className="text-xl font-semibold text-gray-800 mb-1">Hall List Filters</h2>
                        <p className="text-sm text-gray-500 mb-6">Select filters for department, hostel, batch year, batch, and resident date.</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <DepartmentTreeSelect
                                options={paymentFilterOptions.departments}
                                value={paymentFilters.departmentFilter}
                                onChange={(val) => handlePaymentFilterChange('departmentFilter', val)}
                            />

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Hostel</label>
                                <select
                                    value={paymentFilters.hostelId}
                                    onChange={(e) => handlePaymentFilterChange('hostelId', e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
                                >
                                    <option value="">All Hostels</option>
                                    {paymentFilterOptions.hostels.map(h => (
                                        <option key={h._id} value={h._id}>{h.name || 'Hostel'}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Batch Year</label>
                                <select
                                    value={paymentFilters.batchYear}
                                    onChange={(e) => handlePaymentFilterChange('batchYear', e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
                                >
                                    <option value="">All Batch Years</option>
                                    {paymentFilterOptions.batchYears.map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Batch</label>
                                <select
                                    value={paymentFilters.batch}
                                    onChange={(e) => handlePaymentFilterChange('batch', e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
                                >
                                    <option value="">All Batches</option>
                                    {paymentFilterOptions.batches.map(batch => (
                                        <option key={batch} value={batch}>{batch}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Resident Date From</label>
                                <input
                                    type="date"
                                    value={paymentFilters.residentDateFrom}
                                    onChange={(e) => handlePaymentFilterChange('residentDateFrom', e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Resident Date To</label>
                                <input
                                    type="date"
                                    value={paymentFilters.residentDateTo}
                                    onChange={(e) => handlePaymentFilterChange('residentDateTo', e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowPaymentFilterModal(false)}
                                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handlePaymentExportWithFilters}
                                className="rounded-lg bg-[#6b0f14] px-4 py-2 text-sm font-medium text-white hover:bg-[#4f0a0f]"
                            >
                                Export Hall List
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Reports;
