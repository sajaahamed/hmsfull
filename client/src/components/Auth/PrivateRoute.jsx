import { Navigate } from 'react-router-dom';
import { getRoleNames, getUserInfoFromToken } from '../../utils/auth';

// Function to check if user is authenticated
const isAuthenticated = () => {
    return !!localStorage.getItem('login'); // Check for token in localStorage
};

const hasRoleAccess = (allowedRoles) => {
    if (!allowedRoles || allowedRoles.length === 0) return true;
    const roleNames = getRoleNames(getUserInfoFromToken());
    return allowedRoles.some(role => roleNames.includes(role.toLowerCase()));
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
