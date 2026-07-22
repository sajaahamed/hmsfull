require('dotenv').config();
const mongoose = require('mongoose');
const ConnectDB = require('./config/DB');
const Role = require('./model/Role');
const User = require('./model/User');

const email = String(process.argv[2] || '').trim().toLowerCase();
const roleName = String(process.argv[3] || '').trim().toLowerCase();
const allowedRoles = new Set(['student', 'warden', 'admin', 'director']);

(async () => {
  try {
    if (!email || !allowedRoles.has(roleName)) {
      throw new Error('Usage: node assign-role.js <email> <student|warden|admin|director>');
    }

    await ConnectDB();

    const role = await Role.findOne({ name: roleName });
    if (!role) {
      throw new Error(`Role not found: ${roleName}`);
    }

    const result = await User.updateOne(
      { email },
      { $addToSet: { roles: role._id } }
    );

    if (result.matchedCount !== 1) {
      throw new Error(`User not found: ${email}`);
    }

    // Re-query by the stable email instead of a possibly stale in-memory _id.
    const updated = await User.findOne({ email }).populate('roles');
    if (!updated) {
      throw new Error(`User disappeared while assigning role: ${email}`);
    }

    console.log('Assigned roles:', updated.roles.map(item => item.name));
  } catch (error) {
    console.error('Error:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
})();
