import axios from 'axios';
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Link, useNavigate } from 'react-router-dom';
;
import FileInput from '../../components/Form/FileInput';
import DefaultBtn from '../../components/Buttons/DefaultBtn';


const StdCreateSheet = () => {
    const navigate = useNavigate();
    const token = localStorage.getItem('login');

    const [sheet, setsheet] = useState({
        file: null
    });

    const [loading, setLoading] = useState(false);
    const [validation, setValidation] = useState(null);
    const [allowUploadDespiteErrors, setAllowUploadDespiteErrors] = useState(false);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setsheet((prevData) => ({
                ...prevData,
                file: file,
            }));
            // validate immediately
            validateSheetFile(file).then(res => setValidation(res)).catch(err => setValidation({ ok: false, error: String(err) }));
        }
    };

    const normalizeHeader = (h) => (h||'').toString().toLowerCase().replace(/\W/g,'');

    const validateRow = (rowObj, rowIndex) => {
        const errors = [];
        const get = key => rowObj[key] ?? '';

        if (!String(get('enrolmentno') || get('enrollmentno')).trim()) errors.push({ row: rowIndex, col: 'Enrolment No', reason: 'missing' });

        const sex = String(get('sex')).trim().toLowerCase();
        if (sex && !['m','male','f','female','rev','reverend'].includes(sex)) errors.push({ row: rowIndex, col: 'Sex', reason: `invalid value: "${get('sex')}". Accepted: M, Male, F, Female, REV, Reverend` });

        const nic = String(get('nic')).trim();
        if (nic && !/^[A-Za-z0-9]{5,}$/i.test(nic)) errors.push({ row: rowIndex, col: 'NIC', reason: 'unexpected format' });

        const d = get('dateofenrolment') || get('dateofenrollment');
        if (d) {
            const parsed = new Date(d);
            if (isNaN(parsed.getTime())) errors.push({ row: rowIndex, col: 'Date of Enrolment', reason: 'invalid date' });
        }

        const dist = get('distancekm') || get('distance');
        if (dist !== undefined && dist !== '') {
            const n = Number(dist);
            if (isNaN(n) || n < 0) errors.push({ row: rowIndex, col: 'Distance (Km)', reason: 'invalid number' });
        }

        return errors;
    };

    const validateSheetFile = async (file) => {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (!rows || rows.length === 0) return { ok: false, error: 'empty sheet' };

        const rawHeaders = rows[0].map(h => h===null||h===undefined?'':String(h));
        const headerMap = {};
        rawHeaders.forEach((h, i) => headerMap[ normalizeHeader(h) ] = i);

        const hasEnrolmentHeader = ('enrolmentno' in headerMap) || ('enrollmentno' in headerMap);
        if (!hasEnrolmentHeader) {
            return { ok: false, error: 'missing required headers', missingHeaders: ['Enrolment No'] };
        }

        const rowErrors = [];
        for (let r = 1; r < rows.length; r++) {
            const row = rows[r];
            const rowObj = {};
            for (const [norm, idx] of Object.entries(headerMap)) {
                rowObj[norm] = row[idx];
            }
            const errs = validateRow(rowObj, r+1);
            if (errs.length) rowErrors.push(...errs);
        }

        const badCols = [...new Set(rowErrors.map(e => e.col))];
        return { ok: rowErrors.length === 0, rowErrors, badCols, totalRows: rows.length-1 };
    };

    const headleUploadSheet = async () => {
        if (!sheet.file) {
            alert('Please select a file to upload.');
            return;
        }
        // ensure validation ran
        if (!validation) {
            setLoading(true);
            try {
                const resVal = await validateSheetFile(sheet.file);
                setValidation(resVal);
            } catch (err) {
                setValidation({ ok: false, error: String(err) });
            } finally {
                setLoading(false);
            }
        }

        if (validation && !validation.ok && !allowUploadDespiteErrors) {
            const proceed = window.confirm('Validation found issues in the sheet. Check message panel. Do you want to upload anyway?');
            if (!proceed) return;
        }

        const formData = new FormData();
        formData.append('file', sheet.file);

        setLoading(true);

        try {
            const res = await axios.post(
                `${import.meta.env.VITE_APP_API}/student/create-student-sheet`,
                formData,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                }
            );

            if (res.data.Status === "Success") {
                const inserted = res.data.insertedCount ?? 0;
                const duplicated = res.data.duplicateCount ?? 0;
                alert(`${res.data.Message}\n\n- Successfully imported: ${inserted} students\n- Skipped (already exist): ${duplicated} students`);
                navigate('/Dashboard/Students');
            } else {
                alert(res.data.Error || "Upload failed");
            }
        } catch (err) {
            console.error(err);
            alert("An error occurred while uploading the sheet.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 mx-auto bg-white rounded-xl shadow-md">
            <div className="-mt-4 mb-4">
                <Link to={'/Dashboard/Students'}>
                    <DefaultBtn
                        type='button'
                        label='Back'
                    />
                </Link>
            </div>
            <h1 className="font-bold text-[#6b0f14] text-xl mb-4">Upload Student Sheet</h1>
            <div className="my-8">
                <p className="uppercase text-red-500 font-bold">important</p>

                <p className="">Please be Kind to wait when you uploading Student Sheet, </p>
                <p className="">After you Click Upload Button wait until Get "Upload Complete"</p>
                <p className="">The Uploading time will depend on your size of Sheet</p>
                <p className="text-red-500 font-bold">only 2000 recodes can upload via Sheet per Day</p>
            </div>
            <FileInput
                label="Select Excel File"
                name="studentSheet"
                onChange={handleImageChange}
                accept=".xlsx,.xls"
                required
            />

            {validation && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
                    {!validation.ok && validation.error && (
                        <div className="text-sm text-red-700">Validation error: {validation.error}</div>
                    )}

                    {validation.missingHeaders && validation.missingHeaders.length > 0 && (
                        <div className="text-sm text-red-700">Missing required headers: {validation.missingHeaders.join(', ')}</div>
                    )}

                    {validation.badCols && validation.badCols.length > 0 && (
                        <div className="text-sm">Columns with invalid data: <strong>{validation.badCols.join(', ')}</strong></div>
                    )}

                    {validation.rowErrors && validation.rowErrors.length > 0 && (
                        <div className="mt-2 text-sm text-gray-700">
                            <div>Sample row errors (showing up to 10):</div>
                            <ul className="list-disc ml-5">
                                {validation.rowErrors.slice(0,10).map((e, i) => (
                                    <li key={i}>Row {e.row} — {e.col}: {e.reason}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {!validation.ok && (
                        <div className="mt-2">
                            <label className="inline-flex items-center gap-2">
                                <input type="checkbox" checked={allowUploadDespiteErrors} onChange={e => setAllowUploadDespiteErrors(e.target.checked)} />
                                <span className="text-sm">I understand the risks and want to upload anyway</span>
                            </label>
                        </div>
                    )}
                </div>
            )}

            <button
                onClick={headleUploadSheet}
                disabled={loading}
                className="mt-3 w-full px-4 py-2 bg-[#6b0f14] text-white font-semibold rounded hover:bg-[#4f0a0f] transition disabled:opacity-50"
            >
                {loading ? (
                    <span className="flex items-center justify-center">
                        <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                        </svg>
                        Uploading...
                    </span>
                ) : (
                    'Upload Sheet'
                )}
            </button>
        </div>
    );
};

export default StdCreateSheet;
