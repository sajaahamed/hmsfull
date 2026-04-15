const axios = require('axios');
const XLSX = require('xlsx');
const path = require('path');
const jwt = require('jsonwebtoken');
const Student = require('../model/Student');
const SpecialNeeds = require('../model/SpecialNeeds');
const EmergencyContact = require('../model/EmergencyContact');

// Geocoding function using OpenCage API
async function geocodeWithOpenCage(address) {
    try {
        const apiKey = process.env.OPENCAGE_API_KEY;
        const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(address)}&key=${apiKey}`;

        const response = await axios.get(url);
        const result = response.data.results[0];
        return result ? { lat: result.geometry.lat, lng: result.geometry.lng } : null;
    } catch (error) {
        console.error(`OpenCage error for "${address}":`, error.message);
        return null;
    }
}

// Geocoding function using Nominatim (OpenStreetMap) — free, no API key needed
async function geocodeWithNominatim(address) {
    try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=5&addressdetails=1`;
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'HMS-App/1.0' }
        });
        if (!response.data || response.data.length === 0) return null;

        const preferred = response.data.find(r =>
            ['city', 'town', 'village', 'hamlet', 'suburb', 'neighbourhood'].includes(r.type)
        );
        const best = preferred || response.data[0];
        return { lat: parseFloat(best.lat), lng: parseFloat(best.lon) };
    } catch (error) {
        console.error(`Nominatim geocode error for "${address}":`, error.message);
        return null;
    }
}

// Function to calculate road distance using OSRM
async function getRoadDistanceOSRM(start, end) {
    try {
        const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=false&alternatives=false&steps=false`;

        const response = await axios.get(osrmUrl);
        const distance = response.data.routes[0].legs[0].distance;
        return distance / 1000; // km
    } catch (error) {
        console.error('Error getting road distance from OSRM:', error.message);
        return null;
    }
}

// Helper: get distance (km) using Google Directions API
async function getDistanceWithGoogleDirections(origin, dest, apiKey) {
    try {
        // Request alternative routes and pick the shortest by distance to better match Google Maps UI
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}&key=${apiKey}&mode=driving&alternatives=true&units=metric`;
        const resp = await axios.get(url);
        if (!resp.data || resp.data.status !== 'OK') {
            const errMsg = resp.data && resp.data.error_message ? resp.data.error_message : (resp.data && resp.data.status) || 'UNKNOWN';
            console.warn('[getDistanceWithGoogleDirections] Google Directions returned:', errMsg);
            return null;
        }

        const routes = resp.data.routes || [];
        if (!routes.length) {
            console.warn('[getDistanceWithGoogleDirections] No routes returned');
            return null;
        }

        // Compute distance for each route (sum of leg distances) and pick the minimum
        const routeDistancesMeters = routes.map(rt => {
            const legs = rt.legs || [];
            return legs.reduce((sum, lg) => sum + ((lg && lg.distance && typeof lg.distance.value === 'number') ? lg.distance.value : 0), 0);
        });

        const validDistances = routeDistancesMeters.filter(d => d > 0);
        if (!validDistances.length) {
            console.warn('[getDistanceWithGoogleDirections] No valid leg distances in routes');
            return null;
        }

        const minMeters = Math.min(...validDistances);
        return minMeters / 1000; // meters -> km
    } catch (err) {
        console.error('[getDistanceWithGoogleDirections] Exception:', err.message);
        return null;
    }
}

// Helper: get distance (km) using Google Distance Matrix API
async function getDistanceWithDistanceMatrix(origin, dest, apiKey) {
    try {
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(dest)}&key=${apiKey}&units=metric`;
        const resp = await axios.get(url);
        if (!resp.data || resp.data.status !== 'OK') {
            console.warn('[getDistanceWithDistanceMatrix] response status:', resp.data && resp.data.status);
            return null;
        }
        const el = resp.data.rows?.[0]?.elements?.[0];
        if (el && el.status === 'OK' && el.distance && typeof el.distance.value === 'number') {
            return el.distance.value / 1000; // meters -> km
        }
        console.warn('[getDistanceWithDistanceMatrix] element missing or not OK');
        return null;
    } catch (err) {
        console.error('[getDistanceWithDistanceMatrix] Exception:', err.message);
        return null;
    }
}

// Simple in-memory cache for geocoding/place_id results
const placeCache = new Map();

// Helper: get place_id, formatted address and location from Geocoding API (cached)
async function getPlaceInfo(address, apiKey) {
    if (!address) return null;
    const key = address.trim();
    if (placeCache.has(key)) return placeCache.get(key);

    try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
        const resp = await axios.get(url);
        const r = resp.data && Array.isArray(resp.data.results) && resp.data.results[0];
        if (!r) {
            placeCache.set(key, null);
            return null;
        }
        const info = {
            place_id: r.place_id,
            formatted_address: r.formatted_address,
            location: r.geometry && r.geometry.location ? { lat: r.geometry.location.lat, lng: r.geometry.location.lng } : null
        };
        placeCache.set(key, info);
        return info;
    } catch (err) {
        console.error('[getPlaceInfo] Geocode error for', address, err.message);
        placeCache.set(key, null);
        return null;
    }
}

// ── Shared helper: calculate distance (Google → Nominatim+OSRM → OpenCage+OSRM) ──
const universityAddress = 'Gymnasium, University of Peradeniya, 20400';

async function calculateDistance(originAddress) {
    if (!originAddress) {
        console.log('[calculateDistance] No origin address provided — skipping.');
        return null;
    }

    console.log('[calculateDistance] Computing distance for:', originAddress);

    // 1. Try Google (Directions API preferred if configured, else Distance Matrix)
    if (process.env.GOOGLE_MAPS_API_KEY) {
        try {
            const useDirections = /^(1|true)$/i.test(process.env.GOOGLE_MAPS_USE_DIRECTIONS || '');
            // prefer geocoded place_id or lat/lng to match Maps UI
            const originInfo = await getPlaceInfo(originAddress, process.env.GOOGLE_MAPS_API_KEY);
            const uniInfo = await getPlaceInfo(universityAddress, process.env.GOOGLE_MAPS_API_KEY);
            const originParam = originInfo && originInfo.place_id ? `place_id:${originInfo.place_id}` : (originInfo && originInfo.location ? `${originInfo.location.lat},${originInfo.location.lng}` : originAddress);
            const destParam = uniInfo && uniInfo.place_id ? `place_id:${uniInfo.place_id}` : (uniInfo && uniInfo.location ? `${uniInfo.location.lat},${uniInfo.location.lng}` : universityAddress);

            if (useDirections) {
                console.log('[calculateDistance] Using Google Directions API (configured) with place_id/coords ...');
                const km = await getDistanceWithGoogleDirections(originParam, destParam, process.env.GOOGLE_MAPS_API_KEY);
                if (km !== null) {
                    console.log('[calculateDistance] Google Directions result:', +km.toFixed(2), 'km');
                    return +km.toFixed(2);
                }
                console.warn('[calculateDistance] Google Directions failed — falling back to other providers...');
            }

            console.log('[calculateDistance] Using Google Distance Matrix with place_id/coords...');
            const dmKm = await getDistanceWithDistanceMatrix(originParam, destParam, process.env.GOOGLE_MAPS_API_KEY);
            if (dmKm !== null) {
                const km = +dmKm.toFixed(2);
                console.log('[calculateDistance] Google DistanceMatrix result:', km, 'km');
                return km;
            }
        } catch (err) {
            console.error('[calculateDistance] Google API exception:', err.message);
        }
    } else {
        console.log('[calculateDistance] No GOOGLE_MAPS_API_KEY — skipping Google.');
    }

    // 2. Try Nominatim + OSRM (free)
    try {
        console.log('[calculateDistance] Using Nominatim + OSRM...');
        const studentCoords = await geocodeWithNominatim(originAddress);
        console.log('[calculateDistance] Student coords (Nominatim):', studentCoords);
        const uniCoords = await geocodeWithNominatim(universityAddress);
        console.log('[calculateDistance] University coords (Nominatim):', uniCoords);
        if (studentCoords && uniCoords) {
            const dkm = await getRoadDistanceOSRM(studentCoords, uniCoords);
            console.log('[calculateDistance] OSRM result:', dkm, 'km');
            if (dkm !== null) return +dkm.toFixed(2);
        }
    } catch (err) {
        console.error('[calculateDistance] Nominatim/OSRM error:', err.message);
    }

    // 3. Fallback: OpenCage + OSRM
    if (process.env.OPENCAGE_API_KEY) {
        try {
            console.log('[calculateDistance] Falling back to OpenCage + OSRM...');
            const studentCoords = await geocodeWithOpenCage(originAddress);
            const uniCoords = await geocodeWithOpenCage(universityAddress);
            if (studentCoords && uniCoords) {
                const dkm = await getRoadDistanceOSRM(studentCoords, uniCoords);
                if (dkm !== null) return +dkm.toFixed(2);
            }
        } catch (err) {
            console.error('[calculateDistance] OpenCage/OSRM fallback error:', err.message);
        }
    }

    console.log('[calculateDistance] Could not compute distance — returning null.');
    return null;
}


const StudentController = {
    // Debug endpoint: return both Directions and Distance Matrix distances for comparison
    debugDistance: async (req, res) => {
        try {
            const { origin } = req.query;
            if (!origin) return res.status(400).json({ Status: 'Fail', Error: 'origin query parameter is required' });

            const apiKey = process.env.GOOGLE_MAPS_API_KEY;
            if (!apiKey) return res.status(500).json({ Status: 'Fail', Error: 'GOOGLE_MAPS_API_KEY not configured on server.' });

            const dest = universityAddress;

            const [directionsKm, matrixKm] = await Promise.all([
                getDistanceWithGoogleDirections(origin, dest, apiKey),
                getDistanceWithDistanceMatrix(origin, dest, apiKey)
            ]);

            return res.json({ Status: 'Success', origin, destination: dest, directionsKm, matrixKm });
        } catch (err) {
            console.error('debugDistance error:', err);
            return res.status(500).json({ Status: 'Fail', Error: 'Internal server error' });
        }
    },
    createstdviaSheet: async (req, res) => {
        try {
            const filePath = req.file.path;
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const studentsFromExcel = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

            const insertedStudents = [];
            const duplicateStudents = [];

            for (const s of studentsFromExcel) {
                // Normalize header keys (remove non-word chars, lowercase) to tolerate different Excel header names
                const norm = {};
                Object.keys(s || {}).forEach(k => {
                    const nk = k.replace(/\W/g, '').toLowerCase();
                    norm[nk] = s[k];
                });
                const get = (k) => norm[k.replace(/\W/g, '').toLowerCase()];

                // Determine a unique identifier for the row. If none exists, skip the row
                const idField = get('Enrolment_No.') || get('enrolmentNo') || get('enrolmentno') || get('index_no') || get('indexno') || get('nic') || get('email');
                if (!idField) {
                    // No reliable unique id -> skip this row
                    duplicateStudents.push(null);
                    continue;
                }

                const exists = await Student.findOne({
                    $or: [
                        { enrolmentNo: get('Enrolment_No.') || get('enrolmentno') },
                        { indexNo: get('Index_No') || get('indexno') },
                        { nic: get('NIC') },
                        { email: get('email') }
                    ]
                });

                if (exists) {
                    duplicateStudents.push(idField);
                    continue;
                }

                const studentData = {
                    no: get('No'),
                    indexNo: get('Index_No') || get('indexno'),
                    name: get('Name'),
                    title: get('Title'),
                    lastName: get('L_Name') || get('lname'),
                    initials: get('Initials'),
                    fullName: get('Full_Name') || get('fullname'),
                    alDistrict: get('alDistrict') || get('aldistrict'),
                    sex: get('Sex'),
                    zScore: isNaN(parseFloat(get('Z_Score'))) ? 0 : parseFloat(get('Z_Score')),
                    medium: get('Medium'),
                    nic: get('NIC'),
                    address1: get('ADD1') || get('add1'),
                    address2: get('ADD2') || get('add2'),
                    address3: get('ADD3') || get('add3'),
                    fullAddress: get('Address') || get('fullAddress'),
                    email: get('email'),
                    phone1: get('Phone_No') || get('phoneno') || get('phone_no'),
                    phone2: get('Phone_No_2') || get('phone_no_2') || '',
                    genEnglishMarks: get('Gen_English_Marks') ? parseInt(get('Gen_English_Marks')) : null,
                    intake: get('Intake'),
                    dateOfEnrolment: get('Date_of_Enollment') || get('dateofenrolment') || get('dateofenrollment'),
                    distance: null
                };

                // Only set enrolmentNo if present (avoid explicit nulls which trigger unique index conflicts)
                const enrolVal = get('Enrolment_No.') || get('enrolmentno');
                if (enrolVal) studentData.enrolmentNo = enrolVal;

                // Auto-calculate distance using combined address for better accuracy
                const originAddress = studentData.fullAddress
                    || [studentData.address1, studentData.address2, studentData.address3].filter(Boolean).join(', ')
                    || studentData.address3;
                if (originAddress) {
                    const searchAddress = /sri\s*lanka/i.test(originAddress) ? originAddress : `${originAddress}, Sri Lanka`;
                    const distanceKm = await calculateDistance(searchAddress);
                    if (distanceKm !== null) {
                        studentData.distance = distanceKm;
                    }
                    // small delay to avoid rate limits
                    await new Promise(rp => setTimeout(rp, 200));
                }

                insertedStudents.push(studentData);
            }

            // Use unordered bulkWrite so duplicate-key errors skip only failing rows
            let insertedCount = 0;
            if (insertedStudents.length) {
                // Diagnostic logging to help debug upload issues
                console.log('[createstdviaSheet] total rows in sheet:', studentsFromExcel.length);
                console.log('[createstdviaSheet] prepared documents for insert:', insertedStudents.length);
                console.log('[createstdviaSheet] skipped/duplicate candidates so far:', duplicateStudents.length);
                console.log('[createstdviaSheet] sample prepared docs:', insertedStudents.slice(0, 5).map(d => ({ enrolmentNo: d.enrolmentNo || null, indexNo: d.indexNo || null, email: d.email || null })));
                const ops = insertedStudents.map(doc => ({ insertOne: { document: doc } }));
                try {
                    const bulkRes = await Student.bulkWrite(ops, { ordered: false });
                    insertedCount = bulkRes.insertedCount || bulkRes.nInserted || 0;
                } catch (err) {
                    // Bulk write may throw — extract inserted count and which indexes failed
                    console.warn('Partial bulkWrite error:', err.message || err);
                    if (err.result && typeof err.result.insertedCount === 'number') {
                        insertedCount = err.result.insertedCount;
                    } else if (err.result && typeof err.result.nInserted === 'number') {
                        insertedCount = err.result.nInserted;
                    } else if (Array.isArray(err.insertedDocs)) {
                        insertedCount = err.insertedDocs.length;
                    }

                    // Map writeErrors back to original rows and record their id values
                    if (Array.isArray(err.writeErrors)) {
                        for (const we of err.writeErrors) {
                            const idx = we.index;
                            const doc = insertedStudents[idx];
                            const id = (doc && (doc.enrolmentNo || doc.indexNo || doc.email || doc.nic)) || null;
                            duplicateStudents.push(id);
                        }
                    }

                    // continue — we've recorded failed rows and extracted insertedCount where possible
                }
            }

            res.json({
                Status: "Success",
                Message: 'Upload complete',
                insertedCount,
                duplicateCount: duplicateStudents.length,
                duplicates: duplicateStudents
            });
        }
        catch (err) {
            console.error("Error in createstdviaSheet:", err);
            return res.status(500).json({ Status: "Fail", Error: "Internal server error" });
        }
    },

    // Upload Excel and compute student -> university distance using Google Distance Matrix API
    uploadStudentsDistanceGoogle: async (req, res) => {
        try {
            const apiKey = process.env.GOOGLE_MAPS_API_KEY;
            if (!apiKey) return res.status(500).json({ Status: 'Fail', Error: 'GOOGLE_MAPS_API_KEY not configured on server.' });

            const filePath = req.file.path;
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

            const results = [];
            for (const r of rows) {
                const address = r['Address'] || r['fullAddress'] || r['HomeAddress'] || r['ADD3'] || r['ADD1'] || r['Address1'];
                const idField = r['Enrolment_No.'] || r['enrolmentNo'] || r['email'] || r['Index_No'];

                if (!address) {
                    results.push({ id: idField || null, status: 'Skipped', reason: 'No address found in row' });
                    continue;
                }

                const useDirections = /^(1|true)$/i.test(process.env.GOOGLE_MAPS_USE_DIRECTIONS || '');

                try {
                    // prefer place_id or coords for origin/destination
                    const originInfo = await getPlaceInfo(address, apiKey);
                    const uniInfo = await getPlaceInfo(universityAddress, apiKey);
                    const originParam = originInfo && originInfo.place_id ? `place_id:${originInfo.place_id}` : (originInfo && originInfo.location ? `${originInfo.location.lat},${originInfo.location.lng}` : address);
                    const destParam = uniInfo && uniInfo.place_id ? `place_id:${uniInfo.place_id}` : (uniInfo && uniInfo.location ? `${uniInfo.location.lat},${uniInfo.location.lng}` : universityAddress);

                    let distanceKm = null;
                    if (useDirections) {
                        const km = await getDistanceWithGoogleDirections(originParam, destParam, apiKey);
                        if (km === null) {
                            results.push({ id: idField || null, status: 'Fail', reason: 'Google Directions returned no route' });
                            continue;
                        }
                        distanceKm = +km.toFixed(2);
                    } else {
                        const dmKm = await getDistanceWithDistanceMatrix(originParam, destParam, apiKey);
                        if (dmKm === null) {
                            results.push({ id: idField || null, status: 'Fail', reason: 'Distance Matrix returned no element' });
                            continue;
                        }
                        distanceKm = +dmKm.toFixed(2);
                    }

                    let updated = null;
                    if (idField) {
                        const query = {
                            $or: [
                                { enrolmentNo: idField },
                                { indexNo: idField },
                                { email: idField },
                                { nic: idField }
                            ]
                        };
                        updated = await Student.findOneAndUpdate(query, { distance: distanceKm }, { new: true });
                    }

                    results.push({ id: idField || null, status: 'OK', distanceKm, updated: !!updated });
                } catch (err) {
                    console.error('Google API error for', address, err.message);
                    results.push({ id: idField || null, status: 'Error', reason: err.message });
                }

                await new Promise(rp => setTimeout(rp, 200));
            }

            return res.json({ Status: 'Success', Message: 'Distance calculation finished', results });
        } catch (err) {
            console.error('uploadStudentsDistanceGoogle error:', err);
            return res.status(500).json({ Status: 'Fail', Error: 'Internal server error' });
        }
    },

    // Process an already-uploaded Excel file (filename provided in body)
    processUploadedFile: async (req, res) => {
        try {
            const { filename } = req.body;
            if (!filename) return res.status(400).json({ Status: 'Fail', Error: 'filename is required in body' });

            const uploadsPath = path.join(__dirname, '..', 'uploads');
            const filePath = path.join(uploadsPath, filename);

            const fs = require('fs');
            if (!fs.existsSync(filePath)) return res.status(404).json({ Status: 'Fail', Error: 'File not found on server' });

            const apiKey = process.env.GOOGLE_MAPS_API_KEY;
            if (!apiKey) return res.status(500).json({ Status: 'Fail', Error: 'GOOGLE_MAPS_API_KEY not configured on server.' });

            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

            const results = [];
            for (const r of rows) {
                const address = r['Address'] || r['fullAddress'] || r['HomeAddress'] || r['ADD3'] || r['ADD1'] || r['Address1'];
                const idField = r['Enrolment_No.'] || r['enrolmentNo'] || r['email'] || r['Index_No'];

                if (!address) {
                    results.push({ id: idField || null, status: 'Skipped', reason: 'No address found in row' });
                    continue;
                }

                const useDirections = /^(1|true)$/i.test(process.env.GOOGLE_MAPS_USE_DIRECTIONS || '');

                try {
                    // prefer place_id or coords for origin/destination
                    const originInfo = await getPlaceInfo(address, apiKey);
                    const uniInfo = await getPlaceInfo(universityAddress, apiKey);
                    const originParam = originInfo && originInfo.place_id ? `place_id:${originInfo.place_id}` : (originInfo && originInfo.location ? `${originInfo.location.lat},${originInfo.location.lng}` : address);
                    const destParam = uniInfo && uniInfo.place_id ? `place_id:${uniInfo.place_id}` : (uniInfo && uniInfo.location ? `${uniInfo.location.lat},${uniInfo.location.lng}` : universityAddress);

                    let distanceKm = null;
                    if (useDirections) {
                        const km = await getDistanceWithGoogleDirections(originParam, destParam, apiKey);
                        if (km === null) {
                            results.push({ id: idField || null, status: 'Fail', reason: 'Google Directions returned no route' });
                            continue;
                        }
                        distanceKm = +km.toFixed(2);
                    } else {
                        const dmKm = await getDistanceWithDistanceMatrix(originParam, destParam, apiKey);
                        if (dmKm === null) {
                            results.push({ id: idField || null, status: 'Fail', reason: 'Distance Matrix returned no element' });
                            continue;
                        }
                        distanceKm = +dmKm.toFixed(2);
                    }

                    let updated = null;
                    if (idField) {
                        const query = {
                            $or: [
                                { enrolmentNo: idField },
                                { indexNo: idField },
                                { email: idField },
                                { nic: idField }
                            ]
                        };
                        updated = await Student.findOneAndUpdate(query, { distance: distanceKm }, { new: true });
                    }

                    results.push({ id: idField || null, status: 'OK', distanceKm, updated: !!updated });
                } catch (err) {
                    console.error('Google API error for', address, err.message);
                    results.push({ id: idField || null, status: 'Error', reason: err.message });
                }

                await new Promise(rp => setTimeout(rp, 200));
            }

            return res.json({ Status: 'Success', Message: 'Processed uploaded file', results });
        } catch (err) {
            console.error('processUploadedFile error:', err);
            return res.status(500).json({ Status: 'Fail', Error: 'Internal server error' });
        }
    },

    createStudentManually: async (req, res) => {
        try {
            const {
                enrolmentNo,
                indexNo,
                name,
                title,
                lastName,
                initials,
                fullName,
                alDistrict,
                sex,
                zScore,
                medium,
                nic,
                address1,
                address2,
                address3,
                fullAddress,
                email,
                phone1,
                phone2,
                genEnglishMarks,
                intake,
                dateOfEnrolment,
                distance
            } = req.body;


            const existingStudent = await Student.findOne({
                $or: [
                    { enrolmentNo },
                    { indexNo },
                    { nic },
                    { email }
                ]
            });

            if (existingStudent) {
                return res.json({ error: "Student already exists with the provided enrolment number, index number, NIC, or email." });
            }

            // Auto-calculate distance from address if not provided
            let computedDistance = distance;
            if (!distance && (address3 || fullAddress || address1 || address2)) {
                const originAddress = fullAddress
                    || [address1, address2, address3].filter(Boolean).join(', ')
                    || address3;
                const searchAddress = /sri\s*lanka/i.test(originAddress)
                    ? originAddress
                    : `${originAddress}, Sri Lanka`;
                computedDistance = await calculateDistance(searchAddress);
            }

            const newStudent = new Student({
                enrolmentNo,
                indexNo,
                name,
                title,
                lastName,
                initials,
                fullName,
                alDistrict,
                sex,
                zScore,
                medium,
                nic,
                address1,
                address2,
                address3,
                fullAddress,
                email,
                phone1,
                phone2,
                genEnglishMarks,
                intake,
                dateOfEnrolment,
                distance: computedDistance
            });

            await newStudent.save();

            return res.json({ Status: "Success", message: "Student created successfully", student: newStudent });
        } catch (err) {
            console.error("Error creating student:", err);
            return res.json({ error: "Internal server error" });
        }
    },

    studentGetall: async (req, res) => {
        try {
            const getAllStudents = await Student.find()

            return res.json({ Result: getAllStudents })
        }
        catch (err) {
            console.log(err)
        }
    },

    getStudentById: async (req, res) => {
        try {
            const { id } = req.params

            const findStudent = await Student.findById(id)

            res.json({ Result: findStudent })
        }
        catch (err) {
            console.log(err)
        }
    },

    updateStudent: async (req, res) => {
        try {
            const { id } = req.params;
            const {
                name,
                title,
                lastName,
                initials,
                fullName,
                alDistrict,
                sex,
                zScore,
                medium,
                address1,
                address2,
                address3,
                fullAddress,
                phone1,
                phone2,
                genEnglishMarks,
                intake,
                dateOfEnrolment,
                distance
            } = req.body;

            // Auto-calculate distance from address if not provided
            let computedDistance = distance || null;
            if (!computedDistance && (address3 || fullAddress || address1 || address2)) {
                const originAddress = fullAddress
                    || [address1, address2, address3].filter(Boolean).join(', ')
                    || address3;
                const searchAddress = /sri\s*lanka/i.test(originAddress)
                    ? originAddress
                    : `${originAddress}, Sri Lanka`;
                const calcDist = await calculateDistance(searchAddress);
                if (calcDist !== null) {
                    computedDistance = calcDist;
                }
            }

            const updatedStudent = await Student.findByIdAndUpdate(
                id,
                {
                    name,
                    title,
                    lastName,
                    initials,
                    fullName,
                    alDistrict,
                    zScore,
                    medium,
                    address1,
                    address2,
                    address3,
                    fullAddress,
                    phone1,
                    phone2,
                    genEnglishMarks,
                    intake,
                    dateOfEnrolment,
                    distance: computedDistance
                },
                { new: true }
            );

            if (!updatedStudent) {
                return res.json({ message: 'Student not found' });
            }

            res.json({ Status: "Success", Message: 'Student updated successfully', student: updatedStudent });
        } catch (err) {
            console.error(err);
            res.json({ message: 'Internal server error' });
        }
    },



    StudentCreateNeeds: async (req, res) => {
        try {
            const { regNo, needs } = req.body;

            if (!regNo || !needs) {
                return res.json({ Error: 'regNo and needs are required.' });
            }

            const getstdId = await Student.findOne({ email: regNo })

            const newSpecialNeeds = new SpecialNeeds({
                regNo: getstdId._id,
                needs,
            });

            await newSpecialNeeds.save();

            return res.json({ Status: 'Success', Message: 'Special needs submitted successfully!' });
        } catch (err) {
            console.error('Error saving special needs:', err);
            return res.json({ Error: 'Internal server error' });
        }
    },

    studentAddEmergencyContact: async (req, res) => {
        try {
            const {
                regNo,
                firstName,
                surname,
                relationship,
                telNo,
                address,
                active
            } = req.body;

            if (!regNo) {
                return res.json({ message: 'User email (regNo) is required' });
            }

            // Check if emergency contact exists for this regNo
            const existingContact = await EmergencyContact.findOne({ regNo });

            if (existingContact) {
                // Update existing contact
                existingContact.firstName = firstName;
                existingContact.surname = surname;
                existingContact.relationship = relationship;
                existingContact.telNo = telNo;
                existingContact.address = address;
                existingContact.active = active;

                await existingContact.save();

                return res.json({
                    Status: "Success",
                    Message: 'Emergency contact updated successfully',
                });
            } else {
                // Create a new EmergencyContact document if not found
                const newContact = new EmergencyContact({
                    regNo,
                    firstName,
                    surname,
                    relationship,
                    telNo,
                    address,
                    active
                });

                await newContact.save();

                return res.json({
                    Status: "Success",
                    Message: 'Emergency contact saved successfully',
                });
            }

        } catch (err) {
            console.error('Error saving emergency contact:', err);
            return res.json({ message: 'Internal server error' });
        }
    },

    getEmergencyContact: async (req, res) => {
        try {
            const { regNo } = req.query;
            if (!regNo) {
                return res.json({ Error: 'regNo query parameter is required' });
            }

            const emergencyContact = await EmergencyContact.findOne({ regNo, active: true }).lean();

            if (!emergencyContact) {
                return res.json({ Error: 'No emergency contact found' });
            }

            res.json({ Status: 'Success', emergencyContact });
        } catch (err) {
            console.error(err);
            res.json({ Error: 'Server error' });
        }
    },

    getNeedsStudents: async (req, res) => {
        try {
            const { email } = req.params;

            if (!email) {
                return res.json({ Status: 'Fail', Error: 'Email parameter is required' });
            }

            const stdID = await Student.findOne({ email: email })

            const specialNeeds = await SpecialNeeds.find({ regNo: stdID._id });

            if (!specialNeeds) {
                return res.json({ Status: 'Fail', Error: 'No special needs found for this user' });
            }

            return res.json({ Status: 'Success', Data: specialNeeds });
        } catch (err) {
            console.error('Error fetching special needs by email:', err);
            return res.json({ Status: 'Fail', Error: 'Internal server error' });
        }
    }

};

module.exports = StudentController;