import { jwtDecode } from 'jwt-decode';

export function getUserInfoFromToken() {
    const token = localStorage.getItem('login');
    // console.log("TOKEN FROM STORAGE:", token);
    if (!token) return null;

    try {
        const decoded = jwtDecode(token);
        // console.log("DECODED TOKEN:", decoded);

        const username = decoded.username || decoded.user?.username || null;
        const email = decoded.email || decoded.user?.email || null;
        const roles = decoded.role || decoded.roles || decoded.user?.roles || [];

        // NOTE: Removed strict check that required all of username, email, and roles
        // to be present. Some users (e.g. students) may have partially missing data
        // in their token, which was causing an immediate redirect back to login.
        // if (!username || !email || roles.length === 0) {
        //     return null;
        // }

        if (email) {
            localStorage.setItem('loginE', email);
        }

        return { username, email, roles };
    } catch (error) {
        console.error('Invalid token', error);
        return null;
    }
}
