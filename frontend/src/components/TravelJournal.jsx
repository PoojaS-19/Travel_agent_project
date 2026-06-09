import React, { useState, useEffect } from "react";
import axios from "axios";
import { Camera, Image as ImageIcon, MapPin, Plus, Trash2, Calendar, FileDown } from "lucide-react";
import html2pdf from "html2pdf.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export default function TravelJournal({ itineraryId }) {
    const [entries, setEntries] = useState([]);
    const [locationName, setLocationName] = useState("");
    const [note, setNote] = useState("");
    const [photo, setPhoto] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);

    useEffect(() => {
        if (itineraryId) fetchEntries();
    }, [itineraryId]);

    const fetchEntries = async () => {
        setFetching(true);
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get(`${API_BASE_URL}/api/journal/${itineraryId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEntries(res.data);
        } catch (error) {
            console.error("Error fetching journal entries:", error);
        } finally {
            setFetching(false);
        }
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setPhoto(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!note && !photo) return;

        setLoading(true);
        const formData = new FormData();
        formData.append("itinerary_id", itineraryId);
        if (locationName) formData.append("location_name", locationName);
        if (note) formData.append("note", note);
        if (photo) formData.append("photo", photo);

        try {
            const token = localStorage.getItem("token");
            await axios.post(`${API_BASE_URL}/api/journal/`, formData, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "multipart/form-data" 
                }
            });
            setLocationName("");
            setNote("");
            setPhoto(null);
            setPhotoPreview(null);
            fetchEntries();
        } catch (error) {
            console.error("Error adding journal entry:", error);
            alert("Failed to add entry. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (entryId) => {
        if (!window.confirm("Delete this memory?")) return;
        try {
            const token = localStorage.getItem("token");
            await axios.delete(`${API_BASE_URL}/api/journal/${entryId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchEntries();
        } catch (error) {
            console.error("Error deleting entry:", error);
        }
    };

    const exportToPDF = () => {
        const element = document.getElementById("journal-timeline");
        const opt = {
            margin:       10,
            filename:     `Travel_Journal_${itineraryId}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
    };

    return (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mt-8">
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-6 text-white flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Camera className="w-7 h-7" /> Travel Journal & Memories
                    </h2>
                    <p className="opacity-90 text-sm mt-1">Capture your favorite moments and export them as a PDF.</p>
                </div>
                <button 
                    onClick={exportToPDF}
                    className="flex items-center gap-2 bg-white text-orange-600 px-4 py-2 rounded-xl font-bold shadow-md hover:bg-orange-50 transition-colors"
                >
                    <FileDown className="w-5 h-5" /> Export PDF
                </button>
            </div>

            <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8">
                {/* Left Form Panel */}
                <div className="md:w-1/3">
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 sticky top-6">
                        <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
                            <Plus className="w-5 h-5 text-orange-500" /> New Memory
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Location / Spot</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                                    <input 
                                        type="text" 
                                        value={locationName}
                                        onChange={(e) => setLocationName(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-orange-500 outline-none"
                                        placeholder="E.g., Eiffel Tower"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Your Notes</label>
                                <textarea 
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-orange-500 outline-none min-h-[100px]"
                                    placeholder="Write about your experience here..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Photo</label>
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-white hover:bg-slate-50 transition-colors relative overflow-hidden">
                                    {photoPreview ? (
                                        <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            <ImageIcon className="w-8 h-8 text-slate-400 mb-2" />
                                            <p className="text-sm text-slate-500"><span className="font-semibold text-orange-500">Click to upload</span></p>
                                        </div>
                                    )}
                                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                                </label>
                            </div>

                            <button 
                                type="submit" 
                                disabled={loading || (!note && !photo)}
                                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-colors disabled:opacity-50"
                            >
                                {loading ? "Saving..." : "Add to Journal"}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Right Timeline Panel */}
                <div className="md:w-2/3">
                    {fetching ? (
                        <div className="flex justify-center py-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="text-center py-16 px-4 bg-slate-50 rounded-2xl border border-slate-200 border-dashed">
                            <Camera className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-slate-700 mb-2">No memories yet</h3>
                            <p className="text-slate-500">Start documenting your trip by adding your first note and photo!</p>
                        </div>
                    ) : (
                        <div id="journal-timeline" className="bg-white p-4">
                            <h2 className="text-3xl font-black text-slate-800 mb-8 border-b pb-4">Trip Journal</h2>
                            <div className="relative border-l-4 border-orange-200 ml-4 pl-8 space-y-10">
                                {entries.map((entry) => (
                                    <div key={entry.id} className="relative">
                                        <div className="absolute -left-[42px] top-1 bg-orange-500 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-4 border-white">
                                            <MapPin className="w-4 h-4" />
                                        </div>
                                        <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden group">
                                            <div className="p-5 flex justify-between items-start border-b border-slate-100 bg-slate-50/50">
                                                <div>
                                                    {entry.location_name && <h4 className="font-bold text-lg text-slate-800">{entry.location_name}</h4>}
                                                    <div className="flex items-center gap-1 text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider">
                                                        <Calendar className="w-3 h-3" />
                                                        {new Date(entry.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => handleDelete(entry.id)}
                                                    className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                            
                                            {entry.photo_url && (
                                                <div className="w-full max-h-96 overflow-hidden bg-black flex items-center justify-center">
                                                    <img 
                                                        src={entry.photo_url.startsWith('http') ? entry.photo_url : `${API_BASE_URL}${entry.photo_url}`} 
                                                        alt="Journal memory" 
                                                        className="w-full h-auto object-cover max-h-96"
                                                    />
                                                </div>
                                            )}
                                            
                                            {entry.note && (
                                                <div className="p-5">
                                                    <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{entry.note}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
