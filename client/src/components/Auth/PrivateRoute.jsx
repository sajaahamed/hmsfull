import { Navigate } from 'react-router-dom';
import { getUserInfoFromToken } from '../../utils/auth';

// Function to check if user is authenticated
const isAuthenticated = () => {
    return !!localStorage.getItem('login'); // Check for token in localStorage
};

const getRoleNames = () => {
    const info = getUserInfoFromToken();
    const roles = info?.roles;
    if (!roles) return [];
    if (Array.isArray(roles)) {
        return roles.map(r => (typeof r === 'string' ? r : r?.name)).filter(Boolean);
    }
    return [typeof roles === 'string' ? roles : roles?.name].filter(Boolean);
};

const hasRoleAccess = (allowedRoles) => {
    if (!allowedRoles || allowedRoles.length === 0) return true;
    const roleNames = getRoleNames();
    return allowedRoles.some(role => roleNames.includes(role));
};

const PrivateRoute = ({ element, allowedRoles }) => {
    if (!isAuthenticated()) {
        // Force page reload for /
        window.location.href = "/";
        return null;
    }

    if (!hasRoleAccess(allowedRoles)) {
        window.location.href = "/Dashboard/Home";
        return null;
    }

    return element;
};



export default PrivateRoute;