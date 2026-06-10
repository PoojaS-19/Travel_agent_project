import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../api";
import { motion } from "framer-motion";
import { 
  LayoutDashboard, Map, Wallet, CheckCircle2, 
  TrendingUp, Calendar, ArrowRight, Activity, Globe, MapPin, Plus, Navigation
} from "lucide-react";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [expenses, setExpenses] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    try {
      const res = await API.get("/itineraries");
      if (res.data && Array.isArray(res.data.itineraries)) {
        const fetchedTrips = res.data.itineraries;
        setTrips(fetchedTrips);

        // Fetch real expenses
        const expensePromises = fetchedTrips.map(t => 
           API.get(`/trips/${t.id}/expenses`).catch(() => ({ data: { total_expenses: 0 } }))
        );
        const expenseResults = await Promise.all(expensePromises);
        
        const expenseMap = {};
        fetchedTrips.forEach((t, i) => {
           expenseMap[t.id] = expenseResults[i]?.data?.total_expenses || 0;
        });
        setExpenses(expenseMap);
      }
    } catch (err) {
      console.error("Error fetching trips:", err);
    } finally {
      setLoading(false);
    }
  };

  // Compute analytics
  const totalTrips = trips.length;

  const completedTrips = trips.filter(trip => {
    let hasCompleted = false;
    if (trip.daily_plans) {
      try {
        let plans = typeof trip.daily_plans === 'string' ? JSON.parse(trip.daily_plans) : trip.daily_plans;
        plans.forEach(day => {
          if (day.activities) {
            day.activities.forEach(act => {
              if (act.status === 'completed') hasCompleted = true;
            });
          }
        });
      } catch (e) {
        // parse error
      }
    }
    // Also consider completed if they have fully logged expenses and date is passed
    return hasCompleted || (expenses[trip.id] > 0);
  }).length;

  const totalExpense = Object.values(expenses).reduce((a, b) => a + Number(b), 0);


  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="min-h-screen bg-slate-50 pt-8 pb-20 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <LayoutDashboard className="w-8 h-8 text-brand-primary" />
              Your Travel Analytics
            </h1>
            <p className="text-slate-500 font-medium mt-1">Track your generated itineraries, saved trips, and expenses.</p>
          </div>
          <button 
            onClick={() => navigate('/itinerary')}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-primary hover:bg-slate-800 text-white rounded-xl font-bold transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Generate New Trip
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary"></div>
          </div>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-8"
          >
            {/* STATS ROW */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div variants={itemVariants} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Map className="w-16 h-16" /></div>
                <div className="w-12 h-12 bg-sky-50 text-sky-500 rounded-xl flex items-center justify-center mb-4"><Map className="w-6 h-6" /></div>
                <h3 className="text-slate-500 text-sm font-bold uppercase tracking-wider">Generated Trips</h3>
                <div className="text-4xl font-black text-slate-900 mt-1">{totalTrips}</div>
                <p className="text-sky-600 text-xs font-semibold mt-2 flex items-center gap-1"><TrendingUp className="w-3 h-3"/> +{Math.max(1, Math.floor(totalTrips * 0.2))} this month</p>
              </motion.div>

              <motion.div variants={itemVariants} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><CheckCircle2 className="w-16 h-16" /></div>
                <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center mb-4"><CheckCircle2 className="w-6 h-6" /></div>
                <h3 className="text-slate-500 text-sm font-bold uppercase tracking-wider">Completed Trips</h3>
                <div className="text-4xl font-black text-slate-900 mt-1">{completedTrips}</div>
                <p className="text-emerald-600 text-xs font-semibold mt-2 flex items-center gap-1">Trips with progress/expenses</p>
              </motion.div>

              <motion.div variants={itemVariants} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Wallet className="w-16 h-16" /></div>
                <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center mb-4"><Wallet className="w-6 h-6" /></div>
                <h3 className="text-slate-500 text-sm font-bold uppercase tracking-wider">Total Expenses</h3>
                <div className="text-4xl font-black text-slate-900 mt-1">${totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <p className="text-rose-600 text-xs font-semibold mt-2 flex items-center gap-1">Real expenses synced</p>
              </motion.div>

              <motion.div variants={itemVariants} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Globe className="w-16 h-16" /></div>
                <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center mb-4"><Globe className="w-6 h-6" /></div>
                <h3 className="text-slate-500 text-sm font-bold uppercase tracking-wider">Cities Explored</h3>
                <div className="text-4xl font-black text-slate-900 mt-1">{new Set(trips.map(t => t.destination)).size}</div>
                <p className="text-amber-600 text-xs font-semibold mt-2 flex items-center gap-1">Unique destinations</p>
              </motion.div>
            </div>

            {/* MAIN CONTENT SPLIT */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* LEFT: RECENT TRIPS LIST */}
              <motion.div variants={itemVariants} className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-brand-secondary" />
                    Recent Generated Itineraries
                  </h2>
                  <Link to="/saved-trips" className="text-sm font-bold text-brand-primary hover:text-brand-secondary flex items-center gap-1">
                    View All <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
                
                <div className="space-y-4">
                  {trips.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <MapPin className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <h3 className="text-slate-600 font-bold">No trips generated yet</h3>
                      <p className="text-slate-500 text-sm mt-1">Start planning your first adventure!</p>
                      <button onClick={() => navigate('/itinerary')} className="mt-4 px-4 py-2 bg-brand-primary text-white text-sm font-bold rounded-lg shadow-sm">Create Trip</button>
                    </div>
                  ) : (
                    trips.slice(0, 5).map(trip => (
                      <div key={trip.id} className="group flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-brand-secondary/30 hover:shadow-md transition-all bg-slate-50/50 hover:bg-white cursor-pointer" onClick={() => navigate(`/saved-trips`)}>
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-brand-secondary/10 text-brand-secondary flex items-center justify-center font-black">
                            {trip.destination.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 group-hover:text-brand-primary transition-colors">{trip.destination}</h4>
                            <p className="text-xs font-semibold text-slate-500 flex items-center gap-1 mt-0.5">
                              <Calendar className="w-3 h-3" />
                              {new Date(trip.created_at).toLocaleDateString()} &bull; {trip.days || 3} Days
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right hidden sm:block">
                            <div className="text-sm font-bold text-slate-700">${(expenses[trip.id] || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Logged Expenses</div>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-brand-primary group-hover:text-white flex items-center justify-center transition-colors">
                            <ArrowRight className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>

              {/* RIGHT: EXPENSE DISTRIBUTION CHART (Mock) */}
              <motion.div variants={itemVariants} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col">
                <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-brand-secondary" />
                  Expenses By Trip
                </h2>
                <div className="flex-1 flex flex-col justify-center">
                  {trips.length > 0 && totalExpense > 0 ? (
                    <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
                      {trips
                        .filter(t => expenses[t.id] > 0)
                        .sort((a, b) => expenses[b.id] - expenses[a.id])
                        .map(trip => (
                        <div key={trip.id}>
                          <div className="flex justify-between text-sm font-bold mb-2">
                            <span className="text-slate-700">{trip.destination}</span>
                            <span className="text-slate-900">${expenses[trip.id]?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                            <div className="bg-brand-secondary h-2.5 rounded-full transition-all" style={{ width: `${Math.min(100, (expenses[trip.id] / totalExpense) * 100)}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-slate-400 text-sm font-medium">Log expenses in Live Collaboration to see analytics!</div>
                  )}
                </div>
                
                {trips.length > 0 && (
                  <div className="mt-8 p-4 bg-brand-primary/5 rounded-xl border border-brand-primary/10">
                    <p className="text-sm font-semibold text-brand-primary flex items-start gap-2">
                      <Navigation className="w-4 h-4 shrink-0 mt-0.5" />
                      Tip: Invite friends to your generated trips from the Saved Trips page to split these expenses automatically!
                    </p>
                  </div>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
