import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getUserInfoFromToken } from '../../utils/auth';
import { dashsidedata } from './DashSideData';
import uoplogo from '../../assets/uoplogo.png';
import DashUser from '../../assets/DashUser.png';

const DashSide = () => {
    const [activeMenu, setActiveMenu] = useState(null);
    const location = useLocation();
    const navigate = useNavigate();

    const { username, roles } = getUserInfoFromToken() || {};

    // Normalize role names
    const roleNames = useMemo(() => Array.isArray(roles)
        ? roles.map(r => (typeof r === 'string' ? r : r.name))
        : [typeof roles === 'string' ? roles : roles?.name], [roles]);

    // Filter menu based on role
    const filteredMenu = dashsidedata.filter(item => {
        if (roleNames.includes('admin') || roleNames.includes('director')) {
            return ![3, 5, 7, 12, 13, 14].includes(item.id); 
        }
        if (roleNames.includes('warden')) {
            return ![2, 4, 6, 9, 10, 11, 12, 13, 16].includes(item.id); 
        }
        if (roleNames.includes('student')) {
            return ![2, 3, 4, 5, 6, 7, 9, 10, 11, 14, 15, 16].includes(item.id); 
        }
        return false; // All others get no menu
    });

    useEffect(() => {
        const currentItem = dashsidedata.find(item => item.link === location.pathname);
        if (currentItem) {
            // Check if current item is allowed for this user role
            const allowedIds = filteredMenu.map(item => item.id);
            if (roleNames.includes('warden') && !allowedIds.includes(currentItem.id)) {
                // Warden trying to access forbidden menu -> logout
                localStorage.clear();
                navigate('/');  // Adjust your login path here
                return;
            }
            setActiveMenu(currentItem.id);
            localStorage.setItem('dashmenuID', currentItem.id);
        } else {
            const savedId = localStorage.getItem('dashmenuID');
            if (savedId) {
                const savedIdNum = Number(savedId);
                const allowedIds = filteredMenu.map(item => item.id);
                if (allowedIds.includes(savedIdNum)) {
                    setActiveMenu(savedIdNum);
                } else {
                    // Saved menu id not allowed for current user role, logout
                    localStorage.clear();
                    navigate('/');
                }
            } else {
                setActiveMenu(null);
            }
        }
    }, [location, filteredMenu, roleNames, navigate]);

    return (
        <aside
            className="shadow-lg h-full p-4 pb-10 flex flex-col xl:rounded-r-3xl
                overflow-y-auto scrollbar-modern transition-all duration-300"
            style={{ background: 'linear-gradient(180deg, #6b0f14, #4f0a0f)', color: '#fff', borderRight: '1px solid rgba(212,175,55,0.15)' }}
        >
            <div className="mb-6 flex justify-center">
                <img src={uoplogo} alt="University of Peradeniya Logo" className="h-14 object-contain" />
            </div>

            <h2 className="text-center text-xs font-extrabold tracking-widest mb-4 select-none" style={{ color: '#d4af37' }}>
                HOSTEL MANAGEMENT SYSTEM
            </h2>

            <div className="flex items-center gap-3 rounded-2xl p-3 shadow-inner mb-6 select-none" style={{ background: 'rgba(212,175,55,0.1)', color: '#fff' }}>
                <img
                    src={DashUser}
                    alt={`${username} avatar`}
                    className="h-12 w-12 rounded-full border-2 shadow"
                    style={{ borderColor: '#d4af37' }}
                />
                <div>
                    <h3 className="font-semibold uppercase tracking-wide text-white">{username}</h3>
                    <p className="text-xs uppercase font-medium tracking-wider" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        {roleNames.join(', ')}
                    </p>
                </div>
            </div>

            <nav className="flex flex-col space-y-2 flex-grow">
                {/* eslint-disable-next-line no-unused-vars */}
                {filteredMenu.map(({ id, icon: Icon, name, link }) => (
                    <Link
                        to={link}
                        key={id}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors text-sm
                            ${activeMenu === id
                                ? 'text-white shadow-lg'
                                : 'hover:text-white'
                            }`}
                        style={activeMenu === id
                            ? { background: 'linear-gradient(90deg, #d4af37, #c59a3a)' }
                            : { color: 'rgba(255,255,255,0.75)', background: 'transparent' }
                        }
                        onClick={() => {
                            setActiveMenu(id);
                            localStorage.setItem('dashmenuID', id);
                        }}
                        tabIndex={0}
                        aria-current={activeMenu === id ? 'page' : undefined}
                    >
                        <span className="text-lg"><Icon /></span>
                        <span className="font-semibold tracking-wide">{name}</span>
                    </Link>
                ))}
            </nav>
        </aside>
    );
};

export default DashSide;
