const Role = require("../model/Role");
const User = require("../model/User");


const UserController = {
    getallusers: async (req, res) => {
        try {
            const getalluserdata = await User.find().populate('roles');

            return res.json({ Result: getalluserdata })
        }
        catch (err) {
            console.log(err)
        }
    },

    getoneuser: async (req, res) => {
        try {
            const { id } = req.params

            const getoneuserdata = await User.findById(id).populate('roles');

            return res.json({ Result: getoneuserdata })
        }
        catch (err) {
            console.log(err)
        }
    },

    verifyEmailBydir: async (req, res) => {
        try {
            const { id } = req.params

            const user = await User.findById(id);
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            const updatedUser = await User.findByIdAndUpdate(
                id,
                { $set: { emailVerified: !user.emailVerified } },
                { new: true }
            );

            if (updatedUser) {
                return res.json({ Status: "Success", Message: "User Updated Success" })
            }
            else {
                return res.json({ Error: "Internal Server Error while Updating User" })
            }


        }
        catch (err) {
            console.log(err)
        }
    },

    avtiveAnddactiveUser: async (req, res) => {
        try {
            const { id } = req.params

            const user = await User.findById(id);
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            const updatedUser = await User.findByIdAndUpdate(
                id,
                { $set: { active: !user.active } },
                { new: true }
            );

            if (updatedUser) {
                return res.json({ Status: "Success", Message: "User Updated Success" })
            }
            else {
                return res.json({ Error: "Internal Server Error while Updating User" })
            }
        }
        catch (err) {
            console.log(err)
        }
    },

    updateUserRole: async (req, res) => {
        try {
            const { userID, roleID } = req.body;

            const user = await User.findById(userID);
            if (!user) {
                return res.json({ error: "User not found" });
            }

            const roleExists = await Role.findById(roleID);
            if (!roleExists) {
                return res.json({ error: "Role not found" });
            }

            const updatedUser = await User.findByIdAndUpdate(
                userID,
                { $set: { roles: [roleID] } }, 
                { new: true }
            );

            return res.json({ message: "User role updated successfully", user: updatedUser });
        } catch (err) {
            console.error(err);
            return res.json({ error: "Server error" });
        }
    }

    ,

    // Update user details (username, email)
    updateUser: async (req, res) => {
        try {
            const { id } = req.params;
            const { username, email } = req.body;

            const user = await User.findById(id);
            if (!user) return res.status(404).json({ error: 'User not found' });

            if (username) user.username = username;
            if (email) user.email = email;

            await user.save();
            return res.json({ Status: 'Success', Message: 'User updated', Result: user });
        } catch (err) {
            console.error('Error updating user:', err);
            return res.status(500).json({ Error: 'Failed to update user' });
        }
    }

    ,

    // Update user by body (accepts id in body) - helper to avoid path issues
    updateUserByBody: async (req, res) => {
        try {
            const { id, username, email } = req.body;
            if (!id) return res.status(400).json({ Error: 'Missing id in request body' });

            const user = await User.findById(id);
            if (!user) return res.status(404).json({ error: 'User not found' });

            if (username) user.username = username;
            if (email) user.email = email;

            await user.save();
            return res.json({ Status: 'Success', Message: 'User updated', Result: user });
        } catch (err) {
            console.error('Error updating user by body:', err);
            return res.status(500).json({ Error: 'Failed to update user' });
        }
    }

    ,

    // Delete user and associated warden record (if any)
    deleteUser: async (req, res) => {
        try {
            const { id } = req.params;
            const Warden = require('../model/Warden');
            const Hostel = require('../model/Hostel');

            const user = await User.findById(id);
            if (!user) return res.status(404).json({ error: 'User not found' });

            // If user has warden records, remove them and clear hostel references
            await Hostel.updateMany({ warden: id }, { $unset: { warden: "" } });
            await Warden.deleteMany({ userId: id });

            await User.findByIdAndDelete(id);
            return res.json({ Status: 'Success', Message: 'User and related warden removed' });
        } catch (err) {
            console.error('Error deleting user:', err);
            return res.status(500).json({ Error: 'Failed to delete user' });
        }
    }


};

module.exports = UserController;