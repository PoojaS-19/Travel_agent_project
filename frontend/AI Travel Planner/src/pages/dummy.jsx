// import { useState } from "react";
// import API from "../api";
// import "../App.css";

// export default function ItineraryPage() {
//   const [form, setForm] = useState({
//     destination: "",
//     days: "",
//     theme: "",
//     preferences: "",
//   });

//   const [result, setResult] = useState("");
//   const [loading, setLoading] = useState(false);

//   const submit = async () => {
//     setLoading(true);
//     try {
//       const res = await API.post("/itinerary", form);
//       setResult(res.data.itinerary);
//     } catch (error) {
//       setResult("Error generating itinerary");
//     }
//     setLoading(false);
//   };

//   return (
//     <div className="container">
//       <h2>AI Itinerary Generator</h2>

//       <input
//         placeholder="Destination"
//         onChange={(e) => setForm({ ...form, destination: e.target.value })}
//       />

//       <input
//         type="number"
//         placeholder="Days"
//         onChange={(e) => setForm({ ...form, days: e.target.value })}
//       />

//       <input
//         placeholder="Theme (Adventure, Romantic, Family, etc)"
//         onChange={(e) => setForm({ ...form, theme: e.target.value })}
//       />

//       <textarea
//         placeholder="Preferences"
//         onChange={(e) => setForm({ ...form, preferences: e.target.value })}
//       />

//       <button onClick={submit}>
//         {loading ? "Generating..." : "Generate Itinerary"}
//       </button>

//       {result && (
//         <div className="card">
//           <pre style={{ whiteSpace: "pre-wrap" }}>{result}</pre>
//         </div>
//       )}
//     </div>
//   );
// }


// import { useState, useEffect, useRef } from "react";
// import API from "../api";
// import "../App.css";

// export default function ItineraryPage() {
//   const [form, setForm] = useState({
//     destination: "",
//     days: "",
//     theme: "",
//     preferences: "",
//   });

//   const [result, setResult] = useState("");
//   const [parsed, setParsed] = useState([]); // structured itinerary
//   const [loading, setLoading] = useState(false);
//   const printRef = useRef();

//   function sanitizeAndParse(rawText) {
//   if (!rawText) return [];

//   let text = String(rawText);

//   // --------- REMOVE ALL MARKDOWN SYMBOLS ---------
//   text = text
//     .replace(/^#{1,6}\s*/gm, "")        // Remove ##, ### headings
//     .replace(/\*\*(.*?)\*\*/g, "$1")    // Remove **bold**
//     .replace(/\*(.*?)\*/g, "$1")        // Remove *italic*
//     .replace(/`+/g, "")                 // Remove backticks
//     .replace(/^-{3,}$/gm, "")           // Remove ---
//     .replace(/^\|\s*.*\s*\|$/gm, "")    // Remove table rows
//     .replace(/\|\s*[-:]+\s*\|/gm, "")   // Remove table separators
//     .replace(/^\s*[-*]\s*$/gm, "")      // Remove empty '-' or '*' bullets
//     .replace(/•\s*$/gm, "");            // Remove empty bullet lines

//   // Normalize whitespace
//   text = text.replace(/\r\n/g, "\n").replace(/\n{2,}/g, "\n\n");

//   // Split into lines
//   let lines = text
//     .split("\n")
//     .map((l) => l.trim())
//     .filter(Boolean);

//   // Convert any remaining leading "-" or "*" to bullet "•"
//   lines = lines.map((l) => {
//     if (/^[-*]\s+/.test(l)) return "• " + l.replace(/^[-*]\s+/, "");
//     return l;
//   });

//   // ---------------- PARSE INTO DAYS + SECTIONS ----------------
//   const dayHeaderRe = /^(day\s*\d+|day\s*\d+:?|day\s*\d+\b)/i;
//   const sectionRe = /^(THEME OVERVIEW|FOOD|RESTAURANTS|HOTELS|TRANSPORT|BUDGET|PHOTO SPOTS|SAFETY|MAPS|OVERVIEW)\b/i;
//   const timePattern = /^(\d{1,2}(:\d{2})?\s*(AM|PM|am|pm)?)\s*[–—-]\s*(.*)$/;

//   const blocks = [];
//   let current = { title: "OVERVIEW", entries: [] };

//   for (let line of lines) {
//     // Normalize Day headers
//     if (dayHeaderRe.test(line)) {
//       if (current.entries.length || current.title !== "OVERVIEW") blocks.push(current);
//       const title = line.toUpperCase().replace(/[:\-]+$/, "");
//       current = { title, entries: [] };
//       continue;
//     }

//     // Normalize other section headers
//     const sec = line.match(sectionRe);
//     if (sec) {
//       if (current.entries.length || current.title !== "OVERVIEW") blocks.push(current);
//       const title = sec[1].toUpperCase();
//       const rest = line.replace(sec[1], "").trim().replace(/^[:\-–—\s]+/, "");
//       current = { title, entries: [] };
//       if (rest) current.entries.push({ time: "", text: rest });
//       continue;
//     }

//     // Bullet entries
//     if (/^•\s+/.test(line)) {
//       const content = line.replace(/^•\s+/, "");
//       const m = content.match(timePattern);
//       if (m) current.entries.push({ time: m[1], text: m[4] });
//       else current.entries.push({ time: "", text: content });
//       continue;
//     }

//     // Time-based entries like "9:00 AM – Visit X"
//     const tm = line.match(timePattern);
//     if (tm) {
//       current.entries.push({ time: tm[1], text: tm[4] });
//       continue;
//     }

//     // Fallback: plain text
//     current.entries.push({ time: "", text: line });
//   }

//   if (current.entries.length || current.title !== "OVERVIEW") blocks.push(current);

//   return blocks;
// }


//   // -------------------------
//   // Sanitizer + Parser
//   // -------------------------
//   function sanitizeAndParse(rawText) {
//     if (!rawText) return [];

//     // 1) Normalize and split
//     let lines = String(rawText)
//       .replace(/\r\n/g, "\n")
//       .replace(/\t/g, " ")
//       .split("\n")
//       .map((l) => l.trim())
//       .filter(Boolean);

//     // 2) Remove table-like lines and horizontal rules
//     lines = lines.filter((l) => {
//       if (/^\|.*\|$/.test(l)) return false; // table row
//       if (/^-{3,}$/.test(l)) return false; // --- lines
//       return true;
//     });

//     // 3) Remove markdown markers & inline bold/italic markers and backticks
//     lines = lines.map((l) =>
//       l
//         .replace(/^#{1,6}\s*/g, "") // remove leading # headings
//         .replace(/\*\*(.*?)\*\*/g, "$1") // **bold**
//         .replace(/\*(.*?)\*/g, "$1") // *italic*
//         .replace(/`+/g, "") // backticks
//         .replace(/^>\s+/, "") // blockquote >
//         .replace(/^\s*-\s+/g, "• ") // convert leading '-' to bullet
//         .replace(/^\s*\*\s+/g, "• ") // convert leading '*' to bullet
//         .replace(/\|\s*?-/g, "") // remove table dashes if any
//     );

//     // 4) Normalize bullets
//     lines = lines.map((l) => {
//       if (/^[\-\u2022]\s+/.test(l)) return "• " + l.replace(/^[\-\u2022]\s+/, "");
//       return l;
//     });

//     // 5) Group into blocks
//     const dayHeaderRe = /^(day\s*\d+|day\s*\d+:?|day\s*\d+\b)/i;
//     const sectionRe = /^(FOOD|RESTAURANTS|HOTELS|TRANSPORT|BUDGET|PHOTO SPOTS|PHOTO-SPOTS|SAFETY|MAPS|TIP|TIPS)\b/i;
//     const timePattern = /^(\d{1,2}(:\d{2})?\s*(AM|PM|am|pm)?)\s*[–—-]\s*(.*)$/;

//     const resultBlocks = [];
//     let current = { title: "OVERVIEW", entries: [] };

//     for (let rawLine of lines) {
//       // Normalize Day headers
//       if (dayHeaderRe.test(rawLine)) {
//         if (current.entries.length || current.title !== "OVERVIEW") resultBlocks.push(current);
//         const title = rawLine.toUpperCase().replace(/[:\-]+$/, "").trim();
//         current = { title, entries: [] };
//         continue;
//       }

//       // Section headers like FOOD, HOTELS, etc.
//       const sec = rawLine.match(sectionRe);
//       if (sec) {
//         if (current.entries.length || current.title !== "OVERVIEW") resultBlocks.push(current);
//         const title = sec[1].toUpperCase().replace("-", " ");
//         const rest = rawLine.replace(sec[0], "").trim().replace(/^[:\-–—\s]+/, "");
//         current = { title, entries: [] };
//         if (rest) current.entries.push({ time: "", text: rest });
//         continue;
//       }

//       // Bullet lines starting with •
//       if (/^•\s+/.test(rawLine)) {
//         const content = rawLine.replace(/^•\s+/, "");
//         const m = content.match(timePattern);
//         if (m) {
//           current.entries.push({ time: m[1], text: m[4].trim() });
//         } else {
//           // maybe "Label: value" -> keep as text
//           current.entries.push({ time: "", text: content });
//         }
//         continue;
//       }

//       // Lines that start with time directly
//       const tm = rawLine.match(timePattern);
//       if (tm) {
//         current.entries.push({ time: tm[1], text: tm[4].trim() });
//         continue;
//       }

//       // If none matched, treat as plain text (likely a short note)
//       current.entries.push({ time: "", text: rawLine });
//     }

//     if (current.entries.length || current.title !== "OVERVIEW") resultBlocks.push(current);

//     return resultBlocks;
//   }

//   // parse whenever result changes
//   useEffect(() => {
//     if (!result) {
//       setParsed([]);
//       return;
//     }
//     const blocks = sanitizeAndParse(result);
//     setParsed(blocks);
//   }, [result]);

//   // -------------------------
//   // Submit / actions
//   // -------------------------
//   const submit = async () => {
//     setLoading(true);
//     setResult("");
//     setParsed([]);
//     try {
//       const res = await API.post("/itinerary", form);
//       const text = res.data.itinerary || res.data || "";
//       // quick cleanup to remove stray repeated hyphens etc
//       const cleaned = String(text).replace(/\r\n/g, "\n").replace(/\n{2,}/g, "\n\n").trim();
//       setResult(cleaned);
//     } catch (error) {
//       setResult("Error generating itinerary. Try again.");
//     }
//     setLoading(false);
//   };

//   const copyToClipboard = async () => {
//     try {
//       await navigator.clipboard.writeText(result);
//       alert("Itinerary copied to clipboard");
//     } catch {
//       alert("Copy failed — your browser may block clipboard access.");
//     }
//   };

//   const downloadText = () => {
//     const blob = new Blob([result || "No itinerary"], { type: "text/plain;charset=utf-8" });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement("a");
//     a.href = url;
//     const name = (form.destination || "itinerary").replace(/\s+/g, "_");
//     a.download = `${name}_itinerary.txt`;
//     document.body.appendChild(a);
//     a.click();
//     a.remove();
//     URL.revokeObjectURL(url);
//   };

//   const printItinerary = () => {
//     const printContents = printRef.current?.innerHTML || result;
//     const w = window.open("", "_blank", "width=800,height=600");
//     if (!w) {
//       alert("Popup blocked. Allow popups to print.");
//       return;
//     }
//     w.document.write(`
//       <html>
//         <head>
//           <title>Itinerary</title>
//           <style>
//             body { font-family: Arial, sans-serif; padding:20px; color:#0b3d91; }
//             .day { margin-bottom:18px; }
//             .time { color:#ff6f00; font-weight:700; margin-right:8px; }
//             .entry { margin:6px 0; }
//           </style>
//         </head>
//         <body>${printContents}</body>
//       </html>
//     `);
//     w.document.close();
//     w.focus();
//     w.print();
//   };

//   // -------------------------
//   // Render
//   // -------------------------
//   return (
//     <div className="container">
//       <h2>AI Itinerary Generator</h2>

//       <div style={{ display: "grid", gap: 12 }}>
//         <input
//           placeholder="Destination"
//           value={form.destination}
//           onChange={(e) => setForm({ ...form, destination: e.target.value })}
//         />

//         <div style={{ display: "flex", gap: 10 }}>
//           <input
//             type="number"
//             placeholder="Days"
//             style={{ flex: 1 }}
//             value={form.days}
//             onChange={(e) => setForm({ ...form, days: e.target.value })}
//           />
//           <input
//             placeholder="Theme (Adventure, Romantic, Family, etc)"
//             style={{ flex: 2 }}
//             value={form.theme}
//             onChange={(e) => setForm({ ...form, theme: e.target.value })}
//           />
//         </div>

//         <textarea
//           placeholder="Preferences (food, pace, budget, avoid, must-see)"
//           value={form.preferences}
//           onChange={(e) => setForm({ ...form, preferences: e.target.value })}
//         />

//         <button onClick={submit}>{loading ? "Generating..." : "Generate Itinerary"}</button>
//       </div>

//       {/* ACTION / METADATA */}
//       <div className="result-actions" style={{ marginTop: 18 }}>
//         <div className="result-meta">
//           <span className="meta-chip">📍 {form.destination || "Destination"}</span>
//           <span className="meta-chip">🗓 {form.days || "Days"}</span>
//           <span className="meta-chip">🎯 {form.theme || "Theme"}</span>
//         </div>

//         <div className="result-buttons">
//           <button className="small" onClick={copyToClipboard}>Copy</button>
//           <button className="small" onClick={downloadText}>Download</button>
//           <button className="small" onClick={printItinerary}>Print</button>
//         </div>
//       </div>

//       {/* RENDERED ITINERARY */}
//       <div className="result-panel" style={{ marginTop: 16 }}>
//         {parsed.length ? (
//           <div ref={printRef}>
//             {parsed.map((day, di) => (
//               <div className="itinerary-card" key={di}>
//                 <div className="itinerary-header">
//                   <div className="itinerary-title" style={{ fontWeight: 900 }}>
//                     {day.title}
//                   </div>
//                 </div>

//                 <div className="itinerary-timeline">
//                   {day.entries.map((e, ei) => (
//                     <div className="timeline-item" key={ei}>
//                       {e.time ? (
//                         <div className="time-badge">{e.time}</div>
//                       ) : (
//                         <div className="time-badge" style={{ minWidth: 46, textAlign: "center" }}>•</div>
//                       )}
//                       <div className="timeline-content">
//                         <div className="timeline-text">{e.text}</div>
//                       </div>
//                     </div>
//                   ))}
//                 </div>
//               </div>
//             ))}
//           </div>
//         ) : result ? (
//           // fallback: show cleaned text (no raw markdown)
//           <div className="itinerary-card" ref={printRef}>
//             <div className="itinerary-header">
//               <div className="itinerary-title">Itinerary</div>
//             </div>
//             <div className="card">
//               <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
//                 {result
//                   .replace(/^#{1,6}\s*/gm, "")
//                   .replace(/\*\*(.*?)\*\*/g, "$1")
//                   .replace(/\*(.*?)\*/g, "$1")
//                   .replace(/^\|.*\|$/gm, "")
//                 }
//               </pre>
//             </div>
//           </div>
//         ) : (
//           <div className="card" style={{ textAlign: "center", color: "#375a7f" }}>
//             Your generated itinerary will appear here.
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }
// import { useState, useEffect, useRef } from "react";
// import API from "../api";
// import "../App.css";

// export default function ItineraryPage() {
//   const [form, setForm] = useState({
//     destination: "",
//     days: "",
//     theme: "",
//     preferences: "",
//   });

//   const [result, setResult] = useState("");
//   const [parsed, setParsed] = useState([]); // structured itinerary
//   const [loading, setLoading] = useState(false);
//   const printRef = useRef();

//   // -------------------------
//   // Robust sanitizer + parser
//   // -------------------------
//   function sanitizeAndParse(rawText) {
//     if (!rawText) return [];

//     // Convert input to string and normalize newlines
//     let text = String(rawText).replace(/\r\n/g, "\n");

//     // 1) Remove markdown artifacts but KEEP numbers and time-like text
//     text = text
//       // remove headings like ##, ### but keep the rest of the line
//       .replace(/^#{1,6}\s*/gm, "")
//       // remove bold/italic markers but keep content
//       .replace(/\*\*(.*?)\*\*/g, "$1")
//       .replace(/\*(.*?)\*/g, "$1")
//       // remove backticks
//       .replace(/`+/g, "")
//       // remove horizontal rules lines
//       .replace(/^\s*-{3,}\s*$/gm, "")
//       // remove pure table rows (lines that start and end with |) and separators
//       .replace(/^\|.*\|$/gm, "")
//       .replace(/^\s*\|\s*[-:]+\s*\|\s*$/gm, "")
//       // remove lines that are a single bullet or a single star (we'll handle bullets later)
//       .replace(/^\s*[•\*\-]\s*$/gm, "");

//     // 2) Remove orphan bullets lines that have only the bullet char
//     text = text.replace(/^\s*•\s*$/gm, "");

//     // 3) Normalize some weird separators to a single en-dash for parsing
//     text = text.replace(/\s*[:–—-]\s*/g, " – ").replace(/\u2013|\u2014/g, "–");

//     // 4) Collapse multiple blank lines to one
//     text = text.replace(/\n{3,}/g, "\n\n");

//     // 5) Split lines and trim
//     let lines = text.split("\n").map((l) => l.trim());

//     // 6) Join lines where previous line was just a bullet (•) and next line contains actual content/time.
//     //    Example: "•" followed by "9:00 AM – Ratnadurga Fort (12 min)"
//     const joined = [];
//     for (let i = 0; i < lines.length; i++) {
//       const line = lines[i];
//       if ((line === "•" || /^[-*]\s*$/.test(line)) && i + 1 < lines.length) {
//         const next = lines[i + 1];
//         joined.push("• " + next);
//         i++; // skip next
//         continue;
//       }
//       if (/^[\u2022\*\-]\s*/.test(line) && !line.startsWith("• ")) {
//         joined.push("• " + line.replace(/^[\u2022\*\-]\s*/, ""));
//         continue;
//       }
//       if (line !== "") joined.push(line);
//     }
//     lines = joined;

//     // 7) Convert leading '-' or '*' list markers to bullet char '• ' (safety)
//     lines = lines.map((l) => (l.match(/^[\-\*]\s+/) ? "• " + l.replace(/^[\-\*]\s+/, "") : l));

//     // 8) Time detection regex (flexible)
//     const timeRegex = /^\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\s*[–-]\s*(.*)$/;
//     const timeRegex2 = /^\s*(\d{1,2}(?::\d{2})?)\s*[–-]\s*(.*)$/;

//     // Section & day regex
//     const dayHeaderRe = /^(day\s*\d+|day\s*\d+:?|day\s*\d+\b)/i;
//     const sectionRe = /^(OVERVIEW|THEME OVERVIEW|FOOD|RESTAURANTS|HOTELS|TRANSPORT|BUDGET|PHOTO SPOTS|PHOTO-SPOTS|SAFETY|MAPS|TIPS?)\b/i;

//     // parse into blocks
//     const blocks = [];
//     let current = { title: "OVERVIEW", entries: [] };

//     for (let rawLine of lines) {
//       if (!rawLine) continue;

//       // Day header detection
//       if (dayHeaderRe.test(rawLine)) {
//         if (current.entries.length || current.title !== "OVERVIEW") blocks.push(current);
//         current = { title: rawLine.toUpperCase().replace(/[:\s-]+$/, ""), entries: [] };
//         continue;
//       }

//       // Section header detection
//       const s = rawLine.match(sectionRe);
//       if (s) {
//         if (current.entries.length || current.title !== "OVERVIEW") blocks.push(current);
//         const title = s[1].toUpperCase().replace("-", " ");
//         const remainder = rawLine.replace(s[0], "").trim().replace(/^[:\-\–\s]+/, "");
//         current = { title, entries: [] };
//         if (remainder) current.entries.push({ time: "", text: remainder });
//         continue;
//       }

//       // Bullet lines
//       if (/^•\s+/.test(rawLine)) {
//         const content = rawLine.replace(/^•\s+/, "");
//         let m = content.match(timeRegex);
//         if (!m) m = content.match(timeRegex2);
//         if (m) current.entries.push({ time: m[1].trim(), text: m[2].trim() });
//         else current.entries.push({ time: "", text: content });
//         continue;
//       }

//       // Direct time lines
//       let m = rawLine.match(timeRegex);
//       if (!m) m = rawLine.match(timeRegex2);
//       if (m) {
//         current.entries.push({ time: m[1].trim(), text: m[2].trim() });
//         continue;
//       }

//       // Lines like "Theme: ..." or "Best Time to Visit: ..."
//       if (/^[A-Za-z ]+:\s+/.test(rawLine)) {
//         current.entries.push({ time: "", text: rawLine });
//         continue;
//       }

//       // Fallback: plain text
//       current.entries.push({ time: "", text: rawLine });
//     }

//     if (current.entries.length || current.title !== "OVERVIEW") blocks.push(current);

//     // Final normalize
//     for (const b of blocks) {
//       b.title = b.title.toUpperCase();
//       b.entries = b.entries.map((e) => ({ time: (e.time || "").trim(), text: (e.text || "").trim() }));
//     }

//     return blocks;
//   }

//   // parse whenever result changes
//   useEffect(() => {
//     if (!result) {
//       setParsed([]);
//       return;
//     }
//     const blocks = sanitizeAndParse(result);
//     setParsed(blocks);
//   }, [result]);

//   // -------------------------
//   // Submit / actions
//   // -------------------------
//   const submit = async () => {
//     setLoading(true);
//     setResult("");
//     setParsed([]);
//     try {
//       const res = await API.post("/itinerary", form);
//       const text = res.data.itinerary || res.data || "";
//       // quick cleanup to remove stray repeated hyphens etc
//       const cleaned = String(text).replace(/\r\n/g, "\n").replace(/\n{2,}/g, "\n\n").trim();
//       setResult(cleaned);
//     } catch (error) {
//       setResult("Error generating itinerary. Try again.");
//     }
//     setLoading(false);
//   };

//   const copyToClipboard = async () => {
//     try {
//       await navigator.clipboard.writeText(result);
//       alert("Itinerary copied to clipboard");
//     } catch {
//       alert("Copy failed — your browser may block clipboard access.");
//     }
//   };

//   const downloadText = () => {
//     const blob = new Blob([result || "No itinerary"], { type: "text/plain;charset=utf-8" });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement("a");
//     a.href = url;
//     const name = (form.destination || "itinerary").replace(/\s+/g, "_");
//     a.download = `${name}_itinerary.txt`;
//     document.body.appendChild(a);
//     a.click();
//     a.remove();
//     URL.revokeObjectURL(url);
//   };

//   const printItinerary = () => {
//     const printContents = printRef.current?.innerHTML || result;
//     const w = window.open("", "_blank", "width=800,height=600");
//     if (!w) {
//       alert("Popup blocked. Allow popups to print.");
//       return;
//     }
//     w.document.write(`
//       <html>
//         <head>
//           <title>Itinerary</title>
//           <style>
//             body { font-family: Arial, sans-serif; padding:20px; color:#0b3d91; }
//             .day { margin-bottom:18px; }
//             .time { color:#ff6f00; font-weight:700; margin-right:8px; }
//             .entry { margin:6px 0; }
//           </style>
//         </head>
//         <body>${printContents}</body>
//       </html>
//     `);
//     w.document.close();
//     w.focus();
//     w.print();
//   };

//   // -------------------------
//   // Render
//   // -------------------------
//   return (
//     <div className="container">
//       <h2>AI Itinerary Generator</h2>

//       <div style={{ display: "grid", gap: 12 }}>
//         <input
//           placeholder="Destination"
//           value={form.destination}
//           onChange={(e) => setForm({ ...form, destination: e.target.value })}
//         />

//         <div style={{ display: "flex", gap: 10 }}>
//           <input
//             type="number"
//             placeholder="Days"
//             style={{ flex: 1 }}
//             value={form.days}
//             onChange={(e) => setForm({ ...form, days: e.target.value })}
//           />
//           <input
//             placeholder="Theme (Adventure, Romantic, Family, etc)"
//             style={{ flex: 2 }}
//             value={form.theme}
//             onChange={(e) => setForm({ ...form, theme: e.target.value })}
//           />
//         </div>

//         <textarea
//           placeholder="Preferences (food, pace, budget, avoid, must-see)"
//           value={form.preferences}
//           onChange={(e) => setForm({ ...form, preferences: e.target.value })}
//         />

//         <button onClick={submit}>{loading ? "Generating..." : "Generate Itinerary"}</button>
//       </div>

//       {/* ACTION / METADATA */}
//       <div className="result-actions" style={{ marginTop: 18 }}>
//         <div className="result-meta">
//           <span className="meta-chip">📍 {form.destination || "Destination"}</span>
//           <span className="meta-chip">🗓 {form.days || "Days"}</span>
//           <span className="meta-chip">🎯 {form.theme || "Theme"}</span>
//         </div>

//         <div className="result-buttons">
//           <button className="small" onClick={copyToClipboard}>Copy</button>
//           <button className="small" onClick={downloadText}>Download</button>
//           <button className="small" onClick={printItinerary}>Print</button>
//         </div>
//       </div>

//       {/* RENDERED ITINERARY */}
//       <div className="result-panel" style={{ marginTop: 16 }}>
//         {parsed.length ? (
//           <div ref={printRef}>
//             {parsed.map((day, di) => (
//               <div className="itinerary-card" key={di}>
//                 <div className="itinerary-header">
//                   <div className="itinerary-title" style={{ fontWeight: 900 }}>
//                     {day.title}
//                   </div>
//                 </div>

//                 <div className="itinerary-timeline">
//                   {day.entries.map((e, ei) => (
//                     <div className="timeline-item" key={ei}>
//                       {e.time ? (
//                         <div className="time-badge">{e.time}</div>
//                       ) : (
//                         <div className="time-badge" style={{ minWidth: 46, textAlign: "center" }}>•</div>
//                       )}
//                       <div className="timeline-content">
//                         <div className="timeline-text">{e.text}</div>
//                       </div>
//                     </div>
//                   ))}
//                 </div>
//               </div>
//             ))}
//           </div>
//         ) : result ? (
//           // fallback: show cleaned text (no raw markdown)
//           <div className="itinerary-card" ref={printRef}>
//             <div className="itinerary-header">
//               <div className="itinerary-title">Itinerary</div>
//             </div>
//             <div className="card">
//               <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
//                 {result
//                   .replace(/^#{1,6}\s*/gm, "")
//                   .replace(/\*\*(.*?)\*\*/g, "$1")
//                   .replace(/\*(.*?)\*/g, "$1")
//                   .replace(/^\|.*\|$/gm, "")
//                 }
//               </pre>
//             </div>
//           </div>
//         ) : (
//           <div className="card" style={{ textAlign: "center", color: "#375a7f" }}>
//             Your generated itinerary will appear here.
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }
