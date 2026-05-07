const Payment = require("../model/Payment");
const Allocation = require("../model/Allocation");
const Student = require("../model/Student");
const SpecialNeeds = require("../model/SpecialNeeds");
const XLSX = require('xlsx');

const AdminController = {
    // Admin: Get all payments (read-only)
    getPayments: async (req, res) => {
        try {
            const { hostelId } = req.query;

            let payments;

            if (hostelId) {
                // Find active allocations for the hostel
                const allocations = await Allocation.find({ hostelID: hostelId, active: true });

                // Collect student ObjectIds from allocations (if stored) and regNos otherwise.
                // NOTE: Some legacy data stores Student _id (24-hex) as a string in Allocation.regNo.
                const objectIdPattern = /^[0-9a-fA-F]{24}$/;

                const objectIds = allocations
                    .filter(a => a.studentId)
                    .map(a => (a.studentId.toString ? a.studentId.toString() : String(a.studentId)));

                const regNosRaw = allocations
                    .filter(a => !a.studentId && a.regNo)
                    .map(a => String(a.regNo));

                const regNoObjectIds = regNosRaw.filter(v => objectIdPattern.test(v));
                const enrolmentNos = regNosRaw.filter(v => !objectIdPattern.test(v));

                // Resolve enrolmentNos to Student _id where possible
                let resolvedIds = [];
                if (enrolmentNos.length) {
                    const students = await Student.find({ enrolmentNo: { $in: enrolmentNos } }).select('_id enrolmentNo');
                    const map = {};
                    students.forEach(s => { map[s.enrolmentNo] = s._id; });
                    resolvedIds = enrolmentNos.map(r => map[r]).filter(Boolean);
                }

                const studentIds = Array.from(new Set([
                    ...objectIds,
                    ...regNoObjectIds,
                    ...resolvedIds.map(id => id.toString())
                ]));

                if (studentIds.length > 0) {
                    payments = await Payment.find({ studentId: { $in: studentIds } })
                        .populate('studentId', 'fullName enrolmentNo nic no _id')
                        .sort({ paidDate: -1 });
                } else {
                    // If no allocations, return empty
                    payments = [];
                }
            } else {
                // Return all payments when no hostel filter provided
                payments = await Payment.find()
                    .populate('studentId', 'fullName enrolmentNo nic no _id')
                    .sort({ paidDate: -1 });
            }

            // Map allocations to room numbers for the returned payments
            const studentIdsForLookup = payments.map(p => (p.studentId && p.studentId._id) ? p.studentId._id.toString() : (p.studentId ? p.studentId.toString() : null)).filter(Boolean);

            const allocs = await Allocation.find({
                $or: [ { regNo: { $in: studentIdsForLookup } }, { studentId: { $in: studentIdsForLookup } } ],
                active: true
            }).populate('roomId').populate('hostelID');

            const allocMap = {};
            allocs.forEach(a => {
                const sid = a.studentId ? (a.studentId.toString ? a.studentId.toString() : a.studentId) : (a.regNo ? a.regNo.toString() : null);
                if (!sid) return;
                allocMap[sid] = {
                    roomNo: a.roomId && a.roomId.roomID ? a.roomId.roomID : null,
                    hostelName: a.hostelID && a.hostelID.name ? a.hostelID.name : null
                };
            });

            const paymentsWithRoom = payments.map(p => {
                const pObj = p.toObject ? p.toObject() : p;
                let roomNo = null;
                let hostelName = null;
                
                // Try to find room and hostel using studentId first
                if (pObj.studentId && pObj.studentId._id) {
                    const studentIdStr = pObj.studentId._id.toString();
                    if (allocMap[studentIdStr]) {
                        roomNo = allocMap[studentIdStr].roomNo || null;
                        hostelName = allocMap[studentIdStr].hostelName || null;
                    }
                }
                
                // Fallback: try using enrollment number if studentId lookup failed
                if (!roomNo && pObj.studentId && pObj.studentId.enrolmentNo) {
                    if (allocMap[pObj.studentId.enrolmentNo]) {
                        roomNo = allocMap[pObj.studentId.enrolmentNo].roomNo || null;
                        hostelName = allocMap[pObj.studentId.enrolmentNo].hostelName || null;
                    }
                }
                
                pObj.roomNo = roomNo;
                pObj.hostelName = hostelName;
                return pObj;
            });

            const total = paymentsWithRoom.reduce((s, p) => s + (p.amount || 0), 0);

            return res.json({ Status: 'Success', Result: paymentsWithRoom, total });
        } catch (err) {
            console.error('admin getPayments error:', err);
            return res.status(500).json({ Error: 'Server error', details: err.message });
        }
    }
    ,
    exportPayments: async (req, res) => {
        try {
            const { hostelId } = req.query;

            // Use exact same logic as getPayments to ensure consistency
            let payments;

            if (hostelId) {
                // Find active allocations for the hostel
                const allocations = await Allocation.find({ hostelID: hostelId, active: true });

                // Collect student ObjectIds from allocations (if stored) and regNos otherwise.
                // NOTE: Some legacy data stores Student _id (24-hex) as a string in Allocation.regNo.
                const objectIdPattern = /^[0-9a-fA-F]{24}$/;

                const objectIds = allocations
                    .filter(a => a.studentId)
                    .map(a => (a.studentId.toString ? a.studentId.toString() : String(a.studentId)));

                const regNosRaw = allocations
                    .filter(a => !a.studentId && a.regNo)
                    .map(a => String(a.regNo));

                const regNoObjectIds = regNosRaw.filter(v => objectIdPattern.test(v));
                const enrolmentNos = regNosRaw.filter(v => !objectIdPattern.test(v));

                // Resolve enrolmentNos to Student _id where possible
                let resolvedIds = [];
                if (enrolmentNos.length) {
                    const students = await Student.find({ enrolmentNo: { $in: enrolmentNos } }).select('_id enrolmentNo');
                    const map = {};
                    students.forEach(s => { map[s.enrolmentNo] = s._id; });
                    resolvedIds = enrolmentNos.map(r => map[r]).filter(Boolean);
                }

                const studentIds = Array.from(new Set([
                    ...objectIds,
                    ...regNoObjectIds,
                    ...resolvedIds.map(id => id.toString())
                ]));

                payments = await Payment.find({ studentId: { $in: studentIds } })
                    .populate('studentId', 'fullName enrolmentNo nic no _id')
                    .sort({ paidDate: -1 });
            } else {
                // Return all payments when no hostel filter provided
                payments = await Payment.find()
                    .populate('studentId', 'fullName enrolmentNo nic no _id')
                    .sort({ paidDate: -1 });
            }

            // Map allocations to room numbers for the returned payments
            const studentIdsForLookup = payments.map(p => (p.studentId && p.studentId._id) ? p.studentId._id.toString() : (p.studentId ? p.studentId.toString() : null)).filter(Boolean);

            const allocs = await Allocation.find({
                $or: [ { regNo: { $in: studentIdsForLookup } }, { studentId: { $in: studentIdsForLookup } } ],
                active: true
            }).populate('roomId');

            const allocMap = {};
            allocs.forEach(a => {
                const sid = a.studentId ? (a.studentId.toString ? a.studentId.toString() : a.studentId) : (a.regNo ? a.regNo.toString() : null);
                if (!sid) return;
                allocMap[sid] = a.roomId && a.roomId.roomID ? a.roomId.roomID : null;
            });

            const paymentsWithRoom = payments.map(p => {
                const pObj = p.toObject ? p.toObject() : p;
                let roomNo = null;
                
                // Try to find room using studentId first
                if (pObj.studentId && pObj.studentId._id) {
                    const studentIdStr = pObj.studentId._id.toString();
                    roomNo = allocMap[studentIdStr] || null;
                }
                
                // Fallback: try using enrollment number if studentId lookup failed
                if (!roomNo && pObj.studentId && pObj.studentId.enrolmentNo) {
                    roomNo = allocMap[pObj.studentId.enrolmentNo] || null;
                }
                
                pObj.roomNo = roomNo;
                return pObj;
            });

            // Prepare rows for Excel; format date properly to avoid timezone issues
            const rows = paymentsWithRoom.map((p, idx) => {
                // Convert date to YYYY-MM-DD string format to avoid timezone shifts
                let paidDateStr = '';
                if (p.paidDate) {
                    const date = new Date(p.paidDate);
                    paidDateStr = date.toISOString().split('T')[0]; // Gets YYYY-MM-DD
                }
                
                return {
                    '#': idx + 1,
                    'Reg No': p.studentId?.no || '',
                    'Enrollment No': p.studentId?.enrolmentNo || '',
                    'Full Name': p.studentId?.fullName || '',
                    'Hostel': p.hostelName || '',
                    'Room No': p.roomNo || '',
                    'Amount': p.amount || 0,
                    'Paid Date': paidDateStr,
                    'Type': p.type || '',
                    'Note': p.note || ''
                };
            });

            const ws = XLSX.utils.json_to_sheet(rows);

            // Adjust column widths for better readability
            const colWidths = [
                { wch: 5 },   // #
                { wch: 15 },  // Reg No
                { wch: 18 },  // Enrollment No
                { wch: 25 },  // Full Name
                { wch: 20 },  // Hostel
                { wch: 10 },  // Room No
                { wch: 12 },  // Amount
                { wch: 12 },  // Paid Date
                { wch: 15 },  // Type
                { wch: 20 }   // Note
            ];
            ws['!cols'] = colWidths;

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Payments');

            const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer', cellDates: true });

            res.setHeader('Content-Disposition', `attachment; filename=payments${hostelId ? `-${hostelId}` : ''}.xlsx`);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            return res.send(buf);
        } catch (err) {
            console.error('admin exportPayments error:', err);
            return res.status(500).json({ Error: 'Server error', details: err.message });
        }
    },
    
    // Admin: Get all student extra needs with enrollment info, email, hostel, and room
    getStudentExtraNeeds: async (req, res) => {
        try {
            // Fetch only approved special-needs records.
            // Backwards compatibility: older records may not have `decision` but will have `isAccpeted:true` when approved.
            const specialNeeds = await SpecialNeeds.find({
                $or: [
                    { decision: 'approved' },
                    { isAccpeted: true }
                ]
            })
                .populate('regNo', 'enrolmentNo email fullName _id')
                .sort({ createdAt: -1 });

            if (!specialNeeds || specialNeeds.length === 0) {
                return res.json({ Status: 'Success', Result: [] });
            }

            // Extract all student IDs from special needs
            const studentIds = specialNeeds
                .filter(sn => sn.regNo)
                .map(sn => sn.regNo._id.toString());

            // Fetch allocations for these students to get hostel and room info.
            // Some datasets store student ObjectId in Allocation.regNo instead of Allocation.studentId.
            const allocations = await Allocation.find({
                active: true,
                $or: [
                    { studentId: { $in: studentIds } },
                    { regNo: { $in: studentIds } }
                ]
            })
                .populate('hostelID', 'name _id')
                .populate('roomId', 'roomID _id')
                .lean();

            // Create a map of student ID to allocation info
            const allocMap = {};
            allocations.forEach(a => {
                const sid = (a.studentId || a.regNo)?.toString();
                if (!sid) return;
                if (!allocMap[sid]) {  // Keep first (latest) allocation
                    allocMap[sid] = {
                        hostelName: a.hostelID?.name || null,
                        hostelId: a.hostelID?._id || null,
                        roomId: a.roomId?._id || null,
                        roomNo: a.roomId?.roomID || null
                    };
                }
            });

            // Enrich special needs with allocation info
            const enrichedNeeds = specialNeeds.map(sn => {
                const studentId = sn.regNo?._id?.toString() || null;
                const allocInfo = studentId ? allocMap[studentId] : null;

                return {
                    _id: sn._id,
                    enrolmentNo: sn.regNo?.enrolmentNo || null,
                    email: sn.regNo?.email || null,
                    fullName: sn.regNo?.fullName || null,
                    needs: sn.needs,
                    isAccpeted: sn.isAccpeted,
                    decision: sn.decision || (sn.isAccpeted ? 'approved' : 'pending'),
                    hostelName: allocInfo?.hostelName || null,
                    hostelId: allocInfo?.hostelId || null,
                    roomNo: allocInfo?.roomNo || null,
                    roomId: allocInfo?.roomId || null,
                    createdAt: sn.createdAt,
                    updatedAt: sn.updatedAt
                };
            });

            return res.json({ Status: 'Success', Result: enrichedNeeds });
        } catch (err) {
            console.error('admin getStudentExtraNeeds error:', err);
            return res.status(500).json({ Status: 'Fail', Error: 'Server error', details: err.message });
        }
    }
};

module.exports = AdminController;
