import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore'; 

// --- CONFIGURACIÓN Y CONSTANTES ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null; 
// START_DATE_STRING ha sido movido a un estado dinámico.

// --- UTILITIES PARA FECHAS Y FORMATO ---

/**
 * Convierte un objeto Date a formato 'YYYY-MM-DD'.
 */
const formatDate = (date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Devuelve un array de días del mes dado.
 */
const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
        days.push(new Date(d)); 
    }
    return days;
};

/**
 * Devuelve un array de los 7 nombres de los días de la semana (Lunes-Domingo).
 */
const getWeekdayNames = (locale = 'es-ES') => {
    const format = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    const days = [];
    // 2023-01-02 es Lunes
    for (let i = 2; i <= 8; i++) { 
        const date = new Date(2023, 0, i); 
        days.push(format.format(date).charAt(0).toUpperCase() + format.format(date).slice(1));
    }
    return days.map(d => d.slice(0, 3)); // Solo las 3 primeras letras (Lun, Mar, etc.)
};

/**
 * Función central de cálculo de Puntuación y Racha (Lógica de racha creciente).
 * AHORA RECIBE startDateString como argumento.
 */
const calculateScoreAndStreak = (failedDays, startDateString) => {
    let totalScore = 0; // Se mantiene en céntimos (puntos) para el cálculo
    let consecutiveDays = 0; // Racha de días logrados
    let currentStreak = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Usa la fecha de inicio dinámica
    const startDate = new Date(startDateString);
    startDate.setHours(0, 0, 0, 0);
    
    if (startDate > today) {
        return { score: 0, currentStreak: 0 };
    }

    let currentDate = new Date(startDate);

    // Iterar día por día desde la fecha de inicio hasta HOY (inclusive)
    while (currentDate <= today) {
        const dateKey = formatDate(currentDate);
        const isFailed = !!failedDays[dateKey];

        if (isFailed) {
            // Regla Derrota: No se resta nada, la racha se reinicia.
            consecutiveDays = 0;
        } else {
            // Regla Éxito:
            // 1. La puntuación del día es igual a la racha anterior (consecutiveDays)
            totalScore += consecutiveDays;
            // 2. La racha de consecutivos se incrementa para el siguiente día
            consecutiveDays += 1;
        }

        // Determinar la racha actual (al final del bucle será el valor de hoy)
        if (formatDate(currentDate) === formatDate(today)) {
            currentStreak = consecutiveDays; 
        }

        currentDate.setDate(currentDate.getDate() + 1);
    }

    return { score: totalScore, currentStreak: currentStreak };
};

/**
 * Función de ayuda para validar el formato 'YYYY-MM-DD'
 */
const isValidDateString = (dateString) => {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;

    const parts = dateString.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10); // 1-indexed month
    const day = parseInt(parts[2], 10);

    // Crear un objeto de fecha en UTC para evitar problemas de zona horaria
    const date = new Date(Date.UTC(year, month - 1, day));
    
    // Comprobar si la fecha resultante es válida y si sus componentes UTC coinciden con los de entrada.
    return !isNaN(date.getTime()) &&
           date.getUTCFullYear() === year &&
           date.getUTCFullYear() === year &&
           date.getUTCMonth() === month - 1 && 
           date.getUTCDate() === day;
};


// --- SUB-COMPONENTES DE UI ---

/**
 * Componente del Menú Desplegable de Configuración
 * AHORA incluye el selector de fecha de inicio.
 */
const SettingsDropdown = ({ 
    exportToJson, 
    importFromJson, 
    closeDropdown, 
    startDateString, 
    onStartDateChange 
}) => {
    const fileInputRef = useRef(null);
    
    const handleImportClick = () => {
        fileInputRef.current?.click();
    };
    
    const handleFileSelect = (event) => {
        importFromJson(event);
        closeDropdown();
    };

    return (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl ring-1 ring-black ring-opacity-5 z-20">
            <div className="py-1">
                <span className="block px-4 py-2 text-xs text-gray-400 font-semibold uppercase">Gestión de Datos</span>
                
                <button
                    onClick={() => { exportToJson(); closeDropdown(); }}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                    <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11l-3 3-3-3m4 8v-6a4 4 0 00-8 0v6m12 0h2a2 2 0 002-2v-3a2 2 0 00-2-2H9"></path></svg>
                    Exportar a JSON
                </button>

                <button
                    onClick={handleImportClick}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                    <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
                    Importar JSON
                </button>
                
                <input
                    type="file"
                    ref={fileInputRef}
                    accept=".json" 
                    onChange={handleFileSelect} 
                    className="hidden"
                />

                {/* NUEVO: Selector de Fecha de Inicio */}
                <div className="border-t border-gray-100 my-1"></div>
                <span className="block px-4 py-2 text-xs text-gray-400 font-semibold uppercase">Configuración</span>
                <div className="px-4 py-3">
                    <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                        Fecha de Inicio
                    </label>
                    <input
                        type="date"
                        id="startDate"
                        value={startDateString}
                        onChange={onStartDateChange}
                        className="mt-1 w-full p-1.5 border border-gray-300 rounded-md text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
            </div>
        </div>
    );
};

/**
 * Componente para mostrar la Puntuación y Racha
 */
const ScoreCard = ({ formattedMoney, currentStreak, isDataLoaded }) => (
    <div className="flex justify-around items-center space-x-4 mb-6">
        <div className="flex flex-col items-center p-3 bg-indigo-50 rounded-lg w-1/2 shadow-sm">
            <span className="text-xs font-medium text-gray-500">DINERO ACUMULADO</span>
            <span className="text-4xl font-extrabold text-indigo-600 mt-1">{isDataLoaded ? formattedMoney : '...'}</span>
        </div>
        <div className="flex flex-col items-center p-3 bg-green-50 rounded-lg w-1/2 shadow-sm">
            <span className="text-xs font-medium text-gray-500">RACHA ACTUAL</span>
            <span className="text-4xl font-extrabold text-green-600 mt-1">{isDataLoaded ? currentStreak : '...'}</span>
        </div>
    </div>
);

/**
 * Componente para la cabecera del calendario (Navegación)
 */
const CalendarHeader = ({ monthName, goToPrevMonth, goToNextMonth, isCalendarDisabled }) => (
    <div className="flex justify-between items-center mb-4">
        <button 
            onClick={goToPrevMonth}
            className={`p-2 rounded-full text-indigo-600 nav-button ${isCalendarDisabled ? 'opacity-50' : 'hover:bg-indigo-100'}`}
            disabled={isCalendarDisabled}
        >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
        </button>
        <h2 className="text-xl font-semibold text-gray-800 capitalize text-center">{monthName}</h2>
        <button 
            onClick={goToNextMonth}
            className={`p-2 rounded-full text-indigo-600 nav-button ${isCalendarDisabled ? 'opacity-50' : 'hover:bg-indigo-100'}`}
            disabled={isCalendarDisabled}
        >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
        </button>
    </div>
);

/**
 * Componente memorizado para un solo día del calendario.
 * Solo se vuelve a renderizar si sus props (dayInfo) cambian.
 */
const DayCell = React.memo(({ dayInfo, onDayClick, isDataLoaded }) => {
    const { date, dateString, isFailed, isToday, isFuture, isBeforeStart } = dayInfo;

    let contentClass = "";
    let circleClass = "bg-gray-100 text-gray-600";
    let statusText = "";
    let isClickable = true;

    if (isFuture) {
        contentClass = "bg-gray-50 text-gray-400 cursor-default";
        circleClass = "bg-transparent text-gray-300 border border-gray-200";
        isClickable = false;
    } else if (isBeforeStart) {
        contentClass = "bg-gray-200 text-gray-400 cursor-default opacity-50";
        circleClass = "bg-gray-300 text-gray-500";
        isClickable = false;
        statusText = "Inicio";
    } else if (isFailed) {
        contentClass = "bg-red-100 hover:bg-red-200 text-red-800 ring-2 ring-red-400";
        circleClass = "bg-red-500 text-white font-bold";
        statusText = "Derrota!";
    } else {
        contentClass = "neutral-state text-gray-800";
        circleClass = "bg-gray-100 text-gray-600 font-medium";
        statusText = "";
    }
    
    if (isToday && !isFuture && !isBeforeStart) {
        contentClass += " border-2 border-indigo-500 shadow-md";
    }

    // Deshabilita la interacción si los datos no han cargado.
    const finalClickable = isClickable && isDataLoaded;
    contentClass = finalClickable ? contentClass : `${contentClass} opacity-60 cursor-not-allowed`;

    return (
        <div className="day-cell p-1">
            <div
                className={`day-content ${contentClass} ${finalClickable ? 'active:scale-95' : ''}`}
                onClick={() => finalClickable && onDayClick(dateString)}
                role="button"
                aria-label={`Marcar día ${date.getDate()}`}
            >
                <div className={`w-6 h-6 rounded-full text-center text-sm ${circleClass} flex items-center justify-center mb-1`}>
                    {date.getDate()}
                </div>
                <span className="text-xs font-semibold">{statusText}</span>
                {isToday && <span className="text-xs font-bold text-indigo-700 absolute bottom-1">HOY</span>}
            </div>
        </div>
    );
});


// --- COMPONENTE PRINCIPAL ---

const App = () => {
    const [db, setDb] = useState(null);
    const [userId, setUserId] = useState(null);
    const [failedDays, setFailedDays] = useState({});
    
    // NUEVO: Fecha de inicio como estado, con un default.
    const [startDateString, setStartDateString] = useState('2025-10-06');

    // Estados de Carga
    const [isInitializing, setIsInitializing] = useState(true);
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    
    const [message, setMessage] = useState('');
    const [showSettings, setShowSettings] = useState(false); 
    
    // Estados "Local-First"
    const [isSaving, setIsSaving] = useState(false);
    const [needsSave, setNeedsSave] = useState(false);

    const today = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);
    
    const todayKey = useMemo(() => formatDate(today), [today]);
    // Objeto Date de la fecha de inicio (dinámico)
    const startDate = useMemo(() => new Date(startDateString), [startDateString]);

    const [currentViewDate, setCurrentViewDate] = useState(today);

    // Score (Memoizado) - AHORA DEPENDE DE startDateString
    const { score, currentStreak } = useMemo(
        () => calculateScoreAndStreak(failedDays, startDateString), 
        [failedDays, startDateString]
    );
    
    // Dinero (Memoizado)
    const formattedMoney = useMemo(() => {
        const euros = score / 100;
        return new Intl.NumberFormat('es-ES', { 
            style: 'currency', 
            currency: 'EUR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(euros);
    }, [score]);


    const daysInMonth = useMemo(() => getDaysInMonth(currentViewDate), [currentViewDate]);
    const weekdayNames = useMemo(() => getWeekdayNames('es-ES'), []);
    const monthName = useMemo(() => new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(currentViewDate), [currentViewDate]);

    // Pre-calcula los datos del calendario para optimizar el renderizado
    // AHORA DEPENDE DE startDate (dinámico)
    const calendarDays = useMemo(() => {
        const firstDayOfMonth = daysInMonth[0];
        const startOffset = (firstDayOfMonth.getDay() + 6) % 7; // Lunes=0, Domingo=6

        const offsetArray = Array(startOffset).fill(null).map((_, index) => ({
            isOffset: true,
            id: `offset-${index}`
        }));

        const daysArray = daysInMonth.map((date) => {
            const dateString = formatDate(date);
            return {
                isOffset: false,
                id: dateString,
                date,
                dateString,
                isFailed: !!failedDays[dateString],
                isToday: dateString === todayKey,
                isFuture: date > today,
                isBeforeStart: date < startDate // Usa el estado dinámico
            };
        });

        return [...offsetArray, ...daysArray];
    }, [daysInMonth, failedDays, today, todayKey, startDate]);

    // ------------------------------------------------------------------
    // 1. FUNCIONES DE CARGA Y AUTENTICACIÓN
    // ------------------------------------------------------------------

    useEffect(() => {
        if (!firebaseConfig || !Object.keys(firebaseConfig).length) {
            setMessage("Error: Configuración de Firebase no disponible.");
            setIsInitializing(false);
            return;
        }

        try {
            const app = initializeApp(firebaseConfig);
            const firestore = getFirestore(app);
            const authInstance = getAuth(app);
            
            setDb(firestore);

            const handleAuthAndLoad = async (user) => {
                let currentUserId = user ? user.uid : null;

                if (!currentUserId) {
                    try {
                        if (initialAuthToken) { 
                            const userCredential = await signInWithCustomToken(authInstance, initialAuthToken);
                            currentUserId = userCredential.user.uid;
                        } else {
                            const userCredential = await signInAnonymously(authInstance);
                            currentUserId = userCredential.user.uid;
                        }
                    } catch (error) {
                        console.error("Error en la autenticación:", error);
                        setMessage(`Error de Auth: ${error.message}`);
                        setIsInitializing(false); 
                        return;
                    }
                }
                
                setUserId(currentUserId);
                setIsInitializing(false); // Fin de la inicialización y muestra la UI
                
                if (firestore && currentUserId) {
                    await loadGoalData(firestore, currentUserId);
                }
            };
            
            const unsubscribe = onAuthStateChanged(authInstance, handleAuthAndLoad);
            return () => unsubscribe();
        } catch (e) {
            console.error("Error al inicializar Firebase:", e);
            setMessage(`Error al inicializar: ${e.message}`);
            setIsInitializing(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); 

    // AHORA CARGA TAMBIÉN la fecha de inicio
    const loadGoalData = useCallback(async (firestore, currentUserId) => {
        setMessage("Conectando y cargando datos...");
        const userDaysDocRef = doc(firestore, `artifacts/${appId}/users/${currentUserId}/goal_data`, 'day_records');
        try {
            const docSnap = await getDoc(userDaysDocRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setFailedDays(data.failedDays || {});
                // Carga la fecha de inicio guardada, o usa el default si no existe
                setStartDateString(data.startDateString || '2025-10-06');
            } else {
                // Si no existe el documento, usa los defaults
                setFailedDays({});
                setStartDateString('2025-10-06');
            }
            setIsDataLoaded(true);
            setMessage("Datos cargados correctamente.");
        } catch (err) {
            console.error("Error al cargar datos:", err);
            setMessage(`Error al cargar: ${err.message}.`);
            setIsDataLoaded(true); // Forzar a true para no bloquear
        }
    }, [appId]);


    // ------------------------------------------------------------------
    // 2. FUNCIONES DE NAVEGACIÓN Y EDICIÓN LOCAL
    // ------------------------------------------------------------------

    const goToPrevMonth = useCallback(() => {
        setCurrentViewDate(prevDate => {
            const newDate = new Date(prevDate);
            newDate.setMonth(newDate.getMonth() - 1);
            return newDate;
        });
    }, []);

    const goToNextMonth = useCallback(() => {
        setCurrentViewDate(prevDate => {
            const newDate = new Date(prevDate);
            newDate.setMonth(newDate.getMonth() + 1);
            return newDate;
        });
    }, []);

    const toggleDayStatus = useCallback((dateString) => {
        // No es necesario comprobar 'isFuture' aquí, DayCell ya lo previene.
        setFailedDays(currentFailedDays => {
            const newFailedDays = { ...currentFailedDays };
            if (!!newFailedDays[dateString]) {
                delete newFailedDays[dateString];
            } else {
                newFailedDays[dateString] = true;
            }
            return newFailedDays;
        });
        setNeedsSave(true);
    }, []); 

    // NUEVO: Manejador para el cambio de fecha de inicio
    const handleStartDateChange = useCallback((e) => {
        const newDateStr = e.target.value;
        
        if (!isValidDateString(newDateStr)) {
            setMessage("Formato de fecha no válido.");
            return;
        }
        
        const newDate = new Date(newDateStr);
        if (newDate > today) {
            setMessage("La fecha de inicio no puede ser en el futuro.");
            return;
        }

        setStartDateString(newDateStr);
        setNeedsSave(true);
        setMessage("Fecha de inicio actualizada. Pulsa 'Guardar Cambios'.");
    }, [today]);

    // ------------------------------------------------------------------
    // 3. FUNCIONES DE GUARDADO
    // ------------------------------------------------------------------

    // AHORA GUARDA TAMBIÉN la fecha de inicio
    const handleSave = useCallback(async () => {
        if (!db || !userId || !isDataLoaded) {
            setMessage("Error: No se puede guardar. La base de datos no está lista.");
            return;
        }

        setIsSaving(true);
        setMessage("Guardando cambios principales...");
        const userDaysDocRef = doc(db, `artifacts/${appId}/users/${userId}/goal_data`, 'day_records');

        try {
            // Guarda AMBOS estados
            const dataToSave = { 
                failedDays: failedDays,
                startDateString: startDateString 
            };
            await setDoc(userDaysDocRef, dataToSave, { merge: true });
            
            setIsSaving(false);
            setNeedsSave(false);
            setMessage("¡Cambios guardados en la nube!");
        } catch (error) {
            console.error("Error al guardar en Firestore:", error);
            setMessage(`Error al guardar: ${error.message}. Inténtalo de nuevo.`);
            setIsSaving(false);
        }
    }, [db, userId, failedDays, startDateString, isDataLoaded, appId]);


    // ------------------------------------------------------------------
    // 4. FUNCIONES DE IMPORTACIÓN/EXPORTACIÓN JSON
    // ------------------------------------------------------------------

    const exportToJson = useCallback(() => {
        const failedDatesArray = Object.keys(failedDays).sort();
        const jsonContent = JSON.stringify(failedDatesArray, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `GoalTracker_FailedDays_${formatDate(new Date())}.json`; 
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setMessage("¡Días fallidos exportados a JSON!");
    }, [failedDays]);
    

    const importFromJson = useCallback((event) => {
        const file = event.target.files[0];
        if (!file) return;

        setMessage("Importando archivo JSON...");
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const content = e.target.result;
            try {
                const importedArray = JSON.parse(content);
                if (!Array.isArray(importedArray)) {
                    setMessage("Error: El archivo JSON debe contener un Array de fechas.");
                    event.target.value = null;
                    return;
                }

                const importedFailedDays = {};
                let invalidCount = 0;
                let futureCount = 0;
                let totalDatesProcessed = 0;
                
                importedArray.forEach(item => {
                    totalDatesProcessed++;
                    const dateString = String(item).trim();

                    if (isValidDateString(dateString)) {
                        if (dateString <= todayKey) { 
                            importedFailedDays[dateString] = true;
                        } else {
                            futureCount++;
                        }
                    } else {
                        invalidCount++;
                    }
                });

                setFailedDays(importedFailedDays);
                setNeedsSave(true);
                
                let resultMessage = `Importación completada. Se cargaron ${Object.keys(importedFailedDays).length} días fallidos.`;
                const ignoredDates = invalidCount + futureCount;
                if (ignoredDates > 0) {
                    resultMessage += ` (${ignoredDates} fechas ignoradas: ${invalidCount} formato, ${futureCount} futuras.)`;
                } else {
                     resultMessage += ` (Se procesaron ${totalDatesProcessed} fechas.)`;
                }
                setMessage(resultMessage + " ¡Recuerda Guardar Cambios!");
            } catch (error) {
                setMessage(`Error al procesar el archivo JSON: ${error.message}`);
                console.error("Error al parsear JSON:", error);
            }
            event.target.value = null; 
        };
        reader.onerror = () => {
            setMessage("Error al leer el archivo.");
            event.target.value = null; 
        };
        reader.readAsText(file); 
    }, [todayKey]);


    // --- RENDERIZADO ---

    if (isInitializing) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-50">
                <p className="text-xl text-indigo-600 font-semibold">Iniciando aplicación...</p>
            </div>
        );
    }
    
    const isCalendarDisabled = !isDataLoaded;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4">
            <script src="https://cdn.tailwindcss.com"></script>
            <style jsx="true">{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
                body { font-family: 'Inter', sans-serif; }
                .day-cell {
                    width: 14.28%; 
                    padding-top: 14.28%; 
                    position: relative;
                }
                .day-content {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    border-radius: 0.5rem;
                }
                .day-content.neutral-state {
                    background-color: white;
                    border: 1px solid #e5e7eb; /* gray-200 */
                }
                .day-content.neutral-state:hover {
                    background-color: #f3f4f6; /* gray-100 */
                    box-shadow: none;
                }
                .nav-button:hover {
                    background-color: #e0e7ff;
                }
                @keyframes pulse-save {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.8; transform: scale(1.03); }
                }
                .pulse-save-button {
                    animation: pulse-save 2s infinite;
                    box-shadow: 0 0 15px rgba(99, 102, 241, 0.5); /* Sombra índigo */
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .save-spinner {
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-top: 2px solid #fff;
                    border-radius: 50%;
                    width: 1rem;
                    height: 1rem;
                    animation: spin 1s linear infinite;
                }
            `}</style>

            {/* Panel de Puntuación y Guardado Principal */}
            <div className="w-full max-w-md bg-white p-6 mb-4 rounded-xl shadow-lg border-t-4 border-indigo-500 relative">
                
                {/* Botón de Configuración y Dropdown */}
                <div className="absolute top-4 right-4 z-30">
                    <button 
                        onClick={() => setShowSettings(!showSettings)}
                        className="p-2 rounded-full text-indigo-600 hover:bg-indigo-100 transition-colors"
                        aria-expanded={showSettings}
                        disabled={isCalendarDisabled}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    </button>
                    {showSettings && !isCalendarDisabled && (
                        <SettingsDropdown 
                            exportToJson={exportToJson} 
                            importFromJson={importFromJson} 
                            closeDropdown={() => setShowSettings(false)}
                            // Pasa el estado y el manejador al dropdown
                            startDateString={startDateString}
                            onStartDateChange={handleStartDateChange}
                        />
                    )}
                </div>

                <h1 className="text-3xl font-extrabold text-indigo-700 mb-2 text-center">Rastrador de Metas</h1>
                <p className="text-sm text-gray-500 text-center mb-4">ID de Usuario: <span className="font-mono text-xs">{userId || 'Sin autenticar'}</span></p>

                {/* Componente de Puntuación */}
                <ScoreCard 
                    formattedMoney={formattedMoney}
                    currentStreak={currentStreak}
                    isDataLoaded={isDataLoaded}
                />
                
                {/* BOTÓN DE GUARDAR PRINCIPAL */}
                <div>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || isCalendarDisabled}
                        className={`w-full flex justify-center items-center px-4 py-3 rounded-lg text-white font-bold text-lg transition-all
                            ${(isSaving || isCalendarDisabled) ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}
                            ${needsSave && !isSaving && isDataLoaded ? 'pulse-save-button' : ''}
                        `}
                    >
                        {isSaving ? (
                            <>
                                <span className="save-spinner mr-2"></span>
                                Guardando...
                            </>
                        ) : (
                            isCalendarDisabled ? 'Cargando Datos...' : (needsSave ? 'Guardar Cambios' : 'Datos Sincronizados')
                        )}
                    </button>
                    {needsSave && !isSaving && isDataLoaded && (
                        <p className="text-center text-sm text-yellow-600 font-medium mt-2">¡Tienes cambios sin guardar!</p>
                    )}
                </div>
            </div>
            
            {/* Calendario */}
            <div className={`w-full max-w-md bg-white p-4 mb-4 rounded-xl shadow-lg transition-opacity duration-300 ${isCalendarDisabled ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                
                {/* Componente de Cabecera de Calendario */}
                <CalendarHeader 
                    monthName={monthName}
                    goToPrevMonth={goToPrevMonth}
                    goToNextMonth={goToNextMonth}
                    isCalendarDisabled={isCalendarDisabled}
                />

                {/* Encabezado de la semana */}
                <div className="grid grid-cols-7 text-center text-sm font-bold text-gray-600 mb-2">
                    {weekdayNames.map((day, index) => (
                        <div key={index} className="py-2">{day}</div>
                    ))}
                </div>

                {/* Días del mes (Ahora usa DayCell) */}
                <div className="flex flex-wrap">
                    {calendarDays.map((dayInfo) => (
                        dayInfo.isOffset ? (
                            <div key={dayInfo.id} className="day-cell"></div>
                        ) : (
                            <DayCell
                                key={dayInfo.id}
                                dayInfo={dayInfo}
                                onDayClick={toggleDayStatus}
                                isDataLoaded={isDataLoaded}
                            />
                        )
                    ))}
                </div>
                
                {/* Overlay de Carga */}
                {!isDataLoaded && (
                    <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center z-10 rounded-xl">
                        <div className="flex flex-col items-center">
                            <div className="save-spinner !border-t-indigo-600 !w-8 !h-8 mb-2"></div>
                            <p className="text-indigo-600 font-semibold">Cargando datos de la nube...</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Mensaje de estado/error */}
            {message && (
                <div className={`mt-4 p-3 w-full max-w-md rounded-lg ${message.startsWith('Error') ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'} text-sm text-center shadow`}>
                    {message}
                </div>
            )}
        </div>
    );
};

export default App;
