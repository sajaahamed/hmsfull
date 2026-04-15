require('dotenv').config();
const ConnectDB = require('./config/DB');
const User = require('./model/User');
const Role = require('./model/Role');
const mongoose = require('mongoose');

(async () => {
  try {
    await ConnectDB();
    const email = process.argv[2] || process.env.EMAIL;
    if (!email) {
      console.log('Usage: node assign-admin.js <email>');
      process.exit(0);
    }
    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found:', email);
      process.exit(0);
    }

    const adminRole = await Role.findOne({ name: 'admin' });
    if (!adminRole) {
      console.log('Admin role not found.');
      process.exit(0);
    }

    const hasAdmin = user.roles.some(r => r.toString() === adminRole._id.toString());
    if (hasAdmin) {
      console.log('User already has admin role:', email);
    } else {
      user.roles.push(adminRole._id);
      await user.save();
      console.log('Assigned admin role to user:', email);
    }

    const updated = await User.findOne({ email }).populate('roles');
    console.log('User roles now:', updated.roles.map(r => r.name));
    mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    mongoose.connection.close();
    process.exit(1);
  }
})();