const Allocation = require("../model/Allocation");
const SpecialNeeds = require("../model/SpecialNeeds");
const Student = require("../model/Student");
const User = require("../model/User");
const Warden = require("../model/Warden");
const Payment = require("../model/Payment");
const mongoose = require('mongoose');
const { jwtDecode } = require('jwt-decode');
const { getoneHostel } = require("./hostelController");
const Hostel = require("../model/Hostel");
const Room = require("../model/Room");

const WardenController = {
    getstdextraneeds: async (req, res) => {
        try {
            const authHeader = req.headers.authorization || '';
            const token = authHeader.replace('Bearer ', '');
            if (!token) return res.json({ message: 'Unauthorized: No token provided' });

            const decoded = jwtDecode(token);
            const email = decoded.email || decoded.user?.email;

            // Find logged in user
            const userid = await User.findOne({ email: email });
            if (!userid) return res.json({ message: 'User not found' });

            // Find warden record
            const getwarden = await Warden.findOne({ userId: userid._id }).populate('hostelId');
            if (!getwarden) return res.json({ message: 'Warden record not found' });

            // Find students allocated to warden's hostel
            const getstudents = await Allocation.find({ hostelID: getwarden.hostelId._id });
            if (!getstudents.length) return res.json({ message: 'No students allocated' });

            // Extract regNos
            const regNos = getstudents.map(s => s.regNo);

            // Find special needs of these students
            const getstduntneeds = await SpecialNeeds.find({ regNo: { $in: regNos } }).populate('regNo');

            // ✅ Only log special needs data
            // console.log("Special needs records:", JSON.stringify(getstduntneeds, null, 2));

            return res.json({ Result: getstduntneeds });
        }
        catch (err) {
            console.error("Error occurred:", err);
            return res.json({ message: 'Server error', error: err.message });
        }
    },


    approveneeds: async (req, res) => {
        try {
            const id = req.params.id;

            const udpdateneed = await SpecialNeeds.findByIdAndUpdate(
                id,
                { $set: { isAccpeted: true } },
                { new: true }
            );

            if (udpdateneed) {
                return res.json({ Status: "Success", data: udpdateneed });
            } else {
                return res.json({ Error: "SpecialNeed not found" });
            }

        }
        catch (err) {
            console.log(err)
        }
    },

    getallwardenrooms: async (req, res) => {
        try {
            const authHeader = req.headers.authorization || '';
            const token = authHeader.replace('Bearer ', '');
            if (!token) return res.json({ message: 'Unauthorized: No token provided' });

            const decoded = jwtDecode(token);
            const email = decoded.email || decoded.user?.email;

            const getwardendata = await User.findOne({ email });
            if (!getwardendata) return res.json({ message: 'Warden not found' });

            const gethostel = await Hostel.findOne({ warden: getwardendata._id });
            if (!gethostel) return res.json({ message: 'Hostel not assigned to this warden' });

            const rooms = await Room.find({ hostelID: gethostel._id });

            // console.log(rooms)

            return res.json({ Result: rooms });
        }
        catch (err) {
            console.log(err)
        }
    },

    assignstdtorooms_via_sp: async (req, res) => {
        try {
            const { studentId, roomId } = req.body;

            const gethostel = await Room.findById(roomId);
            const getstudent = await Student.findById(studentId);

            if (!getstudent || !gethostel) {
                return res.json({ error: "Invalid student or room ID" });
            }

            const getid = getstudent.enrolmentNo;
            const parts = getid.split('/');
            const yearofenroll = parseInt(parts[1], 10);

            if (yearofenroll >= 22 && yearofenroll <= 40) {
                const fullyear = 2000 + yearofenroll;

                // Allocation.regNo is sometimes stored as the student ObjectId or as enrolmentNo string.
                // Try to find the allocation by multiple possible keys.
                let allocation = await Allocation.findOne({
                    $or: [
                        { regNo: studentId },
                        { regNo: getstudent.enrolmentNo },
                        { studentId: studentId }
                    ]
                });

                if (!allocation) {
                    return res.json({ Error: "No existing allocation found for this student" });
                }

                allocation.roomId = roomId;
                allocation.studentId = allocation.studentId || getstudent._id;
                allocation.academicYear = fullyear;
                allocation.inDate = new Date();
                allocation.active = true;
                await allocation.save();

                await Room.findByIdAndUpdate(
                    roomId,
                    { $inc: { currentOccupants: 1 } },
                    { new: true }
                );

                return res.json({ Status: "Success", Message: "Allocation updated successfully" });
            } else {
                return res.json({ Error: "Invalid enrolment year in student ID" });
            }
        } catch (err) {
            console.log(err);
            return res.json({ Error: "Something went wrong" });
        }
    },


    assigned_students: async (req, res) => {
        try {
            const getallstds = await Allocation.find()
                .populate('regNo')
                .populate('roomId')

            // console.log(getallstds)
            return res.json({ Result: getallstds })
        }
        catch (err) {
            console.log(err)
        }
    },

    unassign_student: async (req, res) => {
        try {
            const { id } = req.params; // allocation id

            if (!id) return res.json({ Error: 'Allocation id required' });

            const allocation = await Allocation.findById(id);
            if (!allocation) return res.json({ Error: 'Allocation not found' });

            const regNo = allocation.regNo;
            const roomId = allocation.roomId;

            if (!roomId) return res.json({ Error: 'Student is not assigned to a room' });

            // Remove student from room
            const room = await Room.findById(roomId);
            if (room) {
                // remove student id from students array
                room.students = (room.students || []).filter(s => s.toString() !== regNo.toString());
                room.currentOccupants = Math.max(0, (room.currentOccupants || 0) - 1);
                if (room.currentOccupants < (room.capasity || 0)) {
                    room.status = 'Availabe';
                }
                await room.save();
            }

            // Update allocation to mark as unassigned
            allocation.roomId = null;
            allocation.active = false;
            await allocation.save();

            // Update student isAssign flag if possible
            let student = null;
            try {
                if (mongoose.Types.ObjectId.isValid(regNo)) {
                    student = await Student.findById(regNo);
                }
            } catch (e) {
                // ignore
            }

            if (!student && typeof regNo === 'string') {
                student = await Student.findOne({ enrolmentNo: regNo });
            }

            if (student) {
                student.isAssign = false;
                await student.save();
            }

            return res.json({ Status: 'Success', Message: 'Student unassigned successfully' });
        } catch (err) {
            console.error('unassign_student error:', err);
            return res.json({ Error: 'An error occurred while unassigning student' });
        }
    },


    assign_students_room: async (req, res) => {
        try {
            const selectedStudentIds = req.body; // Array of Student IDs

            if (!Array.isArray(selectedStudentIds) || selectedStudentIds.length === 0) {
                return res.json({ Error: 'No student IDs provided' });
            }

            for (let i = 0; i < selectedStudentIds.length; i++) {
                const studentId = selectedStudentIds[i];

                // Find the student's allocation record
                const allocation = await Allocation.findOne({ regNo: studentId });
                if (!allocation) {
                    console.log(`No allocation found for student: ${studentId}`);
                    continue;
                }

                const hostelID = allocation.hostelID;
                if (!hostelID) {
                    console.log(`No hostelID in allocation for student: ${studentId}`);
                    continue;
                }

                // Find all available rooms in the same hostel
                const rooms = await Room.find({
                    hostelID: hostelID,
                    status: 'Availabe'
                });

                let assigned = false;

                for (let j = 0; j < rooms.length; j++) {
                    const room = rooms[j];

                    if (room.currentOccupants < room.capasity) {

                        allocation.roomId = room._id;
                        await allocation.save();

                        room.students.push(studentId);
                        room.currentOccupants += 1;
                        if (room.currentOccupants >= room.capasity) {
                            room.status = 'Full';
                        }

                        await room.save();
                        console.log(`Assigned student ${studentId} to room ${room.roomID}`);
                        assigned = true;
                        break;
                    }
                }

                if (!assigned) {
                    console.log(`No available room in hostel ${hostelID} for student ${studentId}`);
                }
            }

            return res.json({ Status: 'Success', message: 'All possible students assigned to rooms' });

        } catch (error) {
            console.error('assign_students_room error:', error);
            return res.json({ Error: 'An error occurred while assigning rooms' });
        }
    },

    // Assign selected students to a specific room
    assign_students_to_room_specific: async (req, res) => {
        try {
            const { studentIds, roomId } = req.body;

            if (!Array.isArray(studentIds) || studentIds.length === 0) {
                return res.json({ Error: 'No student IDs provided' });
            }

            if (!roomId) {
                return res.json({ Error: 'roomId is required' });
            }

            const room = await Room.findById(roomId);
            if (!room) return res.json({ Error: 'Room not found' });

            const capacity = room.capasity || 0;
            const available = capacity - (room.currentOccupants || 0);
            if (available <= 0) return res.json({ Error: 'Room is full' });

            const results = { assigned: [], failed: [] };

            for (const studentId of studentIds) {
                if (results.assigned.length >= available) {
                    results.failed.push({ studentId, reason: 'No space available' });
                    continue;
                }

                const student = await Student.findById(studentId) || await Student.findOne({ enrolmentNo: studentId });

                // Find allocation robustly
                let allocation = await Allocation.findOne({
                    $or: [
                        { regNo: studentId },
                        { studentId: studentId },
                        { regNo: student?.enrolmentNo }
                    ]
                });

                if (!allocation) {
                    results.failed.push({ studentId, reason: 'No allocation found' });
                    continue;
                }

                if (allocation.roomId) {
                    results.failed.push({ studentId, reason: 'Already assigned' });
                    continue;
                }

                allocation.roomId = roomId;
                allocation.hostelID = allocation.hostelID || room.hostelID;
                allocation.inDate = new Date();
                allocation.active = true;
                await allocation.save();

                room.students = room.students || [];
                if (!room.students.some(s => s.toString() === String(studentId))) {
                    room.students.push(studentId);
                }
                room.currentOccupants = (room.currentOccupants || 0) + 1;
                if (room.currentOccupants >= capacity) room.status = 'Full';
                await room.save();

                if (student) {
                    student.isAssign = true;
                    await student.save();
                }

                results.assigned.push(studentId);
            }

            return res.json({ Status: 'Success', Result: results });
        } catch (err) {
            console.error('assign_students_to_room_specific error:', err);
            return res.json({ Error: 'An error occurred while assigning students to room' });
        }
    },

    // Get all wardens with user and hostel details
    getAllWardens: async (req, res) => {
        try {
            const wardens = await Warden.find()
                .populate('userId', 'username email active')
                .populate('hostelId', 'name gender hostelID');
            
            return res.json({ Status: 'Success', Result: wardens });
        } catch (err) {
            console.error('Error getting wardens:', err);
            return res.json({ Error: 'Failed to fetch wardens' });
        }
    },

    // Get single warden by ID
    getWardenById: async (req, res) => {
        try {
            const { id } = req.params;
            const warden = await Warden.findById(id)
                .populate('userId', 'username email active')
                .populate('hostelId', 'name gender hostelID');
            
            if (!warden) {
                return res.json({ Error: 'Warden not found' });
            }
            return res.json({ Status: 'Success', Result: warden });
        } catch (err) {
            console.error('Error getting warden:', err);
            return res.json({ Error: 'Failed to fetch warden' });
        }
    },

    // Create new warden
    createWarden: async (req, res) => {
        try {
            const { userId, hostelId, startDate, active } = req.body;

            // Validate user exists
            const user = await User.findById(userId);
            if (!user) {
                return res.json({ Error: 'User not found' });
            }

            // Validate hostel exists
            const hostel = await Hostel.findById(hostelId);
            if (!hostel) {
                return res.json({ Error: 'Hostel not found' });
            }

            // Check if user already assigned to a warden
            const existingWarden = await Warden.findOne({ userId });
            if (existingWarden) {
                return res.json({ Error: 'User is already assigned as a warden' });
            }

            // Create new warden
            const newWarden = new Warden({
                userId,
                hostelId,
                startDate: startDate || new Date(),
                active: active !== undefined ? active : true
            });

            await newWarden.save();

            // Update hostel with warden reference
            await Hostel.findByIdAndUpdate(hostelId, { warden: userId });

            const populatedWarden = await newWarden.populate('userId', 'username email')
                .populate('hostelId', 'name gender hostelID');

            return res.json({ Status: 'Success', message: 'Warden created successfully', Result: populatedWarden });
        } catch (err) {
            console.error('Error creating warden:', err);
            return res.json({ Error: 'Failed to create warden', details: err.message });
        }
    },

    // Update warden
    updateWarden: async (req, res) => {
        try {
            const { id } = req.params;
            const { hostelId, active, note } = req.body;

            const warden = await Warden.findById(id);
            if (!warden) {
                return res.json({ Error: 'Warden not found' });
            }

            // If hostel is being changed, validate new hostel
            if (hostelId && hostelId !== warden.hostelId.toString()) {
                const hostel = await Hostel.findById(hostelId);
                if (!hostel) {
                    return res.json({ Error: 'Hostel not found' });
                }
                
                // Update hostel references
                await Hostel.findByIdAndUpdate(warden.hostelId, { warden: null });
                await Hostel.findByIdAndUpdate(hostelId, { warden: warden.userId });
                warden.hostelId = hostelId;
            }

            if (active !== undefined) warden.active = active;
            if (note) warden.note = note;

            await warden.save();

            const updatedWarden = await Warden.findById(id)
                .populate('userId', 'username email active')
                .populate('hostelId', 'name gender hostelID');

            return res.json({ Status: 'Success', message: 'Warden updated successfully', Result: updatedWarden });
        } catch (err) {
            console.error('Error updating warden:', err);
            return res.json({ Error: 'Failed to update warden' });
        }
    },

    // Delete warden
    deleteWarden: async (req, res) => {
        try {
            const { id } = req.params;

            const warden = await Warden.findById(id);
            if (!warden) {
                return res.json({ Error: 'Warden not found' });
            }

            // Remove warden from hostel
            await Hostel.findByIdAndUpdate(warden.hostelId, { warden: null });

            // Delete warden record
            await Warden.findByIdAndDelete(id);

            return res.json({ Status: 'Success', message: 'Warden deleted successfully' });
        } catch (err) {
            console.error('Error deleting warden:', err);
            return res.json({ Error: 'Failed to delete warden' });
        }
    }

    ,
    // Collect payment for a student by the logged-in warden
    collect_payment: async (req, res) => {
        try {
            const { studentId, amount, type, note, academicYear, paidDate } = req.body;

            if (!studentId || amount === undefined) {
                return res.status(400).json({ Error: 'studentId and amount are required' });
            }

            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ Error: 'Unauthorized' });

            const wardenRecord = await Warden.findOne({ userId });
            if (!wardenRecord) return res.status(403).json({ Error: 'Warden record not found' });

            // Find allocation for the student (regNo may be studentId or student object id stored in regNo)
            const allocation = await Allocation.findOne({
                $or: [
                    { regNo: studentId },
                    { studentId: studentId }
                ]
            });

            if (!allocation) return res.status(404).json({ Error: 'Allocation not found for student' });

            // Ensure student belongs to the warden's hostel
            if (!allocation.hostelID || allocation.hostelID.toString() !== wardenRecord.hostelId.toString()) {
                return res.status(403).json({ Error: 'Student is not in your hostel' });
            }

            const payment = new Payment({
                studentId: allocation.studentId || studentId,
                academicYear: academicYear || allocation.academicYear || new Date().getFullYear().toString(),
                amount: Number(amount),
                type: type || 'hostel-fee',
                note: note || '',
                paidDate: paidDate ? new Date(paidDate) : new Date()
            });

            await payment.save();

            return res.json({ Status: 'Success', Result: payment });
        } catch (err) {
            console.error('collect_payment error:', err);
            return res.status(500).json({ Error: 'Server error', details: err.message });
        }
    },

    // Get payments for students in this warden's hostel
    getPayments: async (req, res) => {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ Error: 'Unauthorized' });

            const wardenRecord = await Warden.findOne({ userId });
            if (!wardenRecord) return res.status(403).json({ Error: 'Warden record not found' });

            const allocations = await Allocation.find({ hostelID: wardenRecord.hostelId });
            const studentIds = allocations.map(a => a.regNo).filter(Boolean);

            const payments = await Payment.find({ studentId: { $in: studentIds } })
                .populate('studentId', 'fullName enrolmentNo nic no')
                .sort({ paidDate: -1 });

            // Fetch active allocations to get room numbers for students
            const allocs = await Allocation.find({ regNo: { $in: studentIds }, active: true }).populate('roomId');
            const allocMap = {};
            allocs.forEach(a => {
                const sid = a.regNo ? a.regNo.toString() : (a.studentId ? a.studentId.toString() : null);
                if (!sid) return;
                allocMap[sid] = a.roomId && a.roomId.roomID ? a.roomId.roomID : null;
            });

            const paymentsWithRoom = payments.map(p => {
                const pObj = p.toObject ? p.toObject() : p;
                const sid = pObj.studentId ? pObj.studentId._id.toString() : null;
                pObj.roomNo = sid && allocMap[sid] ? allocMap[sid] : null;
                return pObj;
            });

            const total = paymentsWithRoom.reduce((s, p) => s + (p.amount || 0), 0);

            return res.json({ Status: 'Success', Result: paymentsWithRoom, total });
        } catch (err) {
            console.error('getPayments error:', err);
            return res.status(500).json({ Error: 'Server error', details: err.message });
        }
    }

};

module.exports = WardenController;