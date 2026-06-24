import React, { useState } from 'react';
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
        const worksheet = workbook.addWorksheet('Hostel Distribution');

        const row1 = ['Faculty', 'Batch'];
        if (maleHostels.length > 0) { row1.push('Male Hostels'); for (let i = 1; i < maleHostels.length; i++) row1.push(''); }
        if (femaleHostels.length > 0) { row1.push('Female Hostels'); for (let i = 1; i < femaleHostels.length; i++) row1.push(''); }
        row1.push('Total');

        const row2 = ['', ''];
        maleHostels.forEach(h => row2.push(h.name));
        femaleHostels.forEach(h => row2.push(h.name));
        row2.push('');

        worksheet.addRow([`Hostel Distribution Report - Generated ${new Date().toLocaleDateString()}`]);
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
        saveAs(new Blob([buffer]), 'Hostel_Distribution_Report.xlsx');
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
        const worksheet = workbook.addWorksheet('Capacity Summary');

        worksheet.addRow([`Hostel Capacity Summary Report - Generated ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`]);
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
        saveAs(new Blob([buffer]), 'Hostel_Capacity_Summary_Report.xlsx');
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
        const worksheet = workbook.addWorksheet('Financial Breakdown');

        const row1 = ['Hostel Name'];
        departments.forEach(d => { row1.push(d); row1.push(''); });
        row1.push('Total Students', 'Fee/Student');

        const row2 = [''];
        departments.forEach(() => row2.push('M', 'F'));
        row2.push('', '');

        worksheet.addRow([`Hostel Academic & Financial Breakdown - Generated ${new Date().toLocaleDateString()}`]);
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
        saveAs(new Blob([buffer]), 'Hostel_Financial_Report.xlsx');
    };

    // ── 4. Eligibility & Allocation Report ────────────────────────────
    const generateEligibilityReport = async () => {
        const students = await fetchStudents();
        const groups = {};
        let grandRegistered = 0, grandEligible = 0, grandMale = 0, grandFemale = 0, grandTotal = 0;

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
        const worksheet = workbook.addWorksheet('Eligibility & Allocation');

        worksheet.addRow(['HOSTEL ELIGIBILITY AND ALLOCATION SUMMARY REPORT']);
        worksheet.addRow([]);
        worksheet.addRow(['Faculty', 'Batch Year', 'Year of Intake', 'Student Registered', 'No. of Students Eligible for Hostel', 'No. of Students Who Received Hostel', '', '']);
        worksheet.addRow(['', '', '', '', '', 'Male', 'Female', 'Total']);

        Object.values(groups).sort((a, b) => a.department.localeCompare(b.department)).forEach(g => {
            const total = g.maleAssigned + g.femaleAssigned;
            worksheet.addRow([g.department, g.batchYear, g.studyYearLabel, g.registered, g.eligible, g.maleAssigned, g.femaleAssigned, total]);

            grandRegistered += g.registered;
            grandEligible += g.eligible;
            grandMale += g.maleAssigned;
            grandFemale += g.femaleAssigned;
            grandTotal += total;
        });

        worksheet.addRow(['Grand Total', '', '', grandRegistered, grandEligible, grandMale, grandFemale, grandTotal]);

        worksheet.mergeCells(1, 1, 1, 8);
        worksheet.mergeCells(3, 1, 4, 1);
        worksheet.mergeCells(3, 2, 4, 2);
        worksheet.mergeCells(3, 3, 4, 3);
        worksheet.mergeCells(3, 4, 4, 4);
        worksheet.mergeCells(3, 5, 4, 5);
        worksheet.mergeCells(3, 6, 3, 8);
        worksheet.mergeCells(worksheet.rowCount, 1, worksheet.rowCount, 3);

        worksheet.columns = [
            { width: 25 }, { width: 15 }, { width: 18 }, { width: 20 }, { width: 35 }, { width: 12 }, { width: 12 }, { width: 12 }
        ];

        applyStylesToWorksheet(worksheet);

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), 'Hostel_Eligibility_Allocation_Report.xlsx');
    };

    // ── 5. Payment Report ────────────────────────────
    const generatePaymentReport = async () => {
        const url = import.meta.env.VITE_APP_API + '/admin/payments';
        const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
        const payments = res.data.Result || res.data.result || [];

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Payment Records');

        worksheet.addRow([`Hostel Payment Export Report - Generated ${new Date().toLocaleDateString()}`]);
        worksheet.addRow([]);
        
        const headers = ['No', 'Reg No', 'Enrollment No', 'Hostel', 'Room No', 'Hall Fee', 'Date'];
        worksheet.addRow(headers);
        worksheet.addRow(['', '', '', '', '', '', '']); // Empty row 4 for shared styling compatibility

        let totalAmount = 0;
        
        payments.forEach((p, idx) => {
            const dateStr = p.paidDate ? new Date(p.paidDate).toISOString().split('T')[0] : '-';
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
        for(let i = 1; i <= 7; i++) {
            worksheet.mergeCells(3, i, 4, i);
        }
        
        worksheet.mergeCells(worksheet.rowCount, 1, worksheet.rowCount, 5); // Total label

        worksheet.columns = [
            { width: 8 }, { width: 15 }, { width: 20 }, { width: 25 }, { width: 12 }, { width: 15 }, { width: 15 }
        ];

        applyStylesToWorksheet(worksheet);

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), 'Hostel_Payments_Report.xlsx');
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
            title: 'Hostel Distribution',
            description: 'Shows the distribution of students across hostels grouped by their academic department and batch year.',
            icon: Activity,
            color: 'bg-blue-50 text-blue-600',
            action: generateDistributionReport
        },
        {
            id: 'capacity',
            title: 'Capacity Summary',
            description: 'A comprehensive summary of room availability and overall accommodation capacity separated by gender.',
            icon: Building,
            color: 'bg-emerald-50 text-emerald-600',
            action: generateCapacityReport
        },
        {
            id: 'financial',
            title: 'Academic & Financial',
            description: 'Breakdown of allocated students by department inside each hostel, intended for fee and academic analysis.',
            icon: IndianRupee,
            color: 'bg-purple-50 text-purple-600',
            action: generateFinancialReport
        },
        {
            id: 'eligibility',
            title: 'Eligibility & Allocation',
            description: 'Detailed view of student registrations versus actual hostel eligibility and final room assignments.',
            icon: Users,
            color: 'bg-amber-50 text-amber-600',
            action: generateEligibilityReport
        },
        {
            id: 'payments',
            title: 'Payment Records',
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
                                onClick={() => handleDownload(report.id, report.action)}
                                disabled={!!loadingReport}
                                className={`w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-medium transition-all
                                    ${isLoading 
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : !!loadingReport
                                            ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                                            : 'bg-[#6b0f14] text-white hover:bg-[#4f0a0f] active:scale-[0.98]'
                                    }
                                `}
                            >
                                {isLoading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                        Generating...
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
        </div>
    );
};

export default Reports;
