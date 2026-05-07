const express = require('express');
const { authMiddleware } = require('../middlewares/AuthMiddleware');
const checkPermission = require('../middlewares/checkPermissionMiddleware');
const AdminController = require('../controller/adminController');

const router = express.Router();

// Admin: payments (read-only)
router.get('/payments', authMiddleware, checkPermission('view-payments'), AdminController.getPayments);
// Admin: export payments as Excel
router.get('/payments/export', authMiddleware, checkPermission('view-payments'), AdminController.exportPayments);
// Admin: get all student extra needs with enrollment info, email, hostel, and room
router.get('/student-extra-needs', authMiddleware, checkPermission('view-payments'), AdminController.getStudentExtraNeeds);

module.exports = router;
