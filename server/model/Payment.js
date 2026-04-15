const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    academicYear: String,
    amount: Number,
    type: String,
    note: String,
    paidDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Payment', paymentSchema);
