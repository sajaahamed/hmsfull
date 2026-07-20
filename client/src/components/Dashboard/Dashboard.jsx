import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { cacheCurrentUser, getRoleNames, getUserInfoFromToken } from '../../utils/auth';
import { API_BASE_URL } from '../../utils/api';
import DashSide from './DashSide';
import DashNav from './DashNav';
import DashFooter from './DashFooter';

const Dashboard = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [sideOpen, setSideOpen] = useState(false);

    useEffect(() => {
        const userInfo = getUserInfoFromToken();
        if (!userInfo) {
            localStorage.clear();
            navigate('/');
        } else {
            setUser(userInfo);

            const token = localStorage.getItem('login');

            axios.get(`${API_BASE_URL}/auth/get-currentuser-data`, {
                headers: { Authorization: `Bearer ${token}` },
            }).then(res => {
                const currentUser = res.data?.Result;
                if (!currentUser) return;

                const roleNames = getRoleNames(currentUser);
                cacheCurrentUser(currentUser);
                setUser(prev => ({
                    ...prev,
                    username: currentUser.username || prev?.username,
                    email: currentUser.email || prev?.email,
                    profileImage: currentUser.profileImage || prev?.profileImage,
                    roles: currentUser.roles || prev?.roles || [],
                    roleNames,
                }));
            }).catch(error => {
                console.warn('Unable to refresh current user data', error);
            });
        }
    }, [navigate]);

    const toggleSide = () => setSideOpen(prev => !prev);

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center text-gray-600">
                Loading...
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
            <div className="xl:flex relative">

                {/* Sidebar */}
                <aside
                    className={`fixed top-0 left-0 h-full shadow-lg z-50 w-[260px]
                    transform transition-transform duration-300 ease-in-out
                    xl:translate-x-0
                    ${sideOpen ? 'translate-x-0' : '-translate-x-full'}`}
                    style={{ background: 'linear-gradient(180deg, #6b0f14, #4f0a0f)' }}
                >
                    <DashSide toggleSide={toggleSide} user={user} />
                </aside>

                {/* Hamburger — mobile only, shown when sidebar is closed */}
                {!sideOpen && (
                    <button
                        aria-label="Open menu"
                        className="fixed top-5 left-3 z-[60] p-2 rounded-md text-white xl:hidden shadow-lg transition"
                        style={{ background: '#6b0f14' }}
                        onClick={toggleSide}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                )}

                {/* Main Content */}
                <main className="flex-1 xl:ml-[260px] min-h-screen flex flex-col">

                    {/* Header */}
                    <header className="sticky top-0 z-40 bg-white shadow-md">
                        <DashNav user={user} />
                    </header>

                    {/* Page Content */}
                    <section className="flex-grow p-6 bg-gray-50 overflow-auto">
                        <Outlet />
                    </section>

                    {/* Footer */}
                    <footer className="bg-white border-t border-gray-200">
                        <DashFooter />
                    </footer>
                </main>
            </div>
        </div>
    );
};

export default Dashboard;
