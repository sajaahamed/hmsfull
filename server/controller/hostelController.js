const Allocation = require("../model/Allocation");
const Hostel = require("../model/Hostel");
const Role = require("../model/Role");
const Room = require("../model/Room");
const User = require("../model/User");
const Warden = require("../model/Warden");
const Student = require("../model/Student")
const { jwtDecode } = require('jwt-decode');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');


const HostelController = {
    GetallWarden: async (req, res) => {
        try {
            const wardenRole = await Role.findOne({ name: 'warden' });

            if (!wardenRole) {
                return res.json({ error: "Warden role not found" });
            }

            const allWardenUsers = await User.find({ roles: wardenRole._id })
                .select("-password")
                .populate("roles", "name");

            const assignedWardenUserIds = await Warden.find({}).distinct("userId");

            const unassignedWardens = allWardenUsers.filter(user => {
                return !assignedWardenUserIds.some(id => id.equals(user._id));
            });

            return res.json({ result: unassignedWardens });
        } catch (err) {
            console.error("Error fetching unassigned wardens:", err);
            return res.status(500).json({ error: "Server error" });
        }
    },

    CreateHostel: async (req, res) => {
        try {
            const {
                hostelID,
                name,
                location,
                gender,
                roomCount,
                warden
            } = req.body;

            const checkhostel = await Hostel.findOne({
                $or: [
                    { hostelID },
                    { name },
                ]
            });

            if (checkhostel) {
                return res.json({ error: "The hostel already exists" });
            }

            const parsedRoomCount = parseInt(roomCount);
            if (isNaN(parsedRoomCount) || parsedRoomCount <= 0) {
                return res.json({ error: "Invalid room count" });
            }

            // Create and save hostel
            const newHostel = new Hostel({
                hostelID,
                name,
                location,
                gender,
                roomCount: parsedRoomCount,
                warden
            });

            const savedHostel = await newHostel.save();

            // Create and save rooms
            const roomDocs = [];
            for (let i = 1; i <= parsedRoomCount; i++) {
                const room = new Room({
                    roomID: `${hostelID}/${i}`,
                    gender: gender,
                    hostelID: savedHostel._id
                });
                roomDocs.push(room);
            }

            await Room.insertMany(roomDocs);

            let savedWarden = null;
            if (warden) {
                const newWarden = new Warden({
                    userId: warden,
                    hostelId: savedHostel._id,
                    startDate: new Date(),
                    note: "Assigned during hostel creation",
                    active: true
                });
                savedWarden = await newWarden.save();
            }

            return res.json({
                Status: "Success",
                Message: "Hostel, rooms, and warden assigned successfully",
                hostel: savedHostel,
                rooms: roomDocs,
                warden: savedWarden
            });

        } catch (err) {
            console.error("Error creating hostel:", err);
            return res.json({ error: "Server error while creating hostel" });
        }
    },

    getAllhostel: async (req, res) => {
        try {
            const getallhostel = await Hostel.find().populate('warden')

            return res.json({ Result: getallhostel })

        }
        catch (err) {
            console.log(err)
        }
    },

    getoneHostel: async (req, res) => {
        try {
            const { id } = req.params

            const gethostel = await Hostel.findById(id).populate('warden')

            return res.json({ Result: gethostel })
        }
        catch (err) {
            console.log(err)
        }
    },

    updateRoomCount: async (req, res) => {
        try {
            const { id } = req.params;
            const { newRoomCount } = req.body;

            const hostel = await Hostel.findById(id);
            if (!hostel) {
                return res.json({ error: 'Hostel not found' });
            }

            const currentCount = hostel.roomCount;

            if (newRoomCount === currentCount) {
                return res.json({ message: 'Room count is already up to date.' });
            }

            if (newRoomCount > currentCount) {
                const roomsToAdd = [];
                for (let i = currentCount + 1; i <= newRoomCount; i++) {
                    roomsToAdd.push({
                        roomID: `${hostel.hostelID}/${i}`,
                        gender: hostel.gender,
                        hostelID: hostel._id
                    });
                }

                await Room.insertMany(roomsToAdd);
            }

            if (newRoomCount < currentCount) {
                const roomsToRemove = await Room.find({
                    hostelID: hostel._id
                }).sort({ roomID: -1 }).limit(currentCount - newRoomCount);

                const roomIDsToDelete = roomsToRemove.map(room => room._id);

                await Room.deleteMany({ _id: { $in: roomIDsToDelete } });
            }

            hostel.roomCount = newRoomCount;
            await hostel.save();

            return res.json({
                Status: "Success",
                Message: `Room count updated from ${currentCount} to ${newRoomCount}`
            });

        } catch (err) {
            console.error("Error updating room count:", err);
            return res.json({ error: "Server error while updating room count" });
        }
    },

    assignNewWarden: async (req, res) => {
        try {
            const { hostelId, newWardenId } = req.body;

            // Remove existing active wardens for this hostel
            await Warden.deleteMany({ hostelId, active: true });

            // Create new active warden
            const newWarden = new Warden({
                userId: newWardenId,
                hostelId: hostelId,
                startDate: new Date(),
                note: "Reassigned as new warden",
                active: true,
            });

            const savedWarden = await newWarden.save();

            // Update Hostel document with new warden reference
            await Hostel.findByIdAndUpdate(hostelId, { warden: newWardenId });

            return res.json({
                Status: "Success",
                Message: "New warden assigned successfully",
                newWarden: savedWarden,
            });
        } catch (err) {
            console.error("Error assigning new warden:", err);
            res.json({ error: "Internal server error while assigning new warden" });
        }
    },

    assignStudents: async (req, res) => {
        try {
            const { hostelId, studentIds } = req.body;

            const hostel = await Hostel.findById(hostelId);
            if (!hostel) {
                return res.json({ Status: "Error", Message: "Hostel not found" });
            }

            // Fetch students before proceeding
            const students = await Student.find({ _id: { $in: studentIds } });

            // Check gender match
            const mismatch = students.find(
                student => (student.sex || '').toLowerCase() !== (hostel.gender || '').toLowerCase()
            );

            if (mismatch) {
                return res.json({
                    Status: "Error",
                    Message: `Gender mismatch: Student ${mismatch.fullName || mismatch.nic || 'Unknown'} (${mismatch.sex}) does not match hostel gender (${hostel.gender})`
                });
            }

            const totalCapacity = hostel.roomCount * hostel.roomCapacity;

            const existingAllocationsCount = await Allocation.countDocuments({
                hostelID: hostelId,
                academicYear: new Date().getFullYear().toString(),
                active: true
            });

            const newAllocationsCount = studentIds.length;

            if (existingAllocationsCount + newAllocationsCount > totalCapacity) {
                return res.json({ Error: "Gender Mismatch" });
            }

            // Create allocations
            const allocations = studentIds.map(studentId => ({
                regNo: studentId,
                hostelID: hostelId,
                academicYear: new Date().getFullYear().toString(),  // Store as string
                inDate: new Date(),
                active: true,
            }));

            await Allocation.insertMany(allocations);

            // Mark students as assigned
            await Student.updateMany(
                { _id: { $in: studentIds } },
                { $set: { isAssign: true } }
            );

            // Get role document for 'student'
            const studentRole = await Role.findOne({ name: 'student' });
            if (!studentRole) {
                return res.json({ Status: "Error", Message: "Student role not found" });
            }

            for (const student of students) {
                const existingUser = await User.findOne({ username: student.nic });
                if (!existingUser) {
                    const hashedPassword = await bcrypt.hash('12345678', 10); // Load from .env if needed

                    const newUser = new User({
                        username: student.nic,
                        email: student.email,
                        emailVerified: true,
                        password: hashedPassword,
                        roles: [studentRole._id],
                        active: true,
                    });

                    await newUser.save();
                }
            }

            res.json({ Status: "Success", Message: "Students assigned and user accounts created successfully" });

        } catch (err) {
            console.error(err);
            res.json({ Status: "Error", Message: "An error occurred while assigning students" });
        }
    },


    getWardenStudents: async (req, res) => {
        try {
            // Find all active hostel allocations (students assigned to hostels)
            const allocations = await Allocation.find({
                active: true,
            }).populate('roomId').populate('hostelID');

            console.log('Found allocations:', allocations.length);

            // Get all student IDs from allocations
            const studentIds = allocations.map(a => a.regNo).filter(Boolean);

            // Find all students by their ObjectIds
            const students = await Student.find({
                _id: { $in: studentIds }
            });

            console.log('Found students:', students.length);

            // Create a map of students by ID for quick lookup
            const studentMap = {};
            students.forEach(s => {
                studentMap[s._id.toString()] = s;
            });

            // Group allocations by student
            const result = [];
            const processedStudents = new Set();

            for (const allocation of allocations) {
                const studentId = allocation.regNo;
                if (!studentId || processedStudents.has(studentId)) continue;

                const student = studentMap[studentId];
                if (!student) continue;

                processedStudents.add(studentId);

                // Get all allocations for this student
                const studentAllocations = allocations
                    .filter(a => a.regNo === studentId)
                    .map(a => ({
                        allocationId: a._id,
                        roomId: a.roomId ? {
                            _id: a.roomId._id,
                            roomID: a.roomId.roomID,
                            roomNo: a.roomId.roomID,
                            currentOccupants: a.roomId.currentOccupants,
                            capacity: a.roomId.capasity,
                            status: a.roomId.status
                        } : null,
                        hostelID: a.hostelID?._id || a.hostelID,
                        hostelName: a.hostelID?.name || null,
                        academicYear: a.academicYear,
                        inDate: a.inDate,
                        outDate: a.outDate,
                        note: a.note,
                        active: a.active,
                    }));

                result.push({
                    student,
                    allocations: studentAllocations
                });
            }

            console.log('Final result count:', result.length);
            res.json({ Result: result });

        } catch (err) {
            console.error('Error in getWardenStudents:', err);
            res.json({ message: 'Server error', error: err.message });
        }
    }
};

module.exports = HostelController;