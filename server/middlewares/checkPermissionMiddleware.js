// checkPermissionMiddleware.js
const User = require('../model/User');
const Role = require('../model/Role');
const Warden = require('../model/Warden');

const checkPermission = (requiredPermission) => {
    return async (req, res, next) => {
        try {
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ message: 'Unauthorized: No user ID found.' });
            }

            const user = await User.findById(userId).populate('roles');

            if (!user) {
                return res.status(404).json({ message: 'User not found.' });
            }

            const allPermissions = user.roles.flatMap(role => role.permissions);

            // Allow wardens to perform room-assignment actions even when their Role document
            // doesn't explicitly list the 'assign-room-special' permission. This is a focused
            // fallback to avoid blocking typical warden workflows while roles are being managed.
            if (requiredPermission === 'assign-room-special') {
                const roleNames = user.roles.map(r => r.name);
                if (roleNames.includes('warden')) {
                    return next();
                }
            }

            // Extra needs: allow wardens to view and decide extra-needs requests even if the
            // permission strings are missing from Role documents.
            if (requiredPermission === 'std-extra-needs' || requiredPermission === 'approve-needs') {
                const roleNames = user.roles.map(r => r.name);
                if (roleNames.includes('warden')) {
                    return next();
                }

                // Some deployments have warden users with an incorrect Role assignment.
                // If the user is actually linked to a Warden record, allow these warden-only actions.
                const wardenRecord = await Warden.findOne({ userId }).select('_id').lean();
                if (wardenRecord) {
                    return next();
                }
            }

            // Payments: allow privileged roles to read payments even if the permission string
            // hasn't been added to the Role documents yet.
            if (requiredPermission === 'view-payments') {
                const roleNames = user.roles.map(r => r.name);
                if (roleNames.includes('admin') || roleNames.includes('director')) {
                    return next();
                }
            }

            // Backups: allow privileged roles to manage backup settings even if the permission
            // string hasn't been added to the Role documents yet.
            if (requiredPermission === 'manage-backups') {
                const roleNames = user.roles.map(r => r.name);
                if (roleNames.includes('admin') || roleNames.includes('director')) {
                    return next();
                }
            }

            // Rooms/Hostels: allow admins to update room capacity and count
            if (requiredPermission === 'update-room-capasity' || requiredPermission === 'update-room-count') {
                const roleNames = user.roles.map(r => r.name);
                if (roleNames.includes('admin') || roleNames.includes('director')) {
                    return next();
                }
            }

            if (!allPermissions.includes(requiredPermission)) {
                // Debug logging to help identify permission issues
                console.warn('[Permission Denied] userId:', userId, 'required:', requiredPermission);
                console.warn('[Permission Denied] user roles:', user.roles.map(r => ({ name: r.name, permissions: r.permissions })));
                console.warn('[Permission Denied] aggregated permissions:', allPermissions);
                return res.status(403).json({ message: 'Forbidden: You do not have permission.' });
            }

            next();
        } catch (err) {
            console.error('Permission Check Error:', err);
            res.status(500).json({ message: 'Internal Server Error during permission check.' });
        }
    };
};

module.exports = checkPermission;
