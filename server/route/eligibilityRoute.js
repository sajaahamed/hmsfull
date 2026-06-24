const express = require('express');
const { authMiddleware } = require('../middlewares/AuthMiddleware');
const EligibilityController = require('../controller/eligibilityController');

const router = express.Router();

// Eligible Students page - students not yet eligible
router.get('/not-eligible', authMiddleware, EligibilityController.getNotEligibleStudents);

// Mark students as eligible
router.post('/mark-eligible', authMiddleware, EligibilityController.markEligible);

// Mark students as not eligible
router.post('/mark-not-eligible', authMiddleware, EligibilityController.markNotEligible);

// Hostel Assignment page - eligible but not yet assigned
router.get('/eligible-for-assignment', authMiddleware, EligibilityController.getEligibleForAssignment);

// Assigned Students page - eligible and assigned
router.get('/assigned-students', authMiddleware, EligibilityController.getAssignedStudents);

module.exports = router;
