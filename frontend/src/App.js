import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import 'chartjs-adapter-date-fns';

ChartJS.register(CategoryScale, LinearScale, TimeScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ChartDataLabels);

// API Configuration
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Safe number conversion and formatting utilities
const normalizeNumericValue = (value, defaultValue = 0) => {
  if (value === null || value === undefined) return defaultValue;
  const num = Number(value);
  return isFinite(num) ? num : defaultValue;
};

const safeToFixed = (value, decimals = 0, defaultValue = '---') => {
  const num = normalizeNumericValue(value);
  return isFinite(num) ? num.toFixed(decimals) : defaultValue;
};

function App() {
  const [currentPage, setCurrentPage] = useState('login');
  const [menuOpen, setMenuOpen] = useState(false);
  const [readings, setReadings] = useState([]);
  const [latest, setLatest] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [user, setUser] = useState({ name: '', email: '', loggedIn: false });
  const [authMode, setAuthMode] = useState('login');
  const [users] = useState(() => {
    const stored = localStorage.getItem('iot-users');
    return stored ? JSON.parse(stored) : [];
  });
  const [systemPowerOn, setSystemPowerOn] = useState(true);
  const [maxAllowedVoltage, setMaxAllowedVoltage] = useState(240);
  const [maxAllowedCurrent, setMaxAllowedCurrent] = useState(8);
  const [resetProtection, setResetProtection] = useState(false);
  const [userAlertMessage, setUserAlertMessage] = useState('');
  const [autoShutdown, setAutoShutdown] = useState(false);
  const [reportTab, setReportTab] = useState('daily');
  const [selectedDailyDate, setSelectedDailyDate] = useState('');
  const [selectedWeeklyPeriod, setSelectedWeeklyPeriod] = useState('');
  const [selectedMonthlyPeriod, setSelectedMonthlyPeriod] = useState('');
  const [selectedYearlyPeriod, setSelectedYearlyPeriod] = useState('');
  const [wifiStatus, setWifiStatus] = useState('');
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiSsidInput, setWifiSsidInput] = useState('');
  const [wifiPasswordInput, setWifiPasswordInput] = useState('');
  const [wifiLoading, setWifiLoading] = useState(false);
  const [wifiMessage, setWifiMessage] = useState('');
  const [wifiMessageType, setWifiMessageType] = useState('success');
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [savedReports, setSavedReports] = useState([]);
  const [showSaveReportModal, setShowSaveReportModal] = useState(false);
  const [saveReportLoading, setSaveReportLoading] = useState(false);
  const [costPerKwh, setCostPerKwh] = useState(25); // Default to 25 KES per kWh

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginErrors, setLoginErrors] = useState({ email: '', password: '' });
  const [loginGeneralError, setLoginGeneralError] = useState('');

  // Signup Form State
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupErrors, setSignupErrors] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [signupGeneralError, setSignupGeneralError] = useState('');

  // AI Assistant State
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Calendar/Reports State
  const [selectedReportDate, setSelectedReportDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [showCalendarPopup, setShowCalendarPopup] = useState(false);
  const [dateRangeStart, setDateRangeStart] = useState(null);
  const [dateRangeEnd, setDateRangeEnd] = useState(null);
  const [calendarMode, setCalendarMode] = useState('single'); // 'single', 'range', 'month', 'year'

  const dropdownRef = useRef(null);
  const reportRef = useRef(null);
  const chartRef = useRef(null);
  const chatEndRef = useRef(null);
  const calendarRef = useRef(null);

  // AI Assistant responses generator
  const generateAIResponse = (message) => {
    const lowerMessage = message.toLowerCase();
    const responses = [
      {
        keywords: ['consumption', 'usage', 'energy'],
        response: `Your energy consumption today is approximately 12.5 kWh, which is 8% lower than yesterday. Keep up the good habits! 💡`
      },
      {
        keywords: ['cost', 'price', 'bill', 'expensive'],
        response: `Your estimated energy bill for this month is KES 3,125 at the current rate of KES 25 per kWh. Consider using energy-efficient appliances to reduce costs. 💰`
      },
      {
        keywords: ['save', 'reduce', 'lower', 'efficient'],
        response: `Here are some energy-saving tips:\n• Turn off appliances when not in use\n• Use LED bulbs instead of incandescent\n• Set AC to 24-25°C\n• Unplug devices that drain power\n• Run dishwasher/laundry with full loads`
      },
      {
        keywords: ['anomaly', 'unusual', 'spike', 'alert'],
        response: `No anomalies detected today. Your consumption patterns are normal. However, peak usage occurred at 14:00 when power was 450W. ⚡`
      },
      {
        keywords: ['report', 'historical', 'past', 'month'],
        response: `Your monthly energy report is ready. April consumption: 385 kWh | Cost: KES 9,625 | Peak day: April 15 with 16.2 kWh usage.`
      },
      {
        keywords: ['help', 'how', 'what', 'features'],
        response: `I can help you with:\n• Energy consumption analysis\n• Cost calculations\n• Energy-saving tips\n• Report summaries\n• Anomaly detection\nWhat would you like to know?`
      }
    ];

    for (let resp of responses) {
      if (resp.keywords.some(keyword => lowerMessage.includes(keyword))) {
        return resp.response;
      }
    }

    return `I understand you're asking about "${message}". I'm analyzing your energy data... Current status: Normal ✓`;
  };

  // Calendar generation
  const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  
  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(calendarMonth);
    const firstDay = getFirstDayOfMonth(calendarMonth);
    const days = [];
    
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const handleCalendarDateSelect = (day) => {
    if (!day) return;
    
    const year = calendarMonth.getFullYear();
    const month = String(calendarMonth.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const selectedDate = `${year}-${month}-${dayStr}`;
    
    if (calendarMode === 'single') {
      setSelectedReportDate(selectedDate);
      setSelectedDailyDate(selectedDate);
      setDateRangeStart(null);
      setDateRangeEnd(null);
      setShowCalendarPopup(false);
    } else if (calendarMode === 'range') {
      if (!dateRangeStart) {
        setDateRangeStart(selectedDate);
      } else if (!dateRangeEnd) {
        if (selectedDate >= dateRangeStart) {
          setDateRangeEnd(selectedDate);
          setShowCalendarPopup(false);
        } else {
          setDateRangeStart(selectedDate);
        }
      } else {
        setDateRangeStart(selectedDate);
        setDateRangeEnd(null);
      }
    }
  };

  const handleCalendarMonthSelect = () => {
    const year = calendarMonth.getFullYear();
    const month = String(calendarMonth.getMonth() + 1).padStart(2, '0');
    const monthStart = `${year}-${month}-01`;
    setSelectedReportDate(monthStart);
    const monthKey = `${year}-${month}`;
    setSelectedMonthlyPeriod(monthKey);
    setCalendarMode('single');
    setShowCalendarPopup(false);
  };

  const handleCalendarYearSelect = () => {
    const year = calendarMonth.getFullYear();
    const yearStart = `${year}-01-01`;
    setSelectedReportDate(yearStart);
    setSelectedYearlyPeriod(String(year));
    setCalendarMode('single');
    setShowCalendarPopup(false);
  };

  const isDateInRange = (day) => {
    if (!dateRangeStart || !dateRangeEnd) return false;
    const year = calendarMonth.getFullYear();
    const month = String(calendarMonth.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const testDate = `${year}-${month}-${dayStr}`;
    return testDate >= dateRangeStart && testDate <= dateRangeEnd;
  };

  const getFormattedDateRange = () => {
    if (dateRangeStart && dateRangeEnd) {
      const startDate = new Date(dateRangeStart + 'T00:00:00Z');
      const endDate = new Date(dateRangeEnd + 'T00:00:00Z');
      return `${startDate.toLocaleDateString('default', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('default', { month: 'short', day: 'numeric' })}`;
    } else if (dateRangeStart) {
      const startDate = new Date(dateRangeStart + 'T00:00:00Z');
      return `${startDate.toLocaleDateString('default', { month: 'short', day: 'numeric' })} - ...`;
    }
    const selDate = new Date(selectedReportDate + 'T00:00:00Z');
    return selDate.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: chatInput,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages([...chatMessages, userMessage]);
    setChatInput('');
    setChatLoading(true);

    setTimeout(() => {
      const aiResponse = {
        id: Date.now() + 1,
        text: generateAIResponse(chatInput),
        sender: 'ai',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, aiResponse]);
      setChatLoading(false);
    }, 800);
  };

  const handleResetProtection = () => {
    setResetProtection(true);
    setUserAlertMessage('');
    setAutoShutdown(false);
    if (!systemPowerOn) {
      setSystemPowerOn(true);
    }
  };

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (currentPage !== 'dashboard' && currentPage !== 'history' && currentPage !== 'reports') return;

    const fetchData = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/readings');
        const newReadings = res.data.map(item => ({
          ...item,
          voltage: normalizeNumericValue(item.voltage),
          current: normalizeNumericValue(item.current),
          power: normalizeNumericValue(item.power),
          energy_kwh: normalizeNumericValue(item.energy_kwh),
        }));
        
        if (newReadings.length > 0) {
          const newLatest = newReadings[0];
          
          // Check if this is the first load
          if (!latest.timestamp) {
            setReadings(newReadings);
            setLatest(newLatest);
            setLastUpdated(new Date());
          } else {
            // Update with every new reading for real-time experience
            const updatedReadings = [newLatest, ...readings.filter(r => r !== latest)].slice(0, 50);
            setReadings(updatedReadings);
            setLatest(newLatest);
            setLastUpdated(new Date());
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 500);
    return () => clearInterval(interval);
  }, [currentPage, readings, latest]);

  // Validation Functions
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateName = (name) => {
    const trimmedName = name.trim();
    // Check if name only contains letters and spaces
    const nameRegex = /^[a-zA-Z\s]+$/;
    if (!nameRegex.test(trimmedName)) return false;
    
    // Split by spaces and filter out empty strings
    const nameParts = trimmedName.split(/\s+/).filter(part => part.length > 0);
    
    // Must have at least 2 parts (first name and last name)
    if (nameParts.length < 2) return false;
    
    // Each part must be at least 2 characters
    if (nameParts.some(part => part.length < 2)) return false;
    
    return true;
  };

  const validatePassword = (password, minLength = 8) => {
    if (password.length < minLength) return false;
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    return hasLowercase && hasUppercase && hasNumber;
  };

  const validateLoginForm = () => {
    const errors = { email: '', password: '' };
    let isValid = true;

    if (!loginEmail.trim()) {
      errors.email = 'Email is required';
      isValid = false;
    } else if (!validateEmail(loginEmail)) {
      errors.email = 'Please enter a valid email address';
      isValid = false;
    }

    if (!loginPassword) {
      errors.password = 'Password is required';
      isValid = false;
    } else if (!validatePassword(loginPassword)) {
      errors.password = 'Password must be at least 6 characters';
      isValid = false;
    }

    setLoginErrors(errors);
    return isValid;
  };

  const validateSignupForm = () => {
    const errors = { name: '', email: '', password: '', confirmPassword: '' };
    let isValid = true;

    if (!signupName.trim()) {
      errors.name = 'Name is required';
      isValid = false;
    } else if (!validateName(signupName)) {
      errors.name = 'Please enter both first name and last name (minimum 2 letters each, separated by space)';
      isValid = false;
    }

    if (!signupEmail.trim()) {
      errors.email = 'Email is required';
      isValid = false;
    } else if (!validateEmail(signupEmail)) {
      errors.email = 'Please enter a valid email address';
      isValid = false;
    } else if (users.some(u => u.email === signupEmail)) {
      errors.email = 'This email is already registered';
      isValid = false;
    }

    if (!signupPassword) {
      errors.password = 'Password is required';
      isValid = false;
    } else if (!validatePassword(signupPassword, 8)) {
      errors.password = 'Password must be at least 8 characters with uppercase, lowercase, and number';
      isValid = false;
    }

    if (!signupConfirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
      isValid = false;
    } else if (signupPassword !== signupConfirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    setSignupErrors(errors);
    return isValid;
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setSignupGeneralError('');

    if (!validateSignupForm()) {
      return;
    }

    setSignupLoading(true);
    
    try {
      const response = await axios.post('http://localhost:5000/api/signup', {
        name: signupName,
        email: signupEmail,
        password: signupPassword
      });

      if (response.status === 201) {
        const newUser = response.data.user;
        localStorage.setItem('iot-current-user', JSON.stringify({ id: newUser.id, name: newUser.name, email: newUser.email }));

        setUser({ id: newUser.id, name: newUser.name, email: newUser.email, loggedIn: true });
        setCurrentPage('dashboard');
        
        setLoginEmail('');
        setLoginPassword('');
        setSignupName('');
        setSignupEmail('');
        setSignupPassword('');
        setSignupConfirmPassword('');
        
        console.log('✅ User registered successfully');
      }
    } catch (error) {
      console.error('Signup error:', error);
      if (error.response?.status === 409) {
        setSignupGeneralError('Email already registered. Please login instead.');
      } else if (error.response?.data?.error) {
        setSignupGeneralError(error.response.data.error);
      } else {
        setSignupGeneralError('Signup failed. Please try again.');
      }
    } finally {
      setSignupLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginGeneralError('');

    if (!validateLoginForm()) {
      return;
    }

    setLoginLoading(true);

    try {
      const response = await axios.post(`${API_URL}/api/login`, {
        email: loginEmail,
        password: loginPassword
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 200) {
        const foundUser = response.data.user;
        const token = response.data.token;
        
        // Store user data in localStorage
        localStorage.setItem('iot-current-user', JSON.stringify({ 
          id: foundUser.id, 
          name: foundUser.name, 
          email: foundUser.email 
        }));
        localStorage.setItem('token', token);
        
        // Update user state
        setUser({ 
          id: foundUser.id, 
          name: foundUser.name, 
          email: foundUser.email, 
          loggedIn: true 
        });
        
        // Fetch user preferences to get cost per kWh
        try {
          const prefResponse = await axios.get(`${API_URL}/api/user-preferences`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (prefResponse.data && prefResponse.data.cost_per_kwh) {
            setCostPerKwh(prefResponse.data.cost_per_kwh);
          }
        } catch (err) {
          console.log('Could not fetch user preferences, using default rate');
        }
        
        // Clear form and redirect to dashboard
        setLoginEmail('');
        setLoginPassword('');
        setCurrentPage('dashboard');
        console.log('✅ Login successful');
      }
    } catch (error) {
      console.error('Login error:', error);
      
      // Handle specific error cases
      if (error.code === 'ECONNABORTED') {
        setLoginGeneralError('Request timeout. Please check your connection and try again.');
      } else if (error.code === 'ERR_NETWORK') {
        setLoginGeneralError('Network error. Unable to connect to the server.');
      } else if (error.response?.status === 401) {
        setLoginGeneralError('Invalid credentials. Please check your email and password.');
      } else if (error.response?.status === 400) {
        setLoginGeneralError('Invalid credentials. Please check your email and password.');
      } else if (error.response?.status === 500) {
        setLoginGeneralError('Server error. Please try again later.');
      } else if (error.response?.data?.error) {
        setLoginGeneralError(error.response.data.error);
      } else if (!error.response) {
        setLoginGeneralError('Network error. Please check your internet connection.');
      } else {
        setLoginGeneralError('Login failed. Please try again.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // Save report to database
  const saveReportToDatabase = async () => {
    if (!user.loggedIn || !reportData) {
      alert('Please generate a report first');
      return;
    }

    try {
      setSaveReportLoading(true);
      const reportDate = new Date().toISOString();
      
      const payload = {
        report_type: reportTab,
        report_date: reportDate,
        total_energy: parseFloat(reportData.totalEnergy),
        average_power: parseFloat(reportData.averagePower),
        peak_power: parseFloat(reportData.peakPower),
        estimated_cost: parseFloat(reportData.totalCost),
        data: reportData.chartData
      };

      await axios.post(
        `http://localhost:5000/api/users/${user.id}/reports`,
        payload
      );

      alert(`Report saved successfully!`);
      setShowSaveReportModal(false);
      loadUserReports();
    } catch (error) {
      console.error('Error saving report:', error);
      alert('Failed to save report');
    } finally {
      setSaveReportLoading(false);
    }
  };

  // Load user's saved reports
  const loadUserReports = async () => {
    if (!user.loggedIn) return;

    try {
      const response = await axios.get(
        `http://localhost:5000/api/users/${user.id}/reports`
      );
      setSavedReports(response.data.reports || []);
    } catch (error) {
      console.error('Error loading reports:', error);
    }
  };

  // Load reports when user logs in
  useEffect(() => {
    if (user.loggedIn && user.id) {
      loadUserReports();
    }
  }, [user.loggedIn, user.id]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  // Close calendar popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setShowCalendarPopup(false);
      }
    };

    if (showCalendarPopup) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCalendarPopup]);

  const handleWifiConnect = () => {
    if (!wifiSsidInput) {
      setWifiMessage('Enter a valid SSID to connect.');
      setWifiMessageType('error');
      return;
    }

    setWifiLoading(true);
    setWifiMessage('');
    setTimeout(() => {
      setWifiLoading(false);
      setWifiStatus('Connected');
      setWifiSsid(wifiSsidInput);
      setWifiMessage('Connection successful');
      setWifiMessageType('success');
    }, 1500);
  };

  const handleWifiDisconnect = () => {
    setWifiStatus('Disconnected');
    setWifiMessage('Disconnected successfully');
    setWifiMessageType('warning');
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;

    try {
      // Temporarily change text color to black for PDF visibility
      const originalColor = reportRef.current.style.color;
      reportRef.current.style.color = 'black';
      const allElements = reportRef.current.querySelectorAll('*');
      const originalColors = [];
      allElements.forEach(el => {
        originalColors.push(el.style.color);
        el.style.color = 'black';
      });

      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      // Revert colors back
      reportRef.current.style.color = originalColor;
      allElements.forEach((el, index) => {
        el.style.color = originalColors[index];
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pdf = new jsPDF('p', 'mm', 'A4');

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const fileName = `${reportTab}-report-${selectedPeriodValue}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const reportGroups = (() => {
    const daily = {};
    const weekly = {};
    const monthly = {};
    const yearly = {};

    readings.forEach((r) => {
      const date = new Date(r.timestamp);
      if (Number.isNaN(date.getTime())) return;

      const dayKey = date.toISOString().slice(0, 10);
      const dayLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      if (!daily[dayKey]) {
        daily[dayKey] = { label: dayLabel, readings: [] };
      }
      daily[dayKey].readings.push(r);

      const weekStart = new Date(date);
      const weekDay = (weekStart.getDay() + 6) % 7;
      weekStart.setDate(weekStart.getDate() - weekDay);
      weekStart.setHours(0, 0, 0, 0);
      const weekKey = weekStart.toISOString().slice(0, 10);
      const weekLabel = `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      if (!weekly[weekKey]) {
        weekly[weekKey] = { label: weekLabel, readings: [] };
      }
      weekly[weekKey].readings.push(r);

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (!monthly[monthKey]) {
        monthly[monthKey] = { label: monthLabel, readings: [] };
      }
      monthly[monthKey].readings.push(r);

      const yearKey = `${date.getFullYear()}`;
      const yearLabel = `Year ${yearKey}`;
      if (!yearly[yearKey]) {
        yearly[yearKey] = { label: yearLabel, readings: [] };
      }
      yearly[yearKey].readings.push(r);
    });

    return { daily, weekly, monthly, yearly };
  })();

  useEffect(() => {
    const dailyKeys = Object.keys(reportGroups.daily).sort((a, b) => b.localeCompare(a));
    const weeklyKeys = Object.keys(reportGroups.weekly).sort((a, b) => b.localeCompare(a));
    const monthlyKeys = Object.keys(reportGroups.monthly).sort((a, b) => b.localeCompare(a));
    const yearlyKeys = Object.keys(reportGroups.yearly).sort((a, b) => b.localeCompare(a));

    if (reportTab === 'daily' && !selectedDailyDate && dailyKeys.length) {
      setSelectedDailyDate(dailyKeys[0]);
    }
    if (reportTab === 'weekly' && !selectedWeeklyPeriod && weeklyKeys.length) {
      setSelectedWeeklyPeriod(weeklyKeys[0]);
    }
    if (reportTab === 'monthly' && !selectedMonthlyPeriod && monthlyKeys.length) {
      setSelectedMonthlyPeriod(monthlyKeys[0]);
    }
    if (reportTab === 'yearly' && !selectedYearlyPeriod && yearlyKeys.length) {
      setSelectedYearlyPeriod(yearlyKeys[0]);
    }
  }, [reportGroups, reportTab, selectedDailyDate, selectedWeeklyPeriod, selectedMonthlyPeriod, selectedYearlyPeriod]);

  const reportOptions = {
    daily: Object.entries(reportGroups.daily)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, item]) => ({ key, label: item.label })),
    weekly: Object.entries(reportGroups.weekly)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, item]) => ({ key, label: item.label })),
    monthly: Object.entries(reportGroups.monthly)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, item]) => ({ key, label: item.label })),
    yearly: Object.entries(reportGroups.yearly)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, item]) => ({ key, label: item.label })),
  };

  const reportData = (() => {
    const selectedKey = reportTab === 'daily'
      ? selectedDailyDate
      : reportTab === 'weekly'
        ? selectedWeeklyPeriod
        : reportTab === 'monthly'
          ? selectedMonthlyPeriod
          : selectedYearlyPeriod;

    const selectedGroup = reportGroups[reportTab][selectedKey];
    if (!selectedGroup) return null;

    const sortedReadings = [...selectedGroup.readings].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    // Use latest reading's cumulative energy (backend now stores cumulative values)
    const totalEnergy = sortedReadings.length > 0 ? normalizeNumericValue(sortedReadings[sortedReadings.length - 1].energy_kwh, 0) : 0;
    const averagePower = sortedReadings.length
      ? sortedReadings.reduce((sum, item) => sum + (item.power || 0), 0) / sortedReadings.length
      : 0;

    const peakReading = sortedReadings.reduce((best, item) => {
      const power = item.power || 0;
      return power > best.power ? { power, time: item.timestamp, date: new Date(item.timestamp) } : best;
    }, { power: 0, time: '', date: null });

    // Format peak time based on report type
    let peakTimeFormatted = 'N/A';
    if (peakReading.time) {
      const peakDate = new Date(peakReading.time);
      if (reportTab === 'daily') {
        peakTimeFormatted = peakDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (reportTab === 'weekly') {
        peakTimeFormatted = peakDate.toLocaleDateString([], { weekday: 'long' });
      } else if (reportTab === 'monthly') {
        peakTimeFormatted = peakDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
      } else if (reportTab === 'yearly') {
        // Calculate week number
        const yearStart = new Date(peakDate.getFullYear(), 0, 1);
        const weekNum = Math.ceil((((peakDate - yearStart) / 86400000) + yearStart.getDay() + 1) / 7);
        const monthName = peakDate.toLocaleDateString([], { month: 'short' });
        const dayNum = peakDate.getDate();
        peakTimeFormatted = `Week ${weekNum}, ${monthName} ${dayNum}`;
      }
    }

    // Determine grouping interval based on report type
    let groupingFunction;
    let timestampCreator;

    if (reportTab === 'daily') {
      // Daily: hourly grouping
      groupingFunction = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
      timestampCreator = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours());
    } else if (reportTab === 'weekly') {
      // Weekly: daily grouping
      groupingFunction = (date) => date.toISOString().slice(0, 10);
      timestampCreator = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
    } else if (reportTab === 'monthly') {
      // Monthly: weekly grouping
      groupingFunction = (date) => {
        const yearStart = new Date(date.getFullYear(), 0, 1);
        const weekNum = Math.ceil(((date - yearStart) / 86400000 + yearStart.getDay() + 1) / 7);
        return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
      };
      timestampCreator = (date) => {
        const yearStart = new Date(date.getFullYear(), 0, 1);
        const weekNum = Math.ceil(((date - yearStart) / 86400000 + yearStart.getDay() + 1) / 7);
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const weekStart = new Date(firstDayOfYear);
        weekStart.setDate(weekStart.getDate() + (weekNum - 1) * 7);
        return weekStart;
      };
    } else {
      // Yearly: monthly grouping
      groupingFunction = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      timestampCreator = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
    }

    const timeGroups = sortedReadings.reduce((groups, item) => {
      const date = new Date(item.timestamp);
      const timeKey = groupingFunction(date);
      if (!groups[timeKey]) {
        groups[timeKey] = {
          timestamp: timestampCreator(date),
          lastEnergy: 0,  // Track latest cumulative energy for this interval
          powerSum: 0,
          count: 0,
        };
      }
      // Always update to the latest energy value (newer readings have higher cumulative values)
      groups[timeKey].lastEnergy = item.energy_kwh || 0;
      if (typeof item.power === 'number') {
        groups[timeKey].powerSum += item.power;
        groups[timeKey].count += 1;
      }
      return groups;
    }, {});

    // Convert lastEnergy to consumption per interval by calculating differences
    let timeIntervals = Object.values(timeGroups).sort((a, b) => a.timestamp - b.timestamp);
    
    // Calculate consumption = difference between consecutive intervals
    for (let i = 0; i < timeIntervals.length; i++) {
      if (i === 0) {
        // First interval: consumption is the cumulative energy at that point
        timeIntervals[i].energy = timeIntervals[i].lastEnergy;
      } else {
        // Subsequent intervals: consumption is the difference from previous interval
        timeIntervals[i].energy = Math.max(0, timeIntervals[i].lastEnergy - timeIntervals[i - 1].lastEnergy);
      }
      delete timeIntervals[i].lastEnergy;  // Clean up temporary field
    }
    
    if (timeIntervals.length > 0) {
      const firstTime = new Date(timeIntervals[0].timestamp);
      let allIntervals = [];

      if (reportTab === 'daily') {
        // Create a map of existing hours for faster lookup
        const hourMap = new Map();
        timeIntervals.forEach(t => {
          const hour = t.timestamp.getHours();
          hourMap.set(hour, t);
        });
        
        // Display all 24 hours, but only show values for hours with data
        for (let hour = 0; hour < 24; hour++) {
          const hourTime = new Date(firstTime.getFullYear(), firstTime.getMonth(), firstTime.getDate(), hour);
          if (hourMap.has(hour)) {
            const existing = hourMap.get(hour);
            allIntervals.push(existing);
          } else {
            // No data for this hour - show 0
            allIntervals.push({
              timestamp: hourTime,
              energy: 0,
              powerSum: 0,
              count: 0,
            });
          }
        }
      } else if (reportTab === 'weekly') {
        // Fill days from earliest to today with forward-fill
        const selectedDate = new Date(selectedGroup.readings[0].timestamp);
        const dayOfWeek = selectedDate.getDay();
        const startDate = new Date(selectedDate);
        startDate.setDate(selectedDate.getDate() - dayOfWeek);

        // Create a map of existing days for faster lookup
        const dayMap = new Map();
        timeIntervals.forEach(t => {
          const dateStr = t.timestamp.toISOString().slice(0, 10);
          dayMap.set(dateStr, t);
        });

        // Get earliest reading and current date
        const now = new Date();
        const earliestReading = new Date(sortedReadings[0].timestamp);
        
        let lastValidAvgPower = 350; // Default average power
        // Display all 7 days of the week, but only show values for days with data
        for (let day = 0; day < 7; day++) {
          const dayTime = new Date(startDate);
          dayTime.setDate(startDate.getDate() + day);
          const dateStr = dayTime.toISOString().slice(0, 10);
          
          if (dayMap.has(dateStr)) {
            const existing = dayMap.get(dateStr);
            allIntervals.push(existing);
          } else {
            // No data for this day - show 0
            allIntervals.push({
              timestamp: dayTime,
              energy: 0,
              powerSum: 0,
              count: 0,
            });
          }
        }
      } else if (reportTab === 'monthly') {
        // Fill weeks from earliest reading to today with forward-fill
        const selectedDate = new Date(selectedGroup.readings[0].timestamp);
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        
        // Get the first day of the month
        const firstDayOfMonth = new Date(year, month, 1);
        // Get the last day of the month
        const lastDayOfMonth = new Date(year, month + 1, 0);
        
        // Find all Sundays (week starts) that fall within or overlap with this month
        const firstSunday = new Date(firstDayOfMonth);
        firstSunday.setDate(firstSunday.getDate() - firstSunday.getDay());
        
        const lastSunday = new Date(lastDayOfMonth);
        lastSunday.setDate(lastSunday.getDate() + (6 - lastSunday.getDay()));
        
        // Create a map of existing weeks for faster lookup
        const weekMap = new Map();
        timeIntervals.forEach(t => {
          const tYearStart = new Date(t.timestamp.getFullYear(), 0, 1);
          const tWeek = Math.ceil(((t.timestamp - tYearStart) / 86400000 + tYearStart.getDay() + 1) / 7);
          const key = `${t.timestamp.getFullYear()}-W${tWeek}`;
          weekMap.set(key, t);
        });

        // Get earliest reading and current time
        const now = new Date();
        const earliestReading = new Date(sortedReadings[0].timestamp);
        
        // Display all weeks from firstSunday to lastSunday, but only show values for weeks with data
        let lastValidAvgPower = 350; // Default average power
        for (let weekStart = new Date(firstSunday); weekStart <= lastSunday; weekStart.setDate(weekStart.getDate() + 7)) {
          const weekStartDate = new Date(weekStart);
          const tYearStart = new Date(weekStartDate.getFullYear(), 0, 1);
          const weekNum = Math.ceil(((weekStartDate - tYearStart) / 86400000 + tYearStart.getDay() + 1) / 7);
          const key = `${weekStartDate.getFullYear()}-W${weekNum}`;
          
          if (weekMap.has(key)) {
            const existing = weekMap.get(key);
            allIntervals.push(existing);
          } else {
            // No data for this week - show 0
            allIntervals.push({
              timestamp: weekStartDate,
              energy: 0,
              powerSum: 0,
              count: 0,
            });
          }
        }
      } else {
        // Yearly: fill months from earliest reading to current month only
        const selectedDate = new Date(selectedGroup.readings[0].timestamp);
        const year = selectedDate.getFullYear();
        
        // Create a map of existing months
        const monthMap = new Map();
        timeIntervals.forEach(t => {
          const key = `${t.timestamp.getFullYear()}-${t.timestamp.getMonth()}`;
          monthMap.set(key, t);
        });

        // Get earliest reading and current time
        const now = new Date();
        const earliestReading = new Date(sortedReadings[0].timestamp);
        const earliestMonth = earliestReading.getMonth();
        const currentMonth = now.getMonth();

        let lastValidAvgPower = 350; // Default average power
        // Display all 12 months, but only show values for months with data
        for (let monthNum = 0; monthNum < 12; monthNum++) {
          const monthTime = new Date(year, monthNum, 1);
          const key = `${year}-${monthNum}`;
          
          if (monthMap.has(key)) {
            const existing = monthMap.get(key);
            allIntervals.push(existing);
          } else {
            // No data for this month - show 0
            allIntervals.push({
              timestamp: monthTime,
              energy: 0,
              powerSum: 0,
              count: 0,
            });
          }
        }
      }

      timeIntervals = allIntervals.sort((a, b) => a.timestamp - b.timestamp);
    }

    const costPerUnit = costPerKwh; // User's cost per kWh

    const options = reportOptions[reportTab];
    const selectedIndex = options.findIndex(option => option.key === selectedKey);
    const previousIndex = selectedIndex + 1;
    const previousKey = options[previousIndex] ? options[previousIndex].key : null;
    const previousGroup = previousKey ? reportGroups[reportTab][previousKey] : null;
    const previousEnergy = previousGroup
      ? (() => {
        const sortedPreviousReadings = [...previousGroup.readings].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        return sortedPreviousReadings.length > 0 ? normalizeNumericValue(sortedPreviousReadings[sortedPreviousReadings.length - 1].energy_kwh, 0) : 0;
      })()
      : null;

    const comparison = (() => {
      if (previousEnergy === null || previousEnergy === 0) return null;
      const change = ((totalEnergy - previousEnergy) / previousEnergy) * 100;
      const label = change > 0 ? 'higher' : 'lower';
      const percent = safeToFixed(Math.abs(change), 1);
      
      let comparisonText = `${percent}% ${label} than `;
      if (reportTab === 'daily') {
        comparisonText += 'the previous day';
      } else if (reportTab === 'weekly') {
        comparisonText += 'the previous week';
      } else if (reportTab === 'monthly') {
        const currentMonthLabel = selectedGroup ? selectedGroup.label : 'current month';
        const previousMonthLabel = previousGroup ? previousGroup.label : 'previous month';
        comparisonText = `${currentMonthLabel}: ${percent}% ${label} compared to ${previousMonthLabel}`;
      } else {
        comparisonText += 'the previous year';
      }
      
      return {
        text: comparisonText,
        color: change > 0 ? 'red' : 'green',
      };
    })();

    const reportTitle = reportTab === 'daily'
      ? selectedGroup.label
      : selectedGroup.label;

    return {
      title: `${reportTab.charAt(0).toUpperCase() + reportTab.slice(1)} Power Consumption Report - ${reportTitle}`,
      totalEnergy: safeToFixed(totalEnergy, 2),
      averagePower: safeToFixed(averagePower, 0),
      peakPower: safeToFixed(peakReading?.power, 0),
      peakTime: peakTimeFormatted,
      totalCost: safeToFixed(totalEnergy * costPerUnit, 2),
      costPerUnit,
      comparison,
      rows: timeIntervals.map((item) => ({
        timestamp: item.timestamp.toLocaleString(),
        energy: safeToFixed(item.energy, 3),
        averagePower: item.count ? Math.round(item.powerSum / item.count).toString() : '0',
      })),
      chartData: (() => {
        const chartLabels = timeIntervals.map((item) => {
          if (reportTab === 'daily') {
            return item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } else if (reportTab === 'weekly') {
            return item.timestamp.toLocaleDateString([], { weekday: 'short' });
          } else if (reportTab === 'monthly') {
            const yearStart = new Date(item.timestamp.getFullYear(), 0, 1);
            const weekNum = Math.ceil(((item.timestamp - yearStart) / 86400000 + yearStart.getDay() + 1) / 7);
            return `W${weekNum}`;
          } else {
            return item.timestamp.toLocaleDateString([], { month: 'short' });
          }
        });

        const chartValues = timeIntervals.map((item) => item.count ? Math.round(item.powerSum / item.count) : 0);

        return {
          labels: chartLabels,
          datasets: [
            {
              label: 'Average Power (W)',
              data: chartValues,
              backgroundColor: 'rgba(34, 197, 94, 0.7)',
              borderColor: '#22c55e',
              borderWidth: 1,
            }
          ]
        };
      })(),
    };
  })();

  const reportTabLabels = [
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'yearly', label: 'Yearly' },
  ];

  const selectedPeriodOptions = reportTab === 'daily'
    ? reportOptions.daily
    : reportTab === 'weekly'
      ? reportOptions.weekly
      : reportOptions.monthly;

  const selectedPeriodValue = reportTab === 'daily'
    ? selectedDailyDate
    : reportTab === 'weekly'
      ? selectedWeeklyPeriod
      : reportTab === 'monthly'
        ? selectedMonthlyPeriod
        : selectedYearlyPeriod;

  const setSelectedPeriodValue = (value) => {
    if (reportTab === 'daily') setSelectedDailyDate(value);
    if (reportTab === 'weekly') setSelectedWeeklyPeriod(value);
    if (reportTab === 'monthly') setSelectedMonthlyPeriod(value);
    if (reportTab === 'yearly') setSelectedYearlyPeriod(value);
  };

  const reportComparison = reportData ? reportData.comparison : null;

  const reportNoDataMessage = 'No readings are available for the selected period yet.';



  const reportTitleLabel = reportData ? reportData.title : '';

  const reportEnergyMessage = reportData ? `${reportData.totalEnergy} kWh` : '0.00 kWh';
  const reportAveragePowerMessage = reportData ? `${reportData.averagePower} W` : '0 W';
  const reportPeakPowerMessage = reportData ? (() => {
    const preposition = reportTab === 'daily' ? 'at' : 'on';
    return `${reportData.peakPower} W ${preposition} ${reportData.peakTime}`;
  })() : 'N/A';
  const reportCostMessage = reportData ? `KES ${reportData.totalCost}` : 'KES 0.00';
  const reportCompareMessage = reportComparison ? reportComparison.text : 'No previous period available for comparison.';


  const reportRows = reportData ? reportData.rows : [];
  const reportChartData = reportData ? reportData.chartData : { datasets: [] };

  const reportChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    animation: {
      duration: 500,
    },
    scales: {
      x: {
        type: 'category',
        ticks: {
          maxRotation: 45,
          minRotation: 0,
          autoSkip: false,
          autoSkipPadding: 10,
          font: {
            size: 11,
          },
          color: '#9ca3af',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        beginAtZero: true,
        title: {
          display: true,
          text: 'Power (W)',
          font: {
            size: 12,
            weight: 'bold',
          },
          color: '#22c55e',
        },
        ticks: {
          font: {
            size: 11,
          },
          color: '#22c55e',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          font: {
            size: 12,
            weight: 'bold',
          },
          color: '#9ca3af',
          usePointStyle: true,
          padding: 15,
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#22c55e',
        borderWidth: 1,
        displayColors: true,
        padding: 10,
        titleFont: {
          size: 12,
          weight: 'bold',
        },
        bodyFont: {
          size: 11,
        },
      },
      datalabels: {
        display: true,
        color: '#fff',
        font: {
          size: 12,
          weight: 'bold',
        },
        anchor: 'end',
        align: 'top',
        offset: 5,
        formatter: function(value, context) {
          return value > 0 ? Math.round(value) : '';
        },
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 3,
        padding: 4,
      },
    },
  };

  const reportPeriodLabel = reportTabLabels.find((tab) => tab.key === reportTab)?.label || '';



  const monthlyHistory = (() => {
    const now = new Date();
    const months = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.push({
        key: monthKey,
        label: date.toLocaleString('default', { month: 'long', year: 'numeric' }),
        energy: 0,
        powerSum: 0,
        powerCount: 0,
        peakPower: 0,
      });
    }

    readings.forEach((r) => {
      const date = new Date(r.timestamp);
      if (Number.isNaN(date.getTime())) return;
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const group = months.find(m => m.key === monthKey);
      if (group) {
        if (typeof r.energy_kwh === 'number') {
          group.energy += r.energy_kwh;
        }
        if (typeof r.power === 'number') {
          group.powerSum += r.power;
          group.powerCount += 1;
          group.peakPower = Math.max(group.peakPower, r.power);
        }
      }
    });

    return months;
  })();

  // Get hourly aggregated data for use in reports
  const getHourlyAggregatedDataForReports = (readingsArray) => {
    if (!readingsArray || readingsArray.length === 0) return { power: [], voltage: [], current: [] };

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const currentHourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0);
    
    const recentReadings = readingsArray.filter(r => {
      try {
        const ts = new Date(r.timestamp);
        return ts >= oneDayAgo && isFinite(ts.getTime());
      } catch {
        return false;
      }
    }).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const result = {
      power: [],
      voltage: [],
      current: []
    };

    // Separate current hour readings from past readings
    const currentHourReadings = [];
    const pastHourReadings = new Map();
    
    recentReadings.forEach(r => {
      try {
        const ts = new Date(r.timestamp);
        const hourStart = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate(), ts.getHours(), 0, 0);
        const hourKey = hourStart.getTime();
        
        if (hourKey === currentHourStart.getTime()) {
          // Current hour: keep individual readings
          currentHourReadings.push({
            timestamp: ts,
            power: normalizeNumericValue(r.power),
            voltage: normalizeNumericValue(r.voltage),
            current: normalizeNumericValue(r.current)
          });
        } else {
          // Past hours: aggregate
          if (!pastHourReadings.has(hourKey)) {
            pastHourReadings.set(hourKey, { 
              power: [], 
              voltage: [], 
              current: [], 
              timestamp: hourStart 
            });
          }
          const power = normalizeNumericValue(r.power);
          const voltage = normalizeNumericValue(r.voltage);
          const current = normalizeNumericValue(r.current);
          
          if (isFinite(power)) pastHourReadings.get(hourKey).power.push(power);
          if (isFinite(voltage)) pastHourReadings.get(hourKey).voltage.push(voltage);
          if (isFinite(current)) pastHourReadings.get(hourKey).current.push(current);
        }
      } catch (e) {
        // Skip invalid entries
      }
    });

    // Add past hours as averages
    Array.from(pastHourReadings.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([_, hourData]) => {
        const powerAvg = hourData.power.length > 0 
          ? hourData.power.reduce((a, b) => a + b, 0) / hourData.power.length 
          : 0;
        const voltageAvg = hourData.voltage.length > 0
          ? hourData.voltage.reduce((a, b) => a + b, 0) / hourData.voltage.length
          : 0;
        const currentAvg = hourData.current.length > 0
          ? hourData.current.reduce((a, b) => a + b, 0) / hourData.current.length
          : 0;

        result.power.push({ x: hourData.timestamp, y: powerAvg });
        result.voltage.push({ x: hourData.timestamp, y: voltageAvg });
        result.current.push({ x: hourData.timestamp, y: currentAvg });
      });

    // Add current hour as individual readings (for continuous curve)
    currentHourReadings.forEach(reading => {
      if (isFinite(reading.power)) result.power.push({ x: reading.timestamp, y: reading.power });
      if (isFinite(reading.voltage)) result.voltage.push({ x: reading.timestamp, y: reading.voltage });
      if (isFinite(reading.current)) result.current.push({ x: reading.timestamp, y: reading.current });
    });

    return result;
  };

  const realtimeLineData = {
    datasets: [
      {
        label: 'Power (W)',
        data: readings
          .slice(0, 30)
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
          .map(r => ({ 
            x: new Date(r.timestamp), 
            y: normalizeNumericValue(r.power) 
          })),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.05)',
        tension: 0.2,
        borderWidth: 3,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: '#ef4444',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        yAxisID: 'y',
      },
      {
        label: 'Voltage (V)',
        data: readings
          .slice(0, 30)
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
          .map(r => ({ 
            x: new Date(r.timestamp), 
            y: normalizeNumericValue(r.voltage) 
          })),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.05)',
        tension: 0.2,
        borderWidth: 3,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        yAxisID: 'y1',
      },
      {
        label: 'Current (A)',
        data: readings
          .slice(0, 30)
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
          .map(r => ({ 
            x: new Date(r.timestamp), 
            y: normalizeNumericValue(r.current) 
          })),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.05)',
        tension: 0.2,
        borderWidth: 3,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: '#f59e0b',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        yAxisID: 'y2',
      }
    ]
  };

  const getHourlyMetricBars = (sourceReadings, hourCount = 12) => {
    const now = new Date();
    const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
    const startHour = new Date(currentHour);
    startHour.setHours(currentHour.getHours() - (hourCount - 1));

    const hourlyValues = new Map();
    sourceReadings.forEach((reading) => {
      const timestamp = new Date(reading.timestamp);
      if (Number.isNaN(timestamp.getTime())) return;

      const hourStart = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate(), timestamp.getHours(), 0, 0, 0);
      if (hourStart < startHour || hourStart > currentHour) return;

      const hourKey = hourStart.getTime();
      if (!hourlyValues.has(hourKey)) {
        hourlyValues.set(hourKey, { power: [], voltage: [], current: [] });
      }

      const power = normalizeNumericValue(reading.power, NaN);
      const voltage = normalizeNumericValue(reading.voltage, NaN);
      const current = normalizeNumericValue(reading.current, NaN);
      if (isFinite(power)) hourlyValues.get(hourKey).power.push(power);
      if (isFinite(voltage)) hourlyValues.get(hourKey).voltage.push(voltage);
      if (isFinite(current)) hourlyValues.get(hourKey).current.push(current);
    });

    const powerBars = [];
    const voltageBars = [];
    const currentBars = [];

    // Track last valid values for forward-fill
    let lastValidPower = 350; // Default
    let lastValidVoltage = 230; // Default
    let lastValidCurrent = 350 / 230; // Default

    for (let i = 0; i < hourCount; i += 1) {
      const slot = new Date(startHour);
      slot.setHours(startHour.getHours() + i);
      const key = slot.getTime();
      const metricValues = hourlyValues.get(key) || { power: [], voltage: [], current: [] };
      
      let avgPower = metricValues.power.length
        ? metricValues.power.reduce((sum, value) => sum + value, 0) / metricValues.power.length
        : lastValidPower; // Forward-fill with last valid value
      
      let avgVoltage = metricValues.voltage.length
        ? metricValues.voltage.reduce((sum, value) => sum + value, 0) / metricValues.voltage.length
        : lastValidVoltage; // Forward-fill with last valid value
      
      let avgCurrent = metricValues.current.length
        ? metricValues.current.reduce((sum, value) => sum + value, 0) / metricValues.current.length
        : lastValidCurrent; // Forward-fill with last valid value

      // Update last valid values only if this hour has actual data
      if (metricValues.power.length > 0) lastValidPower = avgPower;
      if (metricValues.voltage.length > 0) lastValidVoltage = avgVoltage;
      if (metricValues.current.length > 0) lastValidCurrent = avgCurrent;

      powerBars.push({ x: slot, y: avgPower });
      voltageBars.push({ x: slot, y: avgVoltage });
      currentBars.push({ x: slot, y: avgCurrent });
    }

    return { powerBars, voltageBars, currentBars };
  };

  const { powerBars, voltageBars, currentBars } = getHourlyMetricBars(readings, 12);

  const drawBarValueLabels = (chart) => {
    const { ctx, chartArea } = chart;
    const datasets = chart.data.datasets || [];
    if (!datasets.length || !chartArea) return;

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.lineWidth = 3;
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta?.data?.length) return;

      meta.data.forEach((barElement, index) => {
        const value = dataset.data?.[index]?.y;
        if (!isFinite(value)) return;

        const barProps = barElement.getProps(['x', 'y'], true);
        const textY = Math.max(barProps.y - 12, chartArea.top + 14);
        const text = safeToFixed(value, dataset.unit === 'A' ? 2 : 1);
        ctx.strokeText(text, barProps.x, textY);
        ctx.fillText(text, barProps.x, textY);
      });
    });

    ctx.restore();
  };

  const barValueLabelPlugin = {
    id: 'barValueLabelPlugin',
    afterDatasetsDraw(chart) {
      drawBarValueLabels(chart);
    }
  };

  // Bar chart data with consecutive hourly bars
  const barData = {
    datasets: [
      {
        label: 'Average Power (W) per Hour',
        unit: 'W',
        data: powerBars,
        backgroundColor: 'rgba(239, 68, 68, 0.65)',
        borderColor: '#dc2626',
        borderWidth: 2,
        borderRadius: 6,
        barThickness: 10,
      },
      {
        label: 'Average Voltage (V) per Hour',
        unit: 'V',
        data: voltageBars,
        backgroundColor: 'rgba(16, 185, 129, 0.65)',
        borderColor: '#059669',
        borderWidth: 2,
        borderRadius: 6,
        barThickness: 10,
      },
      {
        label: 'Average Current (A) per Hour',
        unit: 'A',
        data: currentBars,
        backgroundColor: 'rgba(245, 158, 11, 0.65)',
        borderColor: '#d97706',
        borderWidth: 2,
        borderRadius: 6,
        barThickness: 10,
      }
    ]
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'x',
    layout: {
      padding: {
        top: 36,
      },
    },
    animation: {
      onProgress: (animationContext) => drawBarValueLabels(animationContext.chart),
      onComplete: (animationContext) => drawBarValueLabels(animationContext.chart),
    },
    scales: {
      y: {
        beginAtZero: true,
        stacked: false,
        ticks: {
          font: {
            size: 11,
          },
          color: '#9ca3af',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
      x: {
        type: 'time',
        min: powerBars[0]?.x,
        max: powerBars[powerBars.length - 1]?.x,
        offset: true,
        time: {
          unit: 'hour',
          stepSize: 1,
          round: 'hour',
          displayFormats: {
            hour: 'HH:mm'
          }
        },
        ticks: {
          font: {
            size: 12,
            weight: 'bold',
          },
          color: '#9ca3af',
          autoSkip: false,
          maxRotation: 0,
        },
        title: {
          display: true,
          text: 'Time (12 consecutive hours)',
          color: '#9ca3af',
          font: {
            size: 12,
            weight: 'bold',
          },
        },
        grid: {
          display: false,
        },
      },
    },
    plugins: {
      annotations: {
        xaxis: [],
        yaxis: [],
        points: [],
        texts: [],
        images: [],
      },
      datalabels: {
        display: false,
      },
      legend: {
        display: true,
        position: 'top',
        labels: {
          font: {
            size: 12,
            weight: 'bold',
          },
          color: '#9ca3af',
          usePointStyle: true,
          padding: 15,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#22c55e',
        borderWidth: 1,
        displayColors: true,
        padding: 10,
        titleFont: {
          size: 12,
          weight: 'bold',
        },
        bodyFont: {
          size: 11,
        },
        callbacks: {
          label: function(context) {
            const value = context.parsed.y;
            const unit = context.dataset.unit || '';
            return `${context.dataset.label}: ${safeToFixed(value, unit === 'A' ? 3 : 2)} ${unit}`;
          },
          title: function(context) {
            if (!context?.length) return '';
            return new Date(context[0].parsed.x).toLocaleString([], {
              hour: '2-digit',
              minute: '2-digit',
              day: '2-digit',
              month: 'short'
            });
          },
        },
      },
    },
  };

  const realtimeLineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    animation: {
      duration: 750,
      easing: 'easeInOutQuart'
    },
    layout: {
      padding: {
        left: 10,
        right: 50,
        top: 10,
        bottom: 10
      }
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: windowWidth < 640 ? 'second' : 'minute',
          stepSize: windowWidth < 640 ? 5 : 2,
          displayFormats: {
            second: 'HH:mm:ss',
            minute: 'HH:mm:ss'
          }
        },
        ticks: {
          font: {
            size: windowWidth < 640 ? 10 : 12
          },
          color: '#9ca3af',
          maxRotation: 45,
          minRotation: 0
        },
        title: {
          display: true,
          text: 'Time',
          font: {
            size: windowWidth < 640 ? 12 : 14,
            weight: 'bold'
          },
          color: '#9ca3af'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        beginAtZero: true,
        min: 0,
        max: 1000,
        title: {
          display: true,
          text: 'Power (W)',
          font: {
            size: windowWidth < 640 ? 12 : 14,
            weight: 'bold'
          },
          color: '#ef4444'
        },
        ticks: {
          font: {
            size: windowWidth < 640 ? 10 : 12
          },
          color: '#ef4444',
          callback: function(value) {
            const num = normalizeNumericValue(value);
            return isFinite(num) ? num.toFixed(0) : '0';
          }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        beginAtZero: true,
        min: 0,
        max: 250,
        title: {
          display: true,
          text: 'Voltage (V)',
          font: {
            size: windowWidth < 640 ? 12 : 14,
            weight: 'bold'
          },
          color: '#10b981'
        },
        ticks: {
          font: {
            size: windowWidth < 640 ? 10 : 12
          },
          color: '#10b981'
        },
        grid: {
          drawOnChartArea: false,
        }
      },
      y2: {
        type: 'linear',
        display: true,
        position: 'right',
        offset: true,
        beginAtZero: true,
        min: 0,
        max: 6,
        title: {
          display: true,
          text: 'Current (A)',
          font: {
            size: windowWidth < 640 ? 12 : 14,
            weight: 'bold'
          },
          color: '#f59e0b'
        },
        ticks: {
          font: {
            size: windowWidth < 640 ? 10 : 12
          },
          color: '#f59e0b'
        },
        grid: {
          drawOnChartArea: false,
        }
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          font: {
            size: windowWidth < 640 ? 11 : 13,
            weight: 'bold'
          },
          usePointStyle: true,
          padding: 15,
          color: '#e5e7eb'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14,
          weight: 'bold'
        },
        bodyFont: {
          size: 13
        },
        borderColor: '#4f46e5',
        borderWidth: 2,
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              const num = normalizeNumericValue(context.parsed.y);
              label += isFinite(num) ? num.toFixed(2) : '0.00';
            }
            return label;
          }
        }
      }
    }
  };

  const weeklyBarData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{
      label: 'Daily Consumption (kWh)',
      data: [45, 52, 38, 61, 55, 48, 50],
      backgroundColor: '#6366f1',
    }]
  };

  // Daily Insights Calculations
  const dailyInsights = (() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayKey = today.toDateString();
    const yesterdayKey = yesterday.toDateString();

    // Get the latest reading for today (cumulative energy)
    let todayEnergy = 0;
    let yesterdayEnergy = 0;

    const todayReadings = readings.filter(r => new Date(r.timestamp).toDateString() === todayKey);
    const yesterdayReadings = readings.filter(r => new Date(r.timestamp).toDateString() === yesterdayKey);

    // Get the latest reading's cumulative energy (it's already cumulative from backend)
    if (todayReadings.length > 0) {
      todayEnergy = normalizeNumericValue(todayReadings[0].energy_kwh, 0);
    }

    if (yesterdayReadings.length > 0) {
      yesterdayEnergy = normalizeNumericValue(yesterdayReadings[0].energy_kwh, 0);
    }

    const percentageChange = yesterdayEnergy > 0 ? ((todayEnergy - yesterdayEnergy) / yesterdayEnergy * 100) : 0;
    const isHigher = percentageChange > 0;

    return {
      todayEnergy: safeToFixed(todayEnergy, 2),
      yesterdayEnergy: safeToFixed(yesterdayEnergy, 2),
      percentageChange: safeToFixed(Math.abs(percentageChange), 1),
      isHigher
    };
  })();

  // Weekly Insights Calculations
  const insights = (() => {
    const today = new Date();
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay()); // Start of this week (Sunday)
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7); // Start of last week
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1); // End of last week (Saturday)

    let thisWeekEnergy = 0;
    let lastWeekEnergy = 0;

    readings.forEach((r) => {
      const date = new Date(r.timestamp);
      if (date >= thisWeekStart && typeof r.energy_kwh === 'number') {
        thisWeekEnergy += r.energy_kwh;
      } else if (date >= lastWeekStart && date <= lastWeekEnd && typeof r.energy_kwh === 'number') {
        lastWeekEnergy += r.energy_kwh;
      }
    });

    const weeklyChange = lastWeekEnergy > 0 ? ((thisWeekEnergy - lastWeekEnergy) / lastWeekEnergy * 100) : 0;
    const weeklyIsHigher = weeklyChange > 0;

    return {
      thisWeekEnergy: safeToFixed(thisWeekEnergy, 2),
      lastWeekEnergy: safeToFixed(lastWeekEnergy, 2),
      weeklyChange: safeToFixed(Math.abs(weeklyChange), 1),
      weeklyIsHigher
    };
  })();

  // Anomaly Detection
  const anomalyDetection = (() => {
    if (readings.length < 10) return { isAnomaly: false, average: '0', current: '0' };

    const last10Readings = readings.slice(0, 10);
    const averagePower = last10Readings.reduce((sum, r) => sum + normalizeNumericValue(r.power), 0) / last10Readings.length;
    const currentPower = normalizeNumericValue(latest.power);
    const isAnomaly = currentPower > averagePower * 1.3; // 30% above average

    return { isAnomaly, average: safeToFixed(averagePower, 0), current: safeToFixed(currentPower, 0) };
  })();

  // Format currency with commas and 2 decimals
  const formatCurrency = (value) => {
    const num = parseFloat(value) || 0;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Cost Calculations (KES 25 per kWh from readings)
  const costs = useMemo(() => {
    const COST_PER_KWH = 25;
    const now = new Date();
    
    let dailyEnergy = 0;
    let monthlyEnergy = 0;
    let yearlyEnergy = 0;
    
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    const yearStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
    
    readings.forEach(r => {
      const readingDate = new Date(r.timestamp);
      const energy = normalizeNumericValue(r.energy_kwh, 0);
      
      if (energy <= 0) return; // Skip invalid energy values
      
      if (readingDate >= todayStart) {
        dailyEnergy = Math.max(dailyEnergy, energy); // Use latest cumulative value
      }
      if (readingDate >= monthStart) {
        monthlyEnergy = Math.max(monthlyEnergy, energy); // Use latest cumulative value
      }
      if (readingDate >= yearStart) {
        yearlyEnergy = Math.max(yearlyEnergy, energy); // Use latest cumulative value
      }
    });
    
    // Calculate average daily cost (for estimation)
    let dailyCost = dailyEnergy * COST_PER_KWH;
    let monthlyCost = monthlyEnergy * COST_PER_KWH;
    let yearlyCost = yearlyEnergy * COST_PER_KWH;
    
    return {
      dailyEnergy: safeToFixed(dailyEnergy, 2),
      dailyCost: formatCurrency(dailyCost),
      monthlyCost: formatCurrency(monthlyCost),
      yearlyCost: formatCurrency(yearlyCost),
      costPerUnit: COST_PER_KWH
    };
  }, [readings]);

  // Remote Control Status

  const currentAmpValue = latest.current || 0;
  const voltageLimitExceeded = latest.voltage > maxAllowedVoltage;
  const currentLimitExceeded = currentAmpValue > maxAllowedCurrent;
  const brownoutDetected = latest.voltage > 0 && latest.voltage < 210;
  const rawProtectionAlert = currentLimitExceeded
    ? 'Overcurrent Detected – System limiting power to protect appliances'
    : brownoutDetected
      ? 'Brownout Detected – Voltage is unstable'
      : '';
  const protectionAlertMessage = resetProtection ? '' : rawProtectionAlert;

  useEffect(() => {
    if (!rawProtectionAlert && resetProtection) {
      setResetProtection(false);
    }
  }, [rawProtectionAlert, resetProtection]);

  useEffect(() => {
    if (voltageLimitExceeded && systemPowerOn) {
      setSystemPowerOn(false);
      setAutoShutdown(true);
      setUserAlertMessage('Maximum voltage limit reached. System has been turned off to protect appliances. Monitoring voltage for safe restart.');
    }
  }, [voltageLimitExceeded, systemPowerOn]);

  useEffect(() => {
    const voltageNormal = latest.voltage >= 210 && latest.voltage <= 240;
    if (autoShutdown && !systemPowerOn && voltageNormal) {
      setSystemPowerOn(true);
      setAutoShutdown(false);
      setUserAlertMessage('');
    }
  }, [autoShutdown, systemPowerOn, latest.voltage]);

  useEffect(() => {
    if (resetProtection) {
      setUserAlertMessage('');
    }
  }, [resetProtection]);

  // Recommendations
  const recommendations = (() => {
    const currentPower = latest.power || 0;
    const current = latest.current || 0;
    const voltage = latest.voltage || 0;

    const recs = [];

    if (currentPower > 2000) {
      recs.push({
        type: 'critical',
        message: 'High consumption detected. Consider turning off non-essential appliances to reduce energy waste.',
        icon: '⚠️'
      });
    } else if (currentPower > 1500) {
      recs.push({
        type: 'warning',
        message: 'Moderate power usage. Review connected devices and consider energy-efficient alternatives.',
        icon: '💡'
      });
    }

    if (anomalyDetection.isAnomaly) {
      recs.push({
        type: 'critical',
        message: 'Unusual spike detected. Check for faulty equipment or unexpected device activation.',
        icon: '🚨'
      });
    }

    if (voltage < 210 || voltage > 240) {
      recs.push({
        type: 'warning',
        message: 'Voltage levels are outside normal range. Monitor electrical system for stability.',
        icon: '⚡'
      });
    }

    if (current > 10) {
      recs.push({
        type: 'warning',
        message: 'High current draw detected. Check for overloaded circuits or high-power devices.',
        icon: '🔌'
      });
    }

    if (recs.length === 0) {
      recs.push({
        type: 'success',
        message: 'Energy usage is within normal parameters. Keep up the good work!',
        icon: '✅'
      });
    }

    return recs;
  })();

  // Energy Saving Tips
  const energySavingTips = (() => {
    const currentPower = latest.power || 0;
    const todayEnergy = parseFloat(dailyInsights.todayEnergy);
    const yesterdayEnergy = parseFloat(dailyInsights.yesterdayEnergy);
    const tips = [];

    if (currentPower > 1200) {
      tips.push({
        message: "High power usage detected. Consider switching off non-essential appliances like air conditioners or heaters during peak hours.",
        icon: "⚡"
      });
    }

    if (todayEnergy > yesterdayEnergy * 1.1) {
      tips.push({
        message: "Your energy consumption has increased today. Try shifting high-power devices to off-peak hours to save costs.",
        icon: "💡"
      });
    }

    if (tips.length === 0) {
      tips.push({
        message: "Using energy-efficient appliances can reduce your monthly bill by up to 20%.",
        icon: "🌱"
      });
    }

    return tips.slice(0, 3); // Return up to 3 tips
  })();

  // Historical Trends
  const historicalTrends = (() => {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    let totalEnergy = 0;
    let dayCount = 0;
    const dailyConsumptions = {};
    let peakDay = '';
    let peakEnergy = 0;

    readings.forEach((r) => {
      const date = new Date(r.timestamp);
      const dateKey = date.toDateString();

      if (date >= sevenDaysAgo && typeof r.energy_kwh === 'number') {
        if (!dailyConsumptions[dateKey]) {
          dailyConsumptions[dateKey] = 0;
          dayCount++;
        }
        dailyConsumptions[dateKey] += r.energy_kwh;
        totalEnergy += r.energy_kwh;

        if (dailyConsumptions[dateKey] > peakEnergy) {
          peakEnergy = dailyConsumptions[dateKey];
          peakDay = date.toLocaleDateString('en-US', { weekday: 'long' });
        }
      }
    });

    const averageDaily = dayCount > 0 ? totalEnergy / dayCount : 0;

    // Trend analysis (simple comparison of last 3 days vs previous 3 days)
    const dates = Object.keys(dailyConsumptions).sort();
    const recentDays = dates.slice(-3);
    const previousDays = dates.slice(-6, -3);

    const recentAvg = recentDays.length > 0 ? recentDays.reduce((sum, date) => sum + dailyConsumptions[date], 0) / recentDays.length : 0;
    const previousAvg = previousDays.length > 0 ? previousDays.reduce((sum, date) => sum + dailyConsumptions[date], 0) / previousDays.length : 0;

    let trendSummary = "Insufficient data for trend analysis.";
    if (recentAvg > 0 && previousAvg > 0) {
      const changePercent = ((recentAvg - previousAvg) / previousAvg * 100);
      if (Math.abs(changePercent) < 5) {
        trendSummary = "Consumption has been stable over the past few days.";
      } else if (changePercent > 0) {
        trendSummary = `Consumption has increased by ${safeToFixed(Math.abs(changePercent), 1)}% over the past 3 days.`;
      } else {
        trendSummary = `Consumption has decreased by ${safeToFixed(Math.abs(changePercent), 1)}% over the past 3 days.`;
      }
    }

    return {
      averageDaily: safeToFixed(averageDaily, 2),
      peakDay,
      peakEnergy: safeToFixed(peakEnergy, 2),
      trendSummary
    };
  })();

  return (
    <div className="app-shell">
      {user.loggedIn ? (
        <>
          {/* Navigation Bar */}
          <nav className="app-nav">
            <div className="nav-left">
              <button 
                onClick={() => setMenuOpen(!menuOpen)}
                className="nav-button"
              >
                ☰
              </button>
            </div>
            <div className="nav-center">
              <h1 className="page-title">
                {currentPage === 'history' ? 'MONTHLY USAGE' : currentPage.toUpperCase()}
              </h1>
            </div>

            {/* Floating Dropdown */}
            {menuOpen && (
              <div className="dropdown-panel" ref={dropdownRef}>
                <div className="dropdown-inner">
                  <div 
                    onClick={() => { setCurrentPage('dashboard'); setMenuOpen(false); }}
                    className="dropdown-item"
                  >
                    DASHBOARD
                  </div>
                  <div 
                    onClick={() => { setCurrentPage('history'); setMenuOpen(false); }}
                    className="dropdown-item"
                  >
                    MONTHLY USAGE
                  </div>
                  <div 
                    onClick={() => { setCurrentPage('reports'); setMenuOpen(false); }}
                    className="dropdown-item"
                  >
                    REPORTS
                  </div>
                  <div 
                    onClick={() => { setCurrentPage('copilot'); setMenuOpen(false); }}
                    className="dropdown-item"
                  >
                    AI COPILOT
                  </div>
                  <div 
                    onClick={() => { setCurrentPage('settings'); setMenuOpen(false); }}
                    className="dropdown-item"
                  >
                    SETTINGS
                  </div>
                  <div 
                    onClick={() => { setCurrentPage('help'); setMenuOpen(false); }}
                    className="dropdown-item"
                  >
                    HELP
                  </div>
                  <div 
                    onClick={() => { 
                      setUser({ name: '', email: '', loggedIn: false }); 
                      setCurrentPage('login'); 
                      setMenuOpen(false); 
                    }}
                    className="dropdown-item"
                  >
                    LOGOUT
                  </div>
                </div>
              </div>
            )}
          </nav>

          <div className="app-content">
            {/* Dashboard Content */}
            {currentPage === 'dashboard' && (
              <>
                {/* Gauges - Horizontal on desktop, vertical on mobile */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                  <div className="bg-zinc-900 p-6 sm:p-8 rounded-3xl text-center border border-blue-500 min-h-[140px] flex flex-col justify-center">
                    <p className="text-blue-400 text-sm">Current Power</p>
                    <p className="text-4xl sm:text-5xl font-bold text-blue-400 mt-3">
                      {safeToFixed(latest.power, 0)} <span className="text-2xl">W</span>
                    </p>
                  </div>

                  <div className="bg-zinc-900 p-6 sm:p-8 rounded-3xl text-center border border-green-500 min-h-[140px] flex flex-col justify-center">
                    <p className="text-green-400 text-sm">Voltage</p>
                    <p className="text-4xl sm:text-5xl font-bold text-green-400 mt-3">
                      {safeToFixed(latest.voltage, 0)} <span className="text-2xl">V</span>
                    </p>
                  </div>

                  <div className="bg-zinc-900 p-6 sm:p-8 rounded-3xl text-center border border-red-500 min-h-[140px] flex flex-col justify-center">
                    <p className="text-red-400 text-sm">Current</p>
                    <p className="text-4xl sm:text-5xl font-bold text-red-400 mt-3">
                      {safeToFixed(latest.current, 2)} <span className="text-2xl">A</span>
                    </p>
                  </div>

                  <div className="bg-zinc-900 p-6 sm:p-8 rounded-3xl text-center border border-purple-500 min-h-[140px] flex flex-col justify-center">
                    <div className="text-center">
                      <div className="text-5xl mb-2">⚡</div>
                      <p className="text-sm text-gray-400">Live Status</p>
                    </div>
                  </div>
                </div>

                {lastUpdated && (
                  <div style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                    Last Updated: {lastUpdated.toLocaleTimeString()}
                  </div>
                )}

                <div className="bg-zinc-900 p-6 rounded-3xl mb-8">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-semibold text-white">Remote Control Panel</h3>
                    <p className="text-sm text-white mt-1">Simulated remote power and protection controls</p>
                  </div>

                  {userAlertMessage && (
                    <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm mb-5">
                      {userAlertMessage}
                    </div>
                  )}

                  <div className="mb-8">
                    <div className="flex items-center justify-between gap-4">
                      <label className="text-base font-medium text-white">System Power</label>
                      <label className="relative inline-flex items-center cursor-pointer h-12 w-24 flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={systemPowerOn}
                          onChange={() => setSystemPowerOn(prev => !prev)}
                          className="peer sr-only"
                        />
                        <span className="w-full h-12 rounded-lg bg-gray-700 peer-checked:bg-blue-500 transition-colors duration-300"></span>
                        <span className="absolute left-2 text-sm font-semibold text-white peer-checked:hidden">OFF</span>
                        <span className="absolute right-2 text-sm font-semibold text-white hidden peer-checked:block">ON</span>
                      </label>
                    </div>
                  </div>

                  <div className="mb-8">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-base font-medium text-white block mb-3">Maximum Allowed Voltage</label>
                        <input
                          type="number"
                          min="180"
                          max="260"
                          value={maxAllowedVoltage}
                          onChange={(e) => setMaxAllowedVoltage(Number(e.target.value))}
                          className="w-full px-4 py-2 bg-gray-700 border border-green-500 rounded-lg text-white font-semibold focus:outline-none focus:ring-2 focus:ring-green-400"
                        />
                        <p className="text-sm text-green-400 mt-2">{maxAllowedVoltage} V</p>
                        {voltageLimitExceeded && systemPowerOn && (
                          <p className="text-sm text-orange-400 mt-2">Voltage limit reached.</p>
                        )}
                      </div>
                      <div>
                        <label className="text-base font-medium text-white block mb-3">Maximum Allowed Current</label>
                        <input
                          type="number"
                          min="0"
                          max="15"
                          step="0.1"
                          value={maxAllowedCurrent}
                          onChange={(e) => setMaxAllowedCurrent(Number(e.target.value))}
                          className="w-full px-4 py-2 bg-gray-700 border border-red-500 rounded-lg text-white font-semibold focus:outline-none focus:ring-2 focus:ring-red-400"
                        />
                        <p className="text-sm text-red-400 mt-2">{maxAllowedCurrent.toFixed(1)} A</p>
                        {currentLimitExceeded && systemPowerOn && (
                          <p className="text-sm text-orange-400 mt-2">Current exceeds limit.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {protectionAlertMessage && (
                    <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm mb-5">
                      {protectionAlertMessage}
                    </div>
                  )}

                  <button
                    type="button"
                    className="w-full py-4 px-6 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors duration-200"
                    onClick={handleResetProtection}
                  >
                    Reset Protection
                  </button>
                </div>

                <div className="panel panel--chart">
                  <h3 className="panel-title">Real-Time Energy Usage</h3>
                  <div className="chart-container" style={{ height: windowWidth < 640 ? '320px' : '380px' }}>
                    <Bar ref={chartRef} data={barData} options={barOptions} plugins={[barValueLabelPlugin]} />
                  </div>
                </div>

                {/* Daily Insights & Recommendations */}
                <div className="insights-section">
                  <h3 className="panel-title">Daily Insights & Recommendations</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    {/* Daily Comparison */}
                    <div className="insight-card insight-card--comparison">
                      <div className="insight-header">
                        <span className="insight-icon">📊</span>
                        <h4>Daily Comparison</h4>
                      </div>
                      <div className="insight-content">
                        <p className="comparison-text">
                          Today's consumption is <span className={`comparison-value ${dailyInsights.isHigher ? 'higher' : 'lower'}`}>
                            {dailyInsights.percentageChange}%
                          </span> {dailyInsights.isHigher ? 'higher' : 'lower'} than yesterday
                        </p>
                        <div className="comparison-details">
                          <div className="detail-item">
                            <span className="detail-label">Today:</span>
                            <span className="detail-value">{dailyInsights.todayEnergy} kWh</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">Yesterday:</span>
                            <span className="detail-value">{dailyInsights.yesterdayEnergy} kWh</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Weekly Comparison */}
                    <div className="insight-card insight-card--weekly">
                      <div className="insight-header">
                        <span className="insight-icon">📈</span>
                        <h4>Weekly Comparison</h4>
                      </div>
                      <div className="insight-content">
                        <p className="comparison-text">
                          This week's consumption is <span className={`comparison-value ${insights.weeklyIsHigher ? 'higher' : 'lower'}`}>
                            {insights.weeklyChange}%
                          </span> {insights.weeklyIsHigher ? 'higher' : 'lower'} than last week
                        </p>
                        <div className="comparison-details">
                          <div className="detail-item">
                            <span className="detail-label">This Week:</span>
                            <span className="detail-value">{insights.thisWeekEnergy} kWh</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">Last Week:</span>
                            <span className="detail-value">{insights.lastWeekEnergy} kWh</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Cost Estimation */}
                    <div className="insight-card insight-card--cost">
                      <div className="insight-header">
                        <span className="insight-icon">💰</span>
                        <h4>Cost Estimation</h4>
                      </div>
                      <div className="insight-content">
                        <div className="cost-display">
                          <span className="cost-amount">KES {costs.dailyCost}</span>
                          <span className="cost-period">/ day</span>
                        </div>
                        <p className="cost-note">Based on KES {costs.costPerUnit} per kWh</p>
                      </div>
                    </div>

                    {/* Total Cost Today */}
                    <div className="insight-card insight-card--cost">
                      <div className="insight-header">
                        <span className="insight-icon">💵</span>
                        <h4>Total Cost Today</h4>
                      </div>
                      <div className="insight-content">
                        <div className="cost-display">
                          <span className="cost-amount">{costs.dailyEnergy} kWh</span>
                          <span className="cost-period">consumed</span>
                        </div>
                        <div className="cost-display" style={{ marginTop: '10px' }}>
                          <span className="cost-amount">KES {costs.dailyCost}</span>
                          <span className="cost-period">total cost</span>
                        </div>
                        <p className="cost-note">@ KES {costs.costPerUnit} per kWh</p>
                      </div>
                    </div>

                    {/* Total Cost This Month */}
                    <div className="insight-card insight-card--cost">
                      <div className="insight-header">
                        <span className="insight-icon">📅</span>
                        <h4>Total Cost This Month</h4>
                      </div>
                      <div className="insight-content">
                        <div className="cost-display">
                          <span className="cost-amount">KES {costs.monthlyCost}</span>
                          <span className="cost-period">total cost</span>
                        </div>
                      </div>
                    </div>

                    {/* Total Cost This Year */}
                    <div className="insight-card insight-card--cost">
                      <div className="insight-header">
                        <span className="insight-icon">📈</span>
                        <h4>Total Cost This Year</h4>
                      </div>
                      <div className="insight-content">
                        <div className="cost-display">
                          <span className="cost-amount">KES {costs.yearlyCost}</span>
                          <span className="cost-period">total cost</span>
                        </div>
                      </div>
                    </div>

                    {/* Anomaly Detection */}
                    {anomalyDetection.isAnomaly && (
                      <div className="insight-card insight-card--anomaly">
                        <div className="insight-header">
                          <span className="insight-icon">🚨</span>
                          <h4>Anomaly Detected</h4>
                        </div>
                        <div className="insight-content">
                          <p className="anomaly-text">
                            Current power ({anomalyDetection.current}W) is 30% above average ({anomalyDetection.average}W)
                          </p>
                          <p className="anomaly-recommendation">
                            Check for faulty equipment or unexpected device activation.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Recommendations */}
                  <div className="recommendations-section">
                    <h4>Recommendations</h4>
                    <div className="recommendations-list">
                      {recommendations.map((rec, index) => (
                        <div key={index} className={`recommendation-item recommendation--${rec.type}`}>
                          <span className="recommendation-icon">{rec.icon}</span>
                          <p className="recommendation-text">{rec.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Energy Saving Tips */}
                <div className="tips-section">
                  <h4>Energy Saving Tips</h4>
                  <div className="tips-list">
                    {energySavingTips.map((tip, index) => (
                      <div key={index} className="tip-item">
                        <span className="tip-icon">{tip.icon}</span>
                        <p className="tip-text">{tip.message}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Historical Trends */}
                <div className="trends-section">
                  <h4>Historical Trends</h4>
                  <div className="trends-list">
                    <div className="trend-item">
                      <span className="trend-icon">📊</span>
                      <p className="trend-text">Average Daily Consumption (Last 7 days): {historicalTrends.averageDaily} kWh</p>
                    </div>
                    <div className="trend-item">
                      <span className="trend-icon">🔺</span>
                      <p className="trend-text">Peak Consumption Day: {historicalTrends.peakDay} with {historicalTrends.peakEnergy} kWh</p>
                    </div>
                    <div className="trend-item">
                      <span className="trend-icon">📈</span>
                      <p className="trend-text">{historicalTrends.trendSummary}</p>
                    </div>
                  </div>
                </div>

                <div className="panel panel--chart">
                  <h3 className="panel-title">Daily Consumption</h3>
                  <Bar data={weeklyBarData} height={90} />
                </div>
              </>
            )}

            {/* Other Pages */}
            {currentPage === 'history' && (
              <div className="panel">
                <h2 className="panel-large-title">Monthly Usage</h2>
                <p className="usage-description">Last 12 months of monthly usage records.</p>
                <div className="table-responsive">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Energy Consumed (kWh)</th>
                        <th>Average Power (W)</th>
                        <th>Peak Power (W)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyHistory.length > 0 ? monthlyHistory.map((row, i) => (
                        <tr key={row.key} className="history-row">
                          <td>{row.label}</td>
                          <td className="cell-strong">{row.energy.toFixed(2)}</td>
                          <td>{row.powerCount ? (row.powerSum / row.powerCount).toFixed(0) : '---'}</td>
                          <td className="cell-highlight">{row.peakPower ? row.peakPower.toFixed(0) : '---'}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="4" className="muted-text">No monthly usage data available yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="charts-section">
                  <h3 className="panel-title">Monthly Energy Consumption</h3>
                  <Bar data={{
                    labels: monthlyHistory.map(m => m.label),
                    datasets: [{
                      label: 'Energy Consumed (kWh)',
                      data: monthlyHistory.map(m => m.energy),
                      backgroundColor: '#3b82f6',
                    }]
                  }} height={60} />
                </div>
                {monthlyHistory.length >= 2 && (
                  <div className="charts-section">
                    <h3 className="panel-title">Consumption Comparison (Last 2 Months)</h3>
                    <div className="comparison-chart">
                      <Bar data={{
                        labels: [monthlyHistory[1].label, monthlyHistory[0].label],
                        datasets: [{
                          label: 'Energy Consumed (kWh)',
                          data: [monthlyHistory[1].energy, monthlyHistory[0].energy],
                          backgroundColor: ['#22c55e', '#ef4444'],
                        }]
                      }} height={60} />
                      <div className="comparison-info">
                        <p><strong>Difference:</strong> {(monthlyHistory[0].energy - monthlyHistory[1].energy).toFixed(2)} kWh</p>
                        <p><strong>Percentage Change:</strong> {monthlyHistory[1].energy > 0 ? ((monthlyHistory[0].energy - monthlyHistory[1].energy) / monthlyHistory[1].energy * 100).toFixed(2) : 'N/A'}%</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentPage === 'reports' && (
              <div className="panel">
                <h2 className="panel-large-title">Reports</h2>
                
                {/* Date Filter Button and Display */}
                <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '200px' }}>
                    <div style={{ backgroundColor: '#18181b', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', border: '1px solid #27272a', flex: 1 }}>
                      <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: '0 0 0.25rem 0' }}>Selected Period</p>
                      <p style={{ color: '#60a5fa', fontSize: '1rem', fontWeight: '600', margin: 0 }}>{getFormattedDateRange()}</p>
                    </div>
                  </div>
                  <div style={{ position: 'relative' }} ref={calendarRef}>
                    <button
                      onClick={() => setShowCalendarPopup(!showCalendarPopup)}
                      style={{
                        padding: '0.75rem 1.5rem',
                        backgroundColor: '#1e40af',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.95rem',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => (e.target.style.backgroundColor = '#1e3a8a')}
                      onMouseLeave={(e) => (e.target.style.backgroundColor = '#1e40af')}
                    >
                      📅 Filter by Date
                    </button>

                    {/* Calendar Popup */}
                    {showCalendarPopup && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: '0.5rem',
                        backgroundColor: '#18181b',
                        border: '1px solid #27272a',
                        borderRadius: '0.75rem',
                        padding: '1.5rem',
                        minWidth: '320px',
                        zIndex: 100,
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                        maxHeight: '500px',
                        overflowY: 'auto'
                      }}>
                        {/* Mode Selection */}
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                          {['single', 'range', 'month', 'year'].map(mode => (
                            <button
                              key={mode}
                              onClick={(e) => {
                                e.stopPropagation();
                                setCalendarMode(mode);
                                setDateRangeStart(null);
                                setDateRangeEnd(null);
                              }}
                              style={{
                                flex: 1,
                                padding: '0.5rem',
                                backgroundColor: calendarMode === mode ? '#1e40af' : '#27272a',
                                color: '#e5e7eb',
                                border: '1px solid ' + (calendarMode === mode ? '#60a5fa' : '#404040'),
                                borderRadius: '0.375rem',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                transition: 'all 0.2s'
                              }}
                            >
                              {mode === 'single' ? 'Day' : mode === 'range' ? 'Range' : mode === 'month' ? 'Month' : 'Year'}
                            </button>
                          ))}
                        </div>

                        {/* Calendar/Month/Year Selection */}
                        {(calendarMode === 'single' || calendarMode === 'range') && (
                          <>
                            {/* Month Navigation */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1));
                                }}
                                style={{
                                  padding: '0.5rem 0.75rem',
                                  backgroundColor: '#27272a',
                                  color: '#e5e7eb',
                                  border: '1px solid #404040',
                                  borderRadius: '0.375rem',
                                  cursor: 'pointer',
                                  fontSize: '0.875rem'
                                }}
                              >
                                ←
                              </button>
                              <span style={{ color: '#e5e7eb', fontSize: '0.95rem', fontWeight: '600' }}>
                                {calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1));
                                }}
                                style={{
                                  padding: '0.5rem 0.75rem',
                                  backgroundColor: '#27272a',
                                  color: '#e5e7eb',
                                  border: '1px solid #404040',
                                  borderRadius: '0.375rem',
                                  cursor: 'pointer',
                                  fontSize: '0.875rem'
                                }}
                              >
                                →
                              </button>
                            </div>

                            {/* Calendar Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem', marginBottom: '1rem' }}>
                              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                                <div key={day} style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.7rem', fontWeight: '600', padding: '0.25rem' }}>
                                  {day}
                                </div>
                              ))}
                              {generateCalendarDays().map((day, index) => {
                                const dateStr = day ? (() => {
                                  const year = calendarMonth.getFullYear();
                                  const month = String(calendarMonth.getMonth() + 1).padStart(2, '0');
                                  const d = String(day).padStart(2, '0');
                                  return `${year}-${month}-${d}`;
                                })() : '';
                                const isSelected = dateStr === selectedReportDate;
                                const isRangeStart = dateStr === dateRangeStart;
                                const isRangeEnd = dateStr === dateRangeEnd;
                                const isInRange = isDateInRange(day);
                                
                                return (
                                  <div
                                    key={index}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (day) {
                                        handleCalendarDateSelect(day);
                                      }
                                    }}
                                    style={{
                                      aspectRatio: '1',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      borderRadius: '0.375rem',
                                      backgroundColor: isSelected ? '#1e40af' : isRangeStart || isRangeEnd ? '#1e40af' : isInRange ? '#3f3f46' : day ? '#27272a' : 'transparent',
                                      color: day ? (isSelected || isRangeStart || isRangeEnd ? '#fff' : '#e5e7eb') : '#6b7280',
                                      cursor: day ? 'pointer' : 'default',
                                      fontSize: '0.75rem',
                                      fontWeight: day ? '500' : '400',
                                      border: isSelected || isRangeStart || isRangeEnd ? '2px solid #60a5fa' : '1px solid #404040',
                                      transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => day && !isSelected && !isRangeStart && !isRangeEnd && (e.target.style.backgroundColor = '#3f3f46')}
                                    onMouseLeave={(e) => day && !isSelected && !isRangeStart && !isRangeEnd && (e.target.style.backgroundColor = isInRange ? '#3f3f46' : '#27272a')}
                                  >
                                    {day}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Apply Button for Range Mode */}
                            {calendarMode === 'range' && dateRangeStart && dateRangeEnd && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowCalendarPopup(false);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '0.75rem',
                                  backgroundColor: '#22c55e',
                                  color: '#000',
                                  border: 'none',
                                  borderRadius: '0.375rem',
                                  cursor: 'pointer',
                                  fontWeight: '600',
                                  fontSize: '0.875rem'
                                }}
                              >
                                Apply Range
                              </button>
                            )}
                          </>
                        )}

                        {calendarMode === 'month' && (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCalendarMonth(new Date(calendarMonth.getFullYear() - 1, calendarMonth.getMonth()));
                                }}
                                style={{
                                  padding: '0.5rem 0.75rem',
                                  backgroundColor: '#27272a',
                                  color: '#e5e7eb',
                                  border: '1px solid #404040',
                                  borderRadius: '0.375rem',
                                  cursor: 'pointer',
                                  fontSize: '0.875rem'
                                }}
                              >
                                ←
                              </button>
                              <span style={{ color: '#e5e7eb', fontSize: '0.95rem', fontWeight: '600' }}>{calendarMonth.getFullYear()}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCalendarMonth(new Date(calendarMonth.getFullYear() + 1, calendarMonth.getMonth()));
                                }}
                                style={{
                                  padding: '0.5rem 0.75rem',
                                  backgroundColor: '#27272a',
                                  color: '#e5e7eb',
                                  border: '1px solid #404040',
                                  borderRadius: '0.375rem',
                                  cursor: 'pointer',
                                  fontSize: '0.875rem'
                                }}
                              >
                                →
                              </button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, idx) => (
                                <button
                                  key={month}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCalendarMonth(new Date(calendarMonth.getFullYear(), idx));
                                    handleCalendarMonthSelect();
                                  }}
                                  style={{
                                    padding: '0.75rem',
                                    backgroundColor: calendarMonth.getMonth() === idx ? '#1e40af' : '#27272a',
                                    color: '#e5e7eb',
                                    border: calendarMonth.getMonth() === idx ? '1px solid #60a5fa' : '1px solid #404040',
                                    borderRadius: '0.375rem',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                    fontWeight: '600'
                                  }}
                                >
                                  {month}
                                </button>
                              ))}
                            </div>
                          </>
                        )}

                        {calendarMode === 'year' && (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCalendarMonth(new Date(calendarMonth.getFullYear() - 10, calendarMonth.getMonth()));
                                }}
                                style={{
                                  padding: '0.5rem 0.75rem',
                                  backgroundColor: '#27272a',
                                  color: '#e5e7eb',
                                  border: '1px solid #404040',
                                  borderRadius: '0.375rem',
                                  cursor: 'pointer',
                                  fontSize: '0.875rem'
                                }}
                              >
                                ←
                              </button>
                              <span style={{ color: '#e5e7eb', fontSize: '0.95rem', fontWeight: '600' }}>
                                {calendarMonth.getFullYear()}-{calendarMonth.getFullYear() + 9}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCalendarMonth(new Date(calendarMonth.getFullYear() + 10, calendarMonth.getMonth()));
                                }}
                                style={{
                                  padding: '0.5rem 0.75rem',
                                  backgroundColor: '#27272a',
                                  color: '#e5e7eb',
                                  border: '1px solid #404040',
                                  borderRadius: '0.375rem',
                                  cursor: 'pointer',
                                  fontSize: '0.875rem'
                                }}
                              >
                                →
                              </button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                              {Array.from({ length: 10 }, (_, i) => calendarMonth.getFullYear() - 5 + i).map((year) => (
                                <button
                                  key={year}
                                  onClick={() => {
                                    setCalendarMonth(new Date(year, 0));
                                    handleCalendarYearSelect();
                                  }}
                                  style={{
                                    padding: '0.75rem',
                                    backgroundColor: calendarMonth.getFullYear() === year ? '#1e40af' : '#27272a',
                                    color: '#e5e7eb',
                                    border: calendarMonth.getFullYear() === year ? '1px solid #60a5fa' : '1px solid #404040',
                                    borderRadius: '0.375rem',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                    fontWeight: '600'
                                  }}
                                >
                                  {year}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="reports-toolbar">
                  <div className="report-tabs flex flex-wrap gap-2">
                    {reportTabLabels.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        className={`report-tab-button ${reportTab === tab.key ? 'active' : ''} px-4 py-2 text-sm sm:text-base`}
                        onClick={() => setReportTab(tab.key)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="report-selector">
                    <label className="report-selector-label text-sm sm:text-base">Select {reportPeriodLabel}:</label>
                    <select
                      value={selectedPeriodValue}
                      onChange={(e) => setSelectedPeriodValue(e.target.value)}
                      className="report-select h-12 text-base w-full sm:w-auto"
                    >
                      {selectedPeriodOptions.length > 0 ? selectedPeriodOptions.map((option) => (
                        <option key={option.key} value={option.key}>{option.label}</option>
                      )) : (
                        <option value="">No periods available</option>
                      )}
                    </select>
                  </div>
                </div>

                {reportData ? (
                  <>
                    <div className="report-download-button-row">
                      <button
                        type="button"
                        className="btn-primary px-4 py-2 text-sm sm:text-base"
                        onClick={handleDownloadPDF}
                      >
                        📥 Download as PDF
                      </button>
                      <button
                        type="button"
                        className="btn-primary px-4 py-2 text-sm sm:text-base"
                        onClick={() => setShowSaveReportModal(true)}
                        disabled={saveReportLoading}
                      >
                        {saveReportLoading ? '💾 Saving...' : '💾 Save Report'}
                      </button>
                    </div>
                    <div className="report-summary" ref={reportRef}>
                      <div className="insights-section">
                        <div className="mb-4">
                          <h3 className="panel-title">{reportTitleLabel}</h3>
                          <p className="text-gray-400 text-sm mt-1">Generated for: <span className="font-semibold text-gray-300">{user.name}</span></p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                          <div className="insight-card insight-card--total">
                            <div className="insight-header">
                              <span className="insight-icon">📈</span>
                              <h4>Total Consumption</h4>
                            </div>
                            <div className="insight-content">
                              <div className="total-energy-display">
                                <span className="total-energy-amount">{reportEnergyMessage}</span>
                                <span className="total-energy-label">Energy Consumed</span>
                              </div>
                              <div className="total-cost-display">
                                <span className="total-cost-amount">KES {reportData.totalCost}</span>
                                <span className="total-cost-label">Total Cost</span>
                              </div>
                            </div>
                          </div>
                          <div className="insight-card insight-card--energy">
                            <div className="insight-header">
                              <span className="insight-icon">⚡</span>
                              <h4>Energy Summary</h4>
                            </div>
                            <div className="insight-content">
                              <p className="comparison-text">Average Power: {reportAveragePowerMessage}</p>
                            </div>
                          </div>
                          <div className="insight-card insight-card--peak">
                            <div className="insight-header">
                              <span className="insight-icon">🔺</span>
                              <h4>Peak Usage</h4>
                            </div>
                            <div className="insight-content">
                              <p className="comparison-text">{reportPeakPowerMessage}</p>
                            </div>
                          </div>
                          <div className="insight-card insight-card--cost">
                            <div className="insight-header">
                              <span className="insight-icon"></span>
                              <h4>Total Cost Accumulated</h4>
                            </div>
                            <div className="insight-content">
                              <div className="cost-display">
                                <span className="cost-amount">{reportEnergyMessage}</span>
                                <span className="cost-period">consumed</span>
                              </div>
                              <div className="cost-display" style={{ marginTop: '10px' }}>
                                <span className="cost-amount">{reportCostMessage}</span>
                                <span className="cost-period">total cost</span>
                              </div>
                              <p className="comparison-text">@ KES {reportData?.costPerUnit} per kWh</p>
                            </div>
                          </div>
                          <div className="insight-card insight-card--comparison">
                            <div className="insight-header">
                              <span className="insight-icon">📊</span>
                              <h4>Period Comparison</h4>
                            </div>
                            <div className="insight-content">
                              <p className="comparison-text">{reportCompareMessage}</p>
                            </div>
                          </div>
                        </div>
                        <div className="report-content-grid flex flex-col md:flex-row gap-6">
                          <div className="report-section report-section--chart flex-1">
                            <h4 className="section-title text-base sm:text-lg">Consumption Trend</h4>
                            <div style={{ height: '350px', width: '100%' }}>
                              <Bar data={reportChartData} options={reportChartOptions} />
                            </div>
                          </div>
                          <div className="report-section report-section--table flex-1">
                            <h4 className="section-title text-base sm:text-lg">Detailed Usage</h4>
                            <div className="table-responsive overflow-x-auto">
                              <table className="report-table w-full text-sm sm:text-base">
                                <thead>
                                  <tr>
                                    <th className="px-2 py-1">Date / Time</th>
                                    <th className="px-2 py-1">Energy (kWh)</th>
                                    <th className="px-2 py-1">Power (W)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {reportRows.length > 0 ? reportRows.map((row, index) => (
                                    <tr key={index}>
                                      <td className="px-2 py-1">{row.timestamp}</td>
                                      <td className="px-2 py-1">{row.energy}</td>
                                      <td className="px-2 py-1">{row.averagePower}</td>
                                    </tr>
                                  )) : (
                                    <tr>
                                      <td colSpan="3" className="muted-text px-2 py-1">No data available for this period.</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="panel panel--empty">
                    <p>{reportNoDataMessage}</p>
                  </div>
                )}

                {/* Saved Reports Section */}
                {savedReports.length > 0 && (
                  <div className="mt-8">
                    <h3 className="panel-title mb-4">📚 Saved Reports</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {savedReports.map((report) => (
                        <div key={report.id} className="insight-card p-4 border border-gray-600 rounded">
                          <h4 className="font-bold mb-2">{report.report_type.charAt(0).toUpperCase() + report.report_type.slice(1)} Report</h4>
                          <p className="text-sm text-gray-400 mb-2">
                            📅 {new Date(report.report_date).toLocaleDateString()}
                          </p>
                          <div className="text-sm space-y-1 mb-3">
                            <p>💡 Energy: {safeToFixed(report.total_energy, 2)} kWh</p>
                            <p>⚡ Avg Power: {safeToFixed(report.average_power, 0)} W</p>
                            <p>🔝 Peak Power: {safeToFixed(report.peak_power, 0)} W</p>
                            <p>💰 Total Cost: KES {safeToFixed(report.estimated_cost, 2)}</p>
                          </div>
                          <button
                            type="button"
                            className="btn-primary w-full py-1 text-xs"
                            onClick={() => {
                              // Load saved report data
                              const savedData = {
                                title: `${report.report_type.charAt(0).toUpperCase() + report.report_type.slice(1)} Report - ${new Date(report.report_date).toLocaleDateString()}`,
                                totalEnergy: report.total_energy,
                                averagePower: report.average_power,
                                peakPower: report.peak_power,
                                estimatedCost: report.estimated_cost,
                                chartData: report.data
                              };
                              alert('Report loaded: ' + savedData.title);
                            }}
                          >
                            📂 View Report
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Save Report Modal */}
            {showSaveReportModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-gray-900 p-6 rounded-lg max-w-sm w-full mx-4">
                  <h3 className="text-lg font-bold mb-4">Save Report</h3>
                  <p className="text-gray-300 mb-4">
                    This report will be saved to your account and can be accessed later from the Saved Reports section.
                  </p>
                  <p className="text-sm text-gray-400 mb-6">
                    <strong>Report Type:</strong> {reportTab.charAt(0).toUpperCase() + reportTab.slice(1)}<br/>
                    <strong>Date:</strong> {new Date().toLocaleString()}<br/>
                    <strong>Total Energy:</strong> {reportData?.totalEnergy} kWh
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      className="btn-secondary flex-1 py-2"
                      onClick={() => setShowSaveReportModal(false)}
                      disabled={saveReportLoading}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn-primary flex-1 py-2"
                      onClick={saveReportToDatabase}
                      disabled={saveReportLoading}
                    >
                      {saveReportLoading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {currentPage === 'settings' && (
              <div className="panel">
                <div className="settings-content">
                  <div className="setting-group">
                    <h3>User Profile</h3>
                    <p><strong>Name:</strong> {user.name}</p>
                    <p><strong>Email:</strong> {user.email}</p>
                  </div>
                  <div className="setting-group">
                    <h3>Device Settings</h3>
                    <label>
                      Power Threshold (W): <input type="number" placeholder="1500" />
                    </label>
                    <label>
                      Voltage Calibration: <input type="number" step="0.1" placeholder="1.0" />
                    </label>
                  </div>
                  <div className="setting-group">
                    <h3>WiFi Connectivity</h3>
                    {wifiStatus ? (
                      <>
                        <div className="wifi-status-row">
                          <span className="wifi-status-label">Connection Status:</span>
                          <span className={`wifi-status-pill ${wifiStatus === 'Connected' ? 'wifi-status-pill--green' : 'wifi-status-pill--red'}`}>
                            {wifiStatus}
                          </span>
                        </div>
                        <p className="wifi-current">
                          {wifiStatus === 'Connected'
                            ? `Connected to: ${wifiSsid}`
                            : 'Not connected to any network'}
                        </p>
                      </>
                    ) : (
                      <p className="wifi-current wifi-current--placeholder">
                        Enter network credentials and connect to configure WiFi.
                      </p>
                    )}
                    <label>
                      WiFi SSID:
                      <input
                        type="text"
                        value={wifiSsidInput}
                        onChange={(e) => setWifiSsidInput(e.target.value)}
                        placeholder="Enter SSID"
                      />
                    </label>
                    <label>
                      WiFi Password:
                      <input
                        type="password"
                        value={wifiPasswordInput}
                        onChange={(e) => setWifiPasswordInput(e.target.value)}
                        placeholder="Enter Password"
                      />
                    </label>
                    <div className="wifi-button-row">
                      <button type="button" className="btn-primary" onClick={handleWifiConnect} disabled={wifiLoading}>
                        {wifiLoading ? 'Connecting...' : 'Connect'}
                      </button>
                      {wifiStatus === 'Connected' && (
                        <button type="button" className="btn-secondary" onClick={handleWifiDisconnect}>
                          Disconnect
                        </button>
                      )}
                    </div>
                    {wifiMessage && (
                      <p className={`wifi-message ${wifiMessageType === 'success' ? 'wifi-message--success' : wifiMessageType === 'warning' ? 'wifi-message--warning' : 'wifi-message--error'}`}>
                        {wifiMessage}
                      </p>
                    )}
                  </div>
                  <div className="setting-group">
                    <h3>Notifications</h3>
                    <label>
                      <input type="checkbox" /> Enable high power alerts
                    </label>
                    <label>
                      <input type="checkbox" /> Enable daily reports
                    </label>
                  </div>
                  <div className="setting-group">
                    <h3>Data & Privacy</h3>
                    <label>
                      Data Retention (days): <input type="number" placeholder="30" />
                    </label>
                    <button className="btn-primary">Save Settings</button>
                  </div>
                </div>
              </div>
            )}

            {currentPage === 'help' && (
              <div className="panel">
                <h2 className="panel-large-title">Help & Support</h2>
                <div className="help-content">
                  <div className="help-section">
                    <h3>Getting Started</h3>
                    <p>Welcome to IoT Energy Monitoring! This app helps you track your energy usage in real-time.</p>
                    <ul>
                      <li><strong>Dashboard:</strong> View current power, voltage, and real-time graphs.</li>
                      <li><strong>Usage History:</strong> Check monthly energy consumption data.</li>
                      <li><strong>Settings:</strong> Configure device thresholds and notifications.</li>
                    </ul>
                  </div>
                  <div className="help-section">
                    <h3>FAQs</h3>
                    <div className="faq-item">
                      <h4>How do I connect my device?</h4>
                      <p>Ensure your ESP32 device is powered on and connected to the same network. The app will automatically detect and sync data.</p>
                    </div>
                    <div className="faq-item">
                      <h4>Why is the data not updating?</h4>
                      <p>Check your internet connection and device status. If issues persist, restart the device and refresh the app.</p>
                    </div>
                    <div className="faq-item">
                      <h4>How to set up alerts?</h4>
                      <p>Go to Settings Notifications and enable high power alerts or daily reports.</p>
                    </div>
                  </div>
                  <div className="help-section">
                    <h3>Contact Support</h3>
                    <p>If you need further assistance, contact our support team:</p>
                    <p><strong>Email:</strong> support@iotenergy.com</p>
                    <p><strong>Phone:</strong> 1-800-ENERGY</p>
                    <p><strong>Website:</strong> www.iotenergy.com/support</p>
                  </div>
                </div>
              </div>
            )}

            {currentPage === 'copilot' && (
              <div className="panel copilot-panel" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', maxHeight: 'calc(100vh - 120px)' }}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <h2 className="panel-large-title">🤖 AI Copilot</h2>
                  <p className="text-gray-400 text-sm">Get insights about your energy consumption</p>
                </div>

                {/* Messages Container */}
                <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1.5rem', paddingRight: '0.5rem' }} className="chat-messages">
                  {chatMessages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#9ca3af', paddingTop: '3rem' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💬</div>
                      <p>Start a conversation about your energy usage</p>
                      <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Ask about consumption, costs, savings tips, and more</p>
                    </div>
                  ) : (
                    chatMessages.map((msg) => (
                      <div 
                        key={msg.id}
                        style={{
                          marginBottom: '1rem',
                          display: 'flex',
                          justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start'
                        }}
                      >
                        <div
                          style={{
                            maxWidth: '75%',
                            padding: '0.75rem 1rem',
                            borderRadius: '1rem',
                            backgroundColor: msg.sender === 'user' ? '#1e40af' : '#27272a',
                            color: msg.sender === 'user' ? '#fff' : '#e5e7eb',
                            border: msg.sender === 'user' ? '1px solid #1e3a8a' : '1px solid #52525b',
                            wordWrap: 'break-word',
                            whiteSpace: 'pre-wrap'
                          }}
                        >
                          <p style={{ margin: 0, fontSize: '0.95rem' }}>{msg.text}</p>
                          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', opacity: '0.7' }}>{msg.timestamp}</p>
                        </div>
                      </div>
                    ))
                  )}
                  {chatLoading && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1rem' }}>
                      <div style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '1rem',
                        backgroundColor: '#27272a',
                        color: '#9ca3af',
                        border: '1px solid #52525b'
                      }}>
                        <span style={{ animation: 'pulse 1.5s infinite' }}>Thinking...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input Area */}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Ask about your energy usage..."
                    disabled={chatLoading}
                    style={{
                      flex: 1,
                      padding: '0.75rem 1rem',
                      borderRadius: '0.5rem',
                      backgroundColor: '#18181b',
                      border: '1px solid #404040',
                      color: '#fff',
                      fontSize: '0.95rem',
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={chatLoading || !chatInput.trim()}
                    style={{
                      padding: '0.75rem 1.5rem',
                      borderRadius: '0.5rem',
                      backgroundColor: chatLoading ? '#3f3f46' : '#1e40af',
                      color: '#fff',
                      border: 'none',
                      cursor: chatLoading ? 'not-allowed' : 'pointer',
                      fontWeight: '600',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => !chatLoading && (e.target.style.backgroundColor = '#1e3a8a')}
                    onMouseLeave={(e) => !chatLoading && (e.target.style.backgroundColor = '#1e40af')}
                  >
                    📤
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Auth Pages */
        <div className="login-container">
          <div className="login-panel">
            <h1 className="login-title">IoT Energy Monitoring</h1>
            <div className="auth-toggle">
              <button 
                type="button"
                className={`auth-tab ${authMode === 'login' ? 'active' : ''}`}
                onClick={() => {
                  setAuthMode('login');
                  setLoginGeneralError('');
                  setSignupGeneralError('');
                }}
              >
                Sign In
              </button>
              <button 
                type="button"
                className={`auth-tab ${authMode === 'signup' ? 'active' : ''}`}
                onClick={() => {
                  setAuthMode('signup');
                  setLoginGeneralError('');
                  setSignupGeneralError('');
                }}
              >
                Sign Up
              </button>
            </div>

            {authMode === 'login' ? (
              <>
                <p className="login-subtitle">Sign in to your account</p>
                
                {loginGeneralError && (
                  <div className="form-general-error bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm mb-4">
                    {loginGeneralError}
                  </div>
                )}

                <form className="login-form" onSubmit={handleLogin}>
                  {/* Email Field */}
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className={`form-input ${loginErrors.email ? 'form-input--error' : ''}`}
                      value={loginEmail}
                      onChange={(e) => {
                        setLoginEmail(e.target.value);
                        if (loginErrors.email) setLoginErrors({ ...loginErrors, email: '' });
                      }}
                      placeholder="Enter your email"
                      disabled={loginLoading}
                    />
                    {loginErrors.email && (
                      <p className="form-error-message text-red-400 text-sm mt-1">{loginErrors.email}</p>
                    )}
                  </div>

                  {/* Password Field */}
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <div className="form-password-wrapper relative">
                      <input
                        type={showLoginPassword ? 'text' : 'password'}
                        className={`form-input pr-10 ${loginErrors.password ? 'form-input--error' : ''}`}
                        value={loginPassword}
                        onChange={(e) => {
                          setLoginPassword(e.target.value);
                          if (loginErrors.password) setLoginErrors({ ...loginErrors, password: '' });
                        }}
                        placeholder="Enter your password"
                        disabled={loginLoading}
                      />
                      <button
                        type="button"
                        className="form-password-toggle absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 focus:outline-none"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        disabled={loginLoading}
                        tabIndex="-1"
                      >
                        {showLoginPassword ? '👁️' : '👁️‍🗨️'}
                      </button>
                    </div>
                    {loginErrors.password && (
                      <p className="form-error-message text-red-400 text-sm mt-1">{loginErrors.password}</p>
                    )}
                  </div>

                  <button 
                    type="submit" 
                    className={`btn-primary w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${loginLoading ? 'opacity-75 cursor-not-allowed' : 'hover:bg-blue-600'}`}
                    disabled={loginLoading}
                  >
                    {loginLoading ? 'Signing in...' : 'Sign In'}
                  </button>
                </form>
                <p className="auth-link text-center mt-4">
                  Don't have an account? <button type="button" onClick={() => { setAuthMode('signup'); setLoginGeneralError(''); }} className="link-button text-blue-400 hover:text-blue-300">Sign up here</button>
                </p>
              </>
            ) : (
              <>
                <p className="login-subtitle">Create a new account</p>
                
                {signupGeneralError && (
                  <div className="form-general-error bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm mb-4">
                    {signupGeneralError}
                  </div>
                )}

                <form className="login-form" onSubmit={handleSignup}>
                  {/* Name Field */}
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input
                      type="text"
                      className={`form-input ${signupErrors.name ? 'form-input--error' : ''}`}
                      value={signupName}
                      onChange={(e) => {
                        setSignupName(e.target.value);
                        if (signupErrors.name) setSignupErrors({ ...signupErrors, name: '' });
                      }}
                      placeholder="Enter your full name"
                      disabled={signupLoading}
                    />
                    {signupErrors.name && (
                      <p className="form-error-message text-red-400 text-sm mt-1">{signupErrors.name}</p>
                    )}
                  </div>

                  {/* Email Field */}
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className={`form-input ${signupErrors.email ? 'form-input--error' : ''}`}
                      value={signupEmail}
                      onChange={(e) => {
                        setSignupEmail(e.target.value);
                        if (signupErrors.email) setSignupErrors({ ...signupErrors, email: '' });
                      }}
                      placeholder="Enter your email"
                      disabled={signupLoading}
                    />
                    {signupErrors.email && (
                      <p className="form-error-message text-red-400 text-sm mt-1">{signupErrors.email}</p>
                    )}
                  </div>

                  {/* Password Field */}
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <div className="form-password-wrapper relative">
                      <input
                        type={showSignupPassword ? 'text' : 'password'}
                        className={`form-input pr-10 ${signupErrors.password ? 'form-input--error' : ''}`}
                        value={signupPassword}
                        onChange={(e) => {
                          setSignupPassword(e.target.value);
                          if (signupErrors.password) setSignupErrors({ ...signupErrors, password: '' });
                        }}
                        placeholder="At least 8 chars, uppercase, lowercase & number"
                        disabled={signupLoading}
                      />
                      <button
                        type="button"
                        className="form-password-toggle absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 focus:outline-none"
                        onClick={() => setShowSignupPassword(!showSignupPassword)}
                        disabled={signupLoading}
                        tabIndex="-1"
                      >
                        {showSignupPassword ? '👁️' : '👁️‍🗨️'}
                      </button>
                    </div>
                    {signupErrors.password && (
                      <p className="form-error-message text-red-400 text-sm mt-1">{signupErrors.password}</p>
                    )}
                  </div>

                  {/* Confirm Password Field */}
                  <div className="form-group">
                    <label className="form-label">Confirm Password</label>
                    <div className="form-password-wrapper relative">
                      <input
                        type={showSignupConfirmPassword ? 'text' : 'password'}
                        className={`form-input pr-10 ${signupErrors.confirmPassword ? 'form-input--error' : ''}`}
                        value={signupConfirmPassword}
                        onChange={(e) => {
                          setSignupConfirmPassword(e.target.value);
                          if (signupErrors.confirmPassword) setSignupErrors({ ...signupErrors, confirmPassword: '' });
                        }}
                        placeholder="Re-enter your password"
                        disabled={signupLoading}
                      />
                      <button
                        type="button"
                        className="form-password-toggle absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 focus:outline-none"
                        onClick={() => setShowSignupConfirmPassword(!showSignupConfirmPassword)}
                        disabled={signupLoading}
                        tabIndex="-1"
                      >
                        {showSignupConfirmPassword ? '👁️' : '👁️‍🗨️'}
                      </button>
                    </div>
                    {signupErrors.confirmPassword && (
                      <p className="form-error-message text-red-400 text-sm mt-1">{signupErrors.confirmPassword}</p>
                    )}
                  </div>

                  <button 
                    type="submit" 
                    className={`btn-primary w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${signupLoading ? 'opacity-75 cursor-not-allowed' : 'hover:bg-blue-600'}`}
                    disabled={signupLoading}
                  >
                    {signupLoading ? 'Creating account...' : 'Sign Up'}
                  </button>
                </form>
                <p className="auth-link text-center mt-4">
                  Already have an account? <button type="button" onClick={() => { setAuthMode('login'); setSignupGeneralError(''); }} className="link-button text-blue-400 hover:text-blue-300">Sign in here</button>
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;