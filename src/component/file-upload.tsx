'use client';

import { Upload } from 'lucide-react';
import * as React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

const FileUploadComponent: React.FC = () => {
    const [message, setMessage] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [cleanDb, setCleanDb] = React.useState(false); // Add checkbox or toggle for this in future

    const handleUpload = () => {
        const el = document.createElement('input');
        el.setAttribute('type', 'file');
        el.setAttribute('accept', 'application/pdf');

        el.addEventListener('change', async () => {
            if (el.files && el.files.length > 0) {
                const file = el.files.item(0);
                if (file) {
                    const formData = new FormData();
                    formData.append('pdf', file);
                    formData.append('cleanDb', cleanDb.toString());

                    try {
                        const res = await fetch('/api/upload', {
                            method: 'POST',
                            body: formData,
                        });

                        const data = await res.json();

                        if (!res.ok) {
                            setError(data.message || 'An error occurred while uploading the PDF.');
                            setMessage(null);
                        } else {
                            setMessage(data.message || 'Upload successful.');
                            setError(null);
                            console.log('Server response:', data);
                        }
                    } catch (err) {
                        console.error('Fetch error:', err);
                        setError('Something went wrong while uploading.');
                        setMessage(null);
                    }
                }
            }
        });

        el.click();
    };

    return (
        <div className='flex justify-center items-center flex-col'>
            <div className="bg-slate-900 text-white shadow-2xl p-4 rounded-lg flex flex-col items-center space-y-4">
                <div onClick={handleUpload} className="cursor-pointer flex justify-center items-center flex-col space-y-2">
                    <h1>Upload PDF</h1>
                    <Upload />
                </div>
            </div>
            <div className="text-sm text-gray-300 pt-10">
                <label className="inline-flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={cleanDb}
                        onChange={() => setCleanDb(!cleanDb)}
                        className="accent-blue-500"
                    />
                    Clean previous data before upload
                </label>
            </div>
            {message && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-100 text-green-800 border border-green-300 mt-4">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>{message}</span>
                </div>
            )}

            {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-100 text-red-800 border border-red-300 mt-4">
                    <AlertTriangle className="w-5 h-5" />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
};

export default FileUploadComponent;
