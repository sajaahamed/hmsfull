const Student = require('../model/Student');
const Allocation = require('../model/Allocation');
const Hostel = require('../model/Hostel');

const EligibilityController = {
    // ─── Eligible Students Page ───
    // Returns students where eligibilityStatus is Not Evaluated or Not Eligible
    getNotEligibleStudents: async (req, res) => {
        try {
            const students = await Student.find({ 
                eligibilityStatus: { $in: ['Not Eligible', false, null, undefined] }
            }).lean();
            return res.json({ Result: students });
        } catch (err) {
            console.error("Error in getNotEligibleStudents:", err);
            return res.status(500).json({ Error: "Internal server error" });
        }
    },

    // Mark selected students as eligible (eligibilityStatus = 'Eligible', isAssign stays false)
    markEligible: async (req, res) => {
        try {
            const { studentIds } = req.body;
            if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
                return res.status(400).json({ Error: 'studentIds array is required' });
            }

            await Student.updateMany(
                { _id: { $in: studentIds } },
                { $set: { eligibilityStatus: 'Eligible', isAssign: false } }
            );

            return res.json({
                Status: 'Success',
                Message: `${studentIds.length} student(s) marked as eligible.`
            });
        } catch (err) {
            console.error('Error in markEligible:', err);
            return res.status(500).json({ Error: 'Internal server error' });
        }
    },

    // Mark selected students as NOT eligible (eligibilityStatus = 'Not Eligible')
    markNotEligible: async (req, res) => {
        try {
            const { studentIds } = req.body;
            if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
                return res.status(400).json({ Error: 'studentIds array is required' });
            }

            // Only allow un-marking students who are NOT already assigned
            await Student.updateMany(
                { _id: { $in: studentIds }, isAssign: false },
                { $set: { eligibilityStatus: 'Not Eligible' } }
            );

            return res.json({
                Status: 'Success',
                Message: `Student(s) marked as not eligible.`
            });
        } catch (err) {
            console.error('Error in markNotEligible:', err);
            return res.status(500).json({ Error: 'Internal server error' });
        }
    },

    // ─── Hostel Assignment Page ───
    // Returns students where eligibilityStatus = 'Eligible' AND isAssign = false
    getEligibleForAssignment: async (req, res) => {
        try {
            const students = await Student.find({
                eligibilityStatus: { $in: ['Eligible', true] },
                isAssign: false
            }).lean();
            return res.json({ Result: students });
        } catch (err) {
            console.error("Error in getEligibleForAssignment:", err);
            return res.status(500).json({ Error: "Internal server error" });
        }
    },

    // ─── Assigned Students Page ───
    // Returns students where eligibilityStatus = 'Assigned' AND isAssign = true
    // Enriched with hostel, room, and allocation details
    getAssignedStudents: async (req, res) => {
        try {
            const students = await Student.find({
                isAssign: true
            }).lean();

            if (!students.length) {
                return res.json({ Result: [] });
            }

            const studentIds = students.map(s => s._id.toString());
            const enrolNos = students.map(s => s.enrolmentNo).filter(Boolean);

            // Fetch active allocations for these students
            const allocations = await Allocation.find({
                active: true,
                $or: [
                    { studentId: { $in: studentIds } },
                    { regNo: { $in: studentIds } },
                    { regNo: { $in: enrolNos } }
                ]
            })
                .populate('hostelID', 'name hostelID')
                .populate('roomId', 'roomID')
                .lean();

            // Build allocation map by studentId and enrolmentNo
            const allocationMap = new Map();
            for (const alloc of allocations) {
                if (alloc.studentId) allocationMap.set(alloc.studentId.toString(), alloc);
                if (alloc.regNo) allocationMap.set(alloc.regNo.toString(), alloc);
            }

            // Enrich students with assignment info
            const enriched = students.map(s => {
                const alloc = allocationMap.get(s._id.toString()) || allocationMap.get(s.enrolmentNo);
                return {
                    ...s,
                    hostelName: alloc?.hostelID?.name || null,
                    hostelCode: alloc?.hostelID?.hostelID || null,
                    roomNumber: alloc?.roomId?.roomID || null,
                    assignmentDate: alloc?.inDate || s.hostelAssignedDate || null,
                    allocationActive: alloc?.active || false,
                };
            });

            return res.json({ Result: enriched });
        } catch (err) {
            console.error("Error in getAssignedStudents:", err);
            return res.status(500).json({ Error: "Internal server error" });
        }
    }
};

module.exports = EligibilityController;
