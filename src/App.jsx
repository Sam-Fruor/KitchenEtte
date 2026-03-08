import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient'; 
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Utensils, Clock, CheckCircle, Store, ShieldCheck, LogOut, Info, Bike, ToggleLeft, ToggleRight, Trash2, LayoutDashboard, IndianRupee, AlertCircle, PenTool, Package, Send, Eraser, Timer, X, Power, Truck, MapPin, MessageCircle, Edit2, Save, XCircle, PlusCircle, Menu } from 'lucide-react';

const LiveTimer = ({ targetTime }) => {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    if (!targetTime) return;
    const interval = setInterval(() => {
      const validTime = targetTime.includes('T') && !targetTime.endsWith('Z') ? targetTime + 'Z' : targetTime;
      const distance = new Date(validTime).getTime() - new Date().getTime();
      if (distance < 0) setTimeLeft('LATE (00:00)');
      else setTimeLeft(`${Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))}m ${Math.floor((distance % (1000 * 60)) / 1000)}s`);
    }, 1000);
    return () => clearInterval(interval);
  }, [targetTime]);
  if (!targetTime) return null;
  return <div className={`flex items-center gap-1 font-mono font-black px-2 py-1 rounded-md text-sm shadow-sm ${timeLeft.includes('LATE') ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-yellow-100 text-yellow-800'}`}><Timer size={14} /> {timeLeft}</div>;
};

// ==========================================
// 1. THE CUSTOMER APP 
// ==========================================
function CustomerApp() {
  const [staticMenu, setStaticMenu] = useState([]);
  const [dailyBoard, setDailyBoard] = useState([]);
  const [settings, setSettings] = useState({ is_open: true, delivery_active: true, takeaway_active: true, dine_in_active: true });
  const [loading, setLoading] = useState(true);

  const [cart, setCart] = useState([]);
  const [orderStatus, setOrderStatus] = useState(null);
  const [lastOrderDetails, setLastOrderDetails] = useState(null); 
  
  const [orderType, setOrderType] = useState('Delivery');
  const [formData, setFormData] = useState({ name: '', phone_number: '', pg_address: '', payment_reference: '' });

  const [historyPhone, setHistoryPhone] = useState('');
  const [orderHistory, setOrderHistory] = useState(null);
  const [historyError, setHistoryError] = useState('');

  const [thaliModalConfig, setThaliModalConfig] = useState(null);
  const [thaliSelections, setThaliSelections] = useState([]);

  const RESTAURANT_WHATSAPP_NUMBER = "919999999999"; 

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [menuRes, dailyRes, settingsRes] = await Promise.all([
          supabase.from('static_menu').select('*').order('category'),
          supabase.from('daily_board').select('*'),
          supabase.from('store_settings').select('*').eq('id', 1).single()
        ]);

        if (menuRes.data) setStaticMenu(menuRes.data);
        if (dailyRes.data) setDailyBoard(dailyRes.data);
        if (settingsRes.data) {
          const s = settingsRes.data;
          setSettings(s);
          if (!s.delivery_active && s.takeaway_active) setOrderType('Takeaway');
          else if (!s.delivery_active && !s.takeaway_active && s.dine_in_active) setOrderType('Dine-in');
        }
      } catch (error) { console.error("Data fetch error", error); }
      setLoading(false);
    };
    fetchInitialData();

    const settingsSub = supabase.channel('public:store_settings')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'store_settings' }, payload => {
        const s = payload.new;
        setSettings(s);
        setOrderType(prev => {
          if (!s.delivery_active && prev === 'Delivery') return s.takeaway_active ? 'Takeaway' : 'Dine-in';
          if (!s.takeaway_active && prev === 'Takeaway') return s.delivery_active ? 'Delivery' : 'Dine-in';
          if (!s.dine_in_active && prev === 'Dine-in') return s.delivery_active ? 'Delivery' : 'Takeaway';
          return prev;
        });
      }).subscribe();

    const staticMenuSub = supabase.channel('public:static_menu')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'static_menu' }, () => {
        supabase.from('static_menu').select('*').order('category').then(res => { if(res.data) setStaticMenu(res.data) });
      }).subscribe();

    const dailyBoardSub = supabase.channel('public:daily_board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_board' }, () => {
        supabase.from('daily_board').select('*').then(res => { if(res.data) setDailyBoard(res.data) });
      }).subscribe();

    return () => {
      supabase.removeChannel(settingsSub);
      supabase.removeChannel(staticMenuSub);
      supabase.removeChannel(dailyBoardSub);
    };
  }, []);

  const calculatePackingCharge = (category) => {
    if (category.includes('Thali') || category === 'Daily Whiteboard') return 10;
    if (category === 'Extras' && ['Roti', 'Tawa Roti', 'Amul Butter'].includes(category)) return 0;
    return 5;
  };

  const addToCart = (item, type, price, category) => {
    setOrderStatus(null);
    setLastOrderDetails(null);

    const itemName = `${item} (${type})`;
    const existingIndex = cart.findIndex(c => c.item === itemName);

    if (existingIndex !== -1) {
      const updatedCart = [...cart];
      updatedCart[existingIndex].qty += 1;
      setCart(updatedCart);
    } else {
      setCart([...cart, { item: itemName, qty: 1, price: price, packing: calculatePackingCharge(category), category: category }]);
    }
  };

  const removeFromCart = (indexToRemove) => setCart(cart.filter((_, index) => index !== indexToRemove));
  
  const increaseQty = (index) => {
    const newCart = [...cart];
    newCart[index].qty += 1;
    setCart(newCart);
  };

  const decreaseQty = (index) => {
    const newCart = [...cart];
    if (newCart[index].qty > 1) {
      newCart[index].qty -= 1;
      setCart(newCart);
    } else {
      removeFromCart(index);
    }
  };

  const handleThaliClick = (item) => {
    let max = 0; let type = '';
    if (item.item_name.includes('MINI SPECIAL')) { max = 2; type = 'Special Option'; }
    else if (item.item_name.includes('SPECIAL')) { max = 3; type = 'Special Option'; }
    else if (item.item_name.includes('MINI NORMAL')) { max = 2; type = 'Normal Option'; }
    else if (item.item_name.includes('NORMAL')) { max = 3; type = 'Normal Option'; }
    else { addToCart(item.item_name, 'Full', item.price_full, item.category); return; }

    setThaliModalConfig({ item, max, type }); setThaliSelections([]);
  };

  const toggleThaliSelection = (dishName) => {
    if (thaliSelections.includes(dishName)) setThaliSelections(thaliSelections.filter(d => d !== dishName));
    else if (thaliSelections.length < thaliModalConfig.max) setThaliSelections([...thaliSelections, dishName]);
  };

  const confirmThaliSelection = () => {
    const finalItemName = `${thaliModalConfig.item.item_name.split('(')[0].trim()} (${thaliSelections.join(', ')})`;
    addToCart(finalItemName, 'Full', thaliModalConfig.item.price_full, thaliModalConfig.item.category);
    setThaliModalConfig(null);
  };

  const itemSubtotal = cart.reduce((sum, c) => sum + (c.price * c.qty), 0);
  const totalPacking = orderType === 'Dine-in' ? 0 : cart.reduce((sum, c) => sum + (c.packing * c.qty), 0);
  const deliveryFee = (orderType === 'Delivery' && itemSubtotal < 150) ? 20 : 0;
  const grandTotal = itemSubtotal + totalPacking + (cart.length > 0 ? deliveryFee : 0);

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (cart.length === 0 || !settings.is_open) return;

    if (!/^\d{10}$/.test(formData.phone_number)) return alert("Please enter a valid 10-digit mobile number.");
    
    const lastOrder = localStorage.getItem('lastOrderTime');
    if (lastOrder && Date.now() - parseInt(lastOrder) < 60000) return alert("⏳ Please wait a minute before placing another order.");
    
    try {
      const { data: store } = await supabase.from('store_settings').select('*').eq('id', 1).single();
      if (!store.is_open) return alert("The restaurant just closed. Cannot accept orders.");

      let { data: user } = await supabase.from('users').select('*').eq('phone_number', formData.phone_number).single();
      if (!user) {
        const { data: newUser } = await supabase.from('users').insert([{ phone_number: formData.phone_number, name: formData.name, pg_address: formData.pg_address || '' }]).select().single();
        user = newUser;
      } else {
        await supabase.from('users').update({ name: formData.name, pg_address: formData.pg_address || user.pg_address }).eq('id', user.id);
      }

      const { data: orderData, error: orderError } = await supabase.from('orders').insert([{
        user_id: user.id, order_details: cart, total_amount: grandTotal, payment_reference: formData.payment_reference, status: 'Preparing', order_type: orderType
      }]).select().single();

      if (orderError) throw orderError;
      
      localStorage.setItem('lastOrderTime', Date.now().toString());
      setLastOrderDetails({ id: orderData.id, cart: [...cart], grandTotal, orderType, name: formData.name, location: formData.pg_address || "Pickup" });
      setOrderStatus(`✅ Order #${orderData.id} Placed! Waiting for kitchen approval...`);
      setCart([]); setFormData({ name: '', phone_number: '', pg_address: '', payment_reference: '' });

    } catch (error) { alert("Failed to place order: " + error.message); }
  };

  const fetchHistory = async (e) => {
    e.preventDefault();
    setHistoryError('');
    try {
      const { data: user } = await supabase.from('users').select('id, name, phone_number').eq('phone_number', historyPhone).single();
      if (!user) return setHistoryError("No account found with this number.");
      const { data: orders } = await supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      setOrderHistory({ customer_name: user.name, phone_number: user.phone_number, orders: orders });
    } catch (error) { setHistoryError("Could not fetch history"); }
  };

  const getWhatsAppLink = () => {
    if (!lastOrderDetails) return "#";
    const itemsList = lastOrderDetails.cart.map(c => `▪️ ${c.qty}x ${c.item}`).join('%0A');
    const msg = `🛎️ *New Order: #${lastOrderDetails.id}* 🛎️%0A%0A*Name:* ${lastOrderDetails.name}%0A*Type:* ${lastOrderDetails.orderType}%0A*Location:* ${lastOrderDetails.location}%0A%0A*Items:*%0A${itemsList}%0A%0A💰 *Total Paid:* ₹${lastOrderDetails.grandTotal}%0A%0APlease confirm my order!`;
    return `https://wa.me/${RESTAURANT_WHATSAPP_NUMBER}?text=${msg}`;
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Utensils className="animate-spin text-orange-500" /></div>;

  const groupedMenu = staticMenu.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item); return acc;
  }, {});

  let categoryKeys = Object.keys(groupedMenu);
  if (categoryKeys.includes('Thali Combo')) {
    categoryKeys = categoryKeys.filter(k => k !== 'Thali Combo');
    categoryKeys.unshift('Thali Combo');
  }

  const removeDuplicates = (items) => items.filter((item, index, self) => index === self.findIndex((t) => t.item_name.trim().toLowerCase() === item.item_name.trim().toLowerCase()));
  const standaloneWhiteboard = dailyBoard.filter(d => d.category === 'Daily Whiteboard');
  const specialThaliDishes = removeDuplicates(dailyBoard.filter(d => (d.category === 'Special Option' || d.category === 'Common Option') && d.is_available));
  const normalThaliDishes = removeDuplicates(dailyBoard.filter(d => (d.category === 'Normal Option' || d.category === 'Common Option') && d.is_available));
  const availableThaliDishes = thaliModalConfig ? removeDuplicates(dailyBoard.filter(d => (d.category === thaliModalConfig.type || d.category === 'Common Option') && d.is_available)) : [];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans pb-20 relative">

      {!settings.is_open && (
        <div className="bg-red-600 text-white text-center py-3 font-black text-sm md:text-lg shadow-md sticky top-0 z-[100] flex justify-center items-center gap-2">
          <AlertCircle size={18} /> WE ARE CURRENTLY CLOSED. NOT ACCEPTING ORDERS.
        </div>
      )}

      {thaliModalConfig && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-bounce-in">
            <div className="bg-orange-600 p-4 text-white flex justify-between items-center">
              <div><h3 className="font-black text-xl">Customize Your Thali</h3><p className="text-orange-200 text-sm">Select {thaliModalConfig.max} dishes from today's menu.</p></div>
              <button onClick={() => setThaliModalConfig(null)} className="text-white hover:text-orange-200"><X size={24} /></button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {availableThaliDishes.length === 0 ? (<p className="text-gray-500 text-center py-6 italic">No dishes have been updated on the whiteboard today yet!</p>) : (
                <div className="space-y-3">
                  {availableThaliDishes.map(dish => (
                    <label key={dish.id} className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-all ${thaliSelections.includes(dish.item_name) ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:bg-gray-50'} ${thaliSelections.length >= thaliModalConfig.max && !thaliSelections.includes(dish.item_name) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <div><span className="font-bold text-gray-900 block text-sm md:text-base">{dish.item_name}</span>{dish.description && <span className="text-xs text-gray-500">{dish.description}</span>}</div>
                      <input type="checkbox" className="w-5 h-5 accent-orange-600 shrink-0 ml-2" checked={thaliSelections.includes(dish.item_name)} onChange={() => toggleThaliSelection(dish.item_name)} disabled={thaliSelections.length >= thaliModalConfig.max && !thaliSelections.includes(dish.item_name)} />
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-gray-50">
              <button onClick={confirmThaliSelection} disabled={thaliSelections.length !== thaliModalConfig.max} className={`w-full py-4 rounded-xl font-black text-base md:text-lg shadow-lg transition-all ${thaliSelections.length === thaliModalConfig.max ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>
                {thaliSelections.length === thaliModalConfig.max ? `Add to Order (₹${thaliModalConfig.item.price_full})` : `Select ${thaliModalConfig.max - thaliSelections.length} more dish(es)`}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="w-full px-4 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-orange-600"><Store size={28} className="md:w-8 md:h-8" /><h1 className="text-xl md:text-2xl font-black tracking-tight">La Kitchen Ette</h1></div>
          <a href="#track-section" className="flex items-center gap-2 bg-orange-50 text-orange-700 hover:bg-orange-100 px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-bold"><Clock size={16} /> <span className="hidden sm:inline">Track Order</span><span className="sm:hidden">Track</span></a>
        </div>
      </header>

      <div className="w-full px-4 lg:px-8 mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* LEFT: MENU */}
        <div className="lg:col-span-8 space-y-8">

          {(standaloneWhiteboard.length > 0 || specialThaliDishes.length > 0 || normalThaliDishes.length > 0) && (
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-5 md:p-6 rounded-2xl shadow-lg border border-gray-700 text-white">

              {standaloneWhiteboard.length > 0 && (
                <>
                  <h2 className="text-xl md:text-2xl font-black mb-4 flex items-center gap-2">✍️ Today's Board</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {standaloneWhiteboard.map(item => (
                      <div key={item.id} className={`bg-white/10 p-4 rounded-xl border border-white/20 backdrop-blur-sm transition-all ${!item.is_available ? 'opacity-50 grayscale' : ''}`}>
                        <h3 className={`text-base md:text-lg font-bold ${!item.is_available ? 'text-gray-400 line-through' : 'text-orange-400'}`}>{item.item_name}</h3>
                        <p className="text-xs md:text-sm text-gray-300 mb-3">{item.description}</p>
                        <div className="flex justify-between items-center">
                          {item.price > 0 && <span className="text-lg md:text-xl font-black">₹{item.price}</span>}
                          {item.price > 0 && (item.is_available ? <button onClick={() => addToCart(item.item_name, 'Daily', item.price, 'Daily Whiteboard')} className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-bold">Add</button> : <span className="bg-red-500/20 text-red-200 px-3 py-1.5 rounded-lg text-xs md:text-sm font-bold border border-red-500/30">Sold Out</span>)}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {(specialThaliDishes.length > 0 || normalThaliDishes.length > 0) && (
                <div className="bg-white/5 rounded-xl border border-white/10 p-4 md:p-5">
                  <h3 className="text-orange-400 font-bold mb-4 border-b border-white/10 pb-2 flex items-center gap-2 text-sm md:text-base"><Utensils size={18} /> Today's Thali Dishes</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {specialThaliDishes.length > 0 && (
                      <div>
                        <h4 className="font-bold text-gray-200 text-xs md:text-sm uppercase tracking-wider mb-2">Special Thali Choices</h4>
                        <ul className="text-gray-400 text-xs md:text-sm space-y-1">
                          {specialThaliDishes.map(d => <li key={d.id} className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-orange-500"></div>{d.item_name}</li>)}
                        </ul>
                      </div>
                    )}
                    {normalThaliDishes.length > 0 && (
                      <div>
                        <h4 className="font-bold text-gray-200 text-xs md:text-sm uppercase tracking-wider mb-2">Normal Thali Choices</h4>
                        <ul className="text-gray-400 text-xs md:text-sm space-y-1">
                          {normalThaliDishes.map(d => <li key={d.id} className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-orange-500"></div>{d.item_name}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {categoryKeys.map(category => (
            <div key={category} className="space-y-4">
              <h2 className="text-lg md:text-xl font-bold text-gray-800 border-b pb-2">{category}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {groupedMenu[category].map((item) => (
                  <div key={item.id} className={`bg-white p-4 md:p-5 rounded-2xl border flex flex-col justify-between transition-all ${item.is_available ? 'shadow-sm border-gray-100 hover:shadow-md' : 'opacity-60 bg-gray-50 border-gray-200'}`}>
                    <div className="mb-4">
                      <h3 className={`text-base md:text-lg font-bold ${item.is_available ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{item.item_name}</h3>
                      {!item.is_available && <span className="text-xs text-red-500 font-bold mt-1 block">Currently Unavailable</span>}
                    </div>
                    <div className="flex gap-2 justify-end mt-auto">
                      {item.is_available ? (
                        <>
                          {item.price_half && <button onClick={() => addToCart(item.item_name, 'Half', item.price_half, category)} className="flex-1 bg-orange-50 text-orange-600 hover:bg-orange-100 px-2 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-bold border border-orange-200">Half ₹{item.price_half}</button>}
                          <button onClick={() => handleThaliClick(item)} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-2 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-bold shadow-sm">Add ₹{item.price_full}</button>
                        </>
                      ) : (
                        <button disabled className="w-full bg-gray-200 text-gray-500 px-4 py-2 rounded-lg text-xs md:text-sm font-bold cursor-not-allowed border border-gray-300">Out of Stock</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* RIGHT: TRACK & CART */}
        <div className="lg:col-span-4 space-y-6">

          <div id="track-section" className="bg-orange-50 p-5 md:p-6 rounded-2xl border border-orange-100 scroll-mt-32">
            <h2 className="text-base md:text-lg font-bold text-orange-900 mb-3 flex items-center gap-2"><Clock size={20} /> Track Orders</h2>
            <form onSubmit={fetchHistory} className="flex gap-2">
              <input type="tel" placeholder="Mobile No." required onChange={e => setHistoryPhone(e.target.value)} className="flex-1 p-2.5 md:p-3 rounded-xl border border-orange-200 outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 bg-white text-sm md:text-base" />
              <button type="submit" className="bg-orange-800 text-white font-bold px-4 rounded-xl hover:bg-orange-900 text-sm md:text-base">Track</button>
            </form>
            {historyError && <p className="text-red-500 text-xs md:text-sm mt-2">{historyError}</p>}
            {orderHistory && (
              <div className="mt-4 space-y-3 max-h-60 overflow-y-auto">
                <h3 className="font-bold text-orange-900 text-xs md:text-sm">Welcome, {orderHistory.customer_name}! ({orderHistory.phone_number})</h3>
                {orderHistory.orders.map(o => (
                  <div key={o.id} className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-orange-100">
                    <div className="flex justify-between items-start mb-2">
                      <div><span className="font-black text-gray-800 block text-sm">Order #{o.id}</span><span className="text-[10px] md:text-xs text-gray-500 font-bold">{o.order_type}</span></div>
                      {(o.status === 'Preparing' || o.status === 'Packed') && o.estimated_completion_time ? <LiveTimer targetTime={o.estimated_completion_time} /> : <span className={`text-[10px] md:text-xs font-black px-2 py-1 rounded-full ${o.payment_status === 'Verified' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{o.payment_status}</span>}
                    </div>
                    <div className="flex justify-between items-end mt-2 pt-2 border-t border-gray-100"><p className="text-xs md:text-sm font-medium text-gray-500">Status: <span className={`font-black ${o.status === 'Delivered' ? 'text-green-600' : 'text-orange-600'}`}>{o.status}</span></p><p className="font-black text-sm md:text-base text-gray-900">₹{o.total_amount}</p></div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div id="cart-section" className="bg-white p-5 md:p-6 rounded-2xl shadow-xl border border-gray-100 lg:sticky lg:top-32 opacity-100 transition-opacity">
            <h2 className="text-lg md:text-xl font-bold flex items-center gap-2 mb-4"><ShoppingBag /> Your Order</h2>

            {orderStatus && (
              <div className="mb-6 bg-green-50 border border-green-200 text-green-800 p-4 rounded-xl font-bold text-center animate-pulse text-sm md:text-base">
                {orderStatus}
                {lastOrderDetails && (
                  <a href={getWhatsAppLink()} target="_blank" rel="noreferrer" className="mt-3 w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-colors text-xs md:text-sm">
                    Send to WhatsApp
                  </a>
                )}
              </div>
            )}

            <div className="flex gap-2 bg-gray-100 p-1.5 rounded-xl mb-2">
              <button disabled={!settings.delivery_active} onClick={() => setOrderType('Delivery')} className={`flex-1 py-2 text-xs md:text-sm font-bold rounded-lg transition-all ${!settings.delivery_active ? 'opacity-50 text-gray-400 cursor-not-allowed line-through' : orderType === 'Delivery' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>Delivery</button>
              <button disabled={!settings.takeaway_active} onClick={() => setOrderType('Takeaway')} className={`flex-1 py-2 text-xs md:text-sm font-bold rounded-lg transition-all ${!settings.takeaway_active ? 'opacity-50 text-gray-400 cursor-not-allowed line-through' : orderType === 'Takeaway' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>Takeaway</button>
              <button disabled={!settings.dine_in_active} onClick={() => setOrderType('Dine-in')} className={`flex-1 py-2 text-xs md:text-sm font-bold rounded-lg transition-all ${!settings.dine_in_active ? 'opacity-50 text-gray-400 cursor-not-allowed line-through' : orderType === 'Dine-in' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>Dine-in</button>
            </div>

            {(!settings.delivery_active || !settings.takeaway_active || !settings.dine_in_active) && (
              <p className="text-[10px] md:text-[11px] text-orange-600 font-bold text-center mb-4 bg-orange-50 py-1 rounded px-2">
                Some services are paused right now. We will be back soon!
              </p>
            )}

            {cart.length === 0 ? <p className="text-gray-400 text-center py-4 text-sm">Add some delicious food!</p> : (
              <div>
                <div className="max-h-48 overflow-y-auto pr-2 space-y-3 mb-4">
                  {cart.map((c, index) => (
                    <div key={index} className="flex justify-between items-center py-3 border-b">
                      <div className="flex-1 pr-2">
                        <p className="font-semibold text-sm md:text-base leading-tight">{c.item}</p>
                        <p className="text-xs md:text-sm text-gray-500">₹{c.price} each</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => decreaseQty(index)} className="w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded bg-gray-200 hover:bg-gray-300 text-sm">-</button>
                        <span className="font-bold text-sm">{c.qty}</span>
                        <button onClick={() => increaseQty(index)} className="w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded bg-orange-500 text-white hover:bg-orange-600 text-sm">+</button>
                      </div>
                      <div className="w-14 md:w-16 text-right font-bold text-sm md:text-base">₹{c.price * c.qty}</div>
                      <button onClick={() => removeFromCart(index)} className="ml-1 md:ml-2 text-red-500 p-1"><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>

                <div className="bg-gray-50 p-4 rounded-xl space-y-2 text-xs md:text-sm text-gray-600 mb-6 border border-gray-100">
                  <div className="flex justify-between"><span>Item Total</span><span className="font-bold">₹{itemSubtotal}</span></div>
                  {orderType !== 'Dine-in' && <div className="flex justify-between"><span>Packing Charges</span><span className="font-bold">₹{totalPacking}</span></div>}
                  {orderType === 'Delivery' && <div className="flex justify-between"><span>Delivery Fee</span>{deliveryFee === 0 ? <span className="text-green-600 font-bold">FREE</span> : <span className="font-bold">₹20</span>}</div>}
                  <div className="flex justify-between border-t border-gray-300 pt-2 mt-2 text-base md:text-lg font-black text-gray-900"><span>Grand Total</span><span>₹{grandTotal}</span></div>
                </div>

                {settings.is_open && (
                  <form onSubmit={handleCheckout} className="space-y-3">
                    <input type="text" placeholder="Full Name" required onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full bg-white border border-gray-300 p-2.5 md:p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 text-sm md:text-base" />
                    <input type="tel" maxLength={10} minLength={10} placeholder="Mobile Number (10 Digits)" required onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })} className="w-full bg-white border border-gray-300 p-2.5 md:p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 text-sm md:text-base" />
                    {orderType === 'Delivery' && <textarea placeholder="PG Name & Room Number" required onChange={(e) => setFormData({ ...formData, pg_address: e.target.value })} className="w-full bg-white border border-gray-300 p-2.5 md:p-3 rounded-xl h-20 outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 text-sm md:text-base" />}
                    {orderType === 'Dine-in' && <input type="text" placeholder="Table Number (e.g. Table 4)" required onChange={(e) => setFormData({ ...formData, pg_address: e.target.value })} className="w-full bg-white border border-gray-300 p-2.5 md:p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 text-sm md:text-base" />}

                    <div className="bg-blue-50 p-4 rounded-xl text-center border border-blue-100">
                      <p className="text-xs md:text-sm font-bold text-blue-800 mb-2">Scan QR & Pay ₹{grandTotal}</p>
                      <input type="text" placeholder="Enter UTR/UPI Ref" required onChange={(e) => setFormData({ ...formData, payment_reference: e.target.value })} className="w-full p-2 rounded-lg text-center border border-gray-300 outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white text-sm" />
                    </div>
                    <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black py-3 md:py-4 rounded-xl shadow-lg flex justify-center items-center gap-2 text-sm md:text-base">Place Order for ₹{grandTotal} <CheckCircle size={18} /></button>
                  </form>
                )}
                {!settings.is_open && <p className="text-red-500 font-bold text-center mt-4 text-sm">Orders are currently paused.</p>}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {cart.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[92%] max-w-md bg-orange-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex justify-between items-center z-50 lg:hidden">
          <div>
            <p className="text-xs font-semibold">{cart.reduce((sum, i) => sum + i.qty, 0)} items</p>
            <p className="font-black text-sm">₹{grandTotal}</p>
          </div>
          <button onClick={() => document.getElementById("cart-section")?.scrollIntoView({ behavior: "smooth" })} className="bg-white text-orange-600 font-bold px-3 py-1.5 rounded-lg text-sm">View Cart</button>
        </div>
      )}

      <footer className="mt-20 border-t border-gray-200 bg-gray-100 py-8 text-center pb-24">
        <p className="text-gray-400 text-xs md:text-sm font-medium mb-2">© 2026 La Kitchen Ette. All rights reserved.</p>
        <Link to="/admin" className="text-gray-400 hover:text-orange-600 text-xs font-bold transition-colors flex items-center justify-center gap-1"><ShieldCheck size={14} /> Partner Portal Login</Link>
      </footer>
    </div>
  );
}

// ==========================================
// 2. THE POS ADMIN DASHBOARD 
// ==========================================
function AdminDashboard() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // NEW: Mobile Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [orders, setOrders] = useState([]);
  const [adminMenuData, setAdminMenuData] = useState([]);
  const [storeSettings, setStoreSettings] = useState({ is_open: true, delivery_active: true, takeaway_active: true, dine_in_active: true });
  const [whiteboardForm, setWhiteboardForm] = useState({ item_name: '', description: '', price: '', category: 'Daily Whiteboard' });
  const [liveWhiteboardItems, setLiveWhiteboardItems] = useState([]);
  const [customTimers, setCustomTimers] = useState({});

  const [editingMenuId, setEditingMenuId] = useState(null);
  const [editMenuForm, setEditMenuForm] = useState({ item_name: '', price_full: '', price_half: '' });
  const [newMenuForm, setNewMenuForm] = useState({ category: 'Main Course', item_name: '', price_full: '', price_half: '' });

  const navigate = useNavigate();

  const playAlertSound = () => {
    const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
    audio.play().catch(e => console.log("Audio blocked by browser until user interacts."));
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAuthChecking(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("Login Failed: " + error.message);
  };

  const handleLogout = async () => { 
    await supabase.auth.signOut(); 
    navigate('/'); 
  };

  const fetchAllOrders = async () => {
    try {
      const { data, error } = await supabase.from('orders').select('*, users(name, phone_number, pg_address)').order('created_at', { ascending: false });
      if (error) throw error;
      const mappedOrders = data.map(o => ({ ...o, name: o.users?.name, phone_number: o.users?.phone_number, pg_address: o.users?.pg_address }));
      setOrders(mappedOrders);
    } catch (error) { console.error("Failed to fetch orders"); }
  };

  const fetchAdminMenu = async () => {
    try {
      const { data } = await supabase.from('static_menu').select('*').order('category');
      if (data) setAdminMenuData(data);
    } catch (error) { console.error("Failed to fetch menu"); }
  };

  const fetchLiveWhiteboard = async () => {
    try {
      const { data } = await supabase.from('daily_board').select('*');
      if (data) setLiveWhiteboardItems(data);
    } catch (error) { console.error("Failed to fetch whiteboard"); }
  };

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.from('store_settings').select('*').eq('id', 1).single();
      if (data) setStoreSettings(data);
    } catch (error) { console.error("Failed to fetch settings"); }
  };

  const toggleSetting = async (key) => {
    const updatedSettings = { ...storeSettings, [key]: !storeSettings[key] };
    try {
      await supabase.from('store_settings').update({ [key]: !storeSettings[key] }).eq('id', 1);
      setStoreSettings(updatedSettings);
    } catch (error) { alert("Failed to update store settings."); }
  };

  const verifyPayment = async (order) => {
    const defaultMins = order.order_type === 'Dine-in' ? 10 : order.order_type === 'Takeaway' ? 20 : 30;
    const estimatedTime = new Date(Date.now() + defaultMins * 60000).toISOString();
    try {
      await supabase.from('orders').update({ payment_status: 'Verified', status: 'Preparing', estimated_completion_time: estimatedTime }).eq('id', order.id);
      fetchAllOrders();
    } catch (error) { alert("Failed to verify"); }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
      fetchAllOrders();
    } catch (error) { alert("Failed to update status"); }
  };

  const updateOrderTimer = async (orderId) => {
    const mins = customTimers[orderId];
    if (!mins) return alert("Enter minutes first!");
    const estimatedTime = new Date(Date.now() + mins * 60000).toISOString();
    try {
      await supabase.from('orders').update({ estimated_completion_time: estimatedTime }).eq('id', orderId);
      fetchAllOrders(); setCustomTimers({ ...customTimers, [orderId]: '' });
    } catch (error) { alert("Failed to update timer"); }
  };

  const toggleItemAvailability = async (itemId, currentStatus) => {
    try {
      await supabase.from('static_menu').update({ is_available: !currentStatus }).eq('id', itemId);
      fetchAdminMenu();
    } catch (error) { alert("Failed to update item"); }
  };

  const saveMenuEdit = async (itemId) => {
    try {
      await supabase.from('static_menu').update({ 
        item_name: editMenuForm.item_name,
        price_full: editMenuForm.price_full || null,
        price_half: editMenuForm.price_half || null
      }).eq('id', itemId);
      setEditingMenuId(null);
      fetchAdminMenu();
    } catch (error) { alert("Failed to update menu"); }
  };

  const handleDeleteMenuItem = async (id) => {
    if (!window.confirm("Are you sure you want to completely permanently delete this item from the menu?")) return;
    try {
      await supabase.from('static_menu').delete().eq('id', id);
      fetchAdminMenu();
    } catch (error) { alert("Failed to delete menu item."); }
  };

  const handleAddStaticItem = async (e) => {
    e.preventDefault();
    try {
      await supabase.from('static_menu').insert([{
        category: newMenuForm.category,
        item_name: newMenuForm.item_name,
        price_full: newMenuForm.price_full || null,
        price_half: newMenuForm.price_half || null,
        is_available: true
      }]);
      setNewMenuForm({ category: 'Main Course', item_name: '', price_full: '', price_half: '' });
      fetchAdminMenu();
    } catch (error) { alert("Failed to add menu item."); }
  };

  const handleAddWhiteboardItem = async (e) => {
    e.preventDefault();
    try {
      await supabase.from('daily_board').insert([{
        item_name: whiteboardForm.item_name, description: whiteboardForm.description, price: whiteboardForm.price || 0, category: whiteboardForm.category
      }]);
      setWhiteboardForm({ item_name: '', description: '', price: '', category: 'Daily Whiteboard' });
      fetchLiveWhiteboard();
    } catch (error) { alert("Failed to add dish."); }
  };

  const handleDeleteWhiteboardItem = async (id) => {
    if (!window.confirm("Are you sure you want to completely erase this from the whiteboard?")) return;
    try {
      await supabase.from('daily_board').delete().eq('id', id);
      fetchLiveWhiteboard();
    } catch (error) { alert("Failed to erase dish."); }
  };

  useEffect(() => {
    if (session) {
      fetchAllOrders(); fetchAdminMenu(); fetchLiveWhiteboard(); fetchSettings();
      
      const ordersSubscription = supabase.channel('realtime-orders')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
          playAlertSound(); 
          fetchAllOrders();
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
          fetchAllOrders(); 
        })
        .subscribe();

      const settingsSub = supabase.channel('realtime-admin-settings')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'store_settings' }, payload => {
          setStoreSettings(payload.new);
        }).subscribe();

      return () => { 
        supabase.removeChannel(ordersSubscription); 
        supabase.removeChannel(settingsSub);
      };
    }
  }, [session]);

  if (isAuthChecking) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4"><Utensils className="animate-spin text-orange-500" size={48} /></div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-md space-y-4">
          <div className="text-center mb-6"><ShieldCheck size={40} className="mx-auto text-orange-600 mb-2 md:w-12 md:h-12" /><h2 className="text-xl md:text-2xl font-black text-gray-900">Partner Portal Access</h2></div>
          <input type="email" placeholder="Email (admin@lakitchen.com)" required onChange={e => setEmail(e.target.value)} className="w-full p-3 md:p-4 bg-white border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 text-sm md:text-base" />
          <input type="password" placeholder="Password" required onChange={e => setPassword(e.target.value)} className="w-full p-3 md:p-4 bg-white border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 text-sm md:text-base" />
          <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 md:py-4 rounded-xl shadow-lg active:scale-95 transition-all text-sm md:text-base">Login to POS</button>
        </form>
      </div>
    );
  }

  const pendingOrders = orders.filter(o => o.payment_status !== 'Verified').length;
  const verifiedOrders = orders.filter(o => o.payment_status === 'Verified').length;
  const totalRevenue = orders.filter(o => o.payment_status === 'Verified').reduce((sum, o) => sum + o.total_amount, 0);

  const dineInOrders = orders.filter(o => o.order_type === 'Dine-in');
  const takeawayOrders = orders.filter(o => o.order_type === 'Takeaway');
  const deliveryOrders = orders.filter(o => !o.order_type || o.order_type === 'Delivery');

  const groupedAdminMenu = adminMenuData.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item); return acc;
  }, {});

  const renderTicketCluster = (title, orderList, themeColor) => (
    <div className="mb-10 md:mb-12">
      <div className={`flex flex-wrap items-center gap-3 border-b-2 border-${themeColor}-200 pb-2 mb-4 md:mb-6`}>
        <h2 className={`text-lg md:text-2xl font-black text-${themeColor}-800 uppercase tracking-widest`}>{title}</h2>
        <span className={`bg-${themeColor}-100 text-${themeColor}-800 px-2.5 py-0.5 md:px-3 md:py-1 rounded-full text-xs md:text-sm font-bold shadow-sm`}>{orderList.length} Active</span>
      </div>
      {orderList.length === 0 ? (<p className="text-gray-400 italic bg-white p-6 rounded-xl border border-dashed border-gray-300 text-center text-sm md:text-base">No {title.toLowerCase()} tickets.</p>) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {orderList.map(order => (
            <div key={order.id} className={`bg-white rounded-2xl p-4 md:p-6 shadow-md flex flex-col justify-between border-t-4 ${order.payment_status === 'Verified' ? `border-${themeColor}-500` : 'border-red-500 transform transition-transform hover:-translate-y-1'}`}>
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div><h3 className="text-base md:text-lg font-black text-gray-900">Order #{order.id}</h3>{order.status !== 'Delivered' && order.estimated_completion_time && (<div className="mt-1"><LiveTimer targetTime={order.estimated_completion_time} /></div>)}</div>
                  {order.status === 'Delivered' ? <span className="text-[10px] md:text-xs font-black px-2 md:px-3 py-1 rounded-full bg-gray-100 text-gray-500">DELIVERED</span> : order.payment_status === 'Verified' ? <span className="text-[10px] md:text-xs font-black px-2 md:px-3 py-1 rounded-full bg-blue-100 text-blue-700 animate-pulse">{order.status.toUpperCase()}</span> : <span className="text-[10px] md:text-xs font-black px-2 md:px-3 py-1 rounded-full bg-red-100 text-red-700 animate-pulse">PENDING</span>}
                </div>
                
                <div className="bg-gray-50 p-3 rounded-xl text-xs md:text-sm mb-4 border border-gray-200">
                  <div className="flex justify-between border-b border-gray-200 pb-2 mb-2">
                    <span className="font-bold text-gray-800">{order.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 font-mono text-[10px] md:text-xs">{order.phone_number}</span>
                      {order.phone_number && (
                        <a href={`https://wa.me/91${order.phone_number}?text=${encodeURIComponent(`Hello ${order.name},\n\nRegarding your La Kitchen Ette Order #${order.id}:\n\n`)}`} target="_blank" rel="noreferrer" className="text-green-500 hover:text-green-600 bg-green-100 p-1 rounded-md shadow-sm transition-colors">
                          <MessageCircle size={14}/>
                        </a>
                      )}
                    </div>
                  </div>
                  {order.order_type === 'Dine-in' ? <p className="text-gray-900 font-bold text-sm md:text-lg text-center bg-yellow-100 py-1 rounded">{order.pg_address}</p> : order.order_type === 'Takeaway' ? <p className="text-gray-500 text-center font-bold">CUSTOMER PICKUP</p> : <p className="text-gray-700"><span className="text-[10px] md:text-xs text-gray-400 font-bold">ADDRESS:</span> {order.pg_address}</p>}
                  <div className="mt-3 bg-blue-50 text-blue-800 p-2 rounded-lg border border-blue-100 font-mono text-[10px] md:text-xs text-center break-all">UTR: <b>{order.payment_reference}</b></div>
                </div>
                <div className="mb-4"><p className="text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Items Ordered</p><ul className="text-xs md:text-sm font-semibold text-gray-700 space-y-1.5">{order.order_details?.map((item, i) => <li key={i} className="flex justify-between"><span>{item.qty}x {item.item}</span></li>)}</ul></div>
              </div>
              <div className="mt-auto border-t border-gray-100 pt-4">
                {order.payment_status === 'Verified' && order.status !== 'Delivered' && (
                  <div className="flex items-center gap-2 mb-4 bg-gray-50 p-2 rounded-lg border border-gray-200">
                    <input type="number" placeholder="Mins" value={customTimers[order.id] || ''} onChange={e => setCustomTimers({ ...customTimers, [order.id]: e.target.value })} className="w-14 md:w-16 p-1 text-xs md:text-sm text-center border border-gray-300 rounded outline-none focus:ring-1 focus:ring-gray-400 text-gray-900 bg-white" />
                    <button onClick={() => updateOrderTimer(order.id)} className="text-[10px] md:text-xs bg-gray-800 hover:bg-black text-white px-2 py-1.5 rounded font-bold w-full transition-colors">Set new timer</button>
                  </div>
                )}
                {order.payment_status !== 'Verified' ? <button onClick={() => verifyPayment(order)} className="w-full bg-red-500 hover:bg-red-600 text-white font-black py-2.5 md:py-3 rounded-xl shadow-md active:scale-95 flex justify-center items-center gap-2 transition-all text-xs md:text-sm"><CheckCircle size={16} /> Verify (Start)</button> : order.status === 'Preparing' ? <button onClick={() => updateOrderStatus(order.id, 'Packed')} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-2.5 md:py-3 rounded-xl shadow-md active:scale-95 flex justify-center items-center gap-2 transition-all text-xs md:text-sm"><Package size={16} /> Mark Packed</button> : order.status === 'Packed' ? <button onClick={() => updateOrderStatus(order.id, 'Delivered')} className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black py-2.5 md:py-3 rounded-xl shadow-md active:scale-95 flex justify-center items-center gap-2 transition-all text-xs md:text-sm"><Send size={16} /> Mark Delivered</button> : <button disabled className="w-full bg-gray-100 text-gray-400 font-bold py-2.5 md:py-3 rounded-xl border border-gray-200 flex items-center justify-center gap-2 cursor-not-allowed text-xs md:text-sm"><CheckCircle size={16} /> Order Complete</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden relative">

      {/* MOBILE SIDEBAR OVERLAY */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* SIDEBAR */}
      <div className={`w-64 bg-gray-900 text-white flex flex-col shadow-2xl fixed inset-y-0 left-0 z-50 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-300 ease-in-out`}>
        <div className="p-6 border-b border-gray-800 relative">
          <button className="absolute top-6 right-4 md:hidden text-gray-400 hover:text-white" onClick={() => setIsSidebarOpen(false)}><X size={24}/></button>
          <div className="flex items-center gap-2 text-orange-500 mb-1"><Store size={28} /><h2 className="text-xl font-black">La Kitchen Ette</h2></div>
        </div>
        <div className="flex-1 py-6 space-y-2 px-4">
          <button onClick={() => { setActiveMenu('dashboard'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm md:text-base ${activeMenu === 'dashboard' ? 'bg-orange-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}><LayoutDashboard size={20} /> Live Tickets</button>
          <button onClick={() => { setActiveMenu('menu-settings'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm md:text-base ${activeMenu === 'menu-settings' ? 'bg-orange-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}><Utensils size={20} /> Menu Settings</button>
          <button onClick={() => { setActiveMenu('whiteboard'); fetchLiveWhiteboard(); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm md:text-base ${activeMenu === 'whiteboard' ? 'bg-orange-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}><PenTool size={20} /> Daily Whiteboard</button>
        </div>
        <div className="p-4 border-t border-gray-800"><button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-red-600 text-gray-300 hover:text-white py-3 rounded-xl font-bold transition-colors text-sm md:text-base"><LogOut size={18} /> Secure Logout</button></div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto bg-gray-50 flex flex-col w-full">

        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="px-4 md:px-8 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              {/* MOBILE MENU BUTTON */}
              <button className="md:hidden text-gray-600 hover:text-gray-900" onClick={() => setIsSidebarOpen(true)}>
                <Menu size={24} />
              </button>
              <h1 className="text-lg md:text-2xl font-black text-gray-800 truncate">
                {activeMenu === 'dashboard' && 'Live Kitchen Dashboard'}
                {activeMenu === 'menu-settings' && 'Inventory & Pricing'}
                {activeMenu === 'whiteboard' && 'Daily Custom Specials'}
              </h1>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs md:text-sm font-bold text-gray-500 bg-gray-100 px-3 md:px-4 py-1.5 md:py-2 rounded-full"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div> Live Sync</div>
          </div>

          <div className="bg-gray-800 px-4 md:px-8 py-2 md:py-3 flex gap-4 md:gap-6 text-xs md:text-sm overflow-x-auto whitespace-nowrap scrollbar-hide">
            <button onClick={() => toggleSetting('is_open')} className={`flex items-center gap-1.5 font-bold px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg transition-colors ${storeSettings.is_open ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              <Power size={14} /> {storeSettings.is_open ? 'OPEN' : 'CLOSED'}
            </button>
            <div className="w-px bg-gray-700 my-1"></div>
            <button onClick={() => toggleSetting('delivery_active')} className={`flex items-center gap-1.5 font-bold transition-colors ${storeSettings.delivery_active ? 'text-gray-300 hover:text-white' : 'text-red-400 line-through'}`}><Truck size={14} /> Delivery</button>
            <button onClick={() => toggleSetting('takeaway_active')} className={`flex items-center gap-1.5 font-bold transition-colors ${storeSettings.takeaway_active ? 'text-gray-300 hover:text-white' : 'text-red-400 line-through'}`}><ShoppingBag size={14} /> Takeaway</button>
            <button onClick={() => toggleSetting('dine_in_active')} className={`flex items-center gap-1.5 font-bold transition-colors ${storeSettings.dine_in_active ? 'text-gray-300 hover:text-white' : 'text-red-400 line-through'}`}><MapPin size={14} /> Dine-in</button>
          </div>
        </header>

        <div className="p-4 md:p-8 overflow-x-hidden">

          {activeMenu === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
                <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-4">
                  <div className="bg-orange-100 p-3 md:p-4 rounded-xl text-orange-600"><IndianRupee size={24} className="md:w-8 md:h-8" /></div>
                  <div><p className="text-xs md:text-sm font-bold text-gray-500 uppercase tracking-wide">Total Revenue</p><h3 className="text-xl md:text-3xl font-black text-gray-900">₹{totalRevenue}</h3></div>
                </div>
                <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-4">
                  <div className="bg-red-100 p-3 md:p-4 rounded-xl text-red-600"><AlertCircle size={24} className="md:w-8 md:h-8" /></div>
                  <div><p className="text-xs md:text-sm font-bold text-gray-500 uppercase tracking-wide">Needs Verification</p><h3 className="text-xl md:text-3xl font-black text-gray-900">{pendingOrders} <span className="text-sm md:text-lg text-gray-500 font-medium">pending</span></h3></div>
                </div>
                <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-4 hidden sm:flex">
                  <div className="bg-green-100 p-3 md:p-4 rounded-xl text-green-600"><CheckCircle size={24} className="md:w-8 md:h-8" /></div>
                  <div><p className="text-xs md:text-sm font-bold text-gray-500 uppercase tracking-wide">Orders Processed</p><h3 className="text-xl md:text-3xl font-black text-gray-900">{verifiedOrders}</h3></div>
                </div>
              </div>

              {renderTicketCluster("Dine-In Orders", dineInOrders, "yellow")}
              {renderTicketCluster("Takeaway / Pickup", takeawayOrders, "orange")}
              {renderTicketCluster("Home Delivery", deliveryOrders, "blue")}
            </div>
          )}

          {activeMenu === 'menu-settings' && (
            <div className="max-w-5xl">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-8">
                
                <div className="mb-8 md:mb-10 bg-gray-50 p-4 md:p-6 rounded-xl border border-gray-200">
                  <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm md:text-base"><PlusCircle size={18}/> Add Permanent Menu Item</h4>
                  {/* FIXED: Form layout wraps perfectly on mobile */}
                  <form onSubmit={handleAddStaticItem} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 items-end">
                    <div className="w-full">
                      <label className="text-xs font-bold text-gray-500 mb-1 block">Category</label>
                      <input type="text" required placeholder="e.g. Main Course" value={newMenuForm.category} onChange={e => setNewMenuForm({...newMenuForm, category: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-sm text-gray-900 bg-white placeholder-gray-400"/>
                    </div>
                    <div className="w-full sm:col-span-2 md:col-span-2">
                      <label className="text-xs font-bold text-gray-500 mb-1 block">Dish Name</label>
                      <input type="text" required placeholder="e.g. Butter Chicken" value={newMenuForm.item_name} onChange={e => setNewMenuForm({...newMenuForm, item_name: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-sm text-gray-900 bg-white placeholder-gray-400"/>
                    </div>
                    <div className="flex gap-3 w-full">
                      <div className="flex-1">
                        <label className="text-xs font-bold text-gray-500 mb-1 block">Half ₹</label>
                        <input type="number" placeholder="Opt." value={newMenuForm.price_half} onChange={e => setNewMenuForm({...newMenuForm, price_half: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-sm text-gray-900 bg-white placeholder-gray-400"/>
                      </div>
                      <div className="flex-1">
                        <label className="text-xs font-bold text-gray-500 mb-1 block">Full ₹</label>
                        <input type="number" required placeholder="Price" value={newMenuForm.price_full} onChange={e => setNewMenuForm({...newMenuForm, price_full: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-sm text-gray-900 bg-white placeholder-gray-400"/>
                      </div>
                    </div>
                    <button type="submit" className="w-full sm:col-span-2 md:col-span-1 bg-gray-800 hover:bg-black text-white font-bold px-4 py-2 rounded-lg transition-colors h-[38px] shadow-md text-sm md:text-base">Add</button>
                  </form>
                </div>

                <div className="space-y-8 md:space-y-10">
                  {Object.keys(groupedAdminMenu).map(category => (
                    <div key={category}>
                      <h3 className="text-lg md:text-xl font-black text-gray-900 border-b-2 border-gray-100 pb-2 md:pb-3 mb-3 md:mb-4 uppercase tracking-wider">{category}</h3>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
                        {groupedAdminMenu[category].map(item => (
                          <div key={item.id} className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 md:p-4 rounded-xl border transition-all gap-3 sm:gap-0 ${item.is_available ? 'bg-white border-gray-200 hover:shadow-md' : 'bg-gray-50 border-gray-300 opacity-75'}`}>
                            
                            <div className="flex flex-col gap-1 w-full sm:mr-4">
                              {editingMenuId === item.id ? (
                                /* FIXED: Wrap inputs to prevent overflowing off mobile screens */
                                <div className="flex flex-wrap gap-2 items-center w-full">
                                  <input type="text" placeholder="Name" value={editMenuForm.item_name} onChange={e => setEditMenuForm({...editMenuForm, item_name: e.target.value})} className="flex-1 min-w-[120px] p-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white outline-none focus:ring-1 focus:ring-orange-500 placeholder-gray-400"/>
                                  <input type="number" placeholder="Full ₹" value={editMenuForm.price_full} onChange={e => setEditMenuForm({...editMenuForm, price_full: e.target.value})} className="w-[70px] p-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white outline-none focus:ring-1 focus:ring-orange-500 placeholder-gray-400"/>
                                  <input type="number" placeholder="Half ₹" value={editMenuForm.price_half} onChange={e => setEditMenuForm({...editMenuForm, price_half: e.target.value})} className="w-[70px] p-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white outline-none focus:ring-1 focus:ring-orange-500 placeholder-gray-400"/>
                                  <div className="flex gap-1 w-full sm:w-auto mt-1 sm:mt-0">
                                    <button onClick={() => saveMenuEdit(item.id)} className="flex-1 sm:flex-none flex justify-center text-green-600 hover:bg-green-100 p-1.5 bg-green-50 rounded-lg transition-colors"><Save size={16}/></button>
                                    <button onClick={() => setEditingMenuId(null)} className="flex-1 sm:flex-none flex justify-center text-gray-600 hover:bg-gray-100 p-1.5 bg-gray-50 rounded-lg transition-colors"><XCircle size={16}/></button>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <h4 className={`font-bold text-sm md:text-base ${item.is_available ? 'text-gray-900' : 'text-gray-500 line-through'}`}>{item.item_name}</h4>
                                  <div className="flex items-center gap-3 text-xs md:text-sm text-gray-500 font-medium mt-1">
                                    <span>₹{item.price_full} {item.price_half && `/ Half: ₹${item.price_half}`}</span>
                                    <button onClick={() => { setEditingMenuId(item.id); setEditMenuForm({ item_name: item.item_name, price_full: item.price_full, price_half: item.price_half || '' }); }} className="text-blue-500 hover:text-blue-700 hover:bg-blue-100 bg-blue-50 p-1 rounded-md transition-colors"><Edit2 size={14}/></button>
                                    <button onClick={() => handleDeleteMenuItem(item.id)} className="text-red-500 hover:text-red-700 hover:bg-red-100 bg-red-50 p-1 rounded-md transition-colors"><Trash2 size={14}/></button>
                                  </div>
                                </div>
                              )}
                            </div>

                            <button onClick={() => toggleItemAvailability(item.id, item.is_available)} className={`w-full sm:w-auto flex justify-center items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap ${item.is_available ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200' : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'}`}>
                              {item.is_available ? <><ToggleRight size={18} /> On</> : <><ToggleLeft size={18} /> Off</>}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeMenu === 'whiteboard' && (
            <div className="max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-xl border border-gray-700 p-5 md:p-8 text-white h-fit">
                <div className="mb-6 md:mb-8"><h2 className="text-xl md:text-2xl font-black flex items-center gap-2"><PenTool className="text-orange-400" /> Write a New Special</h2></div>
                <form onSubmit={handleAddWhiteboardItem} className="space-y-4">
                  <div>
                    <label className="block text-xs md:text-sm font-bold text-gray-300 mb-1">What type of item is this?</label>
                    <select value={whiteboardForm.category} onChange={e => setWhiteboardForm({ ...whiteboardForm, category: e.target.value, price: e.target.value !== 'Daily Whiteboard' ? 0 : '' })} className="w-full bg-gray-900/50 border border-gray-600 rounded-xl p-3 md:p-4 text-white outline-none focus:ring-2 focus:ring-orange-500 text-sm md:text-base">
                      <option value="Daily Whiteboard">Standalone Special (Sells by itself)</option>
                      <option value="Special Option">Special Thali Dish (For Special Thalis)</option>
                      <option value="Normal Option">Normal Thali Dish (For Normal Thalis)</option>
                      <option value="Common Option">Common Thali Dish (For BOTH Thalis)</option>
                    </select>
                  </div>
                  <div><label className="block text-xs md:text-sm font-bold text-gray-300 mb-1">Dish Name</label><input type="text" required value={whiteboardForm.item_name} onChange={e => setWhiteboardForm({ ...whiteboardForm, item_name: e.target.value })} className="w-full bg-gray-900/50 border border-gray-600 rounded-xl p-3 md:p-4 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-orange-500 text-sm md:text-base" placeholder="e.g., Dal Tadka" /></div>
                  <div><label className="block text-xs md:text-sm font-bold text-gray-300 mb-1">Description</label><input type="text" value={whiteboardForm.description} onChange={e => setWhiteboardForm({ ...whiteboardForm, description: e.target.value })} className="w-full bg-gray-900/50 border border-gray-600 rounded-xl p-3 md:p-4 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-orange-500 text-sm md:text-base" placeholder="Optional details..." /></div>
                  {whiteboardForm.category === 'Daily Whiteboard' && (
                    <div><label className="block text-xs md:text-sm font-bold text-gray-300 mb-1">Price (₹)</label><input type="number" required value={whiteboardForm.price} onChange={e => setWhiteboardForm({ ...whiteboardForm, price: e.target.value })} className="w-full bg-gray-900/50 border border-gray-600 rounded-xl p-3 md:p-4 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-orange-500 text-sm md:text-base" /></div>
                  )}
                  <button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3 md:py-4 rounded-xl shadow-lg mt-6 active:scale-95 transition-all flex justify-center items-center gap-2 text-sm md:text-base"><Send size={18} /> Publish to Board</button>
                </form>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 md:p-8 h-fit">
                <div className="mb-6 border-b border-gray-200 pb-4"><h2 className="text-lg md:text-xl font-black text-gray-900 flex items-center gap-2"><Eraser className="text-red-500" /> Active Whiteboard Items</h2></div>
                {liveWhiteboardItems.length === 0 ? (<div className="text-center py-10 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-sm md:text-base"><p>The whiteboard is empty.</p></div>) : (
                  <div className="space-y-4">
                    {['Daily Whiteboard', 'Special Option', 'Normal Option', 'Common Option'].map(cat => {
                      const itemsInCat = liveWhiteboardItems.filter(i => i.category === cat);
                      if (itemsInCat.length === 0) return null;
                      return (
                        <div key={cat} className="mb-4">
                          <h3 className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{cat === 'Daily Whiteboard' ? 'Standalone Specials' : cat}</h3>
                          <div className="space-y-2">
                            {itemsInCat.map(item => (
                              <div key={item.id} className="flex justify-between items-center p-3 border border-gray-200 rounded-xl bg-gray-50">
                                <div><h4 className="font-bold text-gray-900 text-xs md:text-sm">{item.item_name}</h4>{cat === 'Daily Whiteboard' && <span className="text-[10px] md:text-xs text-gray-500 font-bold">₹{item.price}</span>}</div>
                                <button onClick={() => handleDeleteWhiteboardItem(item.id)} className="text-red-500 hover:bg-red-100 p-2 rounded-lg transition-colors"><Trash2 size={14} className="md:w-4 md:h-4" /></button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() { return <BrowserRouter><Routes><Route path="/" element={<CustomerApp />} /><Route path="/admin" element={<AdminDashboard />} /></Routes></BrowserRouter>; }